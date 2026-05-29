# Data Integrity Audit — TeamFrame Phase 1A

This document lists every mutating action in TeamFrame, the protections applied, and their verification status.

Updated as part of Phase 1A (Weekend 1) foundation work.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Verified — RLS + app-layer guard both present |
| ~ | Partial — one layer verified, other pending |
| ✗ | Gap identified — see notes |

---

## Employee domain

| Action | RBAC check (app layer) | RLS policy | Audit logged | Verified |
|--------|----------------------|------------|--------------|---------|
| `listEmployeesForAdmin` | `actor.role === 'admin'` | `employees_select` | No (read) | ~ |
| `listEmployeesForOrgChart` | Any authenticated actor | `employees_select` | No (read) | ~ |
| `updateEmployee` | `actor.role === 'admin'` | `employees_update` (admin only) | Yes | ✓ (D3 probe 4a) |
| `inviteEmployee` | `actor.role === 'admin'` | `employees_insert` (admin only) | Yes | ~ |
| `softDeleteEmployee` | `actor.role === 'admin'` | No delete policy (service-role) | Yes | ~ |

## Leave domain

| Action | RBAC check (app layer) | RLS policy | Audit logged | Verified |
|--------|----------------------|------------|--------------|---------|
| `listLeavesForEmployee` | Own employee | `leaves_select` | No (read) | ~ |
| `listPendingLeavesWithEmployee` | `actor.role === 'admin'` | `leaves_select` | No (read) | ~ |
| `submitLeaveRequest` | Own employee | `leaves_insert_self` | Yes | ~ |
| `decideLeaveRequest` (approve/reject) | `actor.role === 'admin'` | `leaves_update_admin` (admin only) | Yes | ✓ (D3 probe 4b) |

## Onboarding domain

| Action | RBAC check (app layer) | RLS policy | Audit logged | Verified |
|--------|----------------------|------------|--------------|---------|
| `listOnboardingTasksForEmployee` | Own employee | `onboarding_tasks_select` | No (read) | ~ |
| `listAllOnboardingTasks` | `actor.role === 'admin'` | `onboarding_tasks_select` | No (read) | ~ |
| `assignOnboardingTask` | `actor.role === 'admin'` | `onboarding_tasks_insert_admin` | Yes | ✓ (D3 probe 4c) |
| `completeOnboardingTask` | Own employee | `onboarding_tasks_update_admin` (admin insert only — gap?) | Yes | ~ |

## Document domain

| Action | RBAC check (app layer) | RLS policy | Audit logged | Verified |
|--------|----------------------|------------|--------------|---------|
| `listDocuments` | Own employee or admin | `documents_select` | No (read) | ~ |
| `uploadDocument` | `actor.role === 'admin'` | `documents_write_admin` | Yes | ✓ (D3 probe 4d) |

## Tenant isolation (cross-cutting)

| Protection | Mechanism | Verified |
|-----------|-----------|---------|
| Tenant ID from JWT only | `current_actor_tenant_id()` v2 (no email fallback) | ✓ (D2 migration) |
| Unique active employee per (tenant, email) | `employees_tenant_email_active_idx` | ✓ (applied in staging) |
| Missing-tenant blocks all access | NULL tenant_id → no rows matched by RLS | ✓ (D3 probe 3) |
| Cross-tenant read isolation | RLS `tenant_id = current_actor_tenant_id()` | ✓ (D3 probes 1, 2) |
