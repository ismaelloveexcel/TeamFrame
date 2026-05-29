/**
 * TeamFrame — environment parity verification.
 *
 * Connects to BOTH the existing project (read-only) and staging (read+write allowed)
 * and compares:
 *   - Table list (all tenant tables must be present in both)
 *   - RLS enabled state per tenant table (relrowsecurity must be true)
 *   - RLS policy list (staging must have >= policies as existing on each table)
 *   - Row counts per tenant table (informational)
 *
 * HR5 guard: asserts SUPABASE_URL_STAGING differs from NEXT_PUBLIC_SUPABASE_URL.
 *
 * Exits non-zero if:
 *   - Any tenant table is missing in staging
 *   - Any tenant table has RLS disabled in either environment
 *   - Staging has fewer policies than existing on any tenant table
 *
 * Usage:
 *   npm run verify:parity
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env.staging") });

// ─── HR5 Guard ────────────────────────────────────────────────────────────────
if (!process.env.SUPABASE_URL_STAGING) {
  console.error("[PARITY_FAIL] SUPABASE_URL_STAGING missing — aborting.");
  process.exit(1);
}
if (process.env.SUPABASE_URL_STAGING === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "[PARITY_FAIL] SUPABASE_URL_STAGING must differ from NEXT_PUBLIC_SUPABASE_URL — aborting.\n" +
    "  staging and existing project cannot be the same (HR5)."
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

// All tables that must have RLS enabled in both environments.
const TENANT_TABLES = [
  "companies",
  "employees",
  "employee_profiles",
  "compensation",
  "documents",
  "leaves",
  "company_updates",
  "audit_logs",
  "analytics_events",
  "onboarding_tasks",
  "policies",
  "procedures",
  "acknowledgements",
];

const existingConnStr = process.env.SUPABASE_DB_URL?.replace(/^"|"$/g, "");
const stagingConnStr = process.env.SUPABASE_DB_URL_STAGING?.replace(/^"|"$/g, "");

if (!existingConnStr) {
  console.error("✗ SUPABASE_DB_URL missing from .env.local — cannot check existing project.");
  process.exit(1);
}
if (!stagingConnStr) {
  console.error("✗ SUPABASE_DB_URL_STAGING missing from .env.staging — cannot check staging.");
  process.exit(1);
}

const { Client } = pg;

async function queryDb(connStr, label) {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("reset role");

  // Table list in public schema.
  const { rows: tables } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name;
  `);
  const tableNames = tables.map((r) => r.table_name);

  // RLS enabled state per tenant table.
  const { rows: rlsState } = await client.query(`
    select relname, relrowsecurity
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relname = any($1)
    order by relname;
  `, [TENANT_TABLES]);

  // RLS policies per tenant table.
  const { rows: policies } = await client.query(`
    select tablename, policyname, cmd, roles, qual
    from pg_policies
    where schemaname = 'public'
      and tablename = any($1)
    order by tablename, policyname;
  `, [TENANT_TABLES]);

  // Row counts per tenant table (informational).
  const rowCounts = {};
  for (const tbl of TENANT_TABLES) {
    if (!tableNames.includes(tbl)) {
      rowCounts[tbl] = null;
      continue;
    }
    try {
      const { rows } = await client.query(`select count(*) as cnt from public."${tbl}";`);
      rowCounts[tbl] = parseInt(rows[0].cnt, 10);
    } catch {
      rowCounts[tbl] = "ERROR";
    }
  }

  // Applied schema files: look for files matching SCHEMA_ORDER + v2.
  // We detect applied functions/objects rather than a migration table.
  // Instead, report tables present as a proxy for applied schemas.

  await client.end();
  return { label, tableNames, rlsState, policies, rowCounts };
}

function policyCount(policies, tableName) {
  return policies.filter((p) => p.tablename === tableName).length;
}

function rlsEnabled(rlsState, tableName) {
  const row = rlsState.find((r) => r.relname === tableName);
  return row ? row.relrowsecurity : null;
}

function pad(str, len) {
  return String(str ?? "").padEnd(len);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  TeamFrame — Environment Parity Verification");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("• Connecting to existing project (read-only)…");
  const existing = await queryDb(existingConnStr, "existing");
  console.log(`  ✓ ${existing.tableNames.length} tables found.\n`);

  console.log("• Connecting to staging…");
  const staging = await queryDb(stagingConnStr, "staging");
  console.log(`  ✓ ${staging.tableNames.length} tables found.\n`);

  const failures = [];

  console.log("─── Tenant Table Analysis ─────────────────────────────────");
  console.log(
    pad("Table", 25) +
    pad("RLS (existing)", 16) +
    pad("RLS (staging)", 15) +
    pad("Policies (existing)", 21) +
    pad("Policies (staging)", 20) +
    pad("Rows (existing)", 17) +
    "Rows (staging)"
  );
  console.log("─".repeat(116));

  for (const tbl of TENANT_TABLES) {
    const inExisting = existing.tableNames.includes(tbl);
    const inStaging = staging.tableNames.includes(tbl);
    const rlsExisting = rlsEnabled(existing.rlsState, tbl);
    const rlsStaging = rlsEnabled(staging.rlsState, tbl);
    const polExisting = policyCount(existing.policies, tbl);
    const polStaging = policyCount(staging.policies, tbl);
    const rowsExisting = existing.rowCounts[tbl];
    const rowsStaging = staging.rowCounts[tbl];

    const rlsExistingStr = !inExisting ? "MISSING" : rlsExisting ? "ENABLED ✓" : "DISABLED ✗";
    const rlsStagingStr = !inStaging ? "MISSING" : rlsStaging ? "ENABLED ✓" : "DISABLED ✗";

    console.log(
      pad(tbl, 25) +
      pad(rlsExistingStr, 16) +
      pad(rlsStagingStr, 15) +
      pad(polExisting, 21) +
      pad(polStaging, 20) +
      pad(rowsExisting ?? "n/a", 17) +
      (rowsStaging ?? "n/a")
    );

    if (!inStaging) failures.push(`[PARITY_FAIL] Table '${tbl}' missing in staging.`);
    if (inExisting && !rlsExisting) failures.push(`[PARITY_FAIL] RLS disabled on '${tbl}' in existing project.`);
    if (inStaging && !rlsStaging) failures.push(`[PARITY_FAIL] RLS disabled on '${tbl}' in staging.`);
    if (inStaging && polStaging < polExisting) {
      failures.push(`[PARITY_FAIL] '${tbl}' has ${polStaging} policies in staging vs ${polExisting} in existing.`);
    }
  }

  console.log("\n─── Tables in staging not in TENANT_TABLES list ───────────");
  const extraStagingTables = staging.tableNames.filter((t) => !TENANT_TABLES.includes(t));
  if (extraStagingTables.length === 0) {
    console.log("  (none)");
  } else {
    for (const t of extraStagingTables) console.log(`  ${t}`);
  }

  console.log("\n─── RLS Policy Detail (staging) ────────────────────────────");
  for (const tbl of TENANT_TABLES) {
    const tblPolicies = staging.policies.filter((p) => p.tablename === tbl);
    if (tblPolicies.length === 0) {
      console.log(`  ${tbl}: (no policies)`);
    } else {
      for (const p of tblPolicies) {
        console.log(`  ${pad(tbl, 25)} ${pad(p.policyname, 40)} cmd=${p.cmd}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  if (failures.length === 0) {
    console.log("  ✓ PARITY CHECK PASSED — all tenant tables present, RLS enabled, policy counts match.");
  } else {
    console.log(`  ✗ PARITY CHECK FAILED — ${failures.length} issue(s):`);
    for (const f of failures) console.log(`    • ${f}`);
    process.exitCode = 1;
  }
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n[PARITY_FAIL] verify-parity crashed:", err.message);
  process.exitCode = 1;
});
