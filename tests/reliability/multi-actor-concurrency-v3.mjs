import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env.local") });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("✗ Missing SUPABASE_DB_URL.");
  process.exit(1);
}

const { Client } = pg;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function asActor(client, claims) {
  await client.query("reset role");
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
}

async function expectDenied(client, claims, sql, params, message) {
  await client.query("begin");
  try {
    await asActor(client, claims);
    await client.query(sql, params);
    await client.query("rollback");
    throw new Error(message);
  } catch {
    await client.query("rollback");
  } finally {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");
  }
}

async function main() {
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  const adminEmail = `admin-${randomUUID().slice(0, 8)}@reliability.test`;
  const employeeEmail = `employee-${randomUUID().slice(0, 8)}@reliability.test`;

  const adminClaims = { email: adminEmail, app_metadata: { role: "admin" } };
  const employeeClaims = { email: employeeEmail, app_metadata: { role: "employee" } };

  const setupClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const actorA = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const actorB = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  await setupClient.connect();
  await actorA.connect();
  await actorB.connect();

  let targetEmployeeId = null;

  try {
    await setupClient.query(
      `insert into companies (id, name, slug)
       values ($1, 'Reliability Tenant A', $3), ($2, 'Reliability Tenant B', $4)`,
      [tenantA, tenantB, `reliability-a-${tenantA.slice(0, 8)}`, `reliability-b-${tenantB.slice(0, 8)}`],
    );

    const seeded = await setupClient.query(
      `insert into employees (
         tenant_id, auth_user_id, full_name, email, role_title, department, timezone, status, setup_status
       ) values
         ($1, $2, 'Reliability Admin', $3, 'Founder', 'Leadership', 'UTC', 'active', 'active'),
         ($1, $4, 'Reliability Employee', $5, 'Engineer', 'Product', 'UTC', 'active', 'ready'),
         ($6, null, 'Cross Tenant Employee', $7, 'Engineer', 'Product', 'UTC', 'active', 'ready')
       returning id, email`,
      [tenantA, randomUUID(), adminEmail, randomUUID(), employeeEmail, tenantB, `cross-${randomUUID().slice(0, 8)}@reliability.test`],
    );

    targetEmployeeId = seeded.rows.find((row) => row.email === employeeEmail)?.id ?? null;
    assert(targetEmployeeId, "target employee not seeded");

    await expectDenied(
      actorA,
      adminClaims,
      `insert into employees (tenant_id, full_name, email, role_title, department, timezone, status, setup_status)
       values ($1, 'Spoof Attempt', $2, 'Ops', 'Operations', 'UTC', 'active', 'ready')`,
      [tenantB, `spoof-${randomUUID().slice(0, 8)}@reliability.test`],
      "admin cross-tenant insert should be denied",
    );

    await expectDenied(
      actorA,
      employeeClaims,
      `update employees set role_title = 'Manager'
       where tenant_id = $1 and id <> $2 and deleted_at is null`,
      [tenantA, targetEmployeeId],
      "employee should not update another employee",
    );

    await asActor(actorA, adminClaims);
    await asActor(actorB, adminClaims);

    const snapA = await actorA.query(
      `select updated_at::text as updated_at_text from employees where id = $1 and tenant_id = $2 and deleted_at is null`,
      [targetEmployeeId, tenantA],
    );
    const snapB = await actorB.query(
      `select updated_at::text as updated_at_text from employees where id = $1 and tenant_id = $2 and deleted_at is null`,
      [targetEmployeeId, tenantA],
    );

    const expectedA = snapA.rows[0]?.updated_at_text;
    const expectedB = snapB.rows[0]?.updated_at_text;
    assert(expectedA && expectedB, "missing concurrency snapshots");

    const [first, second] = await Promise.all([
      actorA.query(
        `update employees set role_title = 'Reliability Update A'
         where id = $1 and tenant_id = $2 and updated_at::text = $3 and deleted_at is null`,
        [targetEmployeeId, tenantA, expectedA],
      ),
      actorB.query(
        `update employees set role_title = 'Reliability Update B'
         where id = $1 and tenant_id = $2 and updated_at::text = $3 and deleted_at is null`,
        [targetEmployeeId, tenantA, expectedB],
      ),
    ]);

    const successCount = [first.rowCount, second.rowCount].filter((n) => n === 1).length;
    const staleCount = [first.rowCount, second.rowCount].filter((n) => n === 0).length;
    assert(successCount === 1, "exactly one concurrent write should win");
    assert(staleCount === 1, "exactly one concurrent write should be stale");

    await asActor(actorA, employeeClaims);
    const crossTenantVisible = await actorA.query(
      `select count(*)::int as n from employees where tenant_id = $1 and deleted_at is null`,
      [tenantB],
    );
    assert(crossTenantVisible.rows[0].n === 0, "employee can view cross-tenant rows");

    console.log("✓ reliability multi-actor concurrency passed.");
  } finally {
    try {
      await setupClient.query("delete from employees where tenant_id in ($1, $2)", [tenantA, tenantB]);
      await setupClient.query("delete from companies where id in ($1, $2)", [tenantA, tenantB]);
    } catch {
      // Best-effort cleanup; fixture uniqueness prevents collisions.
    }

    await actorA.end();
    await actorB.end();
    await setupClient.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability multi-actor concurrency failed: ${err.message}`);
  process.exit(1);
});
