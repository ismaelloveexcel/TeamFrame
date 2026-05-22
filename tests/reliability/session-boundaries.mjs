/**
 * Reliability: multi-session JWT boundary checks.
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

async function expectDenied(client, claims, fn, message) {
  await client.query("savepoint denied_case");
  try {
    await asActor(client, claims);
    await fn();
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
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  const adminAuthId = randomUUID();
  const employeeAuthId = randomUUID();

  const adminEmail = `session-admin-${randomUUID().slice(0, 8)}@reliability.test`;
  const employeeEmail = `session-employee-${randomUUID().slice(0, 8)}@reliability.test`;

  const adminClaims = { email: adminEmail, app_metadata: { role: "admin" } };
  const employeeClaims = { email: employeeEmail, app_metadata: { role: "employee" } };

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("set row_security = on");
  await client.query("begin");

  try {
    await client.query(
      `insert into companies (id, name, slug)
       values ($1, 'Session Tenant A', $3), ($2, 'Session Tenant B', $4)`,
      [tenantA, tenantB, `session-a-${tenantA.slice(0, 8)}`, `session-b-${tenantB.slice(0, 8)}`],
    );

    await client.query("alter table employees disable row level security");
    const seeded = await client.query(
      `insert into employees (
         tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
       ) values
         ($1, $2, 'Session Admin', $3, 'Founder', 'Leadership', 'UTC', 'active', 'active'),
         ($1, $4, 'Session Employee', $5, 'Engineer', 'Product', 'UTC', 'active', 'ready'),
         ($6, null, 'Other Tenant Employee', $7, 'Engineer', 'Product', 'UTC', 'active', 'ready')
       returning id, email`,
      [
        tenantA,
        adminAuthId,
        adminEmail,
        employeeAuthId,
        employeeEmail,
        tenantB,
        `session-other-${randomUUID().slice(0, 8)}@reliability.test`,
      ],
    );
    await client.query("alter table employees enable row level security");

    const employeeRowId = seeded.rows.find((r) => r.email === employeeEmail)?.id;
    assert(employeeRowId, "failed to seed employee row");

    await expectDenied(
      client,
      employeeClaims,
      async () => {
        await client.query(
          `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
           values ($1, $2, 'session.boundary.denied', $3)`,
          [tenantA, employeeAuthId, employeeRowId],
        );
      },
      "employee session should not write audit rows",
    );

    await asActor(client, adminClaims);
    await client.query(
      `insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
       values ($1, $2, 'session.boundary.allowed', $3)`,
      [tenantA, adminAuthId, employeeRowId],
    );

    await expectDenied(
      client,
      adminClaims,
      async () => {
        await client.query(
          `insert into employees (tenant_id, full_name, email, role_title, department, timezone, status, setup_status)
           values ($1, 'Replay Spoof', $2, 'Ops', 'Operations', 'UTC', 'active', 'ready')`,
          [tenantB, `replay-${randomUUID().slice(0, 8)}@reliability.test`],
        );
      },
      "replayed admin session should not write cross-tenant rows",
    );

    await asActor(client, adminClaims);
    const visibleCrossTenant = await client.query(
      `select count(*)::int as n from employees where tenant_id = $1 and deleted_at is null`,
      [tenantB],
    );

    assert(visibleCrossTenant.rows[0].n === 0, "admin session can view cross-tenant rows");

    console.log("✓ reliability session boundaries passed.");
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability session boundaries failed: ${err.message}`);
  process.exit(1);
});
