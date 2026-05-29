/**
 * Role + identity resolution for TeamFrame.
 *
 * Magic-link-only auth means every actor is keyed by their email. The
 * Supabase auth user is linked to a row in `employees` by that email.
 *
 *   auth.users.id (session)
 *     → employees.email match
 *     → employees.id
 *     → app_metadata.role  →  'admin' | 'employee'
 *
 * Two roles only. The role is read from Supabase Auth `app_metadata.role`
 * and is NEVER accepted from a request body, cookie, header, or query string.
 */

import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type Role = "admin" | "employee";

export const ROLES: readonly Role[] = ["admin", "employee"] as const;

export type ResolvedIdentity = {
  authUserId: string;
  email: string;
  employeeId: string | null;
  tenantId: string | null;
  role: Role;
};

export async function resolveIdentity(authUserId: string): Promise<ResolvedIdentity> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.auth.admin.getUserById(authUserId);
  if (error || !data?.user || !data.user.email) {
    throw new Error("RBAC: failed to resolve auth user");
  }

  // Phase 1A: tenantId is sourced from JWT app_metadata only — never from the
  // employees row — so the middleware trust boundary matches RLS (which also
  // reads JWT-only via current_actor_tenant_id() in tenancy_rls_v2.sql).
  const appMeta = (data.user.app_metadata ?? {}) as { role?: unknown; tenant_id?: unknown };
  const claim = appMeta.role;
  const role: Role = claim === "admin" ? "admin" : "employee";
  const jwtTenantId = typeof appMeta.tenant_id === "string" ? appMeta.tenant_id : null;
  const email = data.user.email.toLowerCase();

  const { data: linkedEmployeeData, error: linkedEmpErr } = await supabase
    .from("employees")
    .select("id, tenant_id, auth_user_id, setup_status")
    .eq("auth_user_id", data.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (linkedEmpErr) {
    throw new Error(`RBAC: failed to resolve employee link (${linkedEmpErr.message})`);
  }

  let employee = linkedEmployeeData as
    | {
        id: string;
        tenant_id: string;
        auth_user_id: string | null;
        setup_status: "incomplete" | "ready" | "active";
      }
    | null;

  if (!employee) {
    const { data: employeeByEmail, error: empErr } = await supabase
      .from("employees")
      .select("id, tenant_id, auth_user_id, setup_status")
      .eq("email", email)
      .is("deleted_at", null)
      .limit(2);

    if (empErr) {
      throw new Error(`RBAC: failed to resolve employee record (${empErr.message})`);
    }
    if ((employeeByEmail ?? []).length > 1) {
      throw new Error("RBAC: ambiguous employee mapping for this email");
    }
    employee = (employeeByEmail?.[0] as
      | {
          id: string;
          tenant_id: string;
          auth_user_id: string | null;
          setup_status: "incomplete" | "ready" | "active";
        }
      | undefined) ?? null;
  }

  // Keep auth.users -> employees linkage stable after first successful login.
  if (employee && !employee.auth_user_id) {
    await supabase
      .from("employees")
      .update({ auth_user_id: data.user.id } as never)
      .eq("id", employee.id)
      .is("auth_user_id", null);
  }

  if (employee && employee.setup_status !== "active") {
    const { error: markActiveError } = await supabase
      .from("employees")
      .update({
        setup_status: "active",
        activated_at: new Date().toISOString(),
        invite_last_error: null,
      } as never)
      .eq("id", employee.id)
      .eq("tenant_id", employee.tenant_id)
      .is("deleted_at", null);

    if (markActiveError) {
      const message = markActiveError.message.toLowerCase();
      if (
        message.includes("activated_at") ||
        message.includes("invite_last_error")
      ) {
        await supabase
          .from("employees")
          .update({ setup_status: "active" } as never)
          .eq("id", employee.id)
          .eq("tenant_id", employee.tenant_id)
          .is("deleted_at", null);
      }
    }
  }

  if (employee && jwtTenantId && employee.tenant_id !== jwtTenantId) {
    console.warn("[TENANT_MISMATCH] employee row tenant differs from JWT app_metadata.tenant_id", {
      authUserId: data.user.id,
      employeeTenantId: employee.tenant_id,
      jwtTenantId,
    });
  }

  return {
    authUserId: data.user.id,
    email,
    employeeId: employee?.id ?? null,
    tenantId: jwtTenantId,
    role,
  };
}
