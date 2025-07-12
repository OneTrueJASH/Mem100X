/**
 * MCP (Model Context Protocol) type definitions
 * Centralizes all MCP-related types for the Mem100x server
 */

import { RichContent } from './types.js';

/**
 * MCP Tool Definition
 * Structure for defining tools in the MCP protocol
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Tool Response
 * Standard response format for MCP tools
 * Must include both content and structuredContent for full compatibility
 */
export interface MCPToolResponse {
  content: RichContent[]; // Required field for MCP SDK validation
  structuredContent?: any; // Optional field for richer responses
}

/**
 * MCP Tool Names
 * All available tools in the Mem100x server
 */
export type MCPToolName =
  | 'set_context'
  | 'get_context_info'
  | 'create_entities'
  | 'search_nodes'
  | 'read_graph'
  | 'open_nodes'
  | 'create_relations'
  | 'delete_relations'
  | 'add_observations'
  | 'delete_observations'
  | 'delete_entities'
  | 'begin_transaction'
  | 'commit_transaction'
  | 'rollback_transaction'
  | 'create_backup'
  | 'restore_backup'
  | 'get_neighbors'
  | 'find_shortest_path';

/**
 * MCP Server Configuration
 * Configuration for the MCP server instance
 */
export interface MCPServerConfig {
  name: string;
  version: string;
}

/**
 * MCP Server Capabilities
 * Capabilities exposed by the MCP server
 */
export interface MCPServerCapabilities {
  capabilities: {
    tools: Record<string, never>;
    resources?: Record<string, never>;
    prompts?: Record<string, never>;
  };
}

/**
 * MCP Error Response
 * Standard error response format
 */
export interface MCPErrorResponse {
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Tool Input Types
 * Re-export from tool-schemas for convenience
 */
export type {
  SetContextInput,
  GetContextInfoInput,
  CreateEntitiesInput,
  SearchNodesInput,
  ReadGraphInput,
  OpenNodesInput,
  CreateRelationsInput,
  DeleteRelationsInput,
  AddObservationsInput,
  DeleteObservationsInput,
  DeleteEntitiesInput,
  BeginTransactionInput,
  CommitTransactionInput,
  RollbackTransactionInput,
  CreateBackupInput,
  RestoreBackupInput,
  GetNeighborsInput,
  FindShortestPathInput
} from './tool-schemas.js';

/**
 * Tool Performance Metrics
 * Standard performance metrics included in tool responses
 */
export interface ToolPerformanceMetrics {
  duration: string;
  rate?: string;
  resultCount?: number;
  entityCount?: number;
  relationCount?: number;
  totalEntities?: number;
  totalRelations?: number;
}

/**
 * Tool Success Response
 * Common success response structure
 */
export interface ToolSuccessResponse {
  success: boolean;
  performance: ToolPerformanceMetrics;
  [key: string]: any;
}

/**
 * Context Detection Response
 * Response structure for context detection operations
 */
export interface ContextDetectionResponse {
  detectedContext: string;
  confidence: string;
  scores: Record<string, any>;
}

/**
 * Helper function to create a proper MCP tool response
 * Ensures both content and structuredContent are included
 */
export function createMCPToolResponse(
  structuredContent: any,
  textContent?: string
): MCPToolResponse {
  const content: RichContent[] = [];

  if (textContent) {
    content.push({ type: 'text', text: textContent });
  } else if (structuredContent) {
    // Convert structured content to text representation
    const text = typeof structuredContent === 'string'
      ? structuredContent
      : JSON.stringify(structuredContent, null, 2);
    content.push({ type: 'text', text });
  }

  // Always ensure structuredContent is an object
  let wrappedStructuredContent = structuredContent;

  // If it's already an object and not null, check if it contains arrays
  if (typeof structuredContent === 'object' && structuredContent !== null) {
    // Check if any top-level properties are arrays and wrap them
    const processed: any = {};
    for (const [key, value] of Object.entries(structuredContent)) {
      if (Array.isArray(value)) {
        processed[key] = { items: value };
      } else {
        processed[key] = value;
      }
    }
    wrappedStructuredContent = processed;
  } else if (Array.isArray(structuredContent)) {
    wrappedStructuredContent = { result: structuredContent };
  } else if (
    typeof structuredContent !== 'object' || structuredContent === null
  ) {
    wrappedStructuredContent = { value: structuredContent };
  }

  return {
    content,
    structuredContent: wrappedStructuredContent,
  };
}
