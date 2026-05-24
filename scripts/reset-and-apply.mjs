/**
 * TeamFrame — destructive reset + schema apply.
 *
 * 1. Drops every table currently in the `public` schema (CASCADE).
 *    Drops any leftover TeamFrame enum types from prior partial runs.
 * 2. Re-applies the 7 canonical schema files from /schemas in build-plan order.
 *
 * Use only when starting from a known-disposable database state. Supabase Auth
 * users, storage buckets, and project settings are not in `public` and are
 * therefore untouched.
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

const TEAMFRAME_ENUMS = [
  "employee_status",
  "employee_setup_status",
  "document_type",
  "leave_status",
];

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("✗ SUPABASE_DB_URL is missing from .env.local.");
  process.exit(1);
}

const ALLOW_DESTRUCTIVE_RESET = process.env.ALLOW_DESTRUCTIVE_RESET;
if (ALLOW_DESTRUCTIVE_RESET !== "yes-i-mean-it") {
  console.error(
    "✗ Refusing destructive reset. Set ALLOW_DESTRUCTIVE_RESET=yes-i-mean-it to continue.",
  );
  process.exit(1);
}

const isCi = String(process.env.CI ?? "").toLowerCase() === "true";
if (isCi && process.env.ALLOW_DESTRUCTIVE_RESET_IN_CI !== "yes-i-mean-it") {
  console.error(
    "✗ Refusing destructive reset in CI. Set ALLOW_DESTRUCTIVE_RESET_IN_CI=yes-i-mean-it to continue.",
  );
  process.exit(1);
}

function extractHost(dbUrl) {
  const normalized = dbUrl.replace(/^"|"$/g, "");
  const parsed = new URL(normalized);
  return parsed.hostname.toLowerCase();
}

const dbHost = extractHost(connectionString);
const protectedHostTokens = (process.env.PROTECTED_DB_HOST_TOKENS ?? "")
  .split(",")
  .map((token) => token.trim().toLowerCase())
  .filter(Boolean);

if (protectedHostTokens.some((token) => dbHost.includes(token))) {
  console.error(
    `✗ Refusing destructive reset for protected host '${dbHost}'. Review PROTECTED_DB_HOST_TOKENS.`,
  );
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("• Connecting to Postgres…");
  await client.connect();
  console.log("✓ Connected.\n");

  console.log("• Listing existing tables in public schema…");
  const { rows: tables } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE';
  `);
  console.log(`  Found ${tables.length} table(s).\n`);

  if (tables.length > 0) {
    console.log("• Dropping all public-schema tables (CASCADE)…");
    for (const { table_name } of tables) {
      process.stdout.write(`    - drop ${table_name} … `);
      await client.query(`drop table if exists public."${table_name}" cascade;`);
      console.log("✓");
    }
    console.log("");
  }

  console.log("• Dropping any leftover TeamFrame enum types…");
  for (const t of TEAMFRAME_ENUMS) {
    process.stdout.write(`    - drop type ${t} … `);
    await client.query(`drop type if exists public."${t}" cascade;`);
    console.log("✓");
  }
  console.log("");

  console.log("• Applying TeamFrame schemas in order…");
  for (const file of SCHEMA_ORDER) {
    const path = join(repoRoot, "schemas", file);
    const sql = await readFile(path, "utf8");
    process.stdout.write(`    - ${file} … `);
    await client.query(sql);
    console.log("✓");
  }

  console.log("\n• Verifying TeamFrame tables…");
  const { rows: after } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `);
  for (const row of after) console.log(`    ✓ ${row.table_name}`);

  console.log("\n✓ Reset + apply complete.");
}

main()
  .catch((err) => {
    console.error("\nFailed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
