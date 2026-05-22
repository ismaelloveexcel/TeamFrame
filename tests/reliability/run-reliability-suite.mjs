/**
 * TeamFrame reliability suite runner.
 */

import { spawn } from "node:child_process";
import { getDbSnapshot, getDeterministicContext, snapshotDiff, writeReplayArtifact } from "../../scripts/ci/context.mjs";

const checks = [
  {
    label: "Multi-actor concurrency",
    command: "node",
    args: ["tests/reliability/multi-actor-concurrency-v2.mjs"],
  },
  {
    label: "Failure injection and rollback",
    command: "node",
    args: ["tests/reliability/failure-injection-v2.mjs"],
  },
  {
    label: "Session boundary enforcement",
    command: "node",
    args: ["tests/reliability/session-boundaries-v2.mjs"],
  },
];
const ctx = getDeterministicContext("test-reliability");

function runCheck(check) {
  return new Promise((resolve, reject) => {
    const child = spawn(check.command, check.args, {
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        SEED: ctx.seed,
        TEST_RUN_ID: ctx.testRunId,
        TEST_TENANT_SEED: ctx.tenantSeed,
      },
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${check.label} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", (err) => reject(err));
  });
}

async function main() {
  for (const check of checks) {
    console.log(`\n• ${check.label}...`);
    const beforeSnapshot = await getDbSnapshot(process.env.SUPABASE_DB_URL);
    try {
      await runCheck(check);
      console.log(`✓ ${check.label} passed.`);
    } catch (err) {
      const afterSnapshot = await getDbSnapshot(process.env.SUPABASE_DB_URL);
      const replayPath = writeReplayArtifact({
        testId: `test-reliability-${check.label}`,
        gate: "test:reliability",
        command: check.command,
        args: check.args,
        actorContext: { actor: "reliability-suite", tenant: process.env.TEST_TENANT_SEED || "seeded" },
        dbSnapshotDiff: snapshotDiff(beforeSnapshot, afterSnapshot),
        error: err.message,
      });
      throw new Error(`${err.message}. Replay artifact: ${replayPath}`);
    }
  }

  console.log("\n✓ Reliability suite passed.");
}

main().catch((err) => {
  console.error(`\n✗ Reliability suite failed: ${err.message}`);
  process.exit(1);
});
