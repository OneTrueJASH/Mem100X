/**
 * Input size validation for MCP security
 * Prevents DoS attacks by limiting input sizes
 */

import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Size limits
export const INPUT_SIZE_LIMITS = {
  MAX_ARRAY_SIZE: 1000,
  MAX_STRING_LENGTH: 1024 * 1024, // 1MB
  MAX_TOTAL_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_OBSERVATION_LENGTH: 100 * 1024, // 100KB per observation
  MAX_ENTITY_NAME_LENGTH: 255,
  MAX_RELATION_TYPE_LENGTH: 100,
};

/**
 * Validates input size to prevent DoS attacks
 */
export function validateInputSize(input: any, path: string[] = []): void {
  const currentPath = path.join('.');
  
  if (input === null || input === undefined) {
    return;
  }
  
  // Check string length
  if (typeof input === 'string') {
    if (input.length > INPUT_SIZE_LIMITS.MAX_STRING_LENGTH) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `String at ${currentPath || 'root'} exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_STRING_LENGTH} characters`
      );
    }
    return;
  }
  
  // Check array size
  if (Array.isArray(input)) {
    if (input.length > INPUT_SIZE_LIMITS.MAX_ARRAY_SIZE) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Array at ${currentPath || 'root'} exceeds maximum size of ${INPUT_SIZE_LIMITS.MAX_ARRAY_SIZE} items`
      );
    }
    
    // Recursively validate array items
    input.forEach((item, index) => {
      validateInputSize(item, [...path, String(index)]);
    });
    return;
  }
  
  // Check object properties
  if (typeof input === 'object') {
    const size = JSON.stringify(input).length;
    if (size > INPUT_SIZE_LIMITS.MAX_TOTAL_REQUEST_SIZE) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Total request size exceeds maximum of ${INPUT_SIZE_LIMITS.MAX_TOTAL_REQUEST_SIZE} bytes`
      );
    }
    
    // Recursively validate object properties
    Object.entries(input).forEach(([key, value]) => {
      validateInputSize(value, [...path, key]);
    });
  }
}

/**
 * Validates entity-specific constraints
 */
export function validateEntityInput(entity: any): void {
  if (entity.name && entity.name.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Entity name exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH} characters`
    );
  }
  
  if (entity.observations) {
    entity.observations.forEach((obs: string, index: number) => {
      if (obs.length > INPUT_SIZE_LIMITS.MAX_OBSERVATION_LENGTH) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Observation at index ${index} exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_OBSERVATION_LENGTH} characters`
        );
      }
    });
  }
}

/**
 * Validates relation-specific constraints
 */
export function validateRelationInput(relation: any): void {
  if (relation.from && relation.from.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Relation 'from' exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH} characters`
    );
  }
  
  if (relation.to && relation.to.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Relation 'to' exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH} characters`
    );
  }
  
  if (relation.relationType && relation.relationType.length > INPUT_SIZE_LIMITS.MAX_RELATION_TYPE_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Relation type exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_RELATION_TYPE_LENGTH} characters`
    );
  }
}

/**
 * Middleware to validate tool inputs
 */
export function validateToolInput(toolName: string, args: any): void {
  // First, validate overall input size
  validateInputSize(args);
  
  // Then apply tool-specific validations
  switch (toolName) {
    case 'create_entities':
      if (args.entities) {
        args.entities.forEach((entity: any) => validateEntityInput(entity));
      }
      break;
      
    case 'create_relations':
      if (args.relations) {
        args.relations.forEach((relation: any) => validateRelationInput(relation));
      }
      break;
      
    case 'add_observations':
      if (args.observations) {
        args.observations.forEach((obs: any) => {
          if (obs.entityName && obs.entityName.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Entity name exceeds maximum length`
            );
          }
          if (obs.contents) {
            obs.contents.forEach((content: string, index: number) => {
              if (content.length > INPUT_SIZE_LIMITS.MAX_OBSERVATION_LENGTH) {
                throw new McpError(
                  ErrorCode.InvalidParams,
                  `Observation content at index ${index} exceeds maximum length`
                );
              }
            });
          }
        });
      }
      break;
      
    case 'search_nodes':
      if (args.query && args.query.length > 1000) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Search query exceeds maximum length of 1000 characters`
        );
      }
      break;
  }
}