# Contributing to Mem100x

First off, thank you for considering contributing to Mem100x! We're building the FASTEST, most reliable, and most maintainable MCP memory server, and your help can make it even better.

## How Can I Contribute?

### Reporting Bugs

Found a performance or reliability issue? Let us know!

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title describing the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - **Performance metrics** (very important!)
   - Your environment details

### Suggesting Enhancements

Have an idea to make Mem100x even faster, more reliable, or easier to use?

1. Check if it's already suggested
2. Create an issue with:
   - Clear description of the enhancement
   - Why it would be useful
   - **Performance or maintainability impact analysis**
   - Possible implementation approach

### Pull Requests

Ready to contribute code? Awesome!

#### Setup

```bash
# Fork and clone
git clone https://github.com/yourusername/mem100x.git
cd mem100x

# Install dependencies
npm install

# Create a branch
git checkout -b feature/your-amazing-feature
```

#### Development Guidelines

1. **Performance First**: Every change must maintain or improve performance
2. **Multi-Context & MCP Compliance**: Do not break multi-context support or MCP protocol compliance
3. **TypeScript Strict**: All code must pass strict type checking
4. **Maintainability**: Keep code simple, clear, and well-documented
5. **Small Functions**: Keep functions under 50 lines
6. **Clear Names**: Use descriptive variable and function names

#### Before Submitting

```bash
# Run type checking
npm run build

# Ensure the code compiles without errors
# Performance standards must be maintained
```

#### PR Requirements

- [ ] Passes all TypeScript checks
- [ ] Performance impact has been considered
- [ ] Performance is maintained or improved
- [ ] Multi-context and MCP compliance are maintained
- [ ] Documentation is updated
- [ ] Commit messages are clear

### Performance Standards

Any PR must meet these standards:

- Entity creation: > 100,000/sec
- Search time: < 1ms
- No memory leaks
- Cache hit rate: > 95% when applicable

### Quality Assurance

Every change must:

1. Compile successfully with TypeScript strict mode
2. Maintain performance standards
3. Work with both single and multi-context modes
4. Include appropriate error handling

## Priority Areas

We especially welcome contributions in:

1. **Performance Optimizations**: Make it even faster!
2. **Multi-Context Enhancements**: Smarter context detection, cross-context features
3. **Benchmarks**: More comprehensive and comparative testing
4. **Documentation & Onboarding**: Examples, tutorials, guides, onboarding improvements
5. **Reliability & Maintainability**: Error handling, code clarity, test coverage

## Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for public methods
- Keep lines under 100 characters
- Use meaningful variable names

Example:

```typescript
/**
 * Searches entities with blazing speed
 * @param query - Search query
 * @param limit - Maximum results (default: 20)
 * @returns Matching entities and relations
 */
searchNodes(query: string, limit: number = 20): GraphResult {
  // Implementation
}
```

## Quick Wins

Looking for easy contributions?

- Add more examples
- Improve error messages
- Add debug logging options
- Create example use cases
- Improve documentation and onboarding

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

**Thank You!**

Every contribution, no matter how small, helps make Mem100x better. We appreciate your time and effort!

**Let's make the FASTEST, most reliable MCP server even BETTER together!**
