/**
 * TeamFrame — RLS smoke tests.
 *
 * Validates tenant isolation policies using authenticated JWT claims.
 * Runs inside a transaction and rolls back all inserted fixtures.
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
  if (!condition) {
    throw new Error(message);
  }
}

async function runAs(claims, fn) {
  await client.query("reset role");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  return fn();
}

async function main() {
  await client.connect();
  await client.query("begin");

  try {
    const t1 = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const t2 = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const admin1UserId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const admin2UserId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const emp1UserId = (await client.query("select gen_random_uuid() as id")).rows[0].id;

    await client.query(
      `insert into companies (id, name, slug)
       values
         ($1, 'Tenant A', 'tenant-a-test'),
         ($2, 'Tenant B', 'tenant-b-test')`,
      [t1, t2],
    );

    const admin1EmpId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const admin2EmpId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const employee1Id = (await client.query("select gen_random_uuid() as id")).rows[0].id;

    await client.query(
      `insert into employees (
        id, tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
      ) values
        ($1, $2, $3, 'Tenant A Admin', 'admin-a@test.local', 'Founder', 'Leadership', 'UTC', 'active', 'active'),
        ($4, $5, $6, 'Tenant B Admin', 'admin-b@test.local', 'Founder', 'Leadership', 'UTC', 'active', 'active'),
        ($7, $8, $9, 'Tenant A Employee', 'employee-a@test.local', 'Engineer', 'Product', 'UTC', 'active', 'active')`,
      [admin1EmpId, t1, admin1UserId, admin2EmpId, t2, admin2UserId, employee1Id, t1, emp1UserId],
    );

    await runAs(
      {
        email: "admin-a@test.local",
        app_metadata: { role: "admin" },
      },
      async () => {
        const visible = await client.query("select count(*)::int as n from employees where deleted_at is null");
        assert(visible.rows[0].n === 2, "admin should only see same-tenant employees");

        const crossTenant = await client.query("select count(*)::int as n from employees where tenant_id = $1", [t2]);
        assert(crossTenant.rows[0].n === 0, "admin must not see cross-tenant rows");
      },
    );

    await runAs(
      {
        email: "employee-a@test.local",
        app_metadata: { role: "employee" },
      },
      async () => {
        const visible = await client.query("select count(*)::int as n from employees where deleted_at is null");
        assert(visible.rows[0].n === 2, "employee should only see same-tenant employees");
      },
    );

    await runAs(
      {
        email: "employee-a@test.local",
        app_metadata: { role: "employee" },
      },
      async () => {
        await client.query("savepoint employee_insert_attempt");
        let blocked = false;
        try {
          await client.query(
            `insert into employees (
              tenant_id, full_name, email, role_title, department, timezone, status, setup_status
            ) values ($1, 'Nope', 'blocked@test.local', 'Engineer', 'Product', 'UTC', 'active', 'ready')`,
            [t1],
          );
        } catch {
          await client.query("rollback to savepoint employee_insert_attempt");
          blocked = true;
        }
        await client.query("release savepoint employee_insert_attempt");
        assert(blocked, "employee insert should be blocked by RLS");
      },
    );

    await runAs(
      {
        email: "admin-a@test.local",
        app_metadata: { role: "admin" },
      },
      async () => {
        await client.query(
          `insert into employees (
            tenant_id, full_name, email, role_title, department, timezone, status, setup_status
          ) values ($1, 'Admin Insert OK', 'insert-ok@test.local', 'Operator', 'Ops', 'UTC', 'active', 'ready')`,
          [t1],
        );
      },
    );

    console.log("✓ RLS smoke tests passed.");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ RLS smoke tests failed: ${err.message}`);
  process.exit(1);
});
