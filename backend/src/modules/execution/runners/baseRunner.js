import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { SUBMISSION_VERDICT } from '@codeathon/shared';

const execAsync = promisify(exec);

export class BaseRunner {
  createTempWorkspace(prefix = 'codeathon-run-') {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  }

  cleanupWorkspace(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
      // In Windows, files may temporarily be locked for a few ms after process exit
      setTimeout(() => {
        try {
          if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        } catch (_) {}
      }, 500);
    }
  }

  getSanitizedEnv() {
    const safeEnv = { ...process.env };
    // Strip sensitive secrets so candidate code cannot inspect process env for credentials
    delete safeEnv.MONGODB_URI;
    delete safeEnv.JWT_SECRET;
    delete safeEnv.JWT_ACCESS_SECRET;
    delete safeEnv.JWT_REFRESH_SECRET;
    delete safeEnv.SMTP_PASS;
    delete safeEnv.REDIS_URL;
    return safeEnv;
  }

  async runProcess({ command, args = [], cwd, input = '', timeLimitMs = 2000, maxBufferBytes = 512 * 1024 }) {
    const startTime = Date.now();
    const isWindows = process.platform === 'win32';

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;
      let outputLimitExceeded = false;

      const child = spawn(command, args, {
        cwd,
        env: this.getSanitizedEnv(),
        windowsHide: true,
      });

      const killProcessTree = () => {
        if (child.pid && !child.killed) {
          if (isWindows) {
            exec(`taskkill /pid ${child.pid} /T /F`, () => {});
          } else {
            try {
              child.kill('SIGKILL');
            } catch (_) {}
          }
        }
      };

      // Watchdog timeout timer (TLE)
      const timeoutTimer = setTimeout(() => {
        killed = true;
        killProcessTree();
        resolve({
          stdout: stdout.trim(),
          stderr: `Time Limit Exceeded: Process terminated after ${timeLimitMs}ms.`,
          verdict: SUBMISSION_VERDICT.TLE,
          timeMs: timeLimitMs,
          memoryKb: 0,
          exitCode: -1,
        });
      }, timeLimitMs);

      // Write stdin if provided
      if (input !== undefined && input !== null) {
        try {
          child.stdin.write(String(input));
        } catch (_) {}
      }
      try {
        child.stdin.end();
      } catch (_) {}

      // Capture stdout with buffer ceiling
      child.stdout.on('data', (chunk) => {
        if (stdout.length < maxBufferBytes) {
          stdout += chunk.toString();
        } else if (!outputLimitExceeded) {
          outputLimitExceeded = true;
          killProcessTree();
        }
      });

      // Capture stderr
      child.stderr.on('data', (chunk) => {
        if (stderr.length < maxBufferBytes) {
          stderr += chunk.toString();
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        resolve({
          stdout: stdout.trim(),
          stderr: `Process Execution Error: ${err.message}`,
          verdict: SUBMISSION_VERDICT.RUNTIME_ERROR,
          timeMs: Date.now() - startTime,
          memoryKb: 0,
          exitCode: -1,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        if (killed) return;

        const timeMs = Math.max(1, Date.now() - startTime);

        if (outputLimitExceeded) {
          return resolve({
            stdout: stdout.substring(0, 1000).trim(),
            stderr: 'Output Limit Exceeded: Program generated more than 512KB of output.',
            verdict: SUBMISSION_VERDICT.RUNTIME_ERROR,
            timeMs,
            memoryKb: 0,
            exitCode: -1,
          });
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          timeMs,
          memoryKb: 15000,
        });
      });
    });
  }
}
