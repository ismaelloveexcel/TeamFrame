/**
 * TeamFrame — rbac middleware
 *
 * Resolves the actor for the current authenticated request and exposes
 * server-side guards for protected operations.
 *
 * Contract:
 *  - server-only (never imported into a client component)
 *  - two roles only: 'admin' | 'employee'
 *  - role is read from Supabase Auth `app_metadata.role`, never from input
 *  - employeeId is resolved by matching session email to employees.email
 *  - services accept an explicit `Actor` and re-validate authorization
 */

import "server-only";
import { requireAuthSession } from "./auth";
import { resolveIdentity, type Role } from "@/lib/rbac/roles";

export type Actor = {
  authUserId: string;
  email: string;
  employeeId: string | null;
  tenantId: string | null;
  role: Role;
};

export async function getActor(): Promise<Actor | null> {
  try {
    const session = await requireAuthSession();
    return await resolveIdentity(session.userId);
  } catch {
    return null;
  }
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new Error("UNAUTHENTICATED");
  return actor;
}

export async function requireRole(role: Role): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== role) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

export async function requireSelfOrAdmin(targetEmployeeId: string): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role === "admin") return actor;
  if (actor.employeeId && actor.employeeId === targetEmployeeId) return actor;
  throw new Error("FORBIDDEN");
}

export async function requireLinkedEmployee(): Promise<Actor & { employeeId: string }> {
  const actor = await requireActor();
  if (!actor.employeeId) {
    throw new Error("NO_EMPLOYEE_RECORD");
  }
  return { ...actor, employeeId: actor.employeeId };
}

export async function requireTenantActor(): Promise<Actor & { tenantId: string }> {
  const actor = await requireActor();
  if (!actor.tenantId) {
    throw new Error("NO_TENANT_CONTEXT");
  }
  return { ...actor, tenantId: actor.tenantId };
}
