"use strict";
const assert = require("assert");
const { PrivacySecurityManager, PRIVACY_PRESETS } = require("./src/utils/privacy-security.ts");

function testInputValidation() {
  const psm = new PrivacySecurityManager();
  // Safe input
  let result = psm.validateInput({ foo: "bar" });
  assert.strictEqual(result.isValid, true);
  assert.deepStrictEqual(result.errors, []);
  // Suspicious script
  result = psm.validateInput({ foo: "<script>alert('x')</script>" });
  assert.strictEqual(result.isValid, false);
  assert(result.errors.some(e => e.includes("Suspicious")));
  // SQL injection
  result = psm.validateInput({ foo: "1 OR 1=1" });
  assert.strictEqual(result.isValid, false);
  // DROP TABLE
  result = psm.validateInput({ foo: "DROP TABLE users;" });
  assert.strictEqual(result.isValid, false);
}

function testOutputSanitization() {
  const psm = new PrivacySecurityManager();
  // String with HTML/script
  let sanitized = psm.sanitizeOutput("<script>alert('x')</script><b>bold</b>plain");
  assert.strictEqual(sanitized, "plain");
  // Object with nested HTML
  sanitized = psm.sanitizeOutput({ a: "<b>hi</b>", b: { c: "<script>bad()</script>ok" } });
  assert.deepStrictEqual(sanitized, { a: "hi", b: { c: "ok" } });
  // Array with HTML
  sanitized = psm.sanitizeOutput(["<i>italic</i>", 42, { x: "<script>bad</script>good" }]);
  assert.deepStrictEqual(sanitized, ["italic", 42, { x: "good" }]);
  // Non-string primitive
  assert.strictEqual(psm.sanitizeOutput(123), 123);
}

function testStubsNoOps() {
  const psm = new PrivacySecurityManager();
  // Encryption/decryption
  assert.strictEqual(psm.encryptData("abc"), "abc");
  assert.strictEqual(psm.decryptData("xyz"), "xyz");
  // Access control
  assert.strictEqual(psm.checkAccess(), true);
  assert.doesNotThrow(() => psm.setAccessControl());
  assert.doesNotThrow(() => psm.removeAccessControl());
  assert.doesNotThrow(() => psm.unlockAccount());
  // Audit, anonymization, compliance, retention, cleanup
  assert.deepStrictEqual(psm.getPrivacyStats(), { totalAuditEntries: 0, encryptionOperations: 0 });
  assert.deepStrictEqual(psm.applyRetentionPolicy(), { deletedCount: 0, errors: [] });
  assert.deepStrictEqual(psm.cleanupAuditLogs(), { deletedCount: 0 });
  assert.deepStrictEqual(psm.checkCompliance(), { gdpr: false, ccpa: false, hipaa: false });
  assert.strictEqual(psm.anonymizeData({ foo: "bar" }).foo, "bar");
  assert.doesNotThrow(() => psm.shutdown());
}

function testConfig() {
  const psm = new PrivacySecurityManager();
  // Default config is LOCAL
  const cfg = psm.getPrivacyConfig();
  assert.strictEqual(cfg.encryptionLevel, "none");
  assert.strictEqual(cfg.enableInputValidation, true);
  // Update config
  psm.updatePrivacyConfig({ enableInputValidation: false });
  assert.strictEqual(psm.getPrivacyConfig().enableInputValidation, false);
}

function runAll() {
  testInputValidation();
  testOutputSanitization();
  testStubsNoOps();
  testConfig();
  console.log("All privacy/security tests passed.");
}

if (require.main === module) runAll();
