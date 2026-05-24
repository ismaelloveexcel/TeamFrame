import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";
import { getDeterministicContext } from "../../scripts/ci/context.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env.local") });

const dbUrl = process.env.SUPABASE_DB_URL?.replace(/^"|"$/g, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl || !supabaseUrl || !serviceRoleKey) {
  console.error("✗ Missing required env vars for reliability suite.");
  process.exit(1);
}

const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { Client } = pg;
const ctx = getDeterministicContext("reliability-multi-actor-v2");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function asActor(client, claims) {
  await client.query("reset role");
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
}

async function expectDenied(client, claims, sql, params, message) {
  let denied = false;
  await client.query("begin");
  try {
    await asActor(client, claims);
    await client.query(sql, params);
  } catch {
    denied = true;
  } finally {
    await client.query("rollback");
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");
  }

  if (!denied) {
    throw new Error(message);
  }
}

async function main() {
  const tenantA = ctx.deterministicUuid("tenant-a");
  const tenantB = ctx.deterministicUuid("tenant-b");

  const adminEmail = ctx.deterministicEmail("admin", "reliability.test");
  const employeeEmail = ctx.deterministicEmail("employee", "reliability.test");
  const adminAuthId = ctx.deterministicUuid("admin-auth");
  const employeeAuthId = ctx.deterministicUuid("employee-auth");

  const adminClaims = { email: adminEmail, app_metadata: { role: "admin", tenant_id: tenantA } };
  const employeeClaims = { email: employeeEmail, app_metadata: { role: "employee", tenant_id: tenantA } };

  const actorA = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const actorB = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  let targetEmployeeId = null;

  await actorA.connect();
  await actorB.connect();

  try {
    const { error: companyErr } = await supabase.from("companies").insert([
      { id: tenantA, name: "Reliability Tenant A", slug: `reliability-a-${tenantA.slice(0, 8)}` },
      { id: tenantB, name: "Reliability Tenant B", slug: `reliability-b-${tenantB.slice(0, 8)}` },
    ]);
    if (companyErr) throw new Error(`company seed failed: ${companyErr.message}`);

    const { data: seededEmployees, error: employeeErr } = await supabase
      .from("employees")
      .insert([
        {
          tenant_id: tenantA,
          auth_user_id: adminAuthId,
          full_name: "Reliability Admin",
          email: adminEmail,
          role_title: "Founder",
          department: "Leadership",
          timezone: "UTC",
          status: "active",
          setup_status: "active",
        },
        {
          tenant_id: tenantA,
          auth_user_id: employeeAuthId,
          full_name: "Reliability Employee",
          email: employeeEmail,
          role_title: "Engineer",
          department: "Product",
          timezone: "UTC",
          status: "active",
          setup_status: "ready",
        },
        {
          tenant_id: tenantB,
          full_name: "Cross Tenant Employee",
          email: ctx.deterministicEmail("cross", "reliability.test"),
          role_title: "Engineer",
          department: "Product",
          timezone: "UTC",
          status: "active",
          setup_status: "ready",
        },
      ])
      .select("id, email");
    if (employeeErr) throw new Error(`employee seed failed: ${employeeErr.message}`);

    targetEmployeeId = seededEmployees.find((row) => row.email === employeeEmail)?.id ?? null;
    assert(targetEmployeeId, "target employee not seeded");

    await expectDenied(
      actorA,
      adminClaims,
      `insert into employees (tenant_id, full_name, email, role_title, department, timezone, status, setup_status)
       values ($1, 'Spoof Attempt', $2, 'Ops', 'Operations', 'UTC', 'active', 'ready')`,
      [tenantB, ctx.deterministicEmail("spoof", "reliability.test")],
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

    const actorContextA = await actorA.query(
      "select current_actor_email() as email, current_actor_tenant_id()::text as tenant_id, is_current_actor_admin() as is_admin",
    );
    const actorContextB = await actorB.query(
      "select current_actor_email() as email, current_actor_tenant_id()::text as tenant_id, is_current_actor_admin() as is_admin",
    );
    assert(
      actorContextA.rows[0]?.tenant_id === tenantA,
      `admin actor A tenant resolution failed: ${JSON.stringify(actorContextA.rows[0])}`,
    );
    assert(
      actorContextB.rows[0]?.tenant_id === tenantA,
      `admin actor B tenant resolution failed: ${JSON.stringify(actorContextB.rows[0])}`,
    );
    assert(actorContextA.rows[0]?.is_admin === true, "admin actor A role resolution failed");
    assert(actorContextB.rows[0]?.is_admin === true, "admin actor B role resolution failed");

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
    if (tenantA && tenantB) {
      await supabase.from("employees").delete().in("tenant_id", [tenantA, tenantB]);
      await supabase.from("companies").delete().in("id", [tenantA, tenantB]);
    }

    await actorA.end();
    await actorB.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability multi-actor concurrency failed: ${err.message}`);
  process.exit(1);
});
