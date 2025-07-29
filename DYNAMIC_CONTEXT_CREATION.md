# Dynamic Context Creation

## Overview

This document describes the implementation of dynamic context creation in Mem100x, allowing users to create new memory contexts beyond the default "personal" and "work" contexts. This feature enables flexible organization of different types of information (projects, hobbies, studies, etc.).

## Implementation Details

### 1. Core Architecture

The dynamic context creation system extends the existing `MultiDatabaseManager` with the following capabilities:

- **Persistent Configuration**: Context configurations are saved to `data/contexts.json`
- **Dynamic Database Creation**: New contexts get their own SQLite database files
- **Automatic Context Detection**: Updated confidence scoring for new contexts
- **Context Management**: Create, update, delete, and list contexts

### 2. New Methods in MultiDatabaseManager

#### `createContext(name, options)`

Creates a new memory context with the specified configuration:

```typescript
createContext(
  name: string,
  options: {
    path?: string;
    patterns?: string[];
    entityTypes?: string[];
    description?: string;
  } = {}
): string
```

**Parameters:**

- `name`: Context name (lowercase letters, numbers, hyphens, underscores only)
- `path`: Optional custom database path
- `patterns`: Patterns for automatic context detection
- `entityTypes`: Entity types commonly found in this context
- `description`: Human-readable description

**Returns:** Success message with context details

#### `deleteContext(name, force)`

Deletes a context and its associated database:

```typescript
deleteContext(name: string, force: boolean = false): string
```

**Parameters:**

- `name`: Context name to delete
- `force`: Force deletion even if context contains entities

**Safety Features:**

- Cannot delete current context (must switch first)
- Requires confirmation for contexts with entities
- Properly closes database connections

#### `updateContext(name, updates)`

Updates the configuration of an existing context:

```typescript
updateContext(
  name: string,
  updates: {
    patterns?: string[];
    entityTypes?: string[];
    description?: string;
  }
): string
```

#### `listContexts()`

Returns detailed information about all available contexts:

```typescript
listContexts(): Array<{
  name: string;
  path: string;
  patterns: string[];
  entityTypes: string[];
  entityCount: number;
  relationCount: number;
  isCurrent: boolean;
}>
```

### 3. MCP Tool Integration

#### New Tools Added

1. **`create_context`**: Create new memory contexts
2. **`delete_context`**: Delete contexts (with safety confirmation)
3. **`update_context`**: Update context configuration
4. **`list_contexts`**: List all available contexts

#### Tool Schemas

All new tools include proper validation:

- Context name validation (lowercase, alphanumeric, hyphens, underscores)
- Required confirmation for destructive operations
- Comprehensive error handling

### 4. Configuration Persistence

Context configurations are automatically saved to `data/contexts.json`:

```json
{
  "databases": {
    "personal": {
      "path": "./data/personal.db",
      "patterns": ["personal", "family", "health", "hobby"],
      "entityTypes": ["person", "family_member", "friend"]
    },
    "work": {
      "path": "./data/work.db", 
      "patterns": ["work", "project", "colleague", "meeting"],
      "entityTypes": ["project", "company", "colleague"]
    },
    "my-project": {
      "path": "./data/my-project.db",
      "patterns": ["project", "development", "feature"],
      "entityTypes": ["feature", "bug", "requirement"]
    }
  },
  "defaultContext": "personal",
  "autoDetect": true
}
```

### 5. Safety Features

#### Destructive Operation Protection

- `delete_context` requires explicit confirmation (`force: true`)
- Cannot delete current context (must switch first)
- Validation prevents deletion of contexts with entities unless forced

#### Data Integrity

- Automatic database directory creation
- Proper connection cleanup
- Transaction safety during context operations

#### Error Handling

- Comprehensive validation of context names
- Graceful handling of missing configuration files
- Clear error messages for all failure cases

### 6. Usage Examples

#### Creating a Project Context

```json
{
  "name": "my-project",
  "patterns": ["project", "development", "feature", "bug"],
  "entityTypes": ["feature", "bug", "requirement", "task"],
  "description": "My software development project"
}
```

#### Creating a Study Context

```json
{
  "name": "study-notes",
  "patterns": ["study", "course", "lecture", "assignment"],
  "entityTypes": ["course", "lecture", "assignment", "concept"],
  "description": "Academic study materials and notes"
}
```

#### Creating a Hobby Context

```json
{
  "name": "photography",
  "patterns": ["photo", "camera", "lens", "shoot"],
  "entityTypes": ["photo", "equipment", "location", "technique"],
  "description": "Photography hobby and equipment"
}
```

### 7. Performance Considerations

- **Fast Context Creation**: New contexts are created instantly
- **Efficient Storage**: Each context uses its own optimized database
- **Memory Efficient**: Contexts are loaded on-demand
- **Scalable**: No limit on number of contexts (limited by disk space)

### 8. Integration with Existing Features

#### Context Detection

- New contexts automatically participate in context detection
- Confidence scoring includes patterns and entity types from new contexts
- Seamless integration with existing personal/work contexts

#### Search and Retrieval

- All existing search functionality works with new contexts
- Cross-context search capabilities maintained
- Context-aware search enhancements apply to all contexts

#### Memory Aging

- Memory aging system works across all contexts
- Each context maintains its own aging statistics
- Prominence scoring is context-aware

## Benefits

1. **Flexibility**: Organize information by project, topic, or any other criteria
2. **Scalability**: No artificial limits on context organization
3. **User Control**: Full control over context creation and management
4. **Safety**: Built-in protections against accidental data loss
5. **Performance**: Each context is optimized independently
6. **Persistence**: Context configurations survive restarts

## Future Enhancements

Potential future improvements:

- Context templates for common use cases
- Context sharing and collaboration features
- Advanced context merging and splitting
- Context-specific privacy and security settings
- Context backup and restore functionality
