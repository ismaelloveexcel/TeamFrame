/**
 * TeamFrame — destructive reset + schema apply for STAGING environment.
 *
 * Drops all public-schema tables in staging and reapplies all schemas
 * (including tenancy_rls_v2.sql). Used to return staging to a clean state.
 *
 * Guards:
 *   - HR5: SUPABASE_URL_STAGING must differ from NEXT_PUBLIC_SUPABASE_URL.
 *   - Requires ALLOW_DESTRUCTIVE_RESET=true env var OR --allow-destructive-reset flag.
 *   - Host token guard: refuses if hostname contains 'prod', 'production', 'live'.
 *
 * Usage (cross-platform):
 *   npm run db:reset:staging
 *
 * Usage (non-Windows inline env):
 *   ALLOW_DESTRUCTIVE_RESET=true node scripts/reset-and-apply-staging.mjs
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { SCHEMA_ORDER } from "./schema-order.mjs";

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
    "  You may be pointing staging at the existing project. This is forbidden (HR5)."
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

if (process.env.ALLOW_DESTRUCTIVE_RESET !== "true" && !process.argv.includes("--allow-destructive-reset")) {
  console.error("✗ Refusing destructive reset. Set ALLOW_DESTRUCTIVE_RESET=true or pass --allow-destructive-reset.");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL_STAGING?.replace(/^"|"$/g, "");
if (!connectionString) {
  console.error("✗ SUPABASE_DB_URL_STAGING is missing from .env.staging.");
  process.exit(1);
}

// Refuse if hostname suggests production.
const protectedTokens = ["prod", "production", "live"];
const host = (() => { try { return new URL(connectionString).hostname.toLowerCase(); } catch { return ""; } })();
if (host && protectedTokens.some((t) => host.includes(t))) {
  console.error(`✗ Refusing destructive reset against protected host: ${host}`);
  process.exit(1);
}

const TEAMFRAME_ENUMS = [
  "employee_status", "employee_setup_status", "document_type",
  "leave_status", "onboarding_task_status",
];

const STAGING_SCHEMA_ORDER = [...SCHEMA_ORDER, "tenancy_rls_v2.sql"];

const { Client } = pg;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("• Connecting to STAGING Postgres for destructive reset…");
  console.log(`  URL: ${host}`);
  await client.connect();
  console.log("✓ Connected.\n");

  const { rows: tables } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE';
  `);
  console.log(`• Dropping ${tables.length} table(s)…`);
  for (const { table_name } of tables) {
    process.stdout.write(`    - drop ${table_name} … `);
    await client.query(`drop table if exists public."${table_name}" cascade;`);
    console.log("✓");
  }

  console.log("\n• Dropping enum types…");
  for (const t of TEAMFRAME_ENUMS) {
    await client.query(`drop type if exists public."${t}" cascade;`);
  }
  console.log("✓\n");

  for (const file of STAGING_SCHEMA_ORDER) {
    const path = join(repoRoot, "schemas", file);
    const sql = await readFile(path, "utf8");
    process.stdout.write(`• Applying ${file}… `);
    try {
      await client.query(sql);
      console.log("✓");
    } catch (err) {
      console.log("✗");
      console.error(`\n  ${err.message}\n`);
      throw err;
    }
  }

  console.log("\n✓ Staging reset and schema apply complete.");
}

main()
  .catch((err) => {
    console.error("\nStaging reset failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
