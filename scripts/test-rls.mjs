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
import { getDbSnapshot, getDeterministicContext, snapshotDiff, writeReplayArtifact } from "./ci/context.mjs";

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
const ctx = getDeterministicContext("db-test-rls");
let baselineSnapshot = null;

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
  baselineSnapshot = await getDbSnapshot(connectionString);
  await client.connect();
  await client.query("begin");

  try {
    const t1 = ctx.deterministicUuid("tenant-a");
    const t2 = ctx.deterministicUuid("tenant-b");
    const admin1UserId = ctx.deterministicUuid("tenant-a-admin-user");
    const admin2UserId = ctx.deterministicUuid("tenant-b-admin-user");
    const emp1UserId = ctx.deterministicUuid("tenant-a-employee-user");

    const tenantASlug = ctx.deterministicSlug("tenant-a-test");
    const tenantBSlug = ctx.deterministicSlug("tenant-b-test");
    const adminAEmail = ctx.deterministicEmail("admin-a");
    const adminBEmail = ctx.deterministicEmail("admin-b");
    const employeeAEmail = ctx.deterministicEmail("employee-a");
    const blockedEmail = ctx.deterministicEmail("blocked");
    const insertOkEmail = ctx.deterministicEmail("insert-ok");

    await client.query(
      `insert into companies (id, name, slug)
       values
         ($1, 'Tenant A', $3),
         ($2, 'Tenant B', $4)`,
      [t1, t2, tenantASlug, tenantBSlug],
    );

    const admin1EmpId = ctx.deterministicUuid("tenant-a-admin-employee");
    const admin2EmpId = ctx.deterministicUuid("tenant-b-admin-employee");
    const employee1Id = ctx.deterministicUuid("tenant-a-employee");

    await client.query(
      `insert into employees (
        id, tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
      ) values
        ($1, $2, $3, 'Tenant A Admin', $10, 'Founder', 'Leadership', 'UTC', 'active', 'active'),
        ($4, $5, $6, 'Tenant B Admin', $11, 'Founder', 'Leadership', 'UTC', 'active', 'active'),
        ($7, $8, $9, 'Tenant A Employee', $12, 'Engineer', 'Product', 'UTC', 'active', 'active')`,
      [admin1EmpId, t1, admin1UserId, admin2EmpId, t2, admin2UserId, employee1Id, t1, emp1UserId, adminAEmail, adminBEmail, employeeAEmail],
    );

    await runAs(
      {
        email: adminAEmail,
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
        email: employeeAEmail,
        app_metadata: { role: "employee" },
      },
      async () => {
        const visible = await client.query("select count(*)::int as n from employees where deleted_at is null");
        assert(visible.rows[0].n === 2, "employee should only see same-tenant employees");
      },
    );

    await runAs(
      {
        email: employeeAEmail,
        app_metadata: { role: "employee" },
      },
      async () => {
        await client.query("savepoint employee_insert_attempt");
        let blocked = false;
        try {
          await client.query(
            `insert into employees (
              tenant_id, full_name, email, role_title, department, timezone, status, setup_status
            ) values ($1, 'Nope', $2, 'Engineer', 'Product', 'UTC', 'active', 'ready')`,
            [t1, blockedEmail],
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
        email: adminAEmail,
        app_metadata: { role: "admin" },
      },
      async () => {
        await client.query(
          `insert into employees (
            tenant_id, full_name, email, role_title, department, timezone, status, setup_status
          ) values ($1, 'Admin Insert OK', $2, 'Operator', 'Ops', 'UTC', 'active', 'ready')`,
          [t1, insertOkEmail],
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
  getDbSnapshot(connectionString)
    .then((afterSnapshot) => {
      const replayPath = writeReplayArtifact({
        testId: "db-test-rls",
        gate: "db:test:rls",
        command: process.platform === "win32" ? "cmd.exe" : "npm",
        args: process.platform === "win32" ? ["/d", "/s", "/c", "npm run db:test:rls"] : ["run", "db:test:rls"],
        actorContext: { actor: "rls-suite", tenant: process.env.TEST_TENANT_SEED || "seeded" },
        dbSnapshotDiff: snapshotDiff(baselineSnapshot, afterSnapshot),
        error: err.message,
      });
      console.error(`Replay artifact: ${replayPath}`);
      process.exit(1);
    })
    .catch(() => process.exit(1));
});
