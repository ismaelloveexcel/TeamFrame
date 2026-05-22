# Operational Canon

This document defines the canonical operational meaning of core TeamFrame concepts.

Purpose:
- Prevent semantic drift across domains, features, and AI-assisted implementation.
- Keep product behavior aligned with TeamFrame's startup operations positioning.

This file is the semantic source of truth.

## Delivery Status Taxonomy

Use these labels exactly in planning, PRs, and release reporting.

### Implemented
Code exists and builds, but completion gates may still be missing.

### Operationally Complete
The full vertical slice passes all completion gates for that domain:
- schema + tenant scoping complete
- RLS policies + adversarial policy tests passing
- RBAC enforced in handlers/services
- audit events emitted for required transitions
- stale-write protection on mutable transitions
- integration tests and UI/error states wired end-to-end

### Production Hardened
Operationally complete plus failure-mode/adversarial validation (concurrency contention, abuse cases, and recovery behavior) proven in repeatable tests.

## Canonical Definitions

### Tenant
A startup company workspace with isolated data boundaries.

### Employee
An active or archived person record attached to exactly one tenant.

### Manager
An employee who has one or more direct-report relationships in the org structure graph.

### Policy
A versioned governance rule that may require acknowledgement.

### Procedure
An ordered operational instruction set used to execute repeatable work.

### Acknowledgement
An immutable acceptance event by a specific employee for a specific policy version.

### Archive
A record state hidden from operational default views but retained for history and audit.

## Semantic Invariants

1. All operational data is tenant-scoped.
2. Policies and procedures are never hard-deleted.
3. Acknowledgements are immutable history.
4. Leave history is immutable after final decision.
5. Business transitions are defined in domain contracts, not ad hoc in handlers.
6. Handlers, UI behavior, validations, and tests derive from domain contracts.

## State Model Requirements

Each mutable domain must define explicit states and allowed transitions in its contract.

Minimum required domains:
- employees
- documents
- leave
- policies
- procedures
- acknowledgements

Every transition must encode:
- preconditions
- actor permissions
- side effects
- audit event

## Event Taxonomy (Canonical)

Event names use the pattern `domain.action`.

Required baseline events:
- employee.created
- employee.updated
- employee.archived
- document.uploaded
- document.assigned
- document.deleted
- leave.submitted
- leave.approved
- leave.rejected
- policy.published
- policy.assigned
- policy.acknowledged
- procedure.published
- procedure.updated

## Retention and Delete Strategy Matrix

| Domain | Strategy |
|---|---|
| Employees | Archive |
| Policies | Soft archive only |
| Procedures | Soft archive only |
| Leave | Immutable history |
| Documents | Soft delete |
| Audit logs | Immutable |

## Migration Discipline

1. Forward-only migrations.
2. No destructive production migration without an explicit rollback plan.
3. Every schema change requires review for:
   - tenant isolation impact
   - RLS and policy impact
   - index and query impact
   - audit event impact

## Concurrency Discipline

All mutable operational paths require stale-write protection via at least one:
- optimistic locking (`updated_at` or version column)
- idempotency keys for submission paths

Transitions fail closed on stale state.

## Operational Simplicity Principle

Every accepted feature must reduce startup admin friction within one to two interactions.

If configuration complexity exceeds immediate operational value, reject or defer.

## Anti-Creep Boundaries

Forbidden in V1:
- generic workflow engine
- custom rule builder
- no-code automation system
- configurable state machine UI

## Execution Rule

Finish depth before breadth:
- maximum 1-2 active domains at a time
- no new domain starts before vertical completion of active domain
