/**
 * Input size validation for MCP security
 * Prevents DoS attacks by limiting input sizes
 */

import { McpError, ErrorCode } from '../types.js'
import { RichContentSchema } from '../tool-schemas.js';

// Size limits
export const INPUT_SIZE_LIMITS = {
  MAX_ARRAY_SIZE: 1000,
  MAX_STRING_LENGTH: 1024 * 1024, // 1MB
  MAX_TOTAL_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_OBSERVATION_LENGTH: 100 * 1024, // 100KB per observation
  MAX_ENTITY_NAME_LENGTH: 255,
  MAX_RELATION_TYPE_LENGTH: 100,
  MAX_BASE64_LENGTH: 10 * 1024 * 1024, // 10MB for base64 content
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
        `String at ${currentPath || 'root'} exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_STRING_LENGTH} characters`,
        ErrorCode.InvalidParams,
        null
      );
    }
    return;
  }

  // Check array size
  if (Array.isArray(input)) {
    if (input.length > INPUT_SIZE_LIMITS.MAX_ARRAY_SIZE) {
      throw new McpError(
        `Array at ${currentPath || 'root'} exceeds maximum size of ${INPUT_SIZE_LIMITS.MAX_ARRAY_SIZE} items`,
        ErrorCode.InvalidParams,
        null
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
        `Total request size exceeds maximum of ${INPUT_SIZE_LIMITS.MAX_TOTAL_REQUEST_SIZE} bytes`,
        ErrorCode.InvalidParams,
        null
      );
    }

    // Recursively validate object properties
    Object.entries(input).forEach(([key, value]) => {
      validateInputSize(value, [...path, key]);
    });
  }
}

/**
 * Validates content block against MCP specification
 */
export function validateContentBlock(content: any, path: string[] = []): void {
  const currentPath = path.join('.');

  try {
    RichContentSchema.parse(content);
  } catch (error) {
    throw new McpError(
      `Invalid content block at ${currentPath || 'root'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.InvalidParams,
      null
    );
  }

  // Additional size validation for content types
  if (content.type === 'text' && content.text) {
    if (content.text.length > INPUT_SIZE_LIMITS.MAX_OBSERVATION_LENGTH) {
      throw new McpError(
        `Text content at ${currentPath} exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_OBSERVATION_LENGTH} characters`,
        ErrorCode.InvalidParams,
        null
      );
    }
  }

  if (
    (content.type === 'image' || content.type === 'audio' || content.type === 'resource') &&
    content.data
  ) {
    if (content.data.length > INPUT_SIZE_LIMITS.MAX_BASE64_LENGTH) {
      throw new McpError(
        `${content.type} content at ${currentPath} exceeds maximum size of ${INPUT_SIZE_LIMITS.MAX_BASE64_LENGTH} bytes`,
        ErrorCode.InvalidParams,
        null
      );
    }
  }
}

/**
 * Validates entity-specific constraints
 */
export function validateEntityInput(entity: any): void {
  if (entity.name && entity.name.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
    throw new McpError(
      `Entity name exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH} characters`,
      ErrorCode.InvalidParams,
      null
    );
  }

  if (entity.observations) {
    if (!Array.isArray(entity.observations)) {
      throw new McpError(ErrorCode.InvalidParams, 'Entity observations must be an array', null);
    }

    entity.observations.forEach((obs: any, index: number) => {
      validateContentBlock(obs, ['observations', String(index)]);
    });
  }
}

/**
 * Validates relation-specific constraints
 */
export function validateRelationInput(relation: any): void {
  if (relation.from && relation.from.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
    throw new McpError(
      `Relation 'from' exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH} characters`,
      ErrorCode.InvalidParams,
      null
    );
  }

  if (relation.to && relation.to.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
    throw new McpError(
      `Relation 'to' exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH} characters`,
      ErrorCode.InvalidParams,
      null
    );
  }

  if (
    relation.relationType &&
    relation.relationType.length > INPUT_SIZE_LIMITS.MAX_RELATION_TYPE_LENGTH
  ) {
    throw new McpError(
      `Relation type exceeds maximum length of ${INPUT_SIZE_LIMITS.MAX_RELATION_TYPE_LENGTH} characters`,
      ErrorCode.InvalidParams,
      null
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
        if (!Array.isArray(args.entities)) {
          throw new McpError(ErrorCode.InvalidParams, 'Entities must be an array', null);
        }
        args.entities.forEach((entity: any, index: number) => {
          validateEntityInput(entity);
        });
      }
      break;

    case 'create_relations':
      if (args.relations) {
        if (!Array.isArray(args.relations)) {
          throw new McpError(ErrorCode.InvalidParams, 'Relations must be an array', null);
        }
        args.relations.forEach((relation: any, index: number) => {
          validateRelationInput(relation);
        });
      }
      break;

    case 'add_observations':
      if (args.observations) {
        if (!Array.isArray(args.observations)) {
          throw new McpError(ErrorCode.InvalidParams, 'Observations must be an array', null);
        }
        args.observations.forEach((obs: any, obsIndex: number) => {
          if (obs.entityName && obs.entityName.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH) {
            throw new McpError(ErrorCode.InvalidParams, `Entity name exceeds maximum length`, null);
          }
          if (obs.contents) {
            if (!Array.isArray(obs.contents)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                `Contents must be an array for observation at index ${obsIndex}`,
                null
              );
            }
            obs.contents.forEach((content: any, contentIndex: number) => {
              validateContentBlock(content, [
                'observations',
                String(obsIndex),
                'contents',
                String(contentIndex),
              ]);
            });
          }
        });
      }
      break;

    case 'delete_observations':
      if (args.deletions) {
        if (!Array.isArray(args.deletions)) {
          throw new McpError(ErrorCode.InvalidParams, 'Deletions must be an array', null);
        }
        args.deletions.forEach((deletion: any, index: number) => {
          if (
            deletion.entityName &&
            deletion.entityName.length > INPUT_SIZE_LIMITS.MAX_ENTITY_NAME_LENGTH
          ) {
            throw new McpError(ErrorCode.InvalidParams, `Entity name exceeds maximum length`, null);
          }
          if (deletion.observations) {
            if (!Array.isArray(deletion.observations)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                `Observations must be an array for deletion at index ${index}`,
                null
              );
            }
            deletion.observations.forEach((obs: any, obsIndex: number) => {
              validateContentBlock(obs, [
                'deletions',
                String(index),
                'observations',
                String(obsIndex),
              ]);
            });
          }
        });
      }
      break;

    case 'search_nodes':
      if (args.query && args.query.length > 1000) {
        throw new McpError(
          `Search query exceeds maximum length of 1000 characters`,
          ErrorCode.InvalidParams,
          null
        );
      }
      break;
  }
}
