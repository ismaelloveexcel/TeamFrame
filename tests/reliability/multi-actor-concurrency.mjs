/**
 * Reliability: multi-actor concurrency + tenant abuse simulation.
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

async function expectDenied(client, claims, sql, params, message) {
  await client.query("savepoint denied_case");
  try {
    await asActor(client, claims);
    await client.query(sql, params);
    await client.query("rollback to savepoint denied_case");
    await client.query("release savepoint denied_case");
    throw new Error(message);
  } catch {
    await client.query("rollback to savepoint denied_case");
    await client.query("release savepoint denied_case");
  } finally {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");
  }
}

async function main() {
  const adminEmail = `admin-${randomUUID().slice(0, 8)}@reliability.test`;
  const employeeEmail = `employee-${randomUUID().slice(0, 8)}@reliability.test`;

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const adminAuthId = randomUUID();
  const employeeAuthId = randomUUID();

  const adminClaims = { email: adminEmail, app_metadata: { role: "admin" } };
  const employeeClaims = { email: employeeEmail, app_metadata: { role: "employee" } };

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("set row_security = on");
  await client.query("begin");

  let targetEmployeeId = null;

  try {
    await client.query(
      `insert into companies (id, name, slug)
       values
         ($1, 'Reliability Tenant A', $3),
         ($2, 'Reliability Tenant B', $4)`,
      [tenantA, tenantB, `reliability-a-${tenantA.slice(0, 8)}`, `reliability-b-${tenantB.slice(0, 8)}`],
    );

    await client.query("alter table employees disable row level security");
    const seed = await client.query(
      `insert into employees (
         tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
       ) values
         ($1, $2, 'Reliability Admin', $3, 'Founder', 'Leadership', 'UTC', 'active', 'active'),
         ($1, $4, 'Reliability Employee', $5, 'Engineer', 'Product', 'UTC', 'active', 'active'),
         ($6, null, 'Cross Tenant Employee', $7, 'Engineer', 'Product', 'UTC', 'active', 'active')
       returning id, email`,
      [tenantA, adminAuthId, adminEmail, employeeAuthId, employeeEmail, tenantB, `cross-${randomUUID().slice(0, 8)}@reliability.test`],
    );
    await client.query("alter table employees enable row level security");

    targetEmployeeId = seed.rows.find((r) => r.email === employeeEmail)?.id ?? null;
    assert(targetEmployeeId, "failed to seed target employee");

    await expectDenied(
      client,
      adminClaims,
      `insert into employees (tenant_id, full_name, email, role_title, department, timezone, status, setup_status)
       values ($1, 'Spoof Attempt', $2, 'Ops', 'Operations', 'UTC', 'active', 'ready')`,
      [tenantB, `spoof-${randomUUID().slice(0, 8)}@reliability.test`],
      "admin cross-tenant insert should be denied",
    );

    await expectDenied(
      client,
      employeeClaims,
      `update employees set role_title = 'Manager'
       where tenant_id = $1 and id <> $2 and deleted_at is null`,
      [tenantA, targetEmployeeId],
      "employee should not update another employee",
    );

    await asActor(client, adminClaims);

    const snapshot = await client.query(
      `select id, updated_at::text as updated_at_text
       from employees
       where id = $1 and tenant_id = $2 and deleted_at is null`,
      [targetEmployeeId, tenantA],
    );

    const expected = snapshot.rows[0]?.updated_at_text;
    assert(expected, "missing concurrency snapshot");

    const first = await client.query(
      `update employees
       set role_title = 'Reliability Update A'
       where id = $1 and tenant_id = $2 and updated_at::text = $3 and deleted_at is null`,
      [targetEmployeeId, tenantA, expected],
    );
    assert(first.rowCount === 1, "fresh optimistic update should succeed");

    // Simulates second actor/session replaying stale snapshot state.
    const stale = await client.query(
      `update employees
       set role_title = 'Reliability Update B'
       where id = $1 and tenant_id = $2 and updated_at::text = $3 and deleted_at is null`,
      [targetEmployeeId, tenantA, expected],
    );
    assert(stale.rowCount === 0, "stale optimistic update should be rejected");

    await asActor(client, employeeClaims);
    const crossTenantVisible = await client.query(
      `select count(*)::int as n from employees where tenant_id = $1 and deleted_at is null`,
      [tenantB],
    );
    assert(crossTenantVisible.rows[0].n === 0, "employee can see cross-tenant rows");

    console.log("✓ reliability multi-actor concurrency passed.");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability multi-actor concurrency failed: ${err.message}`);
  process.exit(1);
});
