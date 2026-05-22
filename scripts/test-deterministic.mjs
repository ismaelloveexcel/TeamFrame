#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { getDeterministicContext } from "./ci/context.mjs";

const ctx = getDeterministicContext("test-deterministic");

const checks = ["test:employees", "test:security", "test:reliability"];
const isWindows = process.platform === "win32";

console.log(`SEED=${ctx.seed}`);
console.log(`TEST_RUN_ID=${ctx.testRunId}`);
console.log(`TEST_TENANT_SEED=${ctx.tenantSeed}`);

for (const check of checks) {
  console.log(`\n=== deterministic check: ${check} ===`);
  const command = isWindows ? "cmd.exe" : "npm";
  const args = isWindows ? ["/d", "/s", "/c", `npm run ${check}`] : ["run", check];
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      SEED: ctx.seed,
      TEST_RUN_ID: ctx.testRunId,
      TEST_TENANT_SEED: ctx.tenantSeed,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\n✓ deterministic test execution passed.");