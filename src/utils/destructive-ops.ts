/**
 * Destructive operation safety checks
 * Ensures dangerous operations require explicit confirmation
 */

import { McpError, ErrorCode } from '../types.js'

// List of destructive operations that require confirmation
export const DESTRUCTIVE_OPERATIONS = [
  'delete_entities',
  'delete_relations',
  'delete_observations',
  'rollback_transaction',
];

/**
 * Checks if an operation requires confirmation
 */
export function isDestructiveOperation(toolName: string): boolean {
  return DESTRUCTIVE_OPERATIONS.includes(toolName);
}

/**
 * Validates confirmation for destructive operations
 */
export function validateDestructiveOperation(toolName: string, args: any): void {
  if (!isDestructiveOperation(toolName)) {
    return;
  }

  // Check for confirmation flag
  if (!args.confirm || args.confirm !== true) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Destructive operation '${toolName}' requires explicit confirmation. Please add "confirm": true to your request.`
    );
  }
}

/**
 * Adds safety information to destructive tool definitions
 */
export function addDestructiveSafetyInfo(toolDefinition: any, toolName: string): any {
  if (!isDestructiveOperation(toolName)) {
    return toolDefinition;
  }

  // Clone the definition to avoid mutation
  const safeDef = JSON.parse(JSON.stringify(toolDefinition));

  // Add confirm property to input schema
  if (!safeDef.inputSchema.properties.confirm) {
    safeDef.inputSchema.properties.confirm = {
      type: 'boolean',
      description: 'Required confirmation for this destructive operation. Must be true.',
    };

    // Add to required fields if not already there
    if (!safeDef.inputSchema.required) {
      safeDef.inputSchema.required = [];
    }
    if (!safeDef.inputSchema.required.includes('confirm')) {
      safeDef.inputSchema.required.push('confirm');
    }
  }

  // Update description to mention confirmation requirement
  if (safeDef.description && !safeDef.description.includes('requires confirmation')) {
    safeDef.description += ' ⚠️ This is a destructive operation and requires confirmation.';
  }

  return safeDef;
}
