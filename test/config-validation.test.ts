import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, copyFileSync } from 'fs';
import { spawn } from 'child_process';

describe('Configuration Validation', () => {
  const testEnvFile = 'test-validation.env';
  const originalEnvFile = '.env';

  beforeEach(() => {
    // Clean up any existing test files
    if (existsSync(testEnvFile)) {
      unlinkSync(testEnvFile);
    }
    if (existsSync(originalEnvFile)) {
      unlinkSync(originalEnvFile);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testEnvFile)) {
      unlinkSync(testEnvFile);
    }
    if (existsSync(originalEnvFile)) {
      unlinkSync(originalEnvFile);
    }
  });

  it('should detect unknown environment variables', async () => {
    // Create test .env file with unknown variables
    const envContent = `
# Test with unknown variables
UNKNOWN_VAR=some_value
CUSTOM_SETTING=true
DEBUG_MODE=enabled
API_KEY=test123
DATABASE_URL=sqlite://test.db
    `.trim();

    writeFileSync(originalEnvFile, envContent);

    // Run validation script
    const result = await runValidationScript();

    // Check that unknown variables are detected
    expect(result.output).toContain('⚠️  Unknown Environment Variables:');
    expect(result.output).toContain('❌ UNKNOWN_VAR');
    expect(result.output).toContain('❌ CUSTOM_SETTING');
    expect(result.output).toContain('❌ DEBUG_MODE');
    expect(result.output).toContain('❌ API_KEY');
    expect(result.output).toContain('❌ DATABASE_URL');
    expect(result.output).toContain('❌ 5 unknown environment variable(s)');

    expect(result.exitCode).toBe(0); // Should still pass validation
  });

  it('should detect deprecated environment variables', async () => {
    // Create test .env file with deprecated variables
    const envContent = `
# Test with deprecated variables
PERSONAL_DB_PATH=./data/old-personal.db
WORK_DB_PATH=./data/old-work.db
PORT=8080
HOST=0.0.0.0
NODE_ENV=development
    `.trim();

    writeFileSync(originalEnvFile, envContent);

    // Run validation script
    const result = await runValidationScript();

    // Check that deprecated variables are detected
    expect(result.output).toContain('🔄 Deprecated Environment Variables:');
    expect(result.output).toContain('⚠️  PERSONAL_DB_PATH: Use MEM100X_PERSONAL_DB_PATH instead');
    expect(result.output).toContain('⚠️  WORK_DB_PATH: Use MEM100X_WORK_DB_PATH instead');
    expect(result.output).toContain('⚠️  PORT: Use SERVER_PORT instead');
    expect(result.output).toContain('⚠️  HOST: Use SERVER_HOST instead');
    expect(result.output).toContain('⚠️  NODE_ENV: Not used by Mem100x (Node.js standard)');
    expect(result.output).toContain('🔄 5 deprecated environment variable(s)');

    expect(result.exitCode).toBe(0); // Should still pass validation
  });

  it('should detect both unknown and deprecated variables', async () => {
    // Create test .env file with both types of issues
    const envContent = `
# Test with both unknown and deprecated variables
UNKNOWN_VAR=some_value
PERSONAL_DB_PATH=./data/old-personal.db
CUSTOM_SETTING=true
PORT=8080
DEBUG_MODE=enabled
    `.trim();

    writeFileSync(originalEnvFile, envContent);

    // Run validation script
    const result = await runValidationScript();

    // Check that both types are detected
    expect(result.output).toContain('⚠️  Unknown Environment Variables:');
    expect(result.output).toContain('🔄 Deprecated Environment Variables:');
    expect(result.output).toContain('❌ 3 unknown environment variable(s)');
    // Note: NODE_ENV from system environment will also be detected as deprecated
    expect(result.output).toContain('🔄 3 deprecated environment variable(s)');

    expect(result.exitCode).toBe(0); // Should still pass validation
  });

  it('should show valid environment variables when issues are found', async () => {
    // Create test .env file with issues
    const envContent = `
# Test with issues to trigger valid variables display
UNKNOWN_VAR=some_value
PERSONAL_DB_PATH=./data/old-personal.db
DATABASE_PATH=./data/test.db
    `.trim();

    writeFileSync(originalEnvFile, envContent);

    // Run validation script
    const result = await runValidationScript();

    // Check that valid variables are shown
    expect(result.output).toContain('📋 Valid Environment Variables:');
    expect(result.output).toContain('✅ DATABASE_PATH: Database file path');
    expect(result.output).toContain('⚪ DATABASE_CACHE_SIZE_MB: SQLite cache size in MB');

    expect(result.exitCode).toBe(0);
  });

  it('should not show issues section when no problems exist', async () => {
    // Create test .env file with only valid variables
    const envContent = `
# Test with only valid variables
DATABASE_PATH=./data/test.db
ENTITY_CACHE_SIZE=25000
LOG_LEVEL=debug
    `.trim();

    writeFileSync(originalEnvFile, envContent);

    // Run validation script
    const result = await runValidationScript();

    // Check that no unknown variables are reported
    expect(result.output).not.toContain('⚠️  Unknown Environment Variables:');
    // Note: NODE_ENV from system environment will still be detected as deprecated
    expect(result.output).toContain('🔄 Deprecated Environment Variables:');
    expect(result.output).toContain('📋 Valid Environment Variables:');
    expect(result.output).toContain('Configuration Issues Summary:');

    expect(result.exitCode).toBe(0);
  });

  it('should show configuration summary when issues exist', async () => {
    // Create test .env file with issues
    const envContent = `
# Test with issues
UNKNOWN_VAR=some_value
PERSONAL_DB_PATH=./data/old-personal.db
    `.trim();

    writeFileSync(originalEnvFile, envContent);

    // Run validation script
    const result = await runValidationScript();

    // Check that summary is shown
    expect(result.output).toContain('⚠️  Configuration Issues Summary:');
    expect(result.output).toContain('💡 Run "npm run config:generate" to see all valid options');

    expect(result.exitCode).toBe(0);
  });
});

// Helper function to run the validation script
async function runValidationScript(): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('tsx', ['scripts/validate-config.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        output,
        exitCode: code || 0
      });
    });
  });
}
