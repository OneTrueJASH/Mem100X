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
      this.execPath = path.join(process.cwd(), '..', 'dist', 'server-multi.js');
    }
  }

  protected async startServer(): Promise<ChildProcess> {
    console.log(`[${this.name}] Starting Mem100x server at ${this.execPath}`);
    
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      MEMORY_DB: process.env.MEMORY_DB || '/tmp/mem100x-benchmark.db',
      DEBUG: '0',
      // Disable any console output that might interfere with stdio
      QUIET: '1',
      // Disable rate limiting for benchmarks
      DISABLE_RATE_LIMITING: 'true'
    };

    const serverProcess = spawn('node', [this.execPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    // Handle server errors
    serverProcess.on('error', (error) => {
      console.error(`[${this.name}] Server process error:`, error);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[${this.name}] Server stderr:`, data.toString());
    });

    // Wait for server to be ready by monitoring stderr for the "running on stdio" message
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      let stderrBuffer = '';
      
      const checkReady = (data: Buffer) => {
        stderrBuffer += data.toString();
        
        // Check if the server is ready (look for the running message in JSON logs)
        if (stderrBuffer.includes('running on stdio') || 
            stderrBuffer.includes('Server running on stdio')) {
          clearTimeout(timeout);
          serverProcess.stderr.removeListener('data', checkReady);
          resolve();
        }
      };
      
      serverProcess.stderr.on('data', checkReady);
      
      // Also check stdout for backward compatibility
      serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        console.log(`[${this.name}] Server started:`, data.toString().trim());
        resolve();
      });
    });

    return serverProcess;
  }

  protected getCommand(): string {
    return 'node';
  }

  protected getArgs(): string[] {
    return [this.execPath];
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
            heapUsed: 0
          },
          cpu: {
            user: utime,
            system: stime
          }
        };
      }
    } catch (error) {
      console.warn(`[${this.name}] Failed to get process metrics:`, error);
    }

    return super.getMetrics();
  }
}