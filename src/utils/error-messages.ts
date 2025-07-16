/**
 * User-Friendly Error Messages
 * Provides clear, actionable error messages with troubleshooting suggestions
 */

import { config } from '../config.js';
import { ConfigurationError } from '../errors.js';

export interface ErrorSuggestion {
  action: string;
  description: string;
  command?: string;
  url?: string;
}

export interface UserFriendlyError {
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'validation' | 'configuration' | 'database' | 'network' | 'permission' | 'system';
  suggestions: ErrorSuggestion[];
  troubleshooting?: string;
}

/**
 * Error message templates with user-friendly descriptions and suggestions
 */
export const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  // Database Errors
  'EntityNotFoundError': {
    message: "The requested information wasn't found in your memory",
    severity: 'low',
    category: 'database',
    suggestions: [
      {
        action: 'Check spelling',
        description: 'Verify the entity name is spelled correctly',
      },
      {
        action: 'Search broadly',
        description: 'Try a broader search term to find related information',
      },
      {
        action: 'Check context',
        description: 'Make sure you\'re in the right context (personal vs work)',
      },
    ],
    troubleshooting: 'This usually means the information was never stored or was deleted. Try searching with different terms.',
  },

  'DuplicateEntityError': {
    message: 'This information already exists in your memory',
    severity: 'low',
    category: 'validation',
    suggestions: [
      {
        action: 'Use existing entity',
        description: 'The information is already stored - you can search for it',
      },
      {
        action: 'Add observations',
        description: 'Add new observations to the existing entity instead',
      },
      {
        action: 'Use different name',
        description: 'Create the entity with a slightly different name',
      },
    ],
    troubleshooting: 'Mem100x prevents duplicate entities to keep your memory organized. Consider adding new observations to the existing entity.',
  },

  'InvalidContextError': {
    message: 'Invalid context specified',
    severity: 'medium',
    category: 'validation',
    suggestions: [
      {
        action: 'Use valid contexts',
        description: 'Available contexts: personal, work',
      },
      {
        action: 'Check context name',
        description: 'Context names are case-sensitive',
      },
      {
        action: 'Auto-detect context',
        description: 'Let Mem100x automatically detect the context',
      },
    ],
    troubleshooting: 'Mem100x uses contexts to organize your information. Personal context is for private information, work context is for professional information.',
  },

  // Configuration Errors
  'MissingConfigError': {
    message: 'Required configuration is missing',
    severity: 'high',
    category: 'configuration',
    suggestions: [
      {
        action: 'Copy example config',
        description: 'Copy the example configuration file',
        command: 'cp env.example .env',
      },
      {
        action: 'Validate configuration',
        description: 'Run the configuration validation tool',
        command: 'npm run config:validate',
      },
      {
        action: 'Check documentation',
        description: 'Review the configuration guide',
        url: 'https://github.com/OneTrueJASH/Mem100X/blob/main/CONFIGURATION.md',
      },
    ],
    troubleshooting: 'Mem100x requires certain configuration settings to run properly. The example configuration file provides sensible defaults.',
  },

  'InvalidConfigError': {
    message: 'Configuration contains invalid settings',
    severity: 'high',
    category: 'configuration',
    suggestions: [
      {
        action: 'Validate configuration',
        description: 'Run the configuration validation tool',
        command: 'npm run config:validate',
      },
      {
        action: 'Check configuration guide',
        description: 'Review valid configuration options',
        url: 'https://github.com/OneTrueJASH/Mem100X/blob/main/CONFIGURATION.md',
      },
      {
        action: 'Reset to defaults',
        description: 'Start with default configuration and customize gradually',
      },
    ],
    troubleshooting: 'Invalid configuration can prevent Mem100x from starting or cause performance issues. Use the validation tool to identify problems.',
  },

  'ConfigurationError': {
    message: 'Configuration error occurred',
    severity: 'high',
    category: 'configuration',
    suggestions: [
      {
        action: 'Check configuration',
        description: 'Review your configuration settings for typos or missing values',
      },
      {
        action: 'Validate configuration',
        description: 'Run the configuration validation tool',
        command: 'npm run config:validate',
      },
      {
        action: 'Check documentation',
        description: 'Review the configuration guide',
        url: 'https://github.com/OneTrueJASH/Mem100X/blob/main/CONFIGURATION.md',
      },
    ],
    troubleshooting: 'Configuration errors prevent the application from starting or running properly. Check your .env file and ensure all required values are provided and valid.',
  },

  // Validation Errors
  'InvalidInputError': {
    message: 'Invalid input provided',
    severity: 'medium',
    category: 'validation',
    suggestions: [
      {
        action: 'Check input format',
        description: 'Verify the input matches the expected format',
      },
      {
        action: 'Review documentation',
        description: 'Check the tool documentation for correct input format',
        url: 'https://github.com/OneTrueJASH/Mem100X/blob/main/README.md',
      },
      {
        action: 'Use validation tool',
        description: 'Run the configuration validation tool',
        command: 'npm run config:validate',
      },
    ],
    troubleshooting: 'Input validation ensures data integrity and prevents errors. Check the tool documentation for the correct input format.',
  },

  'ValidationError': {
    message: 'Input validation failed',
    severity: 'medium',
    category: 'validation',
    suggestions: [
      {
        action: 'Check required fields',
        description: 'Ensure all required fields are provided',
      },
      {
        action: 'Verify data types',
        description: 'Check that data types match expectations',
      },
      {
        action: 'Review error details',
        description: 'Look at the specific validation error for more details',
      },
    ],
    troubleshooting: 'Validation errors help ensure data quality. Check the specific field mentioned in the error for the issue.',
  },

  // Cache Errors
  'CacheCapacityError': {
    message: 'Memory cache is full',
    severity: 'medium',
    category: 'system',
    suggestions: [
      {
        action: 'Increase cache size',
        description: 'Increase the entity cache size in configuration',
        command: 'ENTITY_CACHE_SIZE=100000 npm start',
      },
      {
        action: 'Restart server',
        description: 'Restart the server to clear the cache',
        command: 'npm start',
      },
      {
        action: 'Optimize usage',
        description: 'Consider using more specific searches to reduce cache usage',
      },
    ],
    troubleshooting: 'The cache helps Mem100x run faster by keeping frequently accessed information in memory. You can increase the cache size in your configuration.',
  },

  // Transaction Errors
  'TransactionError': {
    message: 'Database transaction failed',
    severity: 'high',
    category: 'database',
    suggestions: [
      {
        action: 'Retry operation',
        description: 'Try the operation again - it may succeed on retry',
      },
      {
        action: 'Check disk space',
        description: 'Ensure there is sufficient disk space available',
        command: 'df -h',
      },
      {
        action: 'Restart server',
        description: 'Restart the server to clear any stuck transactions',
        command: 'npm start',
      },
    ],
    troubleshooting: 'Transaction errors usually indicate a temporary database issue. Retrying the operation often resolves the problem.',
  },

  // MCP Protocol Errors
  'ToolNotFoundError': {
    message: 'Requested tool not found',
    severity: 'medium',
    category: 'validation',
    suggestions: [
      {
        action: 'Check tool name',
        description: 'Verify the tool name is spelled correctly',
      },
      {
        action: 'List available tools',
        description: 'Check what tools are available',
        command: 'mem100x --help',
      },
      {
        action: 'Update Mem100x',
        description: 'Update to the latest version for new tools',
        command: 'npm update -g mem100x',
      },
    ],
    troubleshooting: 'Tool names are case-sensitive and must match exactly. Check the documentation for the correct tool names.',
  },

  'ToolExecutionError': {
    message: 'Tool execution failed',
    severity: 'high',
    category: 'system',
    suggestions: [
      {
        action: 'Check input',
        description: 'Verify the input parameters are correct',
      },
      {
        action: 'Check logs',
        description: 'Review the server logs for more details',
      },
      {
        action: 'Restart server',
        description: 'Restart the server to clear any issues',
        command: 'npm start',
      },
    ],
    troubleshooting: 'Tool execution errors can occur due to invalid input, database issues, or system problems. Check the logs for specific error details.',
  },

  // Backup/Restore Errors
  'BackupFailedError': {
    message: 'Backup operation failed',
    severity: 'high',
    category: 'system',
    suggestions: [
      {
        action: 'Check disk space',
        description: 'Ensure there is sufficient disk space for backup',
        command: 'df -h',
      },
      {
        action: 'Check permissions',
        description: 'Verify write permissions to the backup directory',
        command: 'ls -la /path/to/backup/directory',
      },
      {
        action: 'Try different location',
        description: 'Try backing up to a different directory',
      },
    ],
    troubleshooting: 'Backup failures usually indicate disk space or permission issues. Ensure you have sufficient space and write permissions.',
  },

  'RestoreFailedError': {
    message: 'Restore operation failed',
    severity: 'high',
    category: 'system',
    suggestions: [
      {
        action: 'Check backup file',
        description: 'Verify the backup file exists and is not corrupted',
        command: 'ls -la backup-file.db',
      },
      {
        action: 'Check disk space',
        description: 'Ensure there is sufficient disk space for restore',
        command: 'df -h',
      },
      {
        action: 'Check permissions',
        description: 'Verify read permissions for the backup file',
        command: 'ls -la backup-file.db',
      },
    ],
    troubleshooting: 'Restore failures can occur due to corrupted backup files, insufficient disk space, or permission issues.',
  },

  // Rate Limiting Errors
  'RateLimitExceeded': {
    message: 'Too many requests - please slow down',
    severity: 'low',
    category: 'system',
    suggestions: [
      {
        action: 'Wait and retry',
        description: 'Wait a few seconds and try again',
      },
      {
        action: 'Reduce request frequency',
        description: 'Make fewer requests per second',
      },
      {
        action: 'Disable rate limiting',
        description: 'Disable rate limiting for development (not recommended for production)',
        command: 'DISABLE_RATE_LIMITING=true npm start',
      },
    ],
    troubleshooting: 'Rate limiting protects the server from overload. In production, this helps maintain performance for all users.',
  },

  // Circuit Breaker Errors
  'CircuitBreakerOpen': {
    message: 'Service temporarily unavailable - too many failures',
    severity: 'high',
    category: 'system',
    suggestions: [
      {
        action: 'Wait and retry',
        description: 'Wait a few seconds for the circuit breaker to reset',
      },
      {
        action: 'Check system resources',
        description: 'Verify the system has sufficient resources',
        command: 'top',
      },
      {
        action: 'Restart server',
        description: 'Restart the server to reset circuit breakers',
        command: 'npm start',
      },
    ],
    troubleshooting: 'Circuit breakers protect the system from cascading failures. They automatically reset after a short period.',
  },
};

