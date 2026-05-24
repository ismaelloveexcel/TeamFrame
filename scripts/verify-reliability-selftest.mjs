#!/usr/bin/env node

/**
 * Compatibility entrypoint used by CI.
 * The dedicated contract lives in scripts/reliability-helper-contract-selftest.mjs.
 */

import { runReliabilityHelperContractSelftest } from "./reliability-helper-contract-selftest.mjs";

runReliabilityHelperContractSelftest()
  .then(() => {
    console.log("✓ reliability helper self-test passed");
  })
  .catch((err) => {
  console.error(`✗ reliability helper self-test failed: ${err.message}`);
  process.exit(1);
  });
