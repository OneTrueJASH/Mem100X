# Clear Error Messages

Mem100x provides comprehensive, user-friendly error messages that help users understand and resolve issues quickly. This document explains the error handling system and how to use it effectively.

## Overview

The Clear Error Messages feature ensures that all errors in Mem100x are:

- **Descriptive**: Clear explanations of what went wrong
- **Actionable**: Specific suggestions for resolving the issue
- **Categorized**: Organized by severity and type
- **Helpful**: Include troubleshooting guides and commands

## Error Categories

### Severity Levels

- **Low**: Minor issues that don't affect functionality
- **Medium**: Issues that may affect some operations
- **High**: Issues that prevent normal operation
- **Critical**: Issues that require immediate attention

### Error Types

- **Validation**: Input validation failures
- **Configuration**: Settings and environment issues
- **Database**: Data storage and retrieval problems
- **Network**: Communication and connectivity issues
- **Permission**: Access control and file permission problems
- **System**: General system and runtime issues

## Error Message Structure

Each error response includes:

```json
{
  "error": {
    "code": -32602,
    "message": "User-friendly error message",
    "data": {
      "type": "EntityNotFoundError",
      "severity": "low",
      "category": "database",
      "suggestions": [
        {
          "action": "Check spelling",
          "description": "Verify the entity name is spelled correctly"
        }
      ],
      "troubleshooting": "This usually means the information was never stored...",
      "technicalDetails": "Original technical error message"
    }
  }
}
```

## Common Error Scenarios

### Entity Not Found

**Error**: `EntityNotFoundError`

**User Message**: "The requested information wasn't found in your memory"

**Suggestions**:

1. Check spelling - Verify the entity name is spelled correctly
2. Search broadly - Try a broader search term to find related information
3. Check context - Make sure you're in the right context (personal vs work)

**Troubleshooting**: This usually means the information was never stored or was deleted. Try searching with different terms.

### Invalid Context

**Error**: `InvalidContextError`

**User Message**: "Invalid context specified"

**Suggestions**:

1. Use valid contexts - Available contexts: personal, work
2. Check context name - Context names are case-sensitive
3. Auto-detect context - Let Mem100x automatically detect the context

**Troubleshooting**: Mem100x uses contexts to organize your information. Personal context is for private information, work context is for professional information.

### Configuration Issues

**Error**: `MissingConfigError` / `InvalidConfigError`

**User Message**: "Required configuration is missing" / "Configuration contains invalid settings"

**Suggestions**:

1. Copy example config - `cp env.example .env`
2. Validate configuration - `npm run config:validate`
3. Check documentation - Review the configuration guide

**Troubleshooting**: Mem100x requires certain configuration settings to run properly. The example configuration file provides sensible defaults.

### Database Issues

**Error**: `TransactionError` / Database lock errors

**User Message**: "Database transaction failed" / "Database is temporarily locked"

**Suggestions**:

1. Retry operation - Try the operation again
2. Check disk space - `df -h`
3. Restart server - `npm start`

**Troubleshooting**: Database issues usually indicate temporary problems. Retrying the operation often resolves the issue.

### Permission Issues

**Error**: Permission denied errors

**User Message**: "Permission denied - insufficient access rights"

**Suggestions**:

1. Check file permissions - `ls -la data/`
2. Fix permissions - `chmod 755 data/`
3. Run as correct user - Ensure you're running as the correct user

**Troubleshooting**: Permission errors occur when the application cannot access required files or directories.

## Error Message Formatting

The system provides formatted error messages with emojis and clear structure:

```plaintext
❌ The requested information wasn't found in your memory

💡 Suggestions:
1. Check spelling: Verify the entity name is spelled correctly
2. Search broadly: Try a broader search term to find related information
3. Check context: Make sure you're in the right context (personal vs work)

🔧 Troubleshooting: This usually means the information was never stored or was deleted. Try searching with different terms.
```

## Error Handling Best Practices

### For Users

1. **Read the full error message** - Don't just look at the first line
2. **Follow the suggestions** - Try the recommended actions in order
3. **Check the troubleshooting section** - Understand why the error occurred
4. **Use the technical details** - For advanced debugging if needed

### For Developers

1. **Use specific error types** - Create appropriate error classes
2. **Provide context** - Include relevant information in error context
3. **Add suggestions** - Always provide actionable next steps
4. **Include troubleshooting** - Explain the root cause when helpful

## Error Testing

The system includes comprehensive tests for error messages:

```bash
# Run error message tests
node test-clear-error-messages.js
```

Tests validate:

- Error message formatting
- Error categorization
- Specific error patterns
- Server error responses

## Error Message Customization

### Adding New Error Types

1. Create a new error class in `src/errors.ts`:

  ```typescript
  export class CustomError extends Mem100xError {
    constructor(message: string, context?: Record<string, any>) {
      super(message, context);
    }
  }
  ```

2. Add user-friendly message in `src/utils/error-messages.ts`:

  ```typescript
  'CustomError': {
    message: 'User-friendly description',
    severity: 'medium',
    category: 'validation',
    suggestions: [
      {
        action: 'Action to take',
        description: 'Description of the action'
      }
    ],
    troubleshooting: 'Explanation of the issue'
  }
  ```

### Modifying Existing Messages

Edit the `ERROR_MESSAGES` object in `src/utils/error-messages.ts` to customize existing error messages.

## Error Logging

Errors are logged with full context for debugging:

```typescript
logError('Error executing tool: search_nodes', error, {
  args,
  mcpError,
  correlationId,
});
```

## Integration with MCP Protocol

All errors are properly mapped to MCP/JSON-RPC error codes:

- **-32602**: Invalid Params (validation errors)
- **-32601**: Method Not Found (tool not found)
- **-32603**: Internal Error (system errors)

## Performance Considerations

- Error message lookup is optimized for fast access
- User-friendly messages are cached after first lookup
- Technical details are preserved for debugging
- Error context is structured for efficient processing

## Troubleshooting Common Issues

### Error Messages Not Appearing

1. Check if the error class is properly registered
2. Verify the error message mapping exists
3. Ensure the MCP error creation is working

### Generic Error Messages

1. Add specific error handling for the error type
2. Create a user-friendly message template
3. Include relevant suggestions and troubleshooting

### Missing Error Context

1. Ensure error classes include context in constructor
2. Verify error data is being passed through
3. Check error serialization in MCP responses

## Future Enhancements

- **Internationalization**: Support for multiple languages
- **Error Analytics**: Track common errors for improvement
- **Dynamic Suggestions**: Context-aware error suggestions
- **Error Recovery**: Automatic error recovery mechanisms

## Conclusion

The Clear Error Messages feature ensures that users can quickly understand and resolve issues with Mem100x. By providing descriptive, actionable error messages with helpful suggestions and troubleshooting guides, the system reduces user frustration and improves the overall experience.

For more information about error handling in Mem100x, see the [Configuration Guide](CONFIGURATION.md) and [Deployment Guide](DEPLOYMENT.md).
