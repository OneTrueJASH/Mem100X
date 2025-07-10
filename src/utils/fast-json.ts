/**
 * Optimized JSON utilities
 * Uses native JSON with additional validation and error handling
 */

// Optimized stringify for observation arrays with validation
export function stringifyObservations(observations: string[]): string {
  return JSON.stringify(observations);
}

// Optimized parse for observations with validation
export function parseObservations(json: string): string[] {
  try {
    if (!json || json === null || json === undefined) {
      return [];
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Ensure all items are strings
    return parsed.map(item => String(item));
  } catch {
    return [];
  }
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
  observations: string[];
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
    
    // Ensure observations is an array
    if (!parsed.observations || !Array.isArray(parsed.observations)) {
      parsed.observations = [];
    }
    
    return {
      type: 'entity',
      name: parsed.name,
      entityType: parsed.entityType,
      observations: parsed.observations.map((o: any) => String(o))
    };
  } catch {
    return null;
  }
}