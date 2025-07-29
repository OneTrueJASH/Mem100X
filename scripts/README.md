# Scripts

This directory contains utility scripts for the Mem100x project.

## API Reference Generation

### `generate-api-reference.js`

Automatically generates a comprehensive API reference document from the Zod schemas and tool definitions in the codebase.

#### Usage

```bash
# Generate API reference
npm run generate-api-reference

# Or run directly
node scripts/generate-api-reference.js
```

#### What it does

1. **Extracts tool information** from `src/tool-schemas.ts` and `src/tool-definitions.ts`
2. **Generates comprehensive documentation** including:
   - All 49+ tools across 12 categories
   - Parameter specifications with types, descriptions, and defaults
   - Performance metrics for key operations
   - Error codes and descriptions
   - Rate limits and best practices
   - Data type definitions
3. **Outputs** a complete `API_REFERENCE.md` file

#### Features

- **Auto-updating**: Regenerates from source schemas
- **Comprehensive**: Covers all tools and parameters
- **Accurate**: Reflects actual implementation
- **Well-structured**: Organized by category with clear navigation
- **Performance-aware**: Includes performance metrics for key operations

#### Categories Covered

1. **Context Management** - Context creation, switching, and management
2. **Entity Operations** - Creating and deleting entities
3. **Search Operations** - Various search capabilities with performance metrics
4. **Relation Operations** - Managing entity relationships
5. **Observation Operations** - Adding and removing observations
6. **Transaction Management** - Atomic operations
7. **Backup & Restore** - Data backup and recovery
8. **Graph Traversal** - Path finding and neighbor discovery
9. **System Resilience** - Corruption detection and recovery
10. **Privacy & Security** - Access control and data protection
11. **Memory Export/Import** - Data migration and backup
12. **File Operations** - Workspace file management

#### Performance Metrics Included

- **Entity Creation**: 59,780+ entities/sec
- **Relation Creation**: 261,455+ relations/sec
- **Search Performance**: 8,829 searches/sec (88x faster with FTS5)

#### Rate Limits Documented

- Read Operations: 1000 requests/minute
- Write Operations: 100 requests/minute
- Search Operations: 500 requests/minute
- Context Operations: 50 requests/minute
- System Operations: 20 requests/minute

#### Error Codes Covered

- Standard errors (InvalidParams, MethodNotFound, etc.)
- Destructive operation errors
- Search-specific errors
- Transaction errors
- Backup/restore errors

#### Best Practices Included

- Performance optimization tips
- Security guidelines
- Data integrity recommendations

### Keeping the API Reference Updated

The API reference should be regenerated whenever:

1. **New tools are added** to the codebase
2. **Tool parameters change** in the Zod schemas
3. **Tool descriptions are updated** in the definitions
4. **Performance metrics change**
5. **Rate limits are modified**

To ensure the API reference stays current, consider:

- Running the script as part of your CI/CD pipeline
- Adding it to your pre-commit hooks
- Running it before major releases
- Including it in your documentation update workflow

### Customization

The script can be customized by modifying:

- `TOOL_CATEGORIES` - Change how tools are organized
- `PERFORMANCE_METRICS` - Update performance numbers
- `RATE_LIMITS` - Modify rate limit documentation
- `ERROR_CODES` - Add new error codes
- Template sections - Modify the generated content structure

### Integration

The generated `API_REFERENCE.md` can be:

- Included in your project documentation
- Published to documentation sites
- Used for API client generation
- Referenced in tutorials and guides
- Integrated with OpenAPI/Swagger tools 
