#!/usr/bin/env node

/**
 * Dedicated contract test for reliability deny helpers.
 * Contract:
 * - throw => denied
 * - rowCount === 0 => denied
 * - rowCount > 0 => not denied
 */

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function correctedExpectDenied(runDeniedPath, message) {
  let denied = false;
  try {
    const result = await runDeniedPath();
    denied = !result || result.rowCount === 0;
  } catch {
    denied = true;
  }
  assert(denied, message);
}

export async function runReliabilityHelperContractSelftest() {
  // Case 1: thrown error must count as denied
  await correctedExpectDenied(async () => {
    throw new Error("denied");
  }, "expected denied path to throw");

  // Case 2: zero affected rows must count as denied
  await correctedExpectDenied(async () => ({ rowCount: 0 }), "expected denied path to affect zero rows");

  // Case 3: affected rows means operation was allowed and must fail this contract
  let failedAsExpected = false;
  try {
    await correctedExpectDenied(async () => ({ rowCount: 1 }), "operation should have been denied");
  } catch {
    failedAsExpected = true;
  }

  assert(failedAsExpected, "self-test did not detect allowed path");
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  runReliabilityHelperContractSelftest()
    .then(() => {
      console.log("✓ reliability helper self-test passed");
    })
    .catch((err) => {
      console.error(`✗ reliability helper self-test failed: ${err.message}`);
      process.exit(1);
    });
}