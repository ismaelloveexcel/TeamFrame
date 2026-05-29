#!/usr/bin/env node
/**
 * guard-instrumentation.mjs
 *
 * Asserts that Sentry runtime instrumentation wiring is intact.
 *
 * Checks:
 *   1. instrumentation.ts exists
 *   2. sentry.server.config.ts exists
 *   3. sentry.edge.config.ts exists
 *   4. instrumentation.ts contains: import("./sentry.server.config")
 *   5. instrumentation.ts contains: import("./sentry.edge.config")
 *
 * Parsing strategy:
 *   File-existence checks via fs.existsSync. Import assertions via anchored
 *   regex on the raw file text — matches the exact dynamic import() expressions
 *   emitted by Next.js instrumentation hooks.
 *
 * Usage:
 *   node scripts/guard-instrumentation.mjs   (from project root)
 *   npm run guard:instrumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
let failed = false;

function fail(msg) {
  console.error(`[FAIL] guard-instrumentation: ${msg}`);
  failed = true;
}

// ── 1. Required file existence ─────────────────────────────────────────────

const REQUIRED_FILES = [
  "instrumentation.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
];

for (const file of REQUIRED_FILES) {
  if (!existsSync(resolve(ROOT, file))) {
    fail(`Required file not found: ${file}`);
  }
}

// ── 2. Import assertions in instrumentation.ts ────────────────────────────

const instrPath = resolve(ROOT, "instrumentation.ts");
if (existsSync(instrPath)) {
  const src = readFileSync(instrPath, "utf8");

  // Anchored regex: matches the exact dynamic import() expressions used by
  // Next.js 15 instrumentation hooks (single or double quotes).
  const SERVER_IMPORT_RE = /import\(["']\.\/sentry\.server\.config["']\)/;
  const EDGE_IMPORT_RE   = /import\(["']\.\/sentry\.edge\.config["']\)/;

  if (!SERVER_IMPORT_RE.test(src)) {
    fail(
      'instrumentation.ts is missing: import("./sentry.server.config")\n' +
      "  Sentry server-side init will not fire at runtime — captureActionError will be a silent no-op.",
    );
  }

  if (!EDGE_IMPORT_RE.test(src)) {
    fail(
      'instrumentation.ts is missing: import("./sentry.edge.config")\n' +
      "  Sentry edge-runtime init will not fire — middleware exception capture will be a silent no-op.",
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log("[PASS] guard-instrumentation: all Sentry wiring checks passed");
console.log("  ✓ instrumentation.ts exists");
console.log("  ✓ sentry.server.config.ts exists");
console.log("  ✓ sentry.edge.config.ts exists");
console.log('  ✓ instrumentation.ts imports "./sentry.server.config"');
console.log('  ✓ instrumentation.ts imports "./sentry.edge.config"');
