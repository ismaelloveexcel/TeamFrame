# Employees Vertical Slice Audit — 2026-05-22

Scope audited:
- tenant isolation enforcement
- RLS adversarial behavior proof
- employee domain operational completeness
- contract/canon alignment
- partial-slice risk

Environment evidence:
- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` passes
- `npm run db:apply` passes after schema idempotency fixes
- `npm run db:test:rls` passes after RLS recursion + test savepoint fixes
- `npm run db:test:stale` passes after optimistic concurrency trigger fix
- `npm run test:employees` passes (employee CRUD/RBAC/audit/concurrency smoke integration)
- `npm run test:security` passes (RLS + stale-write smoke suite)

## Gate Results (Employees Domain)

| Gate | Result | Evidence |
|---|---|---|
| Schema complete | PASS (employees/leaves/documents/audit present) | `schemas/employees.sql`, `schemas/leaves.sql`, `schemas/documents.sql`, `schemas/audit_logs.sql` |
| Tenant scoping at schema level | PASS (for existing tables) | `tenant_id` exists in operational tables and FK to `companies` |
| RLS complete (policy definitions) | PASS (defined, recursion-fixed) | `schemas/tenancy_rls.sql` |
| RLS policy tests complete | PASS | `scripts/test-rls.mjs` passes against current DB |
| RBAC in employee service | PASS (service-level guards present) | `services/employeeService/index.ts` (`requireAdmin`, tenant filters) |
| Audit events in employee transitions | PASS | `employee.created`, `employee.updated`, `employee.archived` writes in service |
| Concurrency/stale-write protection | PASS (smoke-level) | `updated_at` optimistic checks in service + stale-write smoke passes |
| Integration tests | PASS (smoke-level) | `scripts/test-employee-integration.mjs` via `npm run test:employees` |
| UI states complete | PASS (employees slice) | `app/employees/page.tsx` + `app/employees/actions.ts` now wire create/edit/archive flows |
| No placeholders/TODO throws | FAIL | leave and document services still throw `Not implemented yet` |
| No cross-tenant leakage (runtime proof) | PASS (smoke-level) | adversarial RLS smoke tests now pass for cross-tenant visibility and write denial |

## Critical Findings

1. Completion status is currently **Implemented**, not **Operationally Complete**.
2. The employee slice now has live app wiring and runtime integration smoke coverage; remaining incompleteness sits in adjacent dependency domains and deeper adversarial breadth.
3. Runtime RLS assurance is now established at smoke-test level; broader adversarial coverage is still required.
4. `policies`, `procedures`, and `acknowledgements` schemas are absent despite canonical requirements in `docs/operational-canon.md`.

## Required Before Marking Operationally Complete

1. Expand security regression suite to include role-escalation and direct bypass abuse cases beyond smoke checks.
2. Remove `Not implemented yet` placeholders from in-scope services before claiming a complete vertical slice across related flows.
