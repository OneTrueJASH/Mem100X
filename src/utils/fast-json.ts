/**
 * Optimized JSON utilities
 * Uses native JSON with additional validation and error handling
 */

import { RichContent, TextContent, ImageContent, AudioContent, ResourceLinkContent, ResourceContent } from '../types.js';
import { RichContentSchema } from '../tool-schemas.js';

// Optimized stringify for observation arrays with validation
export function stringifyObservations(observations: RichContent[]): string {
  return JSON.stringify(observations);
}

// Optimized parse for observations with validation
export function parseObservations(json: string): RichContent[] {
  try {
    if (!json || json === null || json === undefined) {
      return [];
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Validate each item against the content block union schema
    return parsed.map(item => {
      if (typeof item === 'string') {
        // Backward compatibility: convert string to RichContent
        return { type: 'text', text: item } as TextContent;
      }

      if (item && typeof item === 'object' && item.type) {
        // Validate against the complete content block union
        try {
          return RichContentSchema.parse(item);
        } catch {
          // If validation fails, try to convert to text content
          if (item.text) {
            return { type: 'text', text: String(item.text) } as TextContent;
          }
          // Invalid item, skip it
          return null;
        }
      }

      // Invalid item, skip it
      return null;
    }).filter(Boolean) as RichContent[];
  } catch {
    return [];
  }
}

// Helper function to convert string observations to RichContent (for backward compatibility)
export function stringToRichContent(observations: string[]): RichContent[] {
  return observations.map(text => ({ type: 'text', text } as TextContent));
}

// Helper function to extract text from RichContent observations
export function richContentToText(observations: RichContent[]): string[] {
  return observations.map(obs => {
    switch (obs.type) {
      case 'text':
        return obs.text;
      case 'image':
        return `[Image: ${obs.mimeType}]`;
      case 'audio':
        return `[Audio: ${obs.mimeType}]`;
      case 'resource_link':
        return `[Resource Link: ${obs.uri}]`;
      case 'resource':
        return `[Resource: ${obs.mimeType}]`;
      default:
        return '[Unknown Content]';
    }
  });
}

// Helper function to validate content blocks
export function validateContentBlock(content: any): content is RichContent {
  try {
    RichContentSchema.parse(content);
    return true;
  } catch {
    return false;
  }
}

// Helper function to create text content
export function createTextContent(text: string): TextContent {
  return { type: 'text', text };
}

// Helper function to create image content
export function createImageContent(data: string, mimeType: string): ImageContent {
  return { type: 'image', data, mimeType };
}

// Helper function to create audio content
export function createAudioContent(data: string, mimeType: string): AudioContent {
  return { type: 'audio', data, mimeType };
}

// Helper function to create resource link content
export function createResourceLinkContent(uri: string, title?: string, description?: string): ResourceLinkContent {
  return { type: 'resource_link', uri, title, description };
}

// Helper function to create resource content
export function createResourceContent(data: string, mimeType: string, title?: string, description?: string): ResourceContent {
  return { type: 'resource', data, mimeType, title, description };
}

// Optimized stringifier for tool responses
export function stringifyToolResponse(obj: any): string {
  return JSON.stringify(obj);
}

// Generic stringify with pretty print support
export function stringifyGeneric(obj: any, pretty = false): string {
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

// Parse with error handling
export function parseJSON<T>(json: string): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// EntityResult type (minimal definition for fast-json)
interface EntityResult {
  type: 'entity';
  name: string;
  entityType: string;
  observations: RichContent[];
}

// Stringify EntityResult
export function stringifyEntityResult(entity: EntityResult): string {
  return JSON.stringify(entity);
}

// Parse EntityResult with validation
export function parseEntityResult(json: string): EntityResult | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.type !== 'entity' || !parsed.name || !parsed.entityType) {
      return null;
    }

    // Ensure observations is an array of valid content blocks
    if (!parsed.observations || !Array.isArray(parsed.observations)) {
      parsed.observations = [];
    } else {
      // Validate each observation
      parsed.observations = parsed.observations.map((obs: any) => {
        if (validateContentBlock(obs)) {
          return obs;
        }
        // Convert invalid observations to text
        if (typeof obs === 'string') {
          return createTextContent(obs);
        }
        if (obs && typeof obs === 'object' && obs.text) {
          return createTextContent(String(obs.text));
        }
        return null;
      }).filter(Boolean);
    }

    return {
      type: 'entity',
      name: parsed.name,
      entityType: parsed.entityType,
      observations: parsed.observations
    };
  } catch {
    return null;
  }
}
