/**
 * Zod schemas for tool input validation
 * Provides type safety and runtime validation for all MCP tools
 */

import { z } from 'zod';

// MCP Content Block Union Schema - matches official MCP specification
const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1, 'Text content cannot be empty'),
});

const ImageContentSchema = z.object({
  type: z.literal('image'),
  data: z.string().min(1, 'Image data cannot be empty'),
  mimeType: z.string().min(1, 'MIME type cannot be empty'),
});

const AudioContentSchema = z.object({
  type: z.literal('audio'),
  data: z.string().min(1, 'Audio data cannot be empty'),
  mimeType: z.string().min(1, 'MIME type cannot be empty'),
});

const ResourceLinkContentSchema = z.object({
  type: z.literal('resource_link'),
  uri: z.string().min(1, 'URI cannot be empty'),
  title: z.string().optional(),
  description: z.string().optional(),
});

const ResourceContentSchema = z.object({
  type: z.literal('resource'),
  data: z.string().min(1, 'Resource data cannot be empty'),
  mimeType: z.string().min(1, 'MIME type cannot be empty'),
  title: z.string().optional(),
  description: z.string().optional(),
});

// Discriminated union for all content types
const RichContentSchema = z.discriminatedUnion('type', [
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
  ResourceLinkContentSchema,
  ResourceContentSchema,
]);

// Entity schemas
const EntitySchema = z.object({
  name: z.string().min(1, 'Entity name cannot be empty'),
  entityType: z.string().min(1, 'Entity type cannot be empty'),
  observations: z.array(RichContentSchema).min(1, 'At least one observation is required'),
});

const RelationSchema = z.object({
  from: z.string().min(1, 'From entity cannot be empty'),
  to: z.string().min(1, 'To entity cannot be empty'),
  relationType: z.string().min(1, 'Relation type cannot be empty'),
});

const ObservationUpdateSchema = z.object({
  entityName: z.string().min(1, 'Entity name cannot be empty'),
  contents: z.array(RichContentSchema).min(1, 'At least one observation is required'),
});

const ObservationDeletionSchema = z.object({
  entityName: z.string().min(1, 'Entity name cannot be empty'),
  observations: z.array(RichContentSchema).min(1, 'At least one observation to delete is required'),
});

// Tool input schemas
export const toolSchemas = {
  // Context management
  set_context: z.object({
    context: z.string().min(1, 'Context name cannot be empty'),
  }),

  get_context_info: z.object({}),

  // Entity operations
  create_entities: z.object({
    entities: z.array(EntitySchema).min(1, 'At least one entity is required'),
    context: z.string().optional(),
  }),

  search_nodes: z.object({
    query: z.string().min(1, 'Search query cannot be empty'),
    limit: z.number().int().positive().default(20).optional(),
    context: z.string().optional(),
    allContexts: z.boolean().default(false).optional(),
  }),

  read_graph: z.object({
    limit: z.number().int().positive().optional(),
    offset: z.number().int().min(0).default(0).optional(),
    context: z.string().optional(),
  }),

  open_nodes: z.object({
    names: z.array(z.string()).min(1, 'At least one entity name is required'),
    context: z.string().optional(),
  }),

  // Relation operations
  create_relations: z.object({
    relations: z.array(RelationSchema).min(1, 'At least one relation is required'),
  }),

  delete_relations: z.object({
    relations: z.array(RelationSchema).min(1, 'At least one relation is required'),
  }),

  // Observation operations
  add_observations: z.object({
    observations: z.array(ObservationUpdateSchema).min(1, 'At least one observation update is required'),
  }),

  delete_observations: z.object({
    deletions: z.array(ObservationDeletionSchema).min(1, 'At least one deletion is required'),
  }),

  // Entity deletion
  delete_entities: z.object({
    entityNames: z.array(z.string()).min(1, 'At least one entity name is required'),
  }),

  // Transaction management
  begin_transaction: z.object({
    name: z.string().optional().describe('Optional transaction name for debugging'),
  }),

  commit_transaction: z.object({}),

  rollback_transaction: z.object({}),

  // Backup and restore
  create_backup: z.object({
    backupPath: z.string().optional().describe('Path for the backup file. If not provided, a timestamped backup will be created in the default backup directory'),
    context: z.string().optional().describe('Specific context to backup. If not provided, backs up current context'),
  }),

  restore_backup: z.object({
    backupPath: z.string().describe('Path to the backup file to restore'),
    context: z.string().optional().describe('Context to restore to. If not provided, restores to current context'),
    confirmRestore: z.boolean().describe('Must be true to confirm the restore operation'),
  }),

  // Graph traversal operations
  get_neighbors: z.object({
    entityName: z.string().min(1, 'Entity name is required'),
    direction: z.enum(['outgoing', 'incoming', 'both']).default('both').optional()
      .describe('Direction of relations to follow'),
    relationType: z.string().optional()
      .describe('Filter by specific relation type'),
    depth: z.number().int().min(1).max(5).default(1).optional()
      .describe('How many hops to traverse (1-5)'),
    includeRelations: z.boolean().default(true).optional()
      .describe('Include relation details in response'),
    context: z.string().optional()
      .describe('Specific context to search in'),
  }),

  find_shortest_path: z.object({
    from: z.string().min(1, 'Source entity name is required'),
    to: z.string().min(1, 'Target entity name is required'),
    bidirectional: z.boolean().default(true).optional()
      .describe('Whether to follow relations in both directions'),
    relationType: z.string().optional()
      .describe('Filter by specific relation type'),
    maxDepth: z.number().int().min(1).max(10).default(6).optional()
      .describe('Maximum path length to search (1-10)'),
    context: z.string().optional()
      .describe('Specific context to search in'),
  }),
};

// Type exports for use in handlers
export type SetContextInput = z.infer<typeof toolSchemas.set_context>;
export type GetContextInfoInput = z.infer<typeof toolSchemas.get_context_info>;
export type CreateEntitiesInput = z.infer<typeof toolSchemas.create_entities>;
export type SearchNodesInput = z.infer<typeof toolSchemas.search_nodes>;
export type ReadGraphInput = z.infer<typeof toolSchemas.read_graph>;
export type OpenNodesInput = z.infer<typeof toolSchemas.open_nodes>;
export type CreateRelationsInput = z.infer<typeof toolSchemas.create_relations>;
export type DeleteRelationsInput = z.infer<typeof toolSchemas.delete_relations>;
export type AddObservationsInput = z.infer<typeof toolSchemas.add_observations>;
export type DeleteObservationsInput = z.infer<typeof toolSchemas.delete_observations>;
export type DeleteEntitiesInput = z.infer<typeof toolSchemas.delete_entities>;
export type BeginTransactionInput = z.infer<typeof toolSchemas.begin_transaction>;
export type CommitTransactionInput = z.infer<typeof toolSchemas.commit_transaction>;
export type RollbackTransactionInput = z.infer<typeof toolSchemas.rollback_transaction>;
export type CreateBackupInput = z.infer<typeof toolSchemas.create_backup>;
export type RestoreBackupInput = z.infer<typeof toolSchemas.restore_backup>;
export type GetNeighborsInput = z.infer<typeof toolSchemas.get_neighbors>;
export type FindShortestPathInput = z.infer<typeof toolSchemas.find_shortest_path>;

// Export content schemas for validation
export {
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
  ResourceLinkContentSchema,
  ResourceContentSchema,
  RichContentSchema,
};

// Helper to validate tool input
export function validateToolInput<T extends keyof typeof toolSchemas>(
  toolName: T,
  input: unknown
): z.infer<typeof toolSchemas[T]> {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new Error(`No schema defined for tool: ${toolName}`);
  }

  return schema.parse(input);
}
