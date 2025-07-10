# 🤝 Contributing to Mem100x

First off, thank you for considering contributing to Mem100x! We're building the FASTEST MCP memory server, and your help can make it even better.

## 🚀 How Can I Contribute?

### 🐛 Reporting Bugs

Found a performance issue? Let us know!

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title describing the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - **Performance metrics** (very important!)
   - Your environment details

### 💡 Suggesting Enhancements

Have an idea to make Mem100x even faster? We're all ears!

1. Check if it's already suggested
2. Create an issue with:
   - Clear description of the enhancement
   - Why it would be useful
   - **Performance impact analysis**
   - Possible implementation approach

### 🔧 Pull Requests

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
2. **TypeScript Strict**: All code must pass strict type checking
3. **Benchmarks Required**: Add benchmarks for new features
4. **Small Functions**: Keep functions under 50 lines
5. **Clear Names**: Use descriptive variable and function names

#### Before Submitting

```bash
# Run type checking
npm run build

# Run ALL benchmarks
npx tsx benchmark/full-benchmark.ts
npx tsx benchmark/optimization-benchmark.ts

# Ensure performance hasn't degraded!
```

#### PR Requirements

- [ ] Passes all TypeScript checks
- [ ] Includes benchmarks for new features
- [ ] Performance is maintained or improved
- [ ] Documentation is updated
- [ ] Commit messages are clear

### 📊 Performance Standards

Any PR must meet these standards:

- Entity creation: > 60,000/sec
- Search time: < 2ms
- No memory leaks
- Cache hit rate: > 95% when applicable

### 🧪 Testing

While we don't have formal tests yet (PRs welcome!), every change must:

1. Run all benchmarks successfully
2. Show no performance regression
3. Work with both single and multi-context modes

## 🎯 Priority Areas

We especially welcome contributions in:

1. **Performance Optimizations**: Make it even faster!
2. **New Storage Backends**: Redis? PostgreSQL?
3. **Benchmarks**: More comprehensive testing
4. **Documentation**: Examples, tutorials, guides
5. **Tooling**: VS Code extension? CLI tools?

## 💬 Code Style

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

## 🏃 Quick Wins

Looking for easy contributions?

- Add more benchmarks
- Improve error messages
- Add debug logging options
- Create example use cases
- Improve documentation

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution, no matter how small, helps make Mem100x better. We appreciate your time and effort!

**Let's make the FASTEST MCP server even FASTER together! 🚀**