#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

class MCPSimpleTest {
  constructor() {
    this.tempDbPath = path.join(os.tmpdir(), `mem100x-mcp-test-${Date.now()}.db`);
    this.serverPath = path.join(__dirname, '../dist/index.js');
    this.transport = null;
    this.client = null;
    this.results = [];
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async setup() {
    this.log('🔧 Setting up MCP test...');
    this.log(`📁 Using temporary database: ${this.tempDbPath}`);
    this.log(`🚀 Server path: ${this.serverPath}`);

    if (!fs.existsSync(this.serverPath)) {
      throw new Error(`Server file does not exist: ${this.serverPath}`);
    }

    // Create transport with clean database
    this.transport = new StdioClientTransport({
      command: '/opt/homebrew/bin/node',
      args: [this.serverPath],
      env: {
        ...process.env,
        MEMORY_DB: this.tempDbPath
      }
    });

    // Create client
    this.client = new Client({
      name: 'simple-test-client',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
  }

  async cleanup() {
    this.log('�� Cleaning up...');

    if (this.transport) {
      try {
        await this.transport.close();
        this.log('✅ Transport closed');
      } catch (error) {
        this.log(`⚠️  Transport close warning: ${error.message}`);
      }
    }

    // Add a small delay to ensure processes are terminated
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      if (fs.existsSync(this.tempDbPath)) {
        fs.unlinkSync(this.tempDbPath);
        this.log('🗑️  Database file cleaned up');
      }

      const bloomPath = this.tempDbPath.replace('.db', '.cbloom');
      if (fs.existsSync(bloomPath)) {
        fs.unlinkSync(bloomPath);
        this.log('🗑️  Bloom filter cleaned up');
      }
    } catch (error) {
      this.log(`⚠️  Cleanup warning: ${error.message}`);
    }

    this.log('✅ Cleanup complete');
  }

  async measure(name, fn, timeoutMs = 5000) {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      const duration = Date.now() - startTime;

      this.results.push({ name, duration, success: true });
      this.log(`✅ ${name}: ${duration}ms`);

      return { duration, result };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({ name, duration, success: false, error: error.message });
      this.log(`❌ ${name}: ${duration}ms - ${error.message}`);
      throw error;
    }
  }

  async testConnection() {
    this.log('\n🔌 Connection Test');
    this.log('==================');

    await this.measure('Connect to Server', async () => {
      await this.client.connect(this.transport);
      return { connected: true };
    });
  }

  async testToolListing() {
    this.log('\n📋 Tool Listing Test');
    this.log('===================');

    await this.measure('List Tools', async () => {
      const tools = await this.client.listTools();
      return { toolCount: tools.tools.length };
    });
  }

  async testSimpleOperations() {
    this.log('\n🔧 Simple Operations Test');
    this.log('=========================');

    // Test read_graph (should be fast and safe)
    await this.measure('Read Graph', async () => {
      const result = await this.client.callTool('read_graph', { limit: 10 });
      return { entityCount: result.structuredContent.entities?.length || 0 };
    });

    // Test search_nodes (should be fast)
    await this.measure('Search Nodes', async () => {
      const result = await this.client.callTool('search_nodes', { query: 'test', limit: 5 });
      return { resultCount: result.structuredContent.entities?.length || 0 };
    });
  }

  async testEntityCreation() {
    this.log('\n📝 Entity Creation Test');
    this.log('=======================');

    // Test with a very simple entity
    await this.measure('Create Single Entity', async () => {
      const result = await this.client.callTool('create_entities', {
        entities: [{
          name: 'mcp-test-entity',
          entityType: 'test',
          observations: [{ type: 'text', text: 'MCP test observation' }]
        }]
      });
      return { created: result.structuredContent.created?.length || 0 };
    }, 10000); // 10 second timeout for this operation
  }

  printSummary() {
    this.log('\n📊 MCP Test Summary');
    this.log('==================');

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    this.log(`Total operations: ${this.results.length}`);
    this.log(`Successful: ${successful.length}`);
    this.log(`Failed: ${failed.length}`);

    if (successful.length > 0) {
      const avgTime = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      this.log(`Average successful time: ${avgTime.toFixed(2)}ms`);
    }

    this.log('\nDetailed Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      this.log(`  ${status} ${result.name}: ${result.duration}ms${result.error ? ` - ${result.error}` : ''}`);
    });
  }

  async run() {
    try {
      await this.setup();

      await this.testConnection();
      await this.testToolListing();
      await this.testSimpleOperations();
      await this.testEntityCreation();

      this.printSummary();

    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
const test = new MCPSimpleTest();
test.run();
