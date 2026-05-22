/**
 * Quick read-only inspection of the public schema.
 * Lists tables, columns, and row counts so we know what's already there
 * before any destructive migration runs.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const { Client } = pg;
const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name;
`);

if (tables.rows.length === 0) {
  console.log("public schema is empty.");
} else {
  console.log(`Tables in public schema (${tables.rows.length}):\n`);
  for (const { table_name } of tables.rows) {
    const cols = await client.query(
      `select column_name, data_type
       from information_schema.columns
       where table_schema = 'public' and table_name = $1
       order by ordinal_position;`,
      [table_name],
    );
    let rowCount = "?";
    try {
      const c = await client.query(`select count(*)::int as n from public."${table_name}"`);
      rowCount = c.rows[0].n;
    } catch {
      // ignore
    }
    console.log(`• ${table_name}  (${rowCount} rows)`);
    for (const col of cols.rows) {
      console.log(`    - ${col.column_name} : ${col.data_type}`);
    }
    console.log("");
  }
}

await client.end();
