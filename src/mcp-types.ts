/**
 * MCP (Model Context Protocol) type definitions
 * Centralizes all MCP-related types for the Mem100x server
 */

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
 */
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
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
  | 'delete_entities';

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
  DeleteEntitiesInput
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