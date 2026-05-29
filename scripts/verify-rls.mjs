/**
 * TeamFrame — RLS verification harness.
 *
 * Runs against STAGING ONLY (HR5 guard enforced at startup).
 *
 * Setup (uses service-role — the ONE permitted use):
 *   Seeds tenant_a + tenant_b companies, 3 employees each (1 admin + 2 non-admin),
 *   creates Supabase auth users, sets app_metadata.tenant_id + role.
 *
 * Probes (all run with anon key + authenticated user JWT — never service-role):
 *   1. App-layer isolation: tenant_a admin queries employees → only tenant_a rows
 *   2. Raw SQL isolation: tenant_a admin queries known tenant_b IDs → 0 rows
 *   3. Missing-tenant probe: user with no tenant_id claim → 0 rows (v2 guarantee)
 *   4. Admin-boundary probes (one per domain):
 *      4a. updateEmployee — non-admin → 0 rows modified (FORBIDDEN)
 *      4b. approveLeave  — non-admin → 0 rows modified (FORBIDDEN)
 *      4c. assignOnboardingTask — non-admin → RLS error (FORBIDDEN)
 *      4d. uploadDocument — non-admin → RLS error (FORBIDDEN)
 *
 * To add future probes: append to the PROBES array with { name, fn } — one line each.
 *
 * Usage:
 *   npm run verify:rls
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env.staging") });

// ─── HR5 Guard ────────────────────────────────────────────────────────────────
if (!process.env.SUPABASE_URL_STAGING) {
  console.error("[PARITY_FAIL] SUPABASE_URL_STAGING missing — aborting verify-rls.");
  process.exit(1);
}
if (process.env.SUPABASE_URL_STAGING === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "[PARITY_FAIL] SUPABASE_URL_STAGING must differ from NEXT_PUBLIC_SUPABASE_URL — aborting.\n" +
    "  verify-rls must run against staging only (HR5)."
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const STAGING_URL = process.env.SUPABASE_URL_STAGING;
const STAGING_ANON_KEY = process.env.SUPABASE_ANON_KEY_STAGING;
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_STAGING;

if (!STAGING_ANON_KEY || !STAGING_SERVICE_KEY) {
  console.error("✗ SUPABASE_ANON_KEY_STAGING and SUPABASE_SERVICE_ROLE_KEY_STAGING required.");
  process.exit(1);
}

// Test identifiers — deterministic so re-runs are idempotent.
const TENANT_A_SLUG = "tf-verify-tenant-a";
const TENANT_B_SLUG = "tf-verify-tenant-b";

const TEST_EMAIL_DOMAIN = "@teamframe-verify.invalid";
const TEST_PASSWORD = "VerifyOnly-Staging-2026!";

const TEST_USERS = {
  ta_admin:    { email: `ta-admin${TEST_EMAIL_DOMAIN}`,    role: "admin"    },
  ta_employee: { email: `ta-employee${TEST_EMAIL_DOMAIN}`, role: "employee" },
  tb_admin:    { email: `tb-admin${TEST_EMAIL_DOMAIN}`,    role: "admin"    },
  no_tenant:   { email: `no-tenant${TEST_EMAIL_DOMAIN}`,   role: "employee" },
};

// Service-role client — for seeding only. Never used in probes.
const adminClient = createClient(STAGING_URL, STAGING_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Seed Phase ───────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("• Cleaning up previous test fixtures…");

  // Delete test auth users (by email search).
  const testEmails = Object.values(TEST_USERS).map((u) => u.email);
  const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`[SETUP] Failed to list auth users: ${listErr.message}`);
  for (const user of users) {
    if (testEmails.includes(user.email)) {
      await adminClient.auth.admin.deleteUser(user.id);
    }
  }

  // companies → employees/leaves/onboarding_tasks/audit_logs use ON DELETE RESTRICT,
  // so dependents must be deleted before the company row. Order matters.
  const { data: existingCompanies, error: lookupErr } = await adminClient
    .from("companies")
    .select("id")
    .in("slug", [TENANT_A_SLUG, TENANT_B_SLUG]);
  if (lookupErr) throw new Error(`[SETUP] Company lookup failed: ${lookupErr.message}`);

  const tenantIds = (existingCompanies ?? []).map((c) => c.id);
  if (tenantIds.length === 0) return;

  for (const table of ["documents", "audit_logs", "onboarding_tasks", "leaves", "employees"]) {
    const { error: delErr } = await adminClient.from(table).delete().in("tenant_id", tenantIds);
    if (delErr) throw new Error(`[SETUP] Failed to clean ${table}: ${delErr.message}`);
  }
  const { error: compDelErr } = await adminClient.from("companies").delete().in("id", tenantIds);
  if (compDelErr) throw new Error(`[SETUP] Failed to delete test companies: ${compDelErr.message}`);
}

async function seed() {
  console.log("• Seeding tenant_a and tenant_b…");

  // Insert companies.
  const { data: companies, error: compErr } = await adminClient
    .from("companies")
    .insert([
      { name: "Verify Tenant A", slug: TENANT_A_SLUG },
      { name: "Verify Tenant B", slug: TENANT_B_SLUG },
    ])
    .select("id, slug");
  if (compErr) throw new Error(`[SETUP] Company insert failed: ${compErr.message}`);

  const tenantA = companies.find((c) => c.slug === TENANT_A_SLUG);
  const tenantB = companies.find((c) => c.slug === TENANT_B_SLUG);

  // Insert employees for tenant_a.
  const { data: empA, error: empAErr } = await adminClient
    .from("employees")
    .insert([
      { tenant_id: tenantA.id, full_name: "TA Admin",   email: TEST_USERS.ta_admin.email,    role_title: "Admin",    department: "Ops", timezone: "UTC", setup_status: "active" },
      { tenant_id: tenantA.id, full_name: "TA Emp One", email: TEST_USERS.ta_employee.email, role_title: "Analyst",  department: "Ops", timezone: "UTC", setup_status: "active" },
      { tenant_id: tenantA.id, full_name: "TA Emp Two", email: `ta-emp2${TEST_EMAIL_DOMAIN}`, role_title: "Analyst", department: "Ops", timezone: "UTC", setup_status: "active" },
    ])
    .select("id, email, tenant_id");
  if (empAErr) throw new Error(`[SETUP] Tenant A employee insert failed: ${empAErr.message}`);

  // Insert employees for tenant_b.
  const { data: empB, error: empBErr } = await adminClient
    .from("employees")
    .insert([
      { tenant_id: tenantB.id, full_name: "TB Admin",   email: TEST_USERS.tb_admin.email,   role_title: "Admin",   department: "Ops", timezone: "UTC", setup_status: "active" },
      { tenant_id: tenantB.id, full_name: "TB Emp One", email: `tb-emp1${TEST_EMAIL_DOMAIN}`, role_title: "Analyst", department: "Ops", timezone: "UTC", setup_status: "active" },
      { tenant_id: tenantB.id, full_name: "TB Emp Two", email: `tb-emp2${TEST_EMAIL_DOMAIN}`, role_title: "Analyst", department: "Ops", timezone: "UTC", setup_status: "active" },
    ])
    .select("id, email, tenant_id");
  if (empBErr) throw new Error(`[SETUP] Tenant B employee insert failed: ${empBErr.message}`);

  // Insert a leave record for tenant_b (used in admin-boundary probe 4b).
  const { data: leaveB, error: leaveBErr } = await adminClient
    .from("leaves")
    .insert({
      tenant_id: tenantB.id,
      employee_id: empB[0].id,
      start_date: "2026-07-01",
      end_date:   "2026-07-03",
      status:     "pending",
    })
    .select("id");
  if (leaveBErr) throw new Error(`[SETUP] Tenant B leave insert failed: ${leaveBErr.message}`);

  // Insert a leave record for tenant_a non-admin (used in admin-boundary probe 4b).
  const taEmployee = empA.find((e) => e.email === TEST_USERS.ta_employee.email);
  const { data: leaveA, error: leaveAErr } = await adminClient
    .from("leaves")
    .insert({
      tenant_id: tenantA.id,
      employee_id: taEmployee.id,
      start_date: "2026-07-01",
      end_date:   "2026-07-03",
      status:     "pending",
    })
    .select("id");
  if (leaveAErr) throw new Error(`[SETUP] Tenant A leave insert failed: ${leaveAErr.message}`);

  // Insert an audit_log row for tenant_b (used in raw-SQL probe).
  const { data: auditB, error: auditBErr } = await adminClient
    .from("audit_logs")
    .insert({ tenant_id: tenantB.id, actor_id: empB[0].id, action_type: "rls_verify_seed", target_id: empB[0].id })
    .select("id");
  if (auditBErr) {
    // audit_logs may have RLS blocking even service-role inserts — note it but don't fail.
    console.warn(`  [SETUP WARN] audit_log seed skipped: ${auditBErr.message}`);
  }

  // Insert an onboarding task for tenant_b (used in raw-SQL probe).
  const { data: taskB, error: taskBErr } = await adminClient
    .from("onboarding_tasks")
    .insert({
      tenant_id: tenantB.id,
      employee_id: empB[1].id,
      title: "TB Verify Task",
      assigned_by: empB[0].id,
    })
    .select("id");
  if (taskBErr) throw new Error(`[SETUP] Tenant B onboarding_task insert failed: ${taskBErr.message}`);

  // Create auth users and set app_metadata (tenant_id + role).
  const authUserIds = {};
  for (const [key, { email, role }] of Object.entries(TEST_USERS)) {
    const tenantId = (key === "no_tenant") ? undefined
      : (key.startsWith("ta_") ? tenantA.id : tenantB.id);

    const appMetadata = tenantId ? { tenant_id: tenantId, role } : { role };
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (createErr) throw new Error(`[SETUP] Auth user create failed for ${email}: ${createErr.message}`);
    authUserIds[key] = created.user.id;

    // Link auth_user_id to the employee row (if applicable).
    if (tenantId) {
      await adminClient.from("employees").update({ auth_user_id: created.user.id }).eq("email", email).is("deleted_at", null);
    }
  }

  console.log("  ✓ Fixtures seeded.");
  return {
    tenantA,
    tenantB,
    empA,
    empB,
    leaveAId: leaveA[0].id,
    leaveBId: leaveB[0].id,
    taskBId: taskB[0].id,
    auditBId: auditB?.[0]?.id ?? null,
  };
}

// ─── Probe Runner ─────────────────────────────────────────────────────────────

const results = [];

async function runProbe(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS", detail: "" });
  } catch (err) {
    console.error(`  [RLS_VERIFY_FAIL] ${name}: ${err.message}`);
    results.push({ name, status: "FAIL", detail: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Create an authenticated Supabase client by signing in with email+password.
// Returns the client — all queries from it carry the user JWT (not service-role).
async function signInClient(email) {
  const client = createClient(STAGING_URL, STAGING_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`[AUTH] Sign-in failed for ${email}: ${error.message}`);
  if (!data.session) throw new Error(`[AUTH] No session returned for ${email}`);
  return client;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  TeamFrame — RLS Verification Harness");
  console.log("═══════════════════════════════════════════════════════════\n");

  await cleanup();
  const fixtures = await seed();
  const { tenantA, tenantB, empA, empB, leaveAId, leaveBId, taskBId, auditBId } = fixtures;

  console.log("\n• Running probes…\n");

  // Capture authenticated clients (reused across probes).
  const taAdminClient    = await signInClient(TEST_USERS.ta_admin.email);
  const taEmployeeClient = await signInClient(TEST_USERS.ta_employee.email);
  const noTenantClient   = await signInClient(TEST_USERS.no_tenant.email);

  const tenantBEmpIds = empB.map((e) => e.id);

  // ── Probe 1: App-layer isolation ──────────────────────────────────────────
  await runProbe("1. App-layer isolation (tenant_a admin → employees)", async () => {
    const { data, error } = await taAdminClient.from("employees").select("id, tenant_id");
    if (error) throw new Error(`Query error: ${error.message}`);
    assert(data.length > 0, "Expected at least 1 employee row for tenant_a.");
    const wrongTenant = data.filter((r) => r.tenant_id !== tenantA.id);
    assert(
      wrongTenant.length === 0,
      `Got ${wrongTenant.length} row(s) with wrong tenant_id: ${JSON.stringify(wrongTenant.map((r) => r.tenant_id))}`
    );
    const tenantBRows = data.filter((r) => r.tenant_id === tenantB.id);
    assert(tenantBRows.length === 0, `Got ${tenantBRows.length} tenant_b row(s) from tenant_a query.`);
  });

  // ── Probe 2: Raw SQL isolation — querying known tenant_b IDs ─────────────
  // Uses authenticated PostgREST (user JWT, NOT service-role).
  await runProbe("2. Raw SQL isolation — tenant_b IDs queried as tenant_a admin", async () => {
    for (const table of ["employees", "leaves", "onboarding_tasks"]) {
      const col = table === "employees" ? "id" : "tenant_id";
      const filter = table === "employees" ? { column: "id", values: tenantBEmpIds }
        : { column: "tenant_id", values: [tenantB.id] };
      const { data, error } = await taAdminClient
        .from(table)
        .select("id")
        .in(filter.column, filter.values);
      if (error) throw new Error(`${table} query error: ${error.message}`);
      assert(data.length === 0, `[RAW_SQL_PROBE] Got ${data.length} row(s) from ${table} for tenant_b IDs.`);
    }
    // Attempt to read tenant_b audit_logs.
    const { data: auditData, error: auditErr } = await taAdminClient
      .from("audit_logs")
      .select("id")
      .eq("tenant_id", tenantB.id);
    if (auditErr) throw new Error(`audit_logs query error: ${auditErr.message}`);
    assert(auditData.length === 0, `[RAW_SQL_PROBE] Got ${auditData.length} audit_log row(s) for tenant_b.`);
  });

  // ── Probe 3: Missing-tenant probe ─────────────────────────────────────────
  // User with no app_metadata.tenant_id → v2 returns NULL → RLS blocks all rows.
  await runProbe("3. Missing-tenant probe (no JWT tenant_id → 0 rows)", async () => {
    const { data, error } = await noTenantClient.from("employees").select("id, tenant_id");
    if (error) throw new Error(`Query error: ${error.message}`);
    assert(
      data.length === 0,
      `[MISSING_TENANT] Expected 0 rows but got ${data.length}. ` +
      "v2 current_actor_tenant_id() should return NULL for sessions without app_metadata.tenant_id."
    );
  });

  // ── Probe 4a: updateEmployee — non-admin ──────────────────────────────────
  await runProbe("4a. updateEmployee — non-admin → FORBIDDEN (0 rows modified)", async () => {
    const taAdminRow = empA.find((e) => e.email !== TEST_USERS.ta_employee.email);
    const { data, error, count } = await taEmployeeClient
      .from("employees")
      .update({ full_name: "HACKED" })
      .eq("id", taAdminRow.id)
      .select("id");
    // RLS employees_update policy: requires is_current_actor_admin().
    // Non-admin cannot see the row via USING clause → 0 rows affected, no error.
    const rowsModified = data?.length ?? 0;
    assert(
      rowsModified === 0,
      `Expected 0 rows modified but got ${rowsModified}. Non-admin updated employee — FORBIDDEN not enforced.`
    );
  });

  // ── Probe 4b: approveLeave — non-admin ────────────────────────────────────
  await runProbe("4b. approveLeave — non-admin → FORBIDDEN (0 rows modified)", async () => {
    const { data, error } = await taEmployeeClient
      .from("leaves")
      .update({ status: "approved" })
      .eq("id", leaveAId)
      .select("id");
    // RLS leaves_update_admin policy: requires is_current_actor_admin().
    // Non-admin cannot satisfy USING clause → 0 rows modified.
    const rowsModified = data?.length ?? 0;
    assert(
      rowsModified === 0,
      `Expected 0 rows modified but got ${rowsModified}. Non-admin approved leave — FORBIDDEN not enforced.`
    );
  });

  // ── Probe 4c: assignOnboardingTask — non-admin ────────────────────────────
  await runProbe("4c. assignOnboardingTask — non-admin → FORBIDDEN (RLS blocks insert)", async () => {
    const taEmployee = empA.find((e) => e.email === TEST_USERS.ta_employee.email);
    const { data, error } = await taEmployeeClient
      .from("onboarding_tasks")
      .insert({
        tenant_id:   tenantA.id,
        employee_id: taEmployee.id,
        title:       "Injected Task",
        assigned_by: taEmployee.id,
      })
      .select("id");
    // RLS onboarding_tasks_insert_admin: WITH CHECK requires is_current_actor_admin().
    // Non-admin insert → RLS violation → PostgREST returns error.
    const succeeded = !error && (data?.length ?? 0) > 0;
    assert(
      !succeeded,
      "Non-admin successfully inserted onboarding_task — FORBIDDEN not enforced by RLS."
    );
  });

  // ── Probe 4d: uploadDocument — non-admin ─────────────────────────────────
  await runProbe("4d. uploadDocument — non-admin → FORBIDDEN (RLS blocks insert)", async () => {
    const taEmployee = empA.find((e) => e.email === TEST_USERS.ta_employee.email);
    const { data, error } = await taEmployeeClient
      .from("documents")
      .insert({
        tenant_id:   tenantA.id,
        employee_id: taEmployee.id,
        type:        "CONTRACT",
        file_url:    "https://fake.test/doc.pdf",
      })
      .select("id");
    // RLS documents_write_admin: WITH CHECK requires is_current_actor_admin().
    const succeeded = !error && (data?.length ?? 0) > 0;
    assert(
      !succeeded,
      "Non-admin successfully inserted document — FORBIDDEN not enforced by RLS."
    );
  });

  // ─── Results Table ─────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  RLS Verification Results");
  console.log("═══════════════════════════════════════════════════════════");
  for (const { name, status, detail } of results) {
    const icon = status === "PASS" ? "✓" : "✗";
    console.log(`  ${icon} [${status}] ${name}`);
    if (detail) console.log(`       → ${detail}`);
  }
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  ${passed}/${results.length} passed.`);

  if (failed > 0) {
    console.log(`  ✗ ${failed} probe(s) FAILED.`);
    console.log("═══════════════════════════════════════════════════════════");
    process.exitCode = 1;
  } else {
    console.log("  ✓ All probes PASSED.");
    console.log("═══════════════════════════════════════════════════════════");
  }
}

main().catch((err) => {
  console.error("\n[RLS_VERIFY_FAIL] verify-rls crashed:", err.message);
  process.exitCode = 1;
});
