import { BaseAdapter } from './base-adapter';
import { ServerConfig } from '../types';
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
      // Local development mode
      // Check if symlink exists first
      const symlinkPath = path.join(
        process.cwd(), 
        'servers', 
        'official-memory', 
        'dist', 
        'index.js'
      );
      
      // Fallback to direct path if symlink doesn't exist
      const directPath = '/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js';
      
      // Use fs.existsSync to check which path to use
      const fs = require('fs');
      if (fs.existsSync(symlinkPath)) {
        this.execPath = symlinkPath;
      } else if (fs.existsSync(directPath)) {
        this.execPath = directPath;
      } else {
        throw new Error('Official memory server not found. Please run setup-official-server.sh first.');
      }
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