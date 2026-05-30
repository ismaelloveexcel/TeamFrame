#!/usr/bin/env node
/**
 * guard-tenancy-filter.mjs
 *
 * Enforces tenancy isolation discipline at the service layer.
 *
 * Rule: every `.from("<table>")` call against a DB client in `services/**`
 * must, within the same chain or insert/upsert payload, either:
 *   (a) contain `.eq("tenant_id", …)` somewhere on the same chain, OR
 *   (b) be an `.insert(...)` / `.upsert(...)` whose payload includes
 *       `tenant_id:` (verified by string scan of the call's argument), OR
 *   (c) be explicitly allowlisted as an intentional non-tenant-scoped query.
 *
 * Service-role bypasses RLS, so the service layer is the only line of defense
 * for cross-tenant isolation. This guard catches a forgotten `.eq("tenant_id")`
 * before it reaches review.
 *
 * Parsing strategy (no AST, matches the style of guard-telemetry.mjs):
 *   1. Read the file as text. Strip line + block comments first so commented
 *      code cannot mask a violation OR falsely satisfy one.
 *   2. Find each `.from("<table>")` occurrence on a DB client (not
 *      `supabase.storage.from`, not `Buffer.from`, not `Array.from`).
 *   3. Extract the surrounding "chain window" — from the start of the
 *      statement (walking backwards to the previous `;` or `{` at chain
 *      depth 0) to the matching `)` that ends the chain's terminating call.
 *      In practice we use a forward window of N lines from the `.from(`
 *      site, which is sufficient for the linear chain style used in
 *      services/**.
 *   4. Apply the rule above. Report violations with file:line.
 *
 * Limitations (by design):
 *   - String-based, not AST. Sufficient for the current service-layer style
 *     where each `.from(...)` begins a one-statement chain.
 *   - Does not validate that the `tenantId` variable passed to `.eq` came
 *     from `requireTenant(actor)` — that's a separate review concern.
 *   - Allowlist entries must justify why the call is intentionally not
 *     tenant-scoped.
 *
 * Usage:
 *   node scripts/guard-tenancy-filter.mjs   (from project root)
 *   npm run guard:tenancy-filter
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SERVICES_DIR = join(ROOT, "services");
const WINDOW_LINES = 40;

// ── Allowlist — intentional non-tenant-scoped `.from(...)` calls ───────────
//
// Each entry: { file, table, reason }. A violation matching (file, table)
// is silenced. Keep this list as short as possible.
const ALLOWLIST = [
  {
    file: "services/employeeService/index.ts",
    table: "employees",
    reason:
      "detectEmployeeTelemetryCapabilities probes column existence with .limit(1); not a tenant-scoped read. Tracked as audit IMPORTANT-4 / Move 4.",
  },
];

// ── Non-DB `.from(...)` patterns that should be ignored entirely ───────────
// These are not Supabase database queries.
const NON_DB_FROM_RE =
  /(?:Buffer|Array|Uint8Array|Int8Array|Float32Array|Float64Array|Object|String|Number|Map|Set|Promise|Date)\.from\(|\.storage\s*\.\s*from\(/;

// ── Comment stripper ──────────────────────────────────────────────────────
//
// Strips // line comments and /* block comments */ while preserving string
// contents. Quoted strings are skipped char-by-char so that `// inside a
// "url//path"` is not interpreted as a comment opener.
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    // line comment
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // single-quoted string
    if (c === "'") {
      out += c;
      i++;
      while (i < n && src[i] !== "'") {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    // double-quoted string
    if (c === '"') {
      out += c;
      i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    // template literal — preserve as-is; do not attempt nested expr parsing,
    // we just want to avoid eating `// inside ${expr}` as a comment.
    if (c === "`") {
      out += c;
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// ── Recursive file walker ─────────────────────────────────────────────────
function walkTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTs(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

// ── Line-number lookup for a char offset ──────────────────────────────────
function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

// ── Forward chain window (N lines after the `.from(` site) ────────────────
function chainWindow(text, fromOffset) {
  let end = fromOffset;
  let lines = 0;
  while (end < text.length && lines < WINDOW_LINES) {
    if (text[end] === "\n") lines++;
    end++;
  }
  return text.slice(fromOffset, end);
}

// ── Insert/upsert payload check ───────────────────────────────────────────
//
// Looks for `.insert(` or `.upsert(` in the chain window and confirms the
// payload object contains `tenant_id:` (object-literal style) or
// `tenant_id =` (rare alt). Returns true if either pattern is present.
function payloadCarriesTenantId(window) {
  const mutationMatch = window.match(/\.(?:insert|upsert)\s*\(/);
  if (!mutationMatch) return false;
  // From the mutation call site, scan ~20 lines or until balanced `)`.
  const start = mutationMatch.index + mutationMatch[0].length;
  const slice = window.slice(start, start + 2000);
  return /\btenant_id\s*:/.test(slice);
}

// ── Main scan ─────────────────────────────────────────────────────────────
function scanFile(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join("/");
  const raw = readFileSync(absPath, "utf8");
  const src = stripComments(raw);
  const violations = [];

  const fromRe = /\.from\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\)/g;
  let m;
  while ((m = fromRe.exec(src)) !== null) {
    const table = m[1];
    const offset = m.index;
    // Skip non-DB .from(...) by looking at the 40 chars before the match.
    const prelude = src.slice(Math.max(0, offset - 40), offset + m[0].length);
    if (NON_DB_FROM_RE.test(prelude)) continue;

    const window = chainWindow(src, offset);
    const hasEq = /\.eq\(\s*["']tenant_id["']/.test(window);
    const hasInsertWithTenant = payloadCarriesTenantId(window);

    if (hasEq || hasInsertWithTenant) continue;

    const allowed = ALLOWLIST.some(
      (a) => a.file === rel && a.table === table,
    );
    if (allowed) continue;

    violations.push({
      file: rel,
      line: lineAt(src, offset),
      table,
    });
  }

  return violations;
}

function main() {
  let total = 0;
  const files = walkTs(SERVICES_DIR);
  for (const f of files) {
    const v = scanFile(f);
    for (const item of v) {
      console.error(
        `TENANCY_GUARD_FAIL: ${item.file}:${item.line} .from("${item.table}") has no .eq("tenant_id", ...) on the chain and no tenant_id in any insert/upsert payload.`,
      );
      total++;
    }
  }

  if (total > 0) {
    console.error(
      `\nguard-tenancy-filter: ${total} violation(s). Add .eq("tenant_id", tenantId) to the chain, include tenant_id in the insert/upsert payload, or add a justified entry to the ALLOWLIST in scripts/guard-tenancy-filter.mjs.`,
    );
    process.exit(1);
  }

  console.log(
    `guard-tenancy-filter: PASS — ${files.length} service file(s) scanned, all .from(...) calls are tenancy-scoped or allowlisted.`,
  );
}

main();
