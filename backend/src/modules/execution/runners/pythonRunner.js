import fs from 'fs';
import path from 'path';
import { BaseRunner } from './baseRunner.js';
import { SUBMISSION_VERDICT } from '@codeathon/shared';

export class PythonRunner extends BaseRunner {
  async execute({ code, input = '', timeLimitMs = 2000, memoryLimitMb = 256 }) {
    const workspace = this.createTempWorkspace('codeathon-py-');
    const scriptPath = path.join(workspace, 'solution.py');

    try {
      fs.writeFileSync(scriptPath, code, 'utf8');

      // Execute Python with -u for unbuffered binary stdout/stderr
      const result = await this.runProcess({
        command: 'python',
        args: ['-u', 'solution.py'],
        cwd: workspace,
        input,
        timeLimitMs,
      });

      if (result.verdict) {
        return result;
      }

      if (result.exitCode !== 0) {
        const isSyntax =
          result.stderr.includes('SyntaxError:') ||
          result.stderr.includes('IndentationError:') ||
          result.stderr.includes('TabError:');

        return {
          stdout: result.stdout,
          stderr: result.stderr,
          verdict: isSyntax ? SUBMISSION_VERDICT.COMPILE_ERROR : SUBMISSION_VERDICT.RUNTIME_ERROR,
          timeMs: result.timeMs,
          memoryKb: result.memoryKb || 18000,
        };
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        verdict: SUBMISSION_VERDICT.PASSED,
        timeMs: result.timeMs,
        memoryKb: result.memoryKb || 16000,
      };
    } finally {
      this.cleanupWorkspace(workspace);
    }
  }
}

export const pythonRunner = new PythonRunner();