/**
 * Get user-friendly error message for an error
 */
export function getUserFriendlyError(error: unknown): UserFriendlyError {
  // Handle Mem100x errors
  if (error && typeof error === 'object' && 'constructor' in error) {
    const errorName = error.constructor.name;
    if (ERROR_MESSAGES[errorName]) {
      return ERROR_MESSAGES[errorName];
    }
    // Fallback: match by name property (case-insensitive)
    if (
      (typeof errorName === 'string' && errorName.toLowerCase().includes('configurationerror')) ||
      (typeof (error as any)?.name === 'string' && (error as any).name.toLowerCase().includes('configurationerror'))
    ) {
      return ERROR_MESSAGES['ConfigurationError'];
    }
  }

  // Fallback for ConfigurationError by instanceof (for local errors)
  if (error instanceof ConfigurationError) {
    return ERROR_MESSAGES['ConfigurationError'];
  }

  // Handle specific error messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Database errors
    if (message.includes('database is locked')) {
      return {
        message: 'Database is temporarily locked - please try again',
        severity: 'medium',
        category: 'database',
        suggestions: [
          {
            action: 'Wait and retry',
            description: 'Wait a few seconds and try the operation again',
          },
          {
            action: 'Increase timeout',
            description: 'Increase the database busy timeout',
            command: 'DATABASE_BUSY_TIMEOUT=60000 npm start',
          },
        ],
        troubleshooting: 'Database locks occur when multiple operations try to access the database simultaneously. This is usually temporary.',
      };
    }

    if (message.includes('no such table')) {
      return {
        message: 'Database table not found - database may be corrupted',
        severity: 'critical',
        category: 'database',
        suggestions: [
          {
            action: 'Restart server',
            description: 'Restart the server to recreate database tables',
            command: 'npm start',
          },
          {
            action: 'Check database file',
            description: 'Verify the database file exists and is not corrupted',
            command: 'ls -la data/*.db',
          },
          {
            action: 'Restore from backup',
            description: 'Restore from a recent backup if available',
          },
        ],
        troubleshooting: 'Missing database tables usually indicate database corruption. Restarting the server will recreate the tables.',
      };
    }

    // Configuration errors
    if (message.includes('cannot find module')) {
      return {
        message: 'Required module not found - installation may be incomplete',
        severity: 'high',
        category: 'configuration',
        suggestions: [
          {
            action: 'Reinstall dependencies',
            description: 'Reinstall all dependencies',
            command: 'npm install',
          },
          {
            action: 'Rebuild project',
            description: 'Rebuild the project',
            command: 'npm run build',
          },
          {
            action: 'Check installation',
            description: 'Verify the installation is complete',
            command: 'npm list',
          },
        ],
        troubleshooting: 'Missing modules usually indicate an incomplete installation. Reinstalling dependencies should resolve the issue.',
      };
    }

    // Permission errors
    if (message.includes('permission denied') || message.includes('eacces')) {
      return {
        message: 'Permission denied - insufficient access rights',
        severity: 'high',
        category: 'permission',
        suggestions: [
          {
            action: 'Check file permissions',
            description: 'Verify file and directory permissions',
            command: 'ls -la data/',
          },
          {
            action: 'Fix permissions',
            description: 'Fix directory permissions',
            command: 'chmod 755 data/',
          },
          {
            action: 'Run as correct user',
            description: 'Ensure you\'re running as the correct user',
          },
        ],
        troubleshooting: 'Permission errors occur when the application cannot access required files or directories. Check file permissions and ownership.',
      };
    }
  }

  // Default error message
  return {
    message: 'An unexpected error occurred',
    severity: 'high',
    category: 'system',
    suggestions: [
      {
        action: 'Check logs',
        description: 'Review the server logs for more details',
      },
      {
        action: 'Restart server',
        description: 'Restart the server to clear any issues',
        command: 'npm start',
      },
      {
        action: 'Report issue',
        description: 'Report the issue with error details',
        url: 'https://github.com/OneTrueJASH/Mem100X/issues',
      },
    ],
    troubleshooting: 'Unexpected errors can occur due to various system issues. Check the logs for specific error details and consider restarting the server.',
  };
}

/**
 * Format error message for user display
 */
export function formatErrorForUser(error: unknown): string {
  const userError = getUserFriendlyError(error);

  let message = `❌ ${userError.message}\n\n`;

  if (userError.suggestions.length > 0) {
    message += '💡 Suggestions:\n';
    userError.suggestions.forEach((suggestion, index) => {
      message += `${index + 1}. ${suggestion.action}: ${suggestion.description}`;
      if (suggestion.command) {
        message += `\n   Command: ${suggestion.command}`;
      }
      if (suggestion.url) {
        message += `\n   URL: ${suggestion.url}`;
      }
      message += '\n';
    });
  }

  if (userError.troubleshooting) {
    message += `\n🔧 Troubleshooting: ${userError.troubleshooting}\n`;
  }

  return message;
}

/**
 * Get error severity level
 */
export function getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
  const userError = getUserFriendlyError(error);
  return userError.severity;
}

/**
 * Check if error is user-actionable
 */
export function isUserActionable(error: unknown): boolean {
  const userError = getUserFriendlyError(error);
  return userError.suggestions.length > 0;
}
