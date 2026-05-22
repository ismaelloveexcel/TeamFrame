/**
 * TeamFrame — security regression suite runner.
 *
 * Runs foundational runtime security checks in sequence and fails fast.
 */

import { spawn } from "node:child_process";
import { getDbSnapshot, getDeterministicContext, snapshotDiff, writeReplayArtifact } from "./ci/context.mjs";

const checks = [
  { label: "RLS adversarial smoke", command: "node", args: ["scripts/test-rls.mjs"] },
  { label: "Stale-write concurrency smoke", command: "node", args: ["scripts/test-stale-writes.mjs"] },
];
const ctx = getDeterministicContext("test-security");

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
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${check.label} failed with exit code ${code ?? "unknown"}`));
      }
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
        testId: `test-security-${check.label}`,
        gate: "test:security",
        command: check.command,
        args: check.args,
        actorContext: { actor: "security-suite", tenant: process.env.TEST_TENANT_SEED || "seeded" },
        dbSnapshotDiff: snapshotDiff(beforeSnapshot, afterSnapshot),
        error: err.message,
      });
      throw new Error(`${err.message}. Replay artifact: ${replayPath}`);
    }
  }

  console.log("\n✓ Security regression suite passed.");
}

main().catch((err) => {
  console.error(`\n✗ Security regression suite failed: ${err.message}`);
  process.exit(1);
});
