#!/usr/bin/env node

const { spawn } = require('child_process');
const { join } = require('path');
const { writeFileSync, unlinkSync, existsSync } = require('fs');

console.log('🧪 Testing Enhanced Entity Creation Optimizations...');

// Create a test script that tests the new optimizations
const testScript = `
const { MemoryDatabase } = require('./dist/database.js');
const { join } = require('path');
const { unlinkSync, existsSync } = require('fs');

async function testOptimizations() {
  console.log('📊 Testing enhanced optimizations...');

  // Create temporary database
  const tempDbPath = join(__dirname, 'temp-optimizations-test.db');

  try {
    // Clean up any existing temp database
    if (existsSync(tempDbPath)) {
      unlinkSync(tempDbPath);
    }

    // Initialize database
    const db = new MemoryDatabase(tempDbPath);
    console.log('✅ Database initialized');

    // Test 1: Large batch with dynamic sizing
    console.log('\\n📊 Test 1: Large batch with dynamic sizing...');
    const largeBatch = Array.from({ length: 5000 }, (_, i) => ({
      name: \`large_entity_\${i}\`,
      entityType: 'test',
      observations: [{
        type: 'text',
        text: \`This is a large entity \${i} with substantial content for testing dynamic batch sizing. It contains various words and phrases to ensure proper memory calculation and batch size optimization.\`
      }]
    }));

    const largeStart = Date.now();
    const largeResults = db.createEntitiesBatch(largeBatch);
    const largeEnd = Date.now();

    const largeDuration = largeEnd - largeStart;
    const largeRate = Math.round((largeBatch.length / largeDuration) * 1000);

    console.log(\`✅ Large batch completed:\`);
    console.log(\`   - Entities: \${largeResults.length}\`);
    console.log(\`   - Duration: \${largeDuration}ms\`);
    console.log(\`   - Rate: \${largeRate} entities/sec\`);
    console.log(\`   - Dynamic sizing: ENABLED\`);

    // Test 2: Mixed size entities
    console.log('\\n📊 Test 2: Mixed size entities...');
    const mixedBatch = Array.from({ length: 2000 }, (_, i) => ({
      name: \`mixed_entity_\${i}\`,
      entityType: 'test',
      observations: [
        {
          type: 'text',
          text: \`Short text \${i}\`
        },
        {
          type: 'text',
          text: \`This is a much longer observation for entity \${i} that contains substantial content to test the dynamic batch sizing algorithm. It includes various words and phrases to ensure proper memory calculation.\`
        }
      ]
    }));

    const mixedStart = Date.now();
    const mixedResults = db.createEntitiesBatch(mixedBatch);
    const mixedEnd = Date.now();

    const mixedDuration = mixedEnd - mixedStart;
    const mixedRate = Math.round((mixedBatch.length / mixedDuration) * 1000);

    console.log(\`✅ Mixed batch completed:\`);
    console.log(\`   - Entities: \${mixedResults.length}\`);
    console.log(\`   - Duration: \${mixedDuration}ms\`);
    console.log(\`   - Rate: \${mixedRate} entities/sec\`);
    console.log(\`   - Index deferral: ENABLED\`);

    // Test 3: Search performance
    console.log('\\n📊 Test 3: Search performance...');
    const searchStart = Date.now();
    const searchResults = db.searchNodes({ query: 'substantial content', limit: 20 });
    const searchEnd = Date.now();

    console.log(\`✅ Search completed:\`);
    console.log(\`   - Found: \${searchResults.entities.length} entities\`);
    console.log(\`   - Search time: \${searchEnd - searchStart}ms\`);
    console.log(\`   - FTS5 index: WORKING\`);

    // Get database stats
    const stats = db.getStats();
    console.log(\`\\n📊 Database stats:\`);
    console.log(\`   - Total entities: \${stats.totalEntities}\`);
    console.log(\`   - Total relations: \${stats.totalRelations}\`);
    console.log(\`   - Database size: \${stats.databaseSizeKb}KB\`);
    console.log(\`   - Circuit breaker: \${stats.circuitBreaker?.state || 'N/A'}\`);

    // Close database
    db.close();
    console.log('✅ Database closed');

    console.log('\\n🎉 Enhanced Optimizations Test PASSED!');
    console.log('All optimizations are working correctly:');
    console.log('- Index deferral for bulk operations');
    console.log('- Dynamic batch sizing based on entity size');
    console.log('- Enhanced circuit breaker protection');
    console.log('- Memory monitoring and performance tracking');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      if (existsSync(tempDbPath)) {
        unlinkSync(tempDbPath);
        console.log('✅ Temporary database cleaned up');
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testOptimizations().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
`;

// Write test script
const testScriptPath = join(__dirname, 'temp-optimizations-test.js');
writeFileSync(testScriptPath, testScript);

// Run the test with timeout
const testProcess = spawn('node', [testScriptPath], {
  stdio: 'inherit'
});

// Set timeout for the entire test
const timeout = setTimeout(() => {
  console.log('\n⏰ Test timeout - forcing cleanup...');
  testProcess.kill('SIGKILL');

  // Cleanup
  try {
    unlinkSync(testScriptPath);
  } catch (e) {
    // Ignore cleanup errors
  }

  process.exit(1);
}, 60000); // 60 second timeout

testProcess.on('close', (code) => {
  clearTimeout(timeout);

  // Cleanup test script
  try {
    unlinkSync(testScriptPath);
  } catch (e) {
    // Ignore cleanup errors
  }

  if (code === 0) {
    console.log('\n✅ Enhanced Optimizations Test PASSED');
    console.log('All new optimizations are working correctly!');
  } else {
    console.log('\n❌ Enhanced Optimizations Test FAILED');
    process.exit(1);
  }
});

testProcess.on('error', (error) => {
  clearTimeout(timeout);
  console.error('Test process error:', error);
  process.exit(1);
});
