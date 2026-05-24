import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function normalizeConnectionString(value) {
  if (!value) return value;
  return value.replace(/^"|"$/g, "");
}

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
  const seed = process.env.SEED || "teamframe-ci-seed-v2";
  const testRunId = process.env.TEST_RUN_ID || `local-${Date.now()}`;
  const tenantSeed = process.env.TEST_TENANT_SEED || `${seed}-${testRunId}`;

  process.env.SEED = seed;
  process.env.TEST_RUN_ID = testRunId;
  process.env.TEST_TENANT_SEED = tenantSeed;

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

  const normalizedConnectionString = normalizeConnectionString(connectionString);

  const { Client } = pg;
  const client = new Client({
    connectionString: normalizedConnectionString,
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
  const keys = new Set([...Object.keys(before.tables), ...Object.keys(after.tables)]);
  for (const key of keys) {
    const b = before.tables[key] ?? 0;
    const a = after.tables[key] ?? 0;
    diff[key] = {
      before: b,
      after: a,
      delta: a - b,
    };
  }

  return diff;
}

export function writeReplayArtifact(payload) {
  const dir = join(process.cwd(), "artifacts", "replay");
  mkdirSync(dir, { recursive: true });

  const slug = toSlug(payload.testId || payload.gate || "unknown-test");
  const fileName = `${slug}-${Date.now()}.json`;
  const filePath = join(dir, fileName);

  const artifact = {
    generatedAt: new Date().toISOString(),
    seed: process.env.SEED,
    testRunId: process.env.TEST_RUN_ID,
    testTenantSeed: process.env.TEST_TENANT_SEED,
    ...payload,
  };

  writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return filePath;
}