/**
 * TeamFrame — apply database schemas.
 *
 * Reads /schemas/*.sql in build-plan order and applies them to the Postgres
 * database referenced by SUPABASE_DB_URL.
 *
 * The schemas are written idempotently (`create table if not exists`, etc.),
 * so this script is safe to re-run.
 *
 * Usage:
 *   npm run db:apply
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

dotenv.config({ path: join(repoRoot, ".env.local") });

const SCHEMA_ORDER = [
  "companies.sql",
  "employees.sql",
  "employee_profiles.sql",
  "compensation.sql",
  "documents.sql",
  "leaves.sql",
  "company_updates.sql",
  "audit_logs.sql",
  "validation_tracking.sql",
  "policies.sql",
  "procedures.sql",
  "acknowledgements.sql",
  "tenancy_rls.sql",
];

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString || connectionString.includes("[YOUR-PASSWORD]")) {
  console.error(
    "✗ SUPABASE_DB_URL is missing or still contains the [YOUR-PASSWORD] placeholder.\n" +
      "  Get it from: Supabase Dashboard → Project Settings → Database → Connection string → URI.",
  );
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("• Connecting to Postgres…");
  await client.connect();
  await client.query("reset role");
  console.log("✓ Connected.\n");

  for (const file of SCHEMA_ORDER) {
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

  console.log("\n✓ All schemas applied.");
}

main()
  .catch((err) => {
    console.error("\nMigration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
