import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function hash32(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFromHex(hex) {
  const normalized = hex.padEnd(32, "0").slice(0, 32);
  const chars = normalized.split("");
  chars[12] = "4";
  const variantNibble = Number.parseInt(chars[16], 16);
  chars[16] = ((variantNibble & 0x3) | 0x8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

function toSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function getDeterministicContext(scope) {
  const seed = process.env.CI_SEED || process.env.SEED || "teamframe-ci-seed-v2";
  const testRunId = process.env.CI_RUN_ID || process.env.TEST_RUN_ID || `local-${Date.now()}`;
  const tenantSeed = process.env.TEST_TENANT_SEED || `${seed}-${testRunId}`;
  const runMode = process.env.CI_MODE || process.env.RUN_MODE || "deterministic";

  process.env.CI_SEED = seed;
  process.env.CI_RUN_ID = testRunId;
  process.env.CI_MODE = runMode;
  process.env.SEED = seed;
  process.env.TEST_RUN_ID = testRunId;
  process.env.TEST_TENANT_SEED = tenantSeed;
  process.env.RUN_MODE = runMode;

  const base = `${seed}|${testRunId}|${tenantSeed}|${scope}`;
  const random = mulberry32(hash32(base));

  function deterministicUuid(label) {
    const hex = createHash("sha256").update(`${base}|uuid|${label}`).digest("hex").slice(0, 32);
    return uuidFromHex(hex);
  }

  function deterministicToken(label, length = 8) {
    const out = [];
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(random() * alphabet.length);
      out.push(alphabet[idx]);
    }
    return out.join("");
  }

  function deterministicEmail(prefix, domain = "local.test") {
    return `${prefix}-${deterministicToken(`${prefix}-email`, 10)}@${domain}`;
  }

  function deterministicSlug(prefix) {
    return `${toSlug(prefix)}-${deterministicToken(`${prefix}-slug`, 10)}`;
  }

  return {
    scope,
    seed,
    testRunId,
    tenantSeed,
    runMode,
    deterministicUuid,
    deterministicToken,
    deterministicEmail,
    deterministicSlug,
  };
}

export async function getDbSnapshot(connectionString) {
  if (!connectionString) {
    return null;
  }

  const { Client } = pg;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const snapshot = {
    capturedAt: new Date().toISOString(),
    tables: {},
  };

  const tables = ["companies", "employees", "leaves", "documents", "audit_logs"];

  try {
    await client.connect();
    for (const table of tables) {
      const result = await client.query(`select count(*)::int as n from ${table}`);
      snapshot.tables[table] = result.rows[0].n;
    }
  } finally {
    await client.end();
  }

  return snapshot;
}

export function snapshotDiff(before, after) {
  if (!before || !after) {
    return null;
  }

  const diff = {};
  const beforeTables = before.tables || {};
  const afterTables = after.tables || {};
  const keys = new Set([...Object.keys(beforeTables), ...Object.keys(afterTables)]);
  for (const key of keys) {
    const b = beforeTables[key] ?? 0;
    const a = afterTables[key] ?? 0;
    diff[key] = {
      before: b,
      after: a,
      delta: a - b,
    };
  }

  return diff;
}

export function writeReplayArtifact(payload) {
  const runId = process.env.TEST_RUN_ID || process.env.CI_RUN_ID || "unknown-run";
  const dir = join(process.cwd(), ".ci", "replays", runId);
  mkdirSync(dir, { recursive: true });

  const slug = toSlug(payload.testId || payload.gate || "unknown-test");
  const fileName = `${slug}-${Date.now()}.json`;
  const filePath = join(dir, fileName);

  const artifact = {
    generatedAt: new Date().toISOString(),
    runMode: process.env.RUN_MODE || process.env.CI_MODE,
    ciSeed: process.env.CI_SEED,
    ciRunId: process.env.CI_RUN_ID,
    seed: process.env.SEED,
    testRunId: process.env.TEST_RUN_ID,
    testTenantSeed: process.env.TEST_TENANT_SEED,
    ...payload,
  };

  writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return filePath;
}