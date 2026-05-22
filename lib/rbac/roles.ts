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

  const claim = (data.user.app_metadata as { role?: unknown } | null)?.role;
  const role: Role = claim === "admin" ? "admin" : "employee";
  const email = data.user.email.toLowerCase();

  const { data: linkedEmployeeData, error: linkedEmpErr } = await supabase
    .from("employees")
    .select("id, tenant_id, auth_user_id")
    .eq("auth_user_id", data.user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (linkedEmpErr) {
    throw new Error(`RBAC: failed to resolve employee link (${linkedEmpErr.message})`);
  }

  let employee = linkedEmployeeData as
    | { id: string; tenant_id: string; auth_user_id: string | null }
    | null;

  if (!employee) {
    const { data: employeeByEmail, error: empErr } = await supabase
      .from("employees")
      .select("id, tenant_id, auth_user_id")
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
      | { id: string; tenant_id: string; auth_user_id: string | null }
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

  return {
    authUserId: data.user.id,
    email,
    employeeId: employee?.id ?? null,
    tenantId: employee?.tenant_id ?? null,
    role,
  };
}
