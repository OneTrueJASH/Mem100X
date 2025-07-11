import { BaseAdapter } from './base-adapter.js';
import { ServerConfig } from '../types.js';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export class OfficialMemoryAdapter extends BaseAdapter {
  private readonly execPath: string;

  constructor(config: ServerConfig) {
    super('official-memory', config);
    
    // Determine the executable path based on environment
    if (process.env.BENCHMARK_MODE === 'docker') {
      this.execPath = '/app/servers/src/memory/build/index.js';
    } else {
      // Local development mode - assumes you've cloned the official repo
      this.execPath = path.join(
        process.cwd(), 
        'servers', 
        'official-memory', 
        'build', 
        'index.js'
      );
    }
  }

  protected async startServer(): Promise<ChildProcess> {
    console.log(`[${this.name}] Starting official memory server at ${this.execPath}`);
    
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      // The official server might have different env vars
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
      // Official server might have different output
      const output = data.toString();
      if (!output.includes('DeprecationWarning')) {
        console.error(`[${this.name}] Server stderr:`, output);
      }
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 15000); // Longer timeout for official server

      // The official server might not output anything on startup
      // So we'll just wait a bit and assume it's ready
      setTimeout(() => {
        clearTimeout(timeout);
        console.log(`[${this.name}] Server assumed ready`);
        resolve();
      }, 3000);

      serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        console.log(`[${this.name}] Server output:`, data.toString().trim());
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
}