import { ResourceMetrics } from '../types.js';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MetricsCollector {
  private samples: ResourceMetrics[] = [];
  private interval: NodeJS.Timeout | null = null;
  private pid: number;

  constructor(pid: number) {
    this.pid = pid;
  }

  start(intervalMs: number = 100): void {
    this.interval = setInterval(async () => {
      const metrics = await this.collect();
      if (metrics) {
        this.samples.push(metrics);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async collect(): Promise<ResourceMetrics | null> {
    try {
      if (process.platform === 'linux') {
        return await this.collectLinux();
      } else if (process.platform === 'darwin') {
        return await this.collectMacOS();
      } else {
        return await this.collectGeneric();
      }
    } catch (error) {
      console.warn('Failed to collect metrics:', error);
      return null;
    }
  }

  private async collectLinux(): Promise<ResourceMetrics> {
    const fs = await import('fs/promises');
    
    // Read memory info from /proc
    const status = await fs.readFile(`/proc/${this.pid}/status`, 'utf-8');
    const vmRssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
    const vmSizeMatch = status.match(/VmSize:\s+(\d+)\s+kB/);
    
    // Read CPU info from /proc
    const stat = await fs.readFile(`/proc/${this.pid}/stat`, 'utf-8');
    const fields = stat.split(' ');
    const utime = parseInt(fields[13]);
    const stime = parseInt(fields[14]);
    
    return {
      memory: {
        rss: vmRssMatch ? parseInt(vmRssMatch[1]) * 1024 : 0,
        heapTotal: vmSizeMatch ? parseInt(vmSizeMatch[1]) * 1024 : 0,
        heapUsed: 0 // Not directly available
      },
      cpu: {
        user: utime,
        system: stime
      }
    };
  }

  private async collectMacOS(): Promise<ResourceMetrics> {
    // Use ps command on macOS
    const { stdout } = await execAsync(`ps -p ${this.pid} -o rss,vsz,%cpu`);
    const lines = stdout.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('Process not found');
    }
    
    const [rss, vsz, cpu] = lines[1].trim().split(/\s+/).map(Number);
    
    return {
      memory: {
        rss: rss * 1024, // Convert KB to bytes
        heapTotal: vsz * 1024,
        heapUsed: 0
      },
      cpu: {
        user: cpu,
        system: 0
      }
    };
  }

  private async collectGeneric(): Promise<ResourceMetrics> {
    // Fallback for other platforms
    return {
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed
      },
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system
      }
    };
  }

  getStats() {
    if (this.samples.length === 0) {
      return null;
    }

    const memoryRss = this.samples.map(s => s.memory.rss);
    const cpuUser = this.samples.map(s => s.cpu.user);
    
    return {
      memory: {
        initial: memoryRss[0],
        peak: Math.max(...memoryRss),
        final: memoryRss[memoryRss.length - 1],
        average: memoryRss.reduce((a, b) => a + b, 0) / memoryRss.length
      },
      cpu: {
        average: cpuUser.reduce((a, b) => a + b, 0) / cpuUser.length,
        peak: Math.max(...cpuUser)
      }
    };
  }
}