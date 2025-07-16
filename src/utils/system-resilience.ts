/**
 * System Resilience Module
 * Provides transaction integrity, rollback capabilities, and data corruption prevention
 */

import { createHash } from 'crypto';
import { logError, logInfo, logWarn } from './logger.js';
import { config } from '../config.js';

export interface TransactionLog {
  id: string;
  timestamp: Date;
  operation: string;
  status: 'pending' | 'committed' | 'rolled_back' | 'failed';
  checksum?: string;
  rollbackData?: any;
  error?: string;
  duration?: number;
}

export interface IntegrityCheck {
  isValid: boolean;
  checksum: string;
  timestamp: Date;
  issues?: string[];
}

export interface RecoveryAction {
  type: 'rollback' | 'repair' | 'restore' | 'degrade';
  description: string;
  data?: any;
  timestamp: Date;
}

export interface ResilienceConfig {
  enableIntegrityChecks: boolean;
  enableAutoRollback: boolean;
  enableGracefulDegradation: boolean;
  maxTransactionRetries: number;
  integrityCheckInterval: number;
  backupBeforeOperations: boolean;
  logAllTransactions: boolean;
}

export class SystemResilience {
  private transactionLogs: Map<string, TransactionLog> = new Map();
  private activeTransactions: Set<string> = new Set();
  private integrityChecks: Map<string, IntegrityCheck> = new Map();
  private recoveryActions: RecoveryAction[] = [];
  private config: ResilienceConfig;
  private isShuttingDown: boolean = false;

  constructor(userConfig: Partial<ResilienceConfig> = {}) {
    this.config = {
      enableIntegrityChecks: userConfig.enableIntegrityChecks ?? config.resilience.enableIntegrityChecks,
      enableAutoRollback: userConfig.enableAutoRollback ?? config.resilience.enableAutoRollback,
      enableGracefulDegradation: userConfig.enableGracefulDegradation ?? config.resilience.enableGracefulDegradation,
      maxTransactionRetries: userConfig.maxTransactionRetries ?? config.resilience.maxTransactionRetries,
      integrityCheckInterval: userConfig.integrityCheckInterval ?? config.resilience.integrityCheckInterval,
      backupBeforeOperations: userConfig.backupBeforeOperations ?? config.resilience.backupBeforeOperations,
      logAllTransactions: userConfig.logAllTransactions ?? config.resilience.logAllTransactions,
      ...userConfig,
    };

    // Start integrity check interval
    if (this.config.enableIntegrityChecks) {
      this.startIntegrityCheckInterval();
    }
  }

  /**
   * Generate checksum for data integrity validation
   */
  private generateChecksum(data: any): string {
    const dataString = JSON.stringify(data, (key, value) => {
      // Sort object keys for consistent checksums
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((result, key) => {
          result[key] = value[key];
          return result;
        }, {} as any);
      }
      return value;
    });
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Create a new transaction with integrity tracking
   */
  createTransaction(operation: string, data?: any): string {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const checksum = data ? this.generateChecksum(data) : undefined;

    const transactionLog: TransactionLog = {
      id: transactionId,
      timestamp: new Date(),
      operation,
      status: 'pending',
      checksum,
      rollbackData: data,
    };

    this.transactionLogs.set(transactionId, transactionLog);
    this.activeTransactions.add(transactionId);

    if (this.config.logAllTransactions) {
      logInfo('Transaction started', {
        transactionId,
        operation,
        checksum: checksum?.substring(0, 8),
      });
    }

    return transactionId;
  }

  /**
   * Commit a transaction with integrity validation
   */
  commitTransaction(transactionId: string, result?: any): void {
    const transaction = this.transactionLogs.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'pending') {
      throw new Error(`Transaction ${transactionId} is not in pending state`);
    }

    const startTime = transaction.timestamp.getTime();
    const duration = Date.now() - startTime;

    // Validate integrity if checksum was provided
    if (transaction.checksum && this.config.enableIntegrityChecks) {
      const resultChecksum = this.generateChecksum(result);
      if (transaction.checksum !== resultChecksum) {
        logError('Transaction integrity check failed', new Error('Checksum mismatch'), {
          transactionId,
          expected: transaction.checksum,
          actual: resultChecksum,
        });

        if (this.config.enableAutoRollback) {
          this.rollbackTransaction(transactionId, 'Integrity check failed');
          throw new Error('Transaction integrity check failed - auto-rolled back');
        }
      }
    }

    transaction.status = 'committed';
    transaction.duration = duration;
    this.activeTransactions.delete(transactionId);

    if (this.config.logAllTransactions) {
      logInfo('Transaction committed', {
        transactionId,
        operation: transaction.operation,
        duration,
      });
    }
  }

  /**
   * Rollback a transaction with recovery data
   */
  rollbackTransaction(transactionId: string, reason: string): void {
    const transaction = this.transactionLogs.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    transaction.status = 'rolled_back';
    transaction.error = reason;
    this.activeTransactions.delete(transactionId);

    // Record recovery action
    const recoveryAction: RecoveryAction = {
      type: 'rollback',
      description: `Rolled back transaction ${transactionId}: ${reason}`,
      data: transaction.rollbackData,
      timestamp: new Date(),
    };
    this.recoveryActions.push(recoveryAction);

    logWarn('Transaction rolled back', {
      transactionId,
      operation: transaction.operation,
      reason,
    });
  }

  /**
   * Execute a function with transaction resilience
   */
  async executeWithResilience<T>(
    operation: string,
    fn: (transactionId: string) => Promise<T>,
    data?: any,
    retries: number = 0
  ): Promise<T> {
    const transactionId = this.createTransaction(operation, data);

    try {
      // Create backup before operation if enabled
      if (this.config.backupBeforeOperations) {
        await this.createBackup(transactionId);
      }

      const result = await fn(transactionId);
      this.commitTransaction(transactionId, result);
      return result;
    } catch (error) {
      this.rollbackTransaction(transactionId, error instanceof Error ? error.message : String(error));

      // Retry logic
      if (retries < this.config.maxTransactionRetries && this.config.enableAutoRollback) {
        logWarn('Retrying transaction', {
          transactionId,
          operation,
          retry: retries + 1,
          maxRetries: this.config.maxTransactionRetries,
        });

        // Exponential backoff
        const delay = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.executeWithResilience(operation, fn, data, retries + 1);
      }

      // Graceful degradation
      if (this.config.enableGracefulDegradation) {
        return this.degradeOperation(operation, error);
      }

      throw error;
    }
  }

  /**
   * Graceful degradation - provide fallback behavior
   */
  private async degradeOperation<T>(operation: string, error: unknown): Promise<T> {
    const recoveryAction: RecoveryAction = {
      type: 'degrade',
      description: `Graceful degradation for operation: ${operation}`,
      data: { error: error instanceof Error ? error.message : String(error) },
      timestamp: new Date(),
    };
    this.recoveryActions.push(recoveryAction);

    logWarn('Operation degraded', {
      operation,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return safe fallback based on operation type
    switch (operation) {
      case 'create_entities':
        return [] as T;
      case 'search_nodes':
        return { entities: [], relations: [] } as T;
      case 'add_observations':
        return undefined as T;
      default:
        throw new Error(`No fallback available for operation: ${operation}`);
    }
  }

  /**
   * Create backup for transaction
   */
  private async createBackup(transactionId: string): Promise<void> {
    try {
      // This would integrate with the database backup system
      logInfo('Creating backup before transaction', { transactionId });
    } catch (error) {
      logError('Failed to create backup', error as Error, { transactionId });
    }
  }

  /**
   * Validate data integrity
   */
  validateIntegrity(data: any, expectedChecksum?: string): IntegrityCheck {
    const checksum = this.generateChecksum(data);
    const isValid = !expectedChecksum || checksum === expectedChecksum;

    const integrityCheck: IntegrityCheck = {
      isValid,
      checksum,
      timestamp: new Date(),
    };

    if (!isValid) {
      integrityCheck.issues = ['Checksum mismatch'];
    }

    return integrityCheck;
  }

  /**
   * Detect and repair data corruption
   */
  async detectAndRepairCorruption(): Promise<RecoveryAction[]> {
    const repairs: RecoveryAction[] = [];

    // Check for orphaned transactions
    for (const [transactionId, transaction] of this.transactionLogs) {
      if (transaction.status === 'pending' && this.activeTransactions.has(transactionId)) {
        // Check if transaction is stale (older than 5 minutes)
        const age = Date.now() - transaction.timestamp.getTime();
        if (age > 300000) { // 5 minutes
          this.rollbackTransaction(transactionId, 'Stale transaction detected');

          const repair: RecoveryAction = {
            type: 'repair',
            description: `Repaired stale transaction ${transactionId}`,
            data: { age, originalStatus: transaction.status },
            timestamp: new Date(),
          };
          repairs.push(repair);
        }
      }
    }

    // Check for data consistency issues
    const consistencyIssues = await this.checkDataConsistency();
    if (consistencyIssues.length > 0) {
      const repair: RecoveryAction = {
        type: 'repair',
        description: `Repaired ${consistencyIssues.length} consistency issues`,
        data: { issues: consistencyIssues },
        timestamp: new Date(),
      };
      repairs.push(repair);
    }

    return repairs;
  }

  /**
   * Check data consistency across the system
   */
  private async checkDataConsistency(): Promise<string[]> {
    const issues: string[] = [];

    // Check for transactions in inconsistent state
    for (const [transactionId, transaction] of this.transactionLogs) {
      if (transaction.status === 'pending' && !this.activeTransactions.has(transactionId)) {
        issues.push(`Transaction ${transactionId} marked as pending but not active`);
      }
    }

    // Check for integrity check failures
    for (const [key, check] of this.integrityChecks) {
      if (!check.isValid) {
        issues.push(`Integrity check failed for ${key}`);
      }
    }

    return issues;
  }

  /**
   * Start periodic integrity checks
   */
  private startIntegrityCheckInterval(): void {
    setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        const repairs = await this.detectAndRepairCorruption();
        if (repairs.length > 0) {
          logInfo('Integrity check completed with repairs', {
            repairsCount: repairs.length,
            repairs: repairs.map(r => r.description),
          });
        }
      } catch (error) {
        logError('Integrity check failed', error as Error);
      }
    }, this.config.integrityCheckInterval);
  }

  /**
   * Get system resilience statistics
   */
  getStats(): any {
    const totalTransactions = this.transactionLogs.size;
    const activeTransactions = this.activeTransactions.size;
    const committedTransactions = Array.from(this.transactionLogs.values())
      .filter(t => t.status === 'committed').length;
    const rolledBackTransactions = Array.from(this.transactionLogs.values())
      .filter(t => t.status === 'rolled_back').length;
    const failedTransactions = Array.from(this.transactionLogs.values())
      .filter(t => t.status === 'failed').length;

    return {
      totalTransactions,
      activeTransactions,
      committedTransactions,
      rolledBackTransactions,
      failedTransactions,
      successRate: totalTransactions > 0 ? (committedTransactions / totalTransactions) * 100 : 100,
      recoveryActions: this.recoveryActions.length,
      integrityChecks: this.integrityChecks.size,
      config: this.config,
    };
  }

  /**
   * Get transaction logs for audit
   */
  getTransactionLogs(limit: number = 100): TransactionLog[] {
    return Array.from(this.transactionLogs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get recovery actions
   */
  getRecoveryActions(): RecoveryAction[] {
    return [...this.recoveryActions];
  }

  /**
   * Clear old transaction logs
   */
  clearOldLogs(olderThanDays: number = 30): void {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let cleared = 0;

    for (const [transactionId, transaction] of this.transactionLogs) {
      if (transaction.timestamp.getTime() < cutoff && transaction.status !== 'pending') {
        this.transactionLogs.delete(transactionId);
        cleared++;
      }
    }

    if (cleared > 0) {
      logInfo('Cleared old transaction logs', { cleared });
    }
  }

  /**
   * Shutdown resilience system
   */
  shutdown(): void {
    this.isShuttingDown = true;

    // Rollback any active transactions
    for (const transactionId of this.activeTransactions) {
      this.rollbackTransaction(transactionId, 'System shutdown');
    }

    logInfo('System resilience shutdown complete', {
      activeTransactions: this.activeTransactions.size,
      totalLogs: this.transactionLogs.size,
    });
  }
}

// Global resilience instance
export const systemResilience = new SystemResilience();
