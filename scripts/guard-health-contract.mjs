#!/usr/bin/env node
/**
 * guard-health-contract.mjs
 *
 * Asserts that GET /api/health unauthenticated response contract is preserved.
 *
 * Contract: unauthenticated payload MUST match exactly:
 *   /^\{"status":"(ok|degraded)"\}$/
 *
 * Verification strategy (helper-import based — replaces the earlier
 * text-pattern matcher that could be bypassed by behavior-changing edits
 * preserving textual shape):
 *
 *   1. Import buildPublicHealthPayload from lib/health/contract.mjs —
 *      the SAME function the route handler calls.
 *   2. For each status in {"ok","degraded"}: call the helper, serialize
 *      with JSON.stringify, assert the output matches the contract regex
 *      EXACTLY (no extra keys, no whitespace drift).
 *   3. Assert route.ts imports the helper (small text check to catch the
 *      regression "delete helper import + inline a different object").
 *
 * No HTTP server boot. No network. No dependencies beyond Node.js stdlib.
 *
 * Why this closes the regression gap:
 *   Adding a key to the helper return value (e.g. { status, timestamp })
 *   immediately changes JSON.stringify output and fails the regex.
 *   Removing the helper import from route.ts is caught by check #3.
 *
 * Usage:
 *   node scripts/guard-health-contract.mjs   (from project root)
 *   npm run guard:health-contract
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPublicHealthPayload } from "../lib/health/contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ROUTE_FILE = "app/api/health/route.ts";
const HELPER_FILE = "lib/health/contract.mjs";
const CONTRACT_RE = /^\{"status":"(ok|degraded)"\}$/;
const EXPECTED_IMPORT_RE =
  /import\s*\{\s*buildPublicHealthPayload\s*\}\s*from\s*["']@\/lib\/health\/contract\.mjs["']/;

let failed = false;

function fail(msg) {
  console.error(`[FAIL] guard-health-contract: ${msg}`);
  failed = true;
}

// ── 1. Files must exist ────────────────────────────────────────────────────

if (!existsSync(join(ROOT, ROUTE_FILE))) {
  console.error(`[FAIL] guard-health-contract: ${ROUTE_FILE} not found`);
  process.exit(1);
}
if (!existsSync(join(ROOT, HELPER_FILE))) {
  console.error(`[FAIL] guard-health-contract: ${HELPER_FILE} not found`);
  process.exit(1);
}

// ── 2. Helper-import contract verification ─────────────────────────────────

for (const status of ["ok", "degraded"]) {
  const payload = buildPublicHealthPayload(status);
  const body = JSON.stringify(payload);

  if (!CONTRACT_RE.test(body)) {
    fail(
      `buildPublicHealthPayload("${status}") produced body that violates contract.\n` +
        `  expected to match: ${CONTRACT_RE}\n` +
        `  actual body:       ${body}\n` +
        `  payload object:    ${JSON.stringify(payload)}`,
    );
  }

  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== "status") {
    fail(
      `buildPublicHealthPayload("${status}") returned unexpected keys.\n` +
        `  expected: ["status"]\n` +
        `  actual:   [${keys.map((k) => `"${k}"`).join(", ")}]`,
    );
  }
}

// ── 3. Route must import the helper (catches inline-replacement regression) ─

const routeSrc = readFileSync(join(ROOT, ROUTE_FILE), "utf8");

if (!EXPECTED_IMPORT_RE.test(routeSrc)) {
  fail(
    `${ROUTE_FILE} does not import buildPublicHealthPayload from "@/lib/health/contract.mjs".\n` +
      `  The route must use the shared helper so this guard can verify the contract.\n` +
      `  Expected import statement matching: ${EXPECTED_IMPORT_RE}`,
  );
}

if (!routeSrc.includes("buildPublicHealthPayload(")) {
  fail(
    `${ROUTE_FILE} imports buildPublicHealthPayload but never calls it.\n` +
      `  The public unauthenticated NextResponse.json() call must use the helper.`,
  );
}

if (failed) {
  process.exit(1);
}

console.log("[PASS] guard-health-contract: public health response contract verified");
console.log(`  ✓ ${HELPER_FILE} exists and exports buildPublicHealthPayload`);
console.log(`  ✓ ${ROUTE_FILE} imports buildPublicHealthPayload from @/lib/health/contract.mjs`);
console.log(`  ✓ ${ROUTE_FILE} calls buildPublicHealthPayload(...)`);
console.log(`  ✓ Helper returns object with exactly one key: "status"`);
console.log(`  ✓ JSON.stringify of helper output matches contract ${CONTRACT_RE}:`);
for (const status of ["ok", "degraded"]) {
  console.log(
    `      buildPublicHealthPayload("${status}") → ${JSON.stringify(buildPublicHealthPayload(status))}`,
  );
}
