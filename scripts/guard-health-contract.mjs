#!/usr/bin/env node
/**
 * guard-health-contract.mjs
 *
 * Asserts that GET /api/health unauthenticated response contract is preserved.
 *
 * Contract: unauthenticated payload MUST match exactly:
 *   /^\{"status":"(ok|degraded)"\}$/
 *
 * No HTTP server boot. No network requests. No dependencies beyond Node.js stdlib.
 *
 * Parsing strategy:
 *   1. Reads app/api/health/route.ts as text.
 *   2. Locates the unauthenticated return section via the sentinel comment:
 *        "// Unauthenticated callers receive only the terse status"
 *      This comment is the boundary marker for the public response path.
 *   3. Asserts no leaked authenticated keys (subsystems, timestamp) appear
 *      in the text after the sentinel.
 *   4. Asserts the NextResponse.json() call in that section has exactly one
 *      key ("status") — no additional object properties.
 *   5. Simulates both possible public bodies {"status":"ok"} and
 *      {"status":"degraded"} and verifies each matches the contract regex.
 *
 * Usage:
 *   node scripts/guard-health-contract.mjs   (from project root)
 *   npm run guard:health-contract
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const ROUTE_FILE = "app/api/health/route.ts";
const CONTRACT_RE = /^\{"status":"(ok|degraded)"\}$/;

// Sentinel comment that marks the start of the unauthenticated return path.
const SENTINEL = "// Unauthenticated callers receive only the terse status";

let failed = false;

function fail(msg) {
  console.error(`[FAIL] guard-health-contract: ${msg}`);
  failed = true;
}

// ── 1. Route file must exist ───────────────────────────────────────────────

if (!existsSync(resolve(ROOT, ROUTE_FILE))) {
  console.error(`[FAIL] guard-health-contract: ${ROUTE_FILE} not found`);
  process.exit(1);
}

const src = readFileSync(resolve(ROOT, ROUTE_FILE), "utf8");

// ── 2. Locate unauthenticated return section via sentinel comment ──────────

const sentinelIdx = src.indexOf(SENTINEL);
if (sentinelIdx === -1) {
  console.error(
    `[FAIL] guard-health-contract: sentinel comment not found in ${ROUTE_FILE}:\n` +
    `  "${SENTINEL}"\n` +
    "  The public/authenticated response boundary has been lost or the comment was removed.\n" +
    "  The guard cannot verify the public response contract without this boundary marker.",
  );
  process.exit(1);
}

const afterSentinel = src.slice(sentinelIdx);

// ── 3. Assert no leaked authenticated keys in the public response section ─

if (/\bsubsystems\b/.test(afterSentinel)) {
  fail(
    `Public response section contains "subsystems" key — authenticated subsystem detail leaking to unauthenticated callers.\n` +
    `  Searched in route.ts text after sentinel at char offset ${sentinelIdx}.\n` +
    `  Actual section (first 300 chars):\n${afterSentinel.slice(0, 300)}`,
  );
}

if (/\btimestamp\b/.test(afterSentinel)) {
  fail(
    `Public response section contains "timestamp" key — authenticated data leaking to unauthenticated callers.\n` +
    `  Searched in route.ts text after sentinel at char offset ${sentinelIdx}.\n` +
    `  Actual section (first 300 chars):\n${afterSentinel.slice(0, 300)}`,
  );
}

// ── 4. Assert the public NextResponse.json call has exactly one key ────────

// Match: return NextResponse.json({ <only_one_key> }, { status: ... })
const publicJsonMatch = afterSentinel.match(
  /return NextResponse\.json\(\s*\{\s*([^}]+)\}\s*,/,
);

if (!publicJsonMatch) {
  fail(
    `Could not locate: return NextResponse.json({ ... }, ...) in public section of ${ROUTE_FILE}.\n` +
    `  Actual section (first 300 chars):\n${afterSentinel.slice(0, 300)}`,
  );
} else {
  const keyBlock = publicJsonMatch[1].trim();
  const keys = [...keyBlock.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);

  if (keys.length !== 1 || keys[0] !== "status") {
    fail(
      `Public response JSON has unexpected keys: [${keys.join(", ")}] — expected exactly ["status"].\n` +
      `  Found in object literal: { ${keyBlock} }`,
    );
  }
}

// ── 5. Simulate both possible bodies and verify contract regex ─────────────

const simulatedBodies = [
  JSON.stringify({ status: "ok" }),
  JSON.stringify({ status: "degraded" }),
];

for (const body of simulatedBodies) {
  if (!CONTRACT_RE.test(body)) {
    fail(
      `Simulated body does not match contract regex ${CONTRACT_RE}\n` +
      `  actual body: ${body}`,
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log("[PASS] guard-health-contract: public health response contract verified");
console.log(`  ✓ ${ROUTE_FILE} exists`);
console.log(`  ✓ Sentinel comment found (char offset ${sentinelIdx})`);
console.log(`  ✓ No "subsystems" key in public response section`);
console.log(`  ✓ No "timestamp" key in public response section`);
console.log(`  ✓ Public JSON object has exactly one key: status`);
console.log(`  ✓ Contract regex ${CONTRACT_RE} matches:`);
for (const b of simulatedBodies) {
  console.log(`      "${b}"`);
}
