import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";
import { getDeterministicContext } from "../../scripts/ci/context.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env.local") });

const dbUrl = process.env.SUPABASE_DB_URL;
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
const ctx = getDeterministicContext("reliability-session-boundaries-v2");

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
  }
}

async function main() {
  const tenantA = ctx.deterministicUuid("tenant-a");
  const tenantB = ctx.deterministicUuid("tenant-b");

  const adminAuthId = ctx.deterministicUuid("admin-auth");
  const employeeAuthId = ctx.deterministicUuid("employee-auth");

  const adminEmail = ctx.deterministicEmail("session-admin", "reliability.test");
  const employeeEmail = ctx.deterministicEmail("session-employee", "reliability.test");

  const adminClaims = { email: adminEmail, app_metadata: { role: "admin", tenant_id: tenantA } };
  const employeeClaims = { email: employeeEmail, app_metadata: { role: "employee", tenant_id: tenantA } };

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const { error: companyErr } = await supabase.from("companies").insert([
      { id: tenantA, name: "Session Tenant A", slug: `session-a-${tenantA.slice(0, 8)}` },
      { id: tenantB, name: "Session Tenant B", slug: `session-b-${tenantB.slice(0, 8)}` },
    ]);
    if (companyErr) throw new Error(`company seed failed: ${companyErr.message}`);

    const { data: seeded, error: employeeErr } = await supabase
      .from("employees")
      .insert([
        {
          tenant_id: tenantA,
          auth_user_id: adminAuthId,
          full_name: "Session Admin",
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
          full_name: "Session Employee",
          email: employeeEmail,
          role_title: "Engineer",
          department: "Product",
          timezone: "UTC",
          status: "active",
          setup_status: "ready",
        },
        {
          tenant_id: tenantB,
          full_name: "Other Tenant Employee",
          email: ctx.deterministicEmail("session-other", "reliability.test"),
          role_title: "Engineer",
          department: "Product",
          timezone: "UTC",
          status: "active",
          setup_status: "ready",
        },
      ])
      .select("id, email");
    if (employeeErr) throw new Error(`employee seed failed: ${employeeErr.message}`);

    const employeeRowId = seeded.find((row) => row.email === employeeEmail)?.id;
    assert(employeeRowId, "employee row not seeded");

    await client.query("begin");

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
          [tenantB, ctx.deterministicEmail("replay", "reliability.test")],
        );
      },
      "replayed admin session should not write cross-tenant rows",
    );

    await asActor(client, adminClaims);
    const crossTenantVisible = await client.query(
      `select count(*)::int as n from employees where tenant_id = $1 and deleted_at is null`,
      [tenantB],
    );
    assert(crossTenantVisible.rows[0].n === 0, "admin session can view cross-tenant rows");

    await client.query("rollback");
    console.log("✓ reliability session boundaries passed.");
  } finally {
    await supabase.from("audit_logs").delete().in("tenant_id", [tenantA, tenantB]);
    await supabase.from("employees").delete().in("tenant_id", [tenantA, tenantB]);
    await supabase.from("companies").delete().in("id", [tenantA, tenantB]);
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability session boundaries failed: ${err.message}`);
  process.exit(1);
});
