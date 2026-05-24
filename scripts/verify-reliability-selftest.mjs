#!/usr/bin/env node

/**
 * Guardrail self-test: verifies the expectDenied logic shape cannot silently pass.
 * This test is DB-free and validates helper semantics directly.
 */

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function correctedExpectDenied(runDeniedPath, message) {
  let denied = false;
  try {
    await runDeniedPath();
  } catch {
    denied = true;
  }
  assert(denied, message);
}

async function main() {
  // Path 1: operation is denied and throws -> should pass
  await correctedExpectDenied(async () => {
    throw new Error("denied");
  }, "expected denied path to throw");

  // Path 2: operation succeeds -> should fail the assertion
  let failedAsExpected = false;
  try {
    await correctedExpectDenied(async () => {}, "operation should have been denied");
  } catch {
    failedAsExpected = true;
  }

  assert(failedAsExpected, "self-test did not detect allowed path");
  console.log("✓ reliability helper self-test passed");
}

main().catch((err) => {
  console.error(`✗ reliability helper self-test failed: ${err.message}`);
  process.exit(1);
});
