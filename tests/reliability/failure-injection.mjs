/**
 * Reliability: transaction failure injection + rollback consistency.
 */

import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env.local") });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("✗ SUPABASE_DB_URL is missing from .env.local.");
  process.exit(1);
}

const { Client } = pg;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function asActor(client, claims) {
  await client.query("reset role");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
}

async function main() {
  const tenantId = randomUUID();
  const adminAuthId = randomUUID();
  const adminEmail = `failure-admin-${randomUUID().slice(0, 8)}@reliability.test`;

  const claims = { email: adminEmail, app_metadata: { role: "admin" } };
  const actionType = `employee.updated.failure.${randomUUID().slice(0, 8)}`;

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("set row_security = on");
  await client.query("begin");

  let employeeId = null;
  let expectedUpdatedAt = null;

  try {
    await client.query(
      `insert into companies (id, name, slug)
       values ($1, 'Failure Injection Tenant', $2)`,
      [tenantId, `failure-injection-${tenantId.slice(0, 8)}`],
    );

    await client.query("alter table employees disable row level security");
    const seeded = await client.query(
      `insert into employees (
         tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
       ) values (
         $1, $2, 'Failure Admin', $3, 'Founder', 'Leadership', 'UTC', 'active', 'active'
       ), (
         $1, null, 'Failure Target', $4, 'Engineer', 'Product', 'UTC', 'active', 'ready'
       )
       returning id, email, updated_at::text as updated_at_text`,
      [tenantId, adminAuthId, adminEmail, `failure-target-${randomUUID().slice(0, 8)}@reliability.test`],
    );
    await client.query("alter table employees enable row level security");

    const target = seeded.rows.find((row) => row.email !== adminEmail);
    employeeId = target?.id ?? null;
    expectedUpdatedAt = target?.updated_at_text ?? null;

    assert(employeeId && expectedUpdatedAt, "failed to seed failure target");

    let injectedFailure = false;

    await client.query("savepoint injected_failure");
    try {
      await asActor(client, claims);

      const updated = await client.query(
        `update employees
         set role_title = 'Should Roll Back'
         where id = $1 and tenant_id = $2 and updated_at::text = $3 and deleted_at is null`,
        [employeeId, tenantId, expectedUpdatedAt],
      );
      assert(updated.rowCount === 1, "pre-failure update did not apply");

      await client.query(
        `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
         values ($1, $2, $3, $4)`,
        [tenantId, adminAuthId, actionType, employeeId],
      );

      // Intentionally fail inside transaction after data + audit writes.
      await client.query("select 1 / 0");
      await client.query("release savepoint injected_failure");
    } catch {
      injectedFailure = true;
      await client.query("rollback to savepoint injected_failure");
      await client.query("release savepoint injected_failure");
    }

    assert(injectedFailure, "failure injection did not trigger");

    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");

    const employeeRow = await client.query(
      `select role_title from employees where id = $1 and tenant_id = $2`,
      [employeeId, tenantId],
    );
    assert(employeeRow.rows[0]?.role_title === "Engineer", "employee update was not rolled back");

    const auditRow = await client.query(
      `select count(*)::int as n
       from audit_logs
       where tenant_id = $1 and action_type = $2 and target_id = $3`,
      [tenantId, actionType, employeeId],
    );
    assert(auditRow.rows[0].n === 0, "audit row persisted despite rollback");

    console.log("✓ reliability failure injection passed.");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability failure injection failed: ${err.message}`);
  process.exit(1);
});
