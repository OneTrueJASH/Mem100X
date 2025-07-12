import { BaseAdapter } from './base-adapter';
import { ServerConfig } from '../types';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export class Mem100xAdapter extends BaseAdapter {
  private readonly execPath: string;

  constructor(config: ServerConfig) {
    super('mem100x', config);

    // Determine the executable path based on environment
    if (process.env.BENCHMARK_MODE === 'docker') {
      this.execPath = '/app/dist/server-multi.js';
    } else {
      // Local development mode
      this.execPath = path.join(__dirname, '..', '..', '..', 'dist', 'server-multi.js');
    }
  }

  protected getCommand(): string {
    return 'node';
  }

  protected getArgs(): string[] {
    return [this.execPath];
  }

  protected getEnv(): Record<string, string> {
    return {
      ...process.env,
      NODE_ENV: 'production',
      MEMORY_DB: process.env.MEMORY_DB || '/tmp/mem100x-benchmark.db',
      DEBUG: '0',
      QUIET: '1',
      DISABLE_RATE_LIMITING: 'true',
      // Suppress dotenv output
      DOTENV_CONFIG_OVERRIDE: 'true',
      SUPPRESS_NO_CONFIG_WARNING: 'true',
    } as Record<string, string>;
  }

  // Override getMetrics to get actual process metrics
  async getMetrics(): Promise<any> {
    if (!this.process || !this.process.pid) {
      return super.getMetrics();
    }

    try {
      // On Linux, we can read from /proc
      if (process.platform === 'linux') {
        const fs = await import('fs/promises');
        const pid = this.process.pid;

        // Read memory info
        const status = await fs.readFile(`/proc/${pid}/status`, 'utf-8');
        const vmRssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
        const rss = vmRssMatch ? parseInt(vmRssMatch[1]) * 1024 : 0;

        // Read CPU info
        const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf-8');
        const statFields = stat.split(' ');
        const utime = parseInt(statFields[13]);
        const stime = parseInt(statFields[14]);

        return {
          memory: {
            rss,
            heapTotal: 0, // Not available from /proc
            heapUsed: 0,
          },
          cpu: {
            user: utime,
            system: stime,
          },
        };
      }
    } catch (error) {
      console.warn(`[${this.name}] Failed to get process metrics:`, error);
    }

    return super.getMetrics();
  }
}
