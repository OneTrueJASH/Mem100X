/**
 * Connection pool for SQLite to handle concurrent operations
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface PoolOptions {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  readonly?: boolean;
}

export interface PooledConnection {
  db: Database.Database;
  id: number;
  lastUsed: number;
  inUse: boolean;
}

export class ConnectionPool extends EventEmitter {
  private connections: Map<number, PooledConnection> = new Map();
  private availableConnections: number[] = [];
  private waitQueue: Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private nextId = 1;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(
    private readonly dbPath: string,
    private readonly options: PoolOptions = {
      minConnections: 2,
      maxConnections: 10,
      acquireTimeout: 5000,
      idleTimeout: 60000,
      readonly: false
    }
  ) {
    super();
    this.initialize();
  }

  private initialize(): void {
    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      this.createConnection();
    }
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 30000);
  }

  private createConnection(): PooledConnection {
    const id = this.nextId++;
    const db = new Database(this.dbPath, {
      readonly: this.options.readonly,
      fileMustExist: true
    });
    
    // Apply optimized pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('cache_size = -64000'); // 64MB
    
    const connection: PooledConnection = {
      db,
      id,
      lastUsed: Date.now(),
      inUse: false
    };
    
    this.connections.set(id, connection);
    this.availableConnections.push(id);
    this.emit('connection-created', id);
    
    return connection;
  }

  async acquire(): Promise<PooledConnection> {
    // Try to get available connection
    while (this.availableConnections.length > 0) {
      const id = this.availableConnections.shift()!;
      const conn = this.connections.get(id);
      
      if (conn && !conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        this.emit('connection-acquired', id);
        return conn;
      }
    }
    
    // Create new connection if under limit
    if (this.connections.size < this.options.maxConnections) {
      const conn = this.createConnection();
      this.availableConnections.shift(); // Remove from available
      conn.inUse = true;
      return conn;
    }
    
    // Wait for connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(w => w.timeout === timeout);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.options.acquireTimeout);
      
      this.waitQueue.push({ resolve, reject, timeout });
    });
  }

  release(connection: PooledConnection): void {
    if (!connection.inUse) return;
    
    connection.inUse = false;
    connection.lastUsed = Date.now();
    
    // Check if anyone is waiting
    const waiter = this.waitQueue.shift();
    if (waiter) {
      clearTimeout(waiter.timeout);
      connection.inUse = true;
      waiter.resolve(connection);
    } else {
      this.availableConnections.push(connection.id);
      this.emit('connection-released', connection.id);
    }
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: number[] = [];
    
    for (const [id, conn] of this.connections) {
      if (!conn.inUse && 
          this.connections.size > this.options.minConnections &&
          now - conn.lastUsed > this.options.idleTimeout) {
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      this.removeConnection(id);
    }
  }

  private removeConnection(id: number): void {
    const conn = this.connections.get(id);
    if (!conn || conn.inUse) return;
    
    const index = this.availableConnections.indexOf(id);
    if (index !== -1) {
      this.availableConnections.splice(index, 1);
    }
    
    conn.db.close();
    this.connections.delete(id);
    this.emit('connection-removed', id);
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupInterval);
    
    // Reject all waiters
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool closing'));
    }
    this.waitQueue = [];
    
    // Close all connections
    for (const conn of this.connections.values()) {
      conn.db.close();
    }
    
    this.connections.clear();
    this.availableConnections = [];
    this.emit('closed');
  }

  getStats() {
    let inUse = 0;
    for (const conn of this.connections.values()) {
      if (conn.inUse) inUse++;
    }
    
    return {
      total: this.connections.size,
      available: this.availableConnections.length,
      inUse,
      waiting: this.waitQueue.length
    };
  }
}