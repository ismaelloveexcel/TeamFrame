/**
 * TeamFrame — employee domain integration smoke.
 *
 * Verifies employee CRUD concurrency guards, tenant isolation, RBAC boundaries,
 * and audit-log RLS behavior using authenticated JWT claims.
 *
 * Runs inside a transaction and rolls back all fixtures.
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

async function expectDenied(message, fn) {
  let denied = false;
  await client.query("savepoint denied_case");
  try {
    await fn();
  } catch {
    denied = true;
    await client.query("rollback to savepoint denied_case");
  }
  await client.query("release savepoint denied_case");
  assert(denied, message);
}

async function main() {
  await client.connect();
  await client.query("begin");
  let step = "init";

  try {
    step = "create-fixtures";
    const tenantA = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const tenantB = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const suffix = tenantA.slice(0, 8);
    const adminEmail = `admin-employee-test-a-${suffix}@local.test`;
    const employeeEmail = `employee-test-a-${suffix}@local.test`;

    await client.query(
      `insert into companies (id, name, slug)
       values
         ($1, 'Employee Test Tenant A', $3),
         ($2, 'Employee Test Tenant B', $4)`,
      [tenantA, tenantB, `employee-test-a-${suffix}`, `employee-test-b-${suffix}`],
    );

    const adminAuthId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const employeeAuthId = (await client.query("select gen_random_uuid() as id")).rows[0].id;

    const adminEmployeeId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const employeeId = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    const otherTenantEmployeeId = (await client.query("select gen_random_uuid() as id")).rows[0].id;

    await client.query(
      `insert into employees (
         id, tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
       ) values
         ($1, $2, $3, 'Tenant A Admin', $9, 'Founder', 'Leadership', 'UTC', 'active', 'active'),
         ($4, $5, $6, 'Tenant A Employee', $10, 'Engineer', 'Product', 'UTC', 'active', 'active'),
         ($7, $8, null, 'Tenant B Employee', 'employee-test-b@local.test', 'Engineer', 'Product', 'UTC', 'active', 'active')`,
      [
        adminEmployeeId,
        tenantA,
        adminAuthId,
        employeeId,
        tenantA,
        employeeAuthId,
        otherTenantEmployeeId,
        tenantB,
        adminEmail,
        employeeEmail,
      ],
    );

    step = "employee-rbac-checks";
    await runAs(
      {
        email: employeeEmail,
        app_metadata: { role: "employee" },
      },
      async () => {
        const visible = await client.query("select count(*)::int as n from employees where deleted_at is null");
        assert(visible.rows[0].n === 2, "employee should only see same-tenant employees");

        await expectDenied("employee should be denied employee insert", async () => {
          await client.query(
            `insert into employees (
               tenant_id, full_name, email, role_title, department, timezone, status, setup_status
             ) values ($1, 'Denied Employee Insert', 'denied-employee-insert@local.test', 'Ops', 'Operations', 'UTC', 'active', 'ready')`,
            [tenantA],
          );
        });

        await expectDenied("employee should be denied audit log insert", async () => {
          await client.query(
            `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
             values ($1, $2, 'employee.updated', $3)`,
            [tenantA, employeeAuthId, employeeId],
          );
        });
      },
    );

    let createdEmployee;
    let latestUpdatedAt;
    step = "admin-crud-flow";
    await runAs(
      {
        email: adminEmail,
        app_metadata: { role: "admin" },
      },
      async () => {
        const roleCheck = await client.query(
          "select is_current_actor_admin() as is_admin, current_actor_tenant_id()::text as tenant_id",
        );
        assert(roleCheck.rows[0].is_admin === true, "admin claim did not resolve as admin");
        assert(roleCheck.rows[0].tenant_id === tenantA, "admin tenant resolution mismatch");

        console.log("• admin insert");
        const insert = await client.query(
          `insert into employees (
             tenant_id, full_name, email, role_title, department, timezone, status, setup_status
           ) values (
             $1, 'Created By Admin', 'created-by-admin@local.test', 'Designer', 'Product', 'UTC', 'active', 'ready'
           )
           returning id, updated_at::text as updated_at_text`,
          [tenantA],
        );

        createdEmployee = insert.rows[0];

        console.log("• admin audit created");
        await client.query(
          `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
           values ($1, $2, 'employee.created', $3)`,
          [tenantA, adminAuthId, createdEmployee.id],
        );

        console.log("• admin update");
        const update = await client.query(
          `update employees
             set role_title = 'Senior Designer', department = 'Design', status = 'on_leave'
           where id = $1
             and tenant_id = $2
             and updated_at::text = $3
             and deleted_at is null
           returning updated_at::text as updated_at_text`,
          [createdEmployee.id, tenantA, createdEmployee.updated_at_text],
        );
        assert(update.rowCount === 1, "admin update with fresh updated_at should succeed");

        console.log("• admin audit updated");
        await client.query(
          `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
           values ($1, $2, 'employee.updated', $3)`,
          [tenantA, adminAuthId, createdEmployee.id],
        );

        console.log("• admin stale update");
        const staleUpdate = await client.query(
          `update employees
             set role_title = 'Principal Designer'
           where id = $1
             and tenant_id = $2
             and updated_at::text = $3
             and deleted_at is null`,
          [createdEmployee.id, tenantA, createdEmployee.updated_at_text],
        );
        assert(staleUpdate.rowCount === 0, "stale update should be rejected");

        const freshUpdatedAt = update.rows[0].updated_at_text;

        latestUpdatedAt = freshUpdatedAt;
      },
    );

    step = "archive-concurrency-check";
    console.log("• archive concurrency check");
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");
    const archive = await client.query(
      `update employees
         set deleted_at = now()
       where id = $1
         and tenant_id = $2
         and updated_at::text = $3
         and deleted_at is null`,
      [createdEmployee.id, tenantA, latestUpdatedAt],
    );
    assert(archive.rowCount === 1, "archive with fresh updated_at should succeed");

    const staleArchive = await client.query(
      `update employees
         set deleted_at = now()
       where id = $1
         and tenant_id = $2
         and updated_at::text = $3
         and deleted_at is null`,
      [createdEmployee.id, tenantA, latestUpdatedAt],
    );
    assert(staleArchive.rowCount === 0, "stale archive should be rejected");

    await client.query(
      `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
       values ($1, $2, 'employee.archived', $3)`,
      [tenantA, adminAuthId, createdEmployee.id],
    );

    step = "admin-audit-verify";
    await runAs(
      {
        email: adminEmail,
        app_metadata: { role: "admin" },
      },
      async () => {
        const auditCount = await client.query(
          `select count(*)::int as n
           from audit_logs
           where tenant_id = $1
             and target_id = $2
             and action_type in ('employee.created', 'employee.updated', 'employee.archived')`,
          [tenantA, createdEmployee.id],
        );

        assert(auditCount.rows[0].n === 3, "expected created/updated/archived audit rows");
      },
    );

    console.log("✓ employee integration smoke tests passed.");
  } catch (err) {
    throw new Error(`${step}: ${err.message}`);
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ employee integration smoke tests failed: ${err.message}`);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
