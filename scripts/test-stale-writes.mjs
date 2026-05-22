/**
 * TeamFrame — stale-write smoke test.
 *
 * Verifies optimistic concurrency semantics on employees and leaves via updated_at guards.
 * Runs in a transaction and rolls back all fixture writes.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("✗ SUPABASE_DB_URL is missing from .env.local.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    const tenantId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const employeeId = (await client.query("select gen_random_uuid() as id")).rows[0].id;

    await client.query(
      `insert into companies (id, name, slug)
       values ($1, 'Concurrency Tenant', 'concurrency-tenant-test')`,
      [tenantId],
    );

    const insert = await client.query(
      `insert into employees (
         id, tenant_id, full_name, email, role_title, department, timezone, status, setup_status
       ) values (
         $1, $2, 'Concurrency User', 'concurrency@test.local', 'Engineer', 'Product', 'UTC', 'active', 'active'
       )
       returning updated_at::text as updated_at_text`,
      [employeeId, tenantId],
    );

    const expectedUpdatedAt = insert.rows[0].updated_at_text;

    const okUpdate = await client.query(
      `update employees
       set role_title = 'Senior Engineer'
       where id = $1
         and tenant_id = $2
         and deleted_at is null
         and updated_at::text = $3`,
      [employeeId, tenantId, expectedUpdatedAt],
    );
    assert(okUpdate.rowCount === 1, "first update with current updated_at should succeed");

    const staleUpdate = await client.query(
      `update employees
       set role_title = 'Principal Engineer'
       where id = $1
         and tenant_id = $2
         and deleted_at is null
         and updated_at::text = $3`,
      [employeeId, tenantId, expectedUpdatedAt],
    );
    assert(staleUpdate.rowCount === 0, "second update with stale updated_at should fail");

    const leaveInsert = await client.query(
      `insert into leaves (tenant_id, employee_id, start_date, end_date, status)
       values ($1, $2, current_date + 1, current_date + 2, 'pending')
       returning id, updated_at::text as updated_at_text`,
      [tenantId, employeeId],
    );

    const leaveId = leaveInsert.rows[0].id;
    const expectedLeaveUpdatedAt = leaveInsert.rows[0].updated_at_text;

    const okLeaveUpdate = await client.query(
      `update leaves
       set status = 'approved'
       where id = $1
         and tenant_id = $2
         and updated_at::text = $3`,
      [leaveId, tenantId, expectedLeaveUpdatedAt],
    );
    assert(okLeaveUpdate.rowCount === 1, "leave update with current updated_at should succeed");

    const staleLeaveUpdate = await client.query(
      `update leaves
       set status = 'rejected'
       where id = $1
         and tenant_id = $2
         and updated_at::text = $3`,
      [leaveId, tenantId, expectedLeaveUpdatedAt],
    );
    assert(staleLeaveUpdate.rowCount === 0, "leave update with stale updated_at should fail");

    console.log("✓ stale-write smoke tests passed.");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ stale-write smoke tests failed: ${err.message}`);
  process.exit(1);
});
