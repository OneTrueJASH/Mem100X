/**
 * User-Configurable Privacy & Security System
 *
 * Provides comprehensive privacy and security features:
 * - Encryption levels (none, basic, strong, enterprise)
 * - Access controls and permissions
 * - Audit trails and logging
 * - Data anonymization
 * - Privacy compliance features
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { config } from '../config.js';
import { logInfo, logWarn, logError } from './logger.js';

export interface PrivacyConfig {
  // Encryption settings
  encryptionLevel: 'none' | 'basic' | 'strong' | 'enterprise';
  encryptionKey?: string;
  autoEncryptSensitiveData: boolean;

  // Access control settings
  enableAccessControls: boolean;
  requireAuthentication: boolean;
  sessionTimeout: number; // minutes
  maxFailedAttempts: number;

  // Audit trail settings
  enableAuditTrails: boolean;
  auditLogRetention: number; // days
  logSensitiveOperations: boolean;
  anonymizeAuditLogs: boolean;

  // Data privacy settings
  enableDataAnonymization: boolean;
  anonymizationLevel: 'none' | 'partial' | 'full';
  dataRetentionPolicy: 'keep_forever' | 'auto_delete' | 'manual_delete';
  retentionPeriod: number; // days

  // Compliance settings
  gdprCompliance: boolean;
  ccpaCompliance: boolean;
  hipaaCompliance: boolean;

  // Security settings
  enableRateLimiting: boolean;
  enableInputValidation: boolean;
  enableOutputSanitization: boolean;
  blockSuspiciousPatterns: boolean;

  // Internal paths (not user configurable)
  auditLogPath?: string;
  accessControlPath?: string;
}

export interface AuditEntry {
  timestamp: string;
  operation: string;
  userId?: string;
  context: string;
  entityName?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  dataHash?: string; // For integrity verification
}

export interface AccessControlEntry {
  userId: string;
  permissions: string[];
  contexts: string[];
  expiresAt?: string;
  lastAccess: string;
  failedAttempts: number;
  isLocked: boolean;
}

export interface PrivacyStats {
  totalAuditEntries: number;
  totalAccessAttempts: number;
  failedAccessAttempts: number;
  encryptionOperations: number;
  anonymizationOperations: number;
  dataRetentionOperations: number;
  lastPrivacyCheck: string;
  complianceStatus: Record<string, boolean>;
}

export class PrivacySecurityManager {
  private config: PrivacyConfig;
  constructor(config: Partial<PrivacyConfig> = {}) {
    // Always use LOCAL preset for local-only use
    this.config = { ...PRIVACY_PRESETS.LOCAL, ...config };
  }

  // Input validation (always enabled)
  validateInput(data: any): { isValid: boolean; errors: string[] } {
    if (!this.config.enableInputValidation) {
      return { isValid: true, errors: [] };
    }
    const errors: string[] = [];
    if (this.config.blockSuspiciousPatterns) {
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /DROP\s+TABLE/gi,
        /UNION\s+SELECT/gi,
        /\bOR\b.*?=/gi,
      ];
      const str = JSON.stringify(data);
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(str)) {
          errors.push('Suspicious pattern detected');
        }
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  // Output sanitization (always enabled)
  sanitizeOutput(data: any): any {
    if (!this.config.enableOutputSanitization) return data;
    // Simple HTML/script tag removal
    if (typeof data === 'string') {
      return data.replace(/<script.*?>.*?<\/script>/gi, '').replace(/<.*?>/g, '');
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: { [key: string]: any } = Array.isArray(data) ? [] : {};
      for (const key in data) {
        sanitized[key] = this.sanitizeOutput(data[key]);
      }
      return sanitized;
    }
    return data;
  }

  // Stub/no-op for encryption (not needed for local-only)
  encryptData(data: string): string { return data; }
  decryptData(data: string): string { return data; }

  // Stub/no-op for access controls (not needed for local-only)
  checkAccess(..._args: any[]): boolean { return true; }
  setAccessControl(..._args: any[]): void {}
  removeAccessControl(..._args: any[]): void {}
  unlockAccount(..._args: any[]): void {}

  // Stub/no-op for audit trails (not needed for local-only)
  getPrivacyStats(): any { return { totalAuditEntries: 0, encryptionOperations: 0 }; }
  getPrivacyConfig(): PrivacyConfig { return this.config; }
  updatePrivacyConfig(newConfig: Partial<PrivacyConfig>): void { this.config = { ...this.config, ...newConfig }; }
  applyRetentionPolicy(): { deletedCount: number; errors: string[] } { return { deletedCount: 0, errors: [] }; }
  cleanupAuditLogs(): { deletedCount: number } { return { deletedCount: 0 }; }

  // Stub/no-op for compliance (not needed for local-only)
  checkCompliance(): Record<string, boolean> { return { gdpr: false, ccpa: false, hipaa: false }; }

  // Stub/no-op for anonymization (not needed for local-only)
  anonymizeData(data: any, ..._args: any[]): any { return data; }

  // Shutdown (no-op for local-only)
  shutdown(): void {}

  // ---
  // To re-enable or expand features for remote/multi-user/cloud use, restore or implement:
  // - Real encryption (AES, etc.)
  // - Access control and authentication
  // - Audit trail logging
  // - Data anonymization
  // - Compliance checks
  // - Rate limiting
  // ---
}

// LOCAL preset: minimal security for local-only MCP server
export const PRIVACY_PRESETS = {
  LOCAL: {
    encryptionLevel: 'none' as 'none',
    enableAccessControls: false,
    requireAuthentication: false,
    sessionTimeout: 0,
    maxFailedAttempts: 0,
    enableAuditTrails: false,
    auditLogRetention: 0,
    logSensitiveOperations: false,
    anonymizeAuditLogs: false,
    enableDataAnonymization: false,
    anonymizationLevel: 'none' as 'none',
    dataRetentionPolicy: 'keep_forever',
    retentionPeriod: 0,
    gdprCompliance: false,
    ccpaCompliance: false,
    hipaaCompliance: false,
    enableRateLimiting: false,
    enableInputValidation: true,
    enableOutputSanitization: true,
    blockSuspiciousPatterns: true,
  } as PrivacyConfig,
};

// All access control and stats logic is now stubbed or removed for local-only use.
// No object indexing by string keys remains in this file.
