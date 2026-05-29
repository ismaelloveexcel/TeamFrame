#!/usr/bin/env node
/**
 * guard-telemetry.mjs
 *
 * Asserts that every critical mutation still has both logAction() and
 * captureActionError() present in its function body.
 *
 * Parsing strategy (no AST):
 *   1. Read the source file as text.
 *   2. Locate the function declaration by searching for
 *        "async function <name>("
 *      using a plain string indexOf.
 *   3. From the opening brace of the function body, walk forward with a
 *      brace-depth counter to find the matching closing brace.
 *      This extracts the full function body including nested blocks.
 *   4. Assert that both "logAction(" and "captureActionError(" appear
 *      inside the extracted body string.
 *
 * Limitations (by design):
 *   - Does not parse string literals or comments. A commented-out call
 *     would still satisfy the check. This is intentional: the guard targets
 *     accidental deletion, not malicious bypass.
 *   - Does not validate call arguments — only presence.
 *
 * Allowlist is the single source of truth verified on 2026-05-29.
 * All symbols confirmed with exact file + line discovery pass.
 * Function names carry the "Action" suffix exactly as they appear in source.
 *
 * Usage:
 *   node scripts/guard-telemetry.mjs   (from project root)
 *   npm run guard:telemetry
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

// ── Single source of truth — VERIFIED allowlist (Phase 1C instrumentation) ─
// Discovery: 2026-05-29. Symbols confirmed with grep, exact file + line.
// Task description uses short names; actual exported names have "Action" suffix.
const ALLOWLIST = [
  // app/employees/actions.ts
  { file: "app/employees/actions.ts", fn: "createEmployeeAction"         },
  { file: "app/employees/actions.ts", fn: "archiveEmployeeAction"        },
  { file: "app/employees/actions.ts", fn: "reinviteEmployeeAction"       },
  { file: "app/employees/actions.ts", fn: "generateActivationLinkAction" },
  { file: "app/employees/actions.ts", fn: "updateEmployeeAction"         },
  // app/leaves/actions.ts
  { file: "app/leaves/actions.ts",    fn: "submitLeaveAction"            },
  { file: "app/leaves/actions.ts",    fn: "decideLeaveAction"            },
  // app/onboarding/actions.ts
  { file: "app/onboarding/actions.ts", fn: "completeOnboardingTaskAction" },
  { file: "app/onboarding/actions.ts", fn: "assignOnboardingTaskAction"   },
  // services/documentService/index.ts (no Action suffix — service layer)
  { file: "services/documentService/index.ts", fn: "uploadDocument" },
];

// ── Brace-balanced function body extractor ─────────────────────────────────

/**
 * Finds "async function <name>(" in src, then extracts the complete function
 * body using two passes:
 *
 *   Pass 1 — Skip the parameter list.
 *     Walk forward from the opening `(` of the parameter list, tracking only
 *     paren depth. Stop when paren depth returns to 0. This safely handles
 *     inline type annotations that contain `{}` (e.g. `input: { key: Type }`).
 *
 *   Pass 2 — Find the function body opening brace.
 *     After the closing `)`, scan forward for the first `{`. This naturally
 *     skips the return-type annotation (e.g. `): Promise<Foo>`).
 *
 *   Pass 3 — Brace-balanced extraction.
 *     Walk from the opening `{` tracking brace depth to find the matching `}`.
 *
 * Returns the body string including both outer braces, or null if not found.
 */
function extractFunctionBody(src, funcName) {
  const needle = `async function ${funcName}(`;
  const declIdx = src.indexOf(needle);
  if (declIdx === -1) return null;

  // i points at the opening `(` of the parameter list
  let i = declIdx + needle.length - 1;

  // Pass 1: walk past parameter list, tracking paren depth only
  let parenDepth = 0;
  while (i < src.length) {
    if (src[i] === "(") parenDepth++;
    else if (src[i] === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        i++; // move past the closing `)`
        break;
      }
    }
    i++;
  }

  // Pass 2: find the first `{` after the parameter list (skips return type)
  while (i < src.length && src[i] !== "{") i++;
  if (i >= src.length) return null;

  const openBrace = i;

  // Pass 3: brace-balanced walk to find the matching `}`
  let depth = 0;
  let closeIdx = -1;
  for (let j = openBrace; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) {
        closeIdx = j;
        break;
      }
    }
  }

  if (closeIdx === -1) return null;
  return src.slice(openBrace, closeIdx + 1);
}

// ── Main ──────────────────────────────────────────────────────────────────

const failures = [];

// Group entries by file to avoid reading the same file multiple times.
const byFile = new Map();
for (const entry of ALLOWLIST) {
  if (!byFile.has(entry.file)) byFile.set(entry.file, []);
  byFile.get(entry.file).push(entry.fn);
}

for (const [file, fns] of byFile) {
  let src;
  try {
    src = readFileSync(resolve(ROOT, file), "utf8");
  } catch {
    for (const fn of fns) {
      failures.push({ file, fn, missing: "file could not be read" });
    }
    continue;
  }

  for (const fn of fns) {
    const body = extractFunctionBody(src, fn);
    if (!body) {
      failures.push({ file, fn, missing: "function body not found (function may have been renamed or removed)" });
      continue;
    }

    if (!body.includes("logAction(")) {
      failures.push({ file, fn, missing: "logAction(" });
    }

    if (!body.includes("captureActionError(")) {
      failures.push({ file, fn, missing: "captureActionError(" });
    }
  }
}

if (failures.length > 0) {
  console.error("[FAIL] guard-telemetry: missing telemetry in critical mutations:\n");
  for (const { file, fn, missing } of failures) {
    console.error(`  ${file} :: ${fn}`);
    console.error(`    missing: ${missing}`);
  }
  process.exit(1);
}

console.log("[PASS] guard-telemetry: all critical mutations have logAction + captureActionError");
for (const entry of ALLOWLIST) {
  console.log(`  ✓ ${entry.file} :: ${entry.fn}`);
}
