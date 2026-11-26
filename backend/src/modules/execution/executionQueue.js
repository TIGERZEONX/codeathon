import os from 'os';
import { logger } from '../../utils/logger.js';

export class ExecutionQueue {
  constructor(concurrency = Math.max(4, os.cpus().length)) {
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.queue = [];
  }

  async enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.processNext();
    });
  }

  processNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { taskFn, resolve, reject } = this.queue.shift();
    this.activeWorkers++;

    (async () => {
      try {
        const result = await taskFn();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        this.activeWorkers--;
        this.processNext();
      }
    })();
  }

  getStats() {
    return {
      activeWorkers: this.activeWorkers,
      queuedTasks: this.queue.length,
      concurrencyLimit: this.concurrency,
    };
  }
}

export const executionQueue = new ExecutionQueue();
