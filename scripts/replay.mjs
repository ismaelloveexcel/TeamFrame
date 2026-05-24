#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const artifactArg = process.argv[2];
if (!artifactArg) {
  console.error("Usage: npm run test:replay -- <artifact-path>");
  process.exit(1);
}

const artifactPath = resolve(process.cwd(), artifactArg);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

const command = artifact.command;
const args = Array.isArray(artifact.args) ? artifact.args : [];

if (!command) {
  console.error("Invalid replay artifact: missing command.");
  process.exit(1);
}

const env = {
  ...process.env,
  CI_SEED: artifact.ciSeed || artifact.seed,
  CI_RUN_ID: artifact.ciRunId || artifact.testRunId,
  CI_MODE: artifact.runMode || "deterministic",
  SEED: artifact.seed,
  TEST_RUN_ID: artifact.testRunId,
  TEST_TENANT_SEED: artifact.testTenantSeed,
  RUN_MODE: artifact.runMode || "deterministic",
};

console.log(`Replaying ${artifact.testId || artifact.gate || "unknown"}`);
console.log(`CI_MODE=${env.CI_MODE}`);
console.log(`CI_SEED=${env.CI_SEED}`);
console.log(`CI_RUN_ID=${env.CI_RUN_ID}`);
console.log(`TEST_TENANT_SEED=${env.TEST_TENANT_SEED}`);
console.log(`Command=${command} ${args.join(" ")}`);

const result = spawnSync(command, args, {
  stdio: "inherit",
  env,
  shell: false,
});

process.exit(result.status ?? 1);
