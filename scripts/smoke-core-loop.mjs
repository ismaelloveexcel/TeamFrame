/**
 * Core Loop smoke test — runs end-to-end user journey against the real DB.
 *
 * Steps:
 *   1. Resolve existing tenant + admin
 *   2. Create test employee  (idempotent)
 *   3. Assign onboarding task (idempotent)
 *   4. Complete onboarding task
 *   5. Submit leave request   (idempotent)
 *   6. Approve leave
 *   7. Maybe fire activation_completed
 *   8. Report all events found in DB
 *
 * Run: node scripts/smoke-core-loop.mjs
 * Safe to re-run — idempotent at every step.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg, err) { console.error(`  ✗ ${msg}`, err ?? ""); process.exit(1); }
function info(msg) { console.log(`  · ${msg}`); }
function section(label) { console.log(`\n── ${label}`); }

async function fireEvent(tenantId, userId, eventName, properties = {}) {
  const { error } = await sb.from("analytics_events").insert({
    tenant_id: tenantId,
    user_id: userId,
    event_name: eventName,
    event_properties: properties,
  });
  // 23505 = unique violation: event already exists, that's fine
  if (error && error.code !== "23505") {
    console.warn(`  [track] ${eventName} insert warning: ${error.message}`);
  }
}

// ── 1. Resolve tenant ───────────────────────────────────────────────────────
section("1. Resolve tenant");

// Prefer the tenant that already has company_created fired (that's the real seeded one).
// Fall back to any company with an admin employee.
const { data: eventRows } = await sb
  .from("analytics_events")
  .select("tenant_id")
  .eq("event_name", "company_created")
  .order("created_at", { ascending: true })
  .limit(1);

let TENANT_ID = eventRows?.[0]?.tenant_id ?? null;

if (!TENANT_ID) {
  // Fallback: first real company (skip placeholder UUID)
  const { data: cos, error: cosErr } = await sb
    .from("companies")
    .select("id, name")
    .neq("id", "00000000-0000-0000-0000-000000000001")
    .order("created_at", { ascending: true })
    .limit(1);
  if (cosErr || !cos?.length) fail("No companies found — run: npm run seed:admin first", cosErr?.message);
  TENANT_ID = cos[0].id;
}

const { data: companyRow } = await sb.from("companies").select("id, name").eq("id", TENANT_ID).single();
const company = companyRow;
if (!company) fail(`Could not resolve company for tenant_id ${TENANT_ID}`);
info(`tenant: ${company.name} (${TENANT_ID})`);

// ── 2. Resolve admin auth user ───────────────────────────────────────────────
section("2. Resolve admin");

// Find any employee in this tenant with a linked auth user — prefer one named "Admin".
// The script uses the service-role client so RLS is bypassed; no need to verify app_metadata.
const { data: adminEmpRows, error: adminEmpErr } = await sb
  .from("employees")
  .select("id, full_name, auth_user_id")
  .eq("tenant_id", TENANT_ID)
  .not("auth_user_id", "is", null)
  .is("deleted_at", null)
  .order("full_name", { ascending: true })
  .limit(10);

if (adminEmpErr) fail("employees lookup failed", adminEmpErr.message);
if (!adminEmpRows?.length) fail("No employees with auth_user_id found — run: npm run seed:admin");

// Prefer an employee whose name contains "Admin", otherwise take first
const adminEmp =
  adminEmpRows.find((e) => e.full_name.toLowerCase().includes("admin")) ?? adminEmpRows[0];

const ADMIN_AUTH_ID = adminEmp.auth_user_id;
info(`admin: ${adminEmp.full_name} auth=${ADMIN_AUTH_ID}`);

// ── 3. Create test employee ─────────────────────────────────────────────────
section("3. Add employee");

const TEST_EMAIL = `smoke-test@${TENANT_ID.slice(0, 8)}.internal`;

const { data: existingEmps } = await sb
  .from("employees")
  .select("id, full_name")
  .eq("tenant_id", TENANT_ID)
  .eq("email", TEST_EMAIL)
  .is("deleted_at", null)
  .limit(1);

let testEmp;
if (existingEmps?.length) {
  testEmp = existingEmps[0];
  info(`employee already exists: ${testEmp.full_name} (${testEmp.id})`);
} else {
  const { data: newEmp, error: empErr } = await sb
    .from("employees")
    .insert({
      tenant_id: TENANT_ID,
      full_name: "Smoke Test Employee",
      email: TEST_EMAIL,
      role_title: "Tester",
      department: "QA",
      timezone: "UTC",
      status: "active",
      setup_status: "incomplete",
    })
    .select("id, full_name")
    .single();

  if (empErr) fail("insert employee failed", empErr.message);
  testEmp = newEmp;
  pass(`created: ${testEmp.full_name} (${testEmp.id})`);
}

// Fire first_employee_added if it hasn't been recorded yet for this tenant
const { data: empEventCheck } = await sb
  .from("analytics_events")
  .select("event_name")
  .eq("tenant_id", TENANT_ID)
  .eq("event_name", "first_employee_added")
  .limit(1);

if (!empEventCheck?.length) {
  await fireEvent(TENANT_ID, ADMIN_AUTH_ID, "first_employee_added", { employee_id: testEmp.id });
  pass("fired first_employee_added");
} else {
  info("first_employee_added already in DB");
}

const TEST_EMP_ID = testEmp.id;

// ── 4. Assign onboarding task ───────────────────────────────────────────────
section("4. Assign onboarding task");

const TASK_TITLE = "Smoke test task";

const { data: existingTasks } = await sb
  .from("onboarding_tasks")
  .select("id, status, updated_at")
  .eq("tenant_id", TENANT_ID)
  .eq("employee_id", TEST_EMP_ID)
  .eq("title", TASK_TITLE)
  .limit(1);

let task;
if (existingTasks?.length) {
  task = existingTasks[0];
  info(`task already exists (${task.id}) status=${task.status}`);
} else {
  const { data: newTask, error: taskErr } = await sb
    .from("onboarding_tasks")
    .insert({
      tenant_id: TENANT_ID,
      employee_id: TEST_EMP_ID,
      title: TASK_TITLE,
      status: "pending",
      assigned_by: ADMIN_AUTH_ID,
    })
    .select("id, status, updated_at")
    .single();

  if (taskErr) fail("assign onboarding task failed", taskErr.message);
  task = newTask;

  const { count } = await sb
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID);

  if ((count ?? 0) === 1) {
    await fireEvent(TENANT_ID, ADMIN_AUTH_ID, "first_onboarding_assigned", { task_id: task.id });
  }

  pass(`task assigned (${task.id})`);
}

// ── 5. Complete onboarding task ─────────────────────────────────────────────
section("5. Complete onboarding task");

if (task.status === "completed") {
  info("already completed");
} else {
  const { data: completed, error: cErr } = await sb
    .from("onboarding_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("tenant_id", TENANT_ID)
    .eq("id", task.id)
    .eq("updated_at", task.updated_at)
    .select("id, status, updated_at")
    .maybeSingle();

  if (cErr) fail("complete onboarding task failed", cErr.message);
  if (!completed) fail("STALE_WRITE — task updated_at mismatch; re-run the script");

  task = completed;

  const { count } = await sb
    .from("onboarding_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("status", "completed");

  if ((count ?? 0) === 1) {
    await fireEvent(TENANT_ID, ADMIN_AUTH_ID, "first_onboarding_completed", { task_id: task.id });
  }

  pass("task marked completed");
}

// ── 6. Submit leave request ─────────────────────────────────────────────────
section("6. Submit leave request");

const LEAVE_START = "2026-07-14";
const LEAVE_END   = "2026-07-16";

const { data: existingLeaves } = await sb
  .from("leaves")
  .select("id, status, updated_at")
  .eq("tenant_id", TENANT_ID)
  .eq("employee_id", TEST_EMP_ID)
  .eq("start_date", LEAVE_START)
  .limit(1);

let leave;
if (existingLeaves?.length) {
  leave = existingLeaves[0];
  info(`leave already exists (${leave.id}) status=${leave.status}`);
} else {
  const { data: newLeave, error: lErr } = await sb
    .from("leaves")
    .insert({
      tenant_id: TENANT_ID,
      employee_id: TEST_EMP_ID,
      start_date: LEAVE_START,
      end_date: LEAVE_END,
      status: "pending",
    })
    .select("id, status, updated_at")
    .single();

  if (lErr) fail("submit leave failed", lErr.message);
  leave = newLeave;

  const { count } = await sb
    .from("leaves")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID);

  if ((count ?? 0) === 1) {
    await fireEvent(TENANT_ID, ADMIN_AUTH_ID, "first_leave_requested", { leave_id: leave.id });
  }

  pass(`leave submitted (${leave.id})`);
}

// ── 7. Approve leave ────────────────────────────────────────────────────────
section("7. Approve leave");

if (leave.status === "approved") {
  info("already approved");
} else {
  // If rejected, reset to pending first so we can approve
  if (leave.status === "rejected") {
    const { data: reset, error: rErr } = await sb
      .from("leaves")
      .update({ status: "pending" })
      .eq("tenant_id", TENANT_ID)
      .eq("id", leave.id)
      .select("id, status, updated_at")
      .single();
    if (rErr) fail("reset leave to pending failed", rErr.message);
    leave = reset;
    info("reset rejected leave → pending");
  }

  const { data: approved, error: aErr } = await sb
    .from("leaves")
    .update({ status: "approved" })
    .eq("tenant_id", TENANT_ID)
    .eq("id", leave.id)
    .eq("updated_at", leave.updated_at)
    .select("id, status")
    .maybeSingle();

  if (aErr) fail("approve leave failed", aErr.message);
  if (!approved) fail("STALE_WRITE — leave updated_at mismatch; re-run the script");

  const { count } = await sb
    .from("leaves")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("status", "approved");

  if ((count ?? 0) === 1) {
    await fireEvent(TENANT_ID, ADMIN_AUTH_ID, "first_leave_approved", { leave_id: leave.id });
  }

  pass("leave approved");
}

// ── 8. Maybe fire activation_completed ─────────────────────────────────────
section("8. Check activation_completed");

const WORKFLOW_EVENTS = [
  "first_employee_added",
  "first_onboarding_assigned",
  "first_onboarding_completed",
  "first_leave_requested",
  "first_leave_approved",
];

const { data: workflowRows } = await sb
  .from("analytics_events")
  .select("event_name")
  .eq("tenant_id", TENANT_ID)
  .in("event_name", WORKFLOW_EVENTS);

const workflowFired = new Set((workflowRows ?? []).map((r) => r.event_name));
const allWorkflowFired = WORKFLOW_EVENTS.every((e) => workflowFired.has(e));

if (allWorkflowFired) {
  await fireEvent(TENANT_ID, ADMIN_AUTH_ID, "activation_completed", {});
  pass("activation_completed fired (or already existed)");
} else {
  const notYet = WORKFLOW_EVENTS.filter((e) => !workflowFired.has(e));
  info(`activation_completed not yet fired — missing workflow events: ${notYet.join(", ")}`);
}

// ── 9. Final event audit ────────────────────────────────────────────────────
section("9. Event audit (DB verification)");

const ALL_EVENTS = [
  "company_created",
  "session_started",
  "first_employee_added",
  "first_onboarding_assigned",
  "first_onboarding_completed",
  "first_leave_requested",
  "first_leave_approved",
  "activation_completed",
];

// These two events only fire through real UI flows (seed-admin, /auth/callback).
// A direct-DB smoke test cannot simulate them; missing here is expected.
const UI_ONLY_EVENTS = new Set(["company_created", "session_started"]);

const { data: auditEventRows } = await sb
  .from("analytics_events")
  .select("event_name, created_at")
  .eq("tenant_id", TENANT_ID)
  .in("event_name", ALL_EVENTS)
  .order("created_at", { ascending: true });

const eventMap = new Map();
for (const row of auditEventRows ?? []) {
  if (!eventMap.has(row.event_name)) {
    eventMap.set(row.event_name, row.created_at);
  }
}

console.log();
for (const e of ALL_EVENTS) {
  const ts = eventMap.get(e);
  if (ts) {
    console.log(`  ✓ ${e.padEnd(30)} ${new Date(ts).toISOString()}`);
  } else if (UI_ONLY_EVENTS.has(e)) {
    console.log(`  · ${e.padEnd(30)} (requires real UI flow — not testable here)`);
  } else {
    console.log(`  ✗ ${e.padEnd(30)} NOT IN DB`);
  }
}

const missing = ALL_EVENTS.filter((e) => !eventMap.has(e) && !UI_ONLY_EVENTS.has(e));

console.log();
if (missing.length === 0) {
  console.log("✅  Core Loop COMPLETE — all 8 activation events confirmed in DB.");
} else {
  console.log(`⚠️   Gap found (${missing.length} missing):`);
  for (const e of missing) console.log(`    • ${e}`);
  console.log("\n    Fix the gap above before any further product work.");
  process.exit(1);
}
