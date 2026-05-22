import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";

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
  const targetEmail = `failure-target-${randomUUID().slice(0, 8)}@reliability.test`;
  const actionType = `employee.updated.failure.${randomUUID().slice(0, 8)}`;

  const claims = { email: adminEmail, app_metadata: { role: "admin", tenant_id: tenantId } };

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("reset role");

  let employeeId = null;

  try {
    const { error: companyErr } = await supabase.from("companies").insert({
      id: tenantId,
      name: "Failure Injection Tenant",
      slug: `failure-injection-${tenantId.slice(0, 8)}`,
    });
    if (companyErr) throw new Error(`company seed failed: ${companyErr.message}`);

    const { data: seeded, error: employeeErr } = await supabase
      .from("employees")
      .insert([
        {
          tenant_id: tenantId,
          auth_user_id: adminAuthId,
          full_name: "Failure Admin",
          email: adminEmail,
          role_title: "Founder",
          department: "Leadership",
          timezone: "UTC",
          status: "active",
          setup_status: "active",
        },
        {
          tenant_id: tenantId,
          full_name: "Failure Target",
          email: targetEmail,
          role_title: "Engineer",
          department: "Product",
          timezone: "UTC",
          status: "active",
          setup_status: "ready",
        },
      ])
      .select("id, email");
    if (employeeErr) throw new Error(`employee seed failed: ${employeeErr.message}`);

    employeeId = seeded.find((row) => row.email === targetEmail)?.id ?? null;
    assert(employeeId, "target employee not seeded");

    await client.query("begin");

    const baseline = await client.query(
      `select updated_at::text as updated_at_text, role_title
       from employees where id = $1 and tenant_id = $2 and deleted_at is null`,
      [employeeId, tenantId],
    );
    const expectedUpdatedAt = baseline.rows[0]?.updated_at_text;
    assert(expectedUpdatedAt, "missing baseline updated_at");

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

    const post = await client.query(
      `select role_title from employees where id = $1 and tenant_id = $2`,
      [employeeId, tenantId],
    );
    assert(post.rows[0]?.role_title === "Engineer", "employee update was not rolled back");

    const auditCount = await client.query(
      `select count(*)::int as n from audit_logs where tenant_id = $1 and action_type = $2 and target_id = $3`,
      [tenantId, actionType, employeeId],
    );
    assert(auditCount.rows[0].n === 0, "audit row persisted despite rollback");

    await client.query("rollback");
    console.log("✓ reliability failure injection passed.");
  } finally {
    await supabase.from("audit_logs").delete().eq("tenant_id", tenantId);
    await supabase.from("employees").delete().eq("tenant_id", tenantId);
    await supabase.from("companies").delete().eq("id", tenantId);
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✗ reliability failure injection failed: ${err.message}`);
  process.exit(1);
});
