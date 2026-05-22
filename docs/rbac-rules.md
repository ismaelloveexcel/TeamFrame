# RBAC Rules

## Core Rule
**All authorization is enforced server-side.** Client-side checks are UX hints only and never grant access.

Authentication is **Magic Link only** (see [`auth-rules.md`](auth-rules.md)). No passwords, no OAuth, no MFA in V1.

## Roles
TeamFrame V1 has exactly two roles:

1. `admin`
2. `employee`

No other roles exist in V1. Do not introduce manager, hr, finance, viewer, owner, or custom roles — that is V2.

## Capability Matrix

| Capability | admin | employee |
|---|:-:|:-:|
| List all employees | ✅ | ✅ (org chart fields only) |
| View own profile | ✅ | ✅ |
| View any profile (full) | ✅ | ❌ |
| Create / update / delete employee | ✅ | ❌ |
| View / edit compensation | ✅ | ❌ |
| Upload document for any employee | ✅ | ❌ |
| Upload own document | ✅ | ✅ (where allowed by flow) |
| Submit own leave request | ✅ | ✅ |
| Approve / reject leave | ✅ | ❌ |
| Post company update | ✅ | ❌ |
| View company updates | ✅ | ✅ |
| Generate bio from CV (AI) | ✅ | ❌ |
| Generate contract template (AI) | ✅ | ❌ |

## Org Chart — Non-Sensitive Field Whitelist
When an employee views the org chart, only these fields may be returned:
- `id`
- `full_name`
- `role_title`
- `department`
- `manager_id`
- `photo_url` (from `employee_profiles`)
- `status` (limited to `active` / `on_leave` / `inactive`)

Compensation, personal details, email (optional), and document references must **never** be selected in employee-scope queries.

## Enforcement Pattern

```
Request
  → resolve Supabase session (middleware/auth.ts)
  → resolve actor (middleware/rbac.ts):
        auth.users.id  →  employees.email  →  employees.id
        app_metadata.role  →  'admin' | 'employee'
  → call requireRole('admin') or requireSelfOrAdmin(targetEmployeeId)
  → service layer executes scoped query
```

Service-layer functions accept an explicit `Actor` argument
(`{ authUserId, email, employeeId, role }`) and re-validate authorization.
They never read the session themselves.

## Audit
Sensitive admin actions (employee delete, compensation change, document delete, leave approval/rejection, bulk export) must write a row to `audit_logs` from the service layer.

## Forbidden
- frontend-only "if role === admin" as a security boundary
- exposing the Supabase service role key to the browser
- accepting a role from a request body, cookie, or query string
- adding new roles to satisfy a one-off feature
