/**
 * TeamFrame — apply database schemas to STAGING environment.
 *
 * Reads staging credentials from .env.staging and applies all schemas
 * (including tenancy_rls_v2.sql) to the staging Supabase project.
 *
 * HR5 guard: asserts SUPABASE_URL_STAGING differs from NEXT_PUBLIC_SUPABASE_URL
 * (existing project) before connecting. Exits non-zero if guard fails.
 *
 * Usage:
 *   npm run db:apply:staging
 *
 * Never run this against the existing project. See docs/launch/environment-parity.md.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { SCHEMA_ORDER } from "./schema-order.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// Load existing project env first (for HR5 comparison), then staging env.
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

const connectionString = process.env.SUPABASE_DB_URL_STAGING?.replace(/^"|"$/g, "");
if (!connectionString) {
  console.error("✗ SUPABASE_DB_URL_STAGING is missing from .env.staging.");
  process.exit(1);
}

// Staging schema order = all existing schemas + the v2 tenant isolation fix.
const STAGING_SCHEMA_ORDER = [...SCHEMA_ORDER, "tenancy_rls_v2.sql"];

const { Client } = pg;
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("• Connecting to STAGING Postgres…");
  console.log(`  URL: ${new URL(connectionString).hostname}`);
  await client.connect();
  await client.query("reset role");
  console.log("✓ Connected.\n");

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

  console.log("\n✓ All staging schemas applied.");
  console.log(`  Applied: ${STAGING_SCHEMA_ORDER.join(", ")}`);
}

main()
  .catch((err) => {
    console.error("\nStaging migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
