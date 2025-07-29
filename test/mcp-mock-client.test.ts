import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pkg from '../package.json';
import { spawn } from 'child_process';
import * as readline from 'readline';
import path from 'path';
import { setTimeout as setTimeoutPromise } from 'timers/promises';
import { once } from 'events';

// Path to the built Mem100x server
const SERVER_PATH = path.resolve(__dirname, '../dist/server-multi.js');

function createJsonRpcMessage(id: number, method: string, params: any) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

// Helper to wait for a response with a specific id
function waitForResponse(rl: readline.Interface, expectedId: number): Promise<any> {
  return new Promise((resolve) => {
    rl.on('line', (line) => {
      console.log('RAW line from server:', line);
      const res = JSON.parse(line);
      if (res.id === expectedId) {
        resolve(res);
      }
    });
  });
}

const TEST_TIMEOUT = 10000; // 10 seconds per test

describe('MCP LLM Compatibility (Minimal JSON-RPC Client)', () => {
  let server: any;
  let rl: readline.Interface;
  let id = 1;

  beforeEach(async () => {
    server = spawn('node', [SERVER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
    rl = readline.createInterface({ input: server.stdout });
    rl.setMaxListeners(20); // Avoid MaxListenersExceededWarning
    // Wait for 'SERVER READY' from server's stderr
    await new Promise((resolve, reject) => {
      const onData = (data: Buffer) => {
        const str = data.toString();
        if (str.includes('SERVER READY')) {
          server.stderr.off('data', onData);
          resolve(undefined);
        }
      };
      server.stderr.on('data', onData);
      // Fallback timeout
      setTimeout(() => {
        server.stderr.off('data', onData);
        reject(new Error('Timeout waiting for SERVER READY'));
      }, 5000);
    });
  });

  afterEach(async () => {
    // Ensure readline is closed after each test
    if (rl && typeof rl.close === 'function') {
      rl.close();
    }
    // Ensure server is killed after each test
    if (server && typeof server.kill === 'function') {
      server.kill('SIGTERM');
    }
    // Wait a bit for process to exit
    await setTimeoutPromise(200);
  });

  it('should negotiate protocol version (initialize)', async () => {
    const req = createJsonRpcMessage(id++, 'initialize', {
      protocolVersion: pkg.version,
      capabilities: {},
      clientInfo: { name: 'mock-client', version: pkg.version }
    });
    console.log('Sending initialize request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received initialize response:', res);
    if (!res.result) {
      throw new Error('No result in initialize response: ' + JSON.stringify(res));
    }
    if (!res.result?.protocolVersion && !res.error) {
      // Log the full response for debugging
      console.error('Full response:', res);
    }
    if (res.error) {
      throw new Error('Initialize failed: ' + JSON.stringify(res.error));
    }
    expect(res.result?.protocolVersion).toBeDefined();
    expect(res.result?.serverInfo?.version).toBeDefined();
    expect(res.result?.serverInfo?.name).toBe('mem100x-multi');
  }, TEST_TIMEOUT);

  it('should list tools and include titles', async () => {
    const req = createJsonRpcMessage(id++, 'tools/list', {});
    console.log('Sending tools/list request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received tools/list response:', res);
    let tools = res.result?.tools;
    if (!Array.isArray(tools)) {
      console.log('tools is not an array:', tools);
    }
    if (Array.isArray(tools)) {
      console.log('tools array:', JSON.stringify(tools, null, 2));
      if (tools.length > 0) {
        console.log('First tool keys:', Object.keys(tools[0]));
      }
    }
    if (res.error) {
      throw new Error('List tools failed: ' + JSON.stringify(res.error));
    }
    expect(Array.isArray(tools)).toBe(true);
    for (const tool of tools) {
      expect(tool.title).toBeDefined();
      expect(typeof tool.title).toBe('string');
    }
  }, TEST_TIMEOUT);

  it('should handle valid create_entities call', async () => {
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'create_entities',
      arguments: {
        entities: [
          { name: 'LLMTest', entityType: 'test', content: [ { type: 'text', text: 'hello' } ] }
        ]
      }
    });
    console.log('Sending create_entities request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received create_entities response:', res);
    expect(res.result?.structuredContent).toBeDefined();
    expect(res.result?.content).toBeDefined();
  }, TEST_TIMEOUT);

  it('should return elicitation for missing required fields', async () => {
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'create_entities',
      arguments: {
        entities: [ { name: 'MissingType', content: [ { type: 'text', text: 'test' } ] } ]
      }
    });
    console.log('Sending create_entities request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received create_entities response:', res);
    // Elicitation may be in result or error.data
    let elicitation = res.result?.structuredContent?.elicitation;
    let missingFields = res.result?.structuredContent?.missingFields;
    if (!elicitation && res.error && res.error.data && res.error.data.structuredContent) {
      elicitation = res.error.data.structuredContent.elicitation;
      missingFields = res.error.data.structuredContent.missingFields;
    }
    console.log('elicitation full response:', res);
    if (!elicitation) {
      console.log('elicitation is not true:', elicitation);
    }
    expect(elicitation).toBe(true);
    expect(Array.isArray(missingFields)).toBe(true);
  }, TEST_TIMEOUT);

  it('should handle invalid tool name gracefully', async () => {
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'not_a_real_tool',
      arguments: {}
    });
    console.log('Sending invalid tool request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received invalid tool response:', res);
    expect(res.error).toBeDefined();
    expect(res.error.message).toMatch(/unknown tool|method not found/i);
  }, TEST_TIMEOUT);

  it('should return error for malformed JSON-RPC (missing method)', async () => {
    const badReq = JSON.stringify({ jsonrpc: '2.0', id: id++, params: {} }) + '\n';
    console.log('Sending malformed JSON-RPC request:', badReq);
    server.stdin.write(badReq);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received malformed JSON-RPC response:', res);
    expect(res.error).toBeDefined();
    expect(res.error.message).toBe('Invalid Request');
  }, TEST_TIMEOUT);

  it('should handle duplicate IDs gracefully', async () => {
    const req1 = createJsonRpcMessage(999, 'tools/list', {});
    const req2 = createJsonRpcMessage(999, 'tools/list', {});
    console.log('Sending duplicate tools/list requests:', req1, req2);
    server.stdin.write(req1);
    server.stdin.write(req2);
    const res1 = await waitForResponse(rl, 999);
    const res2 = await waitForResponse(rl, 999);
    console.log('Received duplicate tools/list responses:', res1, res2);
    expect(res1.result || res1.error).toBeDefined();
    expect(res2.result || res2.error).toBeDefined();
  }, TEST_TIMEOUT);

  it('should handle batch JSON-RPC requests', async () => {
    const batch = [
      { jsonrpc: '2.0', id: id, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: id + 1, method: 'tools/list', params: {} }
    ];
    console.log('Sending batch JSON-RPC requests:', batch);
    server.stdin.write(JSON.stringify(batch) + '\n');
    const resA = await waitForResponse(rl, id);
    const resB = await waitForResponse(rl, id + 1);
    console.log('Received batch JSON-RPC responses:', resA, resB);
    expect(resA.result?.tools).toBeDefined();
    expect(resB.result?.tools).toBeDefined();
    id += 2;
  }, TEST_TIMEOUT);

  it('should return method not found for unknown method', async () => {
    const req = createJsonRpcMessage(id++, 'tools/foobar', {});
    console.log('Sending unknown method request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received unknown method response:', res);
    expect(res.error).toBeDefined();
    expect(res.error.message).toMatch(/method not found|unknown tool/i);
  }, TEST_TIMEOUT);

  it('should return elicitation for tool input with extra fields and wrong types', async () => {
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'create_entities',
      arguments: {
        entities: [
          { name: 'Extra', entityType: 123, content: 'not-an-array', extra: 'field' }
        ]
      }
    });
    console.log('Sending tool input with extra fields request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received tool input with extra fields response:', res);
    let elicitation = res.result?.structuredContent?.elicitation;
    if (!elicitation && res.error && res.error.data && res.error.data.structuredContent) {
      elicitation = res.error.data.structuredContent.elicitation;
    }
    expect(elicitation).toBe(true);
  }, TEST_TIMEOUT);

  it('should handle repeated elicitation loop', async () => {
    let lastRes;
    for (let i = 0; i < 3; ++i) {
      const req = createJsonRpcMessage(id++, 'tools/call', {
        name: 'create_entities',
        arguments: { entities: [ { name: 'Loop' } ] }
      });
      console.log('Sending repeated elicitation request:', req);
      server.stdin.write(req);
      lastRes = await waitForResponse(rl, id - 1);
      console.log('Received repeated elicitation response:', lastRes);
      let elicitation = lastRes.result?.structuredContent?.elicitation;
      if (!elicitation && lastRes.error && lastRes.error.data && lastRes.error.data.structuredContent) {
        elicitation = lastRes.error.data.structuredContent.elicitation;
      }
      expect(elicitation).toBe(true);
    }
  }, TEST_TIMEOUT);

  it('should return error for large payloads', async () => {
    const bigEntities = Array.from({ length: 10000 }, (_, i) => ({ name: 'E' + i, entityType: 't', content: [ { type: 'text', text: 'x' } ] }));
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'create_entities',
      arguments: { entities: bigEntities }
    });
    console.log('Sending large payload request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received large payload response:', res);
    expect(res.error || res.result?.structuredContent?.error).toBeDefined();
  }, TEST_TIMEOUT);

  it('should return error for protocol version mismatch', async () => {
    const req = createJsonRpcMessage(id++, 'initialize', {
      protocolVersion: '0.0.1',
      capabilities: {},
      clientInfo: { name: 'mock-client', version: '0.0.1' }
    });
    console.log('Sending protocol version mismatch request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received protocol version mismatch response:', res);
    expect(res.error).toBeDefined();
    expect(res.error.message).toMatch(/protocol version/i);
  }, TEST_TIMEOUT);

  it('should handle resource links in tool responses', async () => {
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'list_files',
      arguments: { path: './data' }
    });
    console.log('Sending resource links request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received resource links response:', res);
    expect(res.result?.structuredContent?.resourceLinks || res.result?.structuredContent?.items).toBeDefined();
  }, TEST_TIMEOUT);

  it('should handle concurrent requests', async () => {
    const reqs = [1,2,3].map((n) => createJsonRpcMessage(id + n, 'tools/list', {}));
    console.log('Sending concurrent tools/list requests:', reqs);
    reqs.forEach((r) => server.stdin.write(r));
    const results = await Promise.all([waitForResponse(rl, id+1), waitForResponse(rl, id+2), waitForResponse(rl, id+3)]);
    console.log('Received concurrent tools/list responses:', results);
    results.forEach((res) => expect(res.result?.tools).toBeDefined());
    id += 4;
  }, TEST_TIMEOUT);

  it('should handle Unicode and emoji in tool input/output', async () => {
    const req = createJsonRpcMessage(id++, 'tools/call', {
      name: 'create_entities',
      arguments: {
        entities: [ { name: 'ユニコード🌟', entityType: 'emoji', content: [ { type: 'text', text: '😀👍' } ] } ]
      }
    });
    console.log('Sending Unicode/emoji request:', req);
    server.stdin.write(req);
    const res = await waitForResponse(rl, id - 1);
    console.log('Received Unicode/emoji response:', res);
    expect(res.result?.structuredContent?.items || res.result?.structuredContent).toBeDefined();
  }, TEST_TIMEOUT);

  // Timeout/slow client simulation is not practical in this synchronous test harness, but could be tested with a custom harness.
});
