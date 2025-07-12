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
      const directPath =
        '/Users/josh/source/personal/mcp-servers-official/src/memory/dist/index.js';

      // Use fs.existsSync to check which path to use
      const fs = require('fs');
      if (fs.existsSync(symlinkPath)) {
        this.execPath = symlinkPath;
      } else if (fs.existsSync(directPath)) {
        this.execPath = directPath;
      } else {
        throw new Error(
          'Official memory server not found. Please run setup-official-server.sh first.'
        );
      }
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
      DISABLE_RATE_LIMITING: 'true', // Ensure rate limiting is disabled for benchmarks
    } as Record<string, string>;
  }
}
