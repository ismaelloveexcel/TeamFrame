#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { getDbSnapshot, getDeterministicContext, snapshotDiff, writeReplayArtifact } from "./ci/context.mjs";

const gates = [
  "db:apply",
  "db:test:rls",
  "db:test:stale",
  "test:employees",
  "test:security",
  "test:reliability",
  "typecheck",
  "lint",
  "build",
];

const actorContextByGate = {
  "db:apply": { actor: "migration", tenant: "n/a" },
  "db:test:rls": { actor: "rls-suite", tenant: "test-tenant-seeded" },
  "db:test:stale": { actor: "stale-suite", tenant: "test-tenant-seeded" },
  "test:employees": { actor: "employee-suite", tenant: "test-tenant-seeded" },
  "test:security": { actor: "security-suite", tenant: "test-tenant-seeded" },
  "test:reliability": { actor: "reliability-suite", tenant: "test-tenant-seeded" },
  typecheck: { actor: "static-analysis", tenant: "n/a" },
  lint: { actor: "static-analysis", tenant: "n/a" },
  build: { actor: "build", tenant: "n/a" },
};

const ctx = getDeterministicContext("ci-full");
const gateTrace = [];
console.log(`SEED=${ctx.seed}`);
console.log(`TEST_RUN_ID=${ctx.testRunId}`);
console.log(`TEST_TENANT_SEED=${ctx.tenantSeed}`);
console.log(`RUN_MODE=${ctx.runMode}`);

const isWindows = process.platform === "win32";

async function safeDbSnapshot() {
  try {
    return await getDbSnapshot(process.env.SUPABASE_DB_URL);
  } catch (err) {
    return {
      capturedAt: new Date().toISOString(),
      tables: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

for (let i = 0; i < gates.length; i += 1) {
  const gate = gates[i];
  const label = `Gate ${i + 1}/${gates.length}`;
  console.log(`\n=== ${label}: npm run ${gate} ===`);

  const beforeSnapshot = await safeDbSnapshot();
  const gateRunId = `${ctx.testRunId}-${gate.replace(/[^a-z0-9]/gi, "-")}`;
  const gateTenantSeed = `${ctx.tenantSeed}-${gate.replace(/[^a-z0-9]/gi, "-")}`;

  const command = isWindows ? "cmd.exe" : "npm";
  const args = isWindows ? ["/d", "/s", "/c", `npm run ${gate}`] : ["run", gate];

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      CI_SEED: ctx.seed,
      CI_RUN_ID: gateRunId,
      CI_MODE: "deterministic",
      SEED: ctx.seed,
      TEST_RUN_ID: gateRunId,
      TEST_TENANT_SEED: gateTenantSeed,
      RUN_MODE: "deterministic",
    },
  });

  gateTrace.push({ gate, exitCode: result.status ?? 1 });

  if (result.status !== 0) {
    const code = result.status ?? 1;
    const afterSnapshot = await safeDbSnapshot();
    const replayPath = writeReplayArtifact({
      testId: `gate-${gate}`,
      gate,
      gateRunId,
      gateTenantSeed,
      command,
      args,
      executionTrace: gateTrace,
      testOrder: gates,
      actorContext: actorContextByGate[gate] || { actor: "unknown", tenant: "unknown" },
      dbSnapshotDiff: snapshotDiff(beforeSnapshot, afterSnapshot),
      exitCode: code,
      stderrHint: `CI gate failed at ${label}`,
    });
    console.error(`\nCI gate failed at ${label} (${gate}) with exit code ${code}.`);
    console.error(`Replay artifact: ${replayPath}`);
    process.exit(code);
  }
}

console.log("\nAll CI gates passed in strict order.");