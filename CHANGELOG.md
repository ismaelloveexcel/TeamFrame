# Changelog

## [Unreleased]

### Added
- Added docs/launch/ folder: consolidated audit findings (M1–M20), hardening execution plan, accepted risks register (DR-01–DR-06), audit reports archive, operational runbook skeletons, verification checklists, and operational readiness checklist.

## v1.0.0 - 2026-05-22

### Added
- Tenant-root and domain schemas for employees, profiles, compensation, documents, leaves, company updates, audit logs, policies, procedures, and acknowledgements.
- Hardened RLS policy layer with tenant helpers and role-aware access rules.
- Auth/RBAC server layer with actor resolution and server-only permission guards.
- Operational domain services for employees, leave, and documents, including audit writes.
- Full reliability and security test suites for RLS, stale writes, multi-actor concurrency, failure injection, and session boundaries.
- App Router surfaces for auth, dashboard, admin, and employee workflows.
- Governance and operational contract documentation set (architecture, drift guard, RBAC, auth, AI boundaries, operational canon).

### Changed
- Placeholder schema files replaced with idempotent, tenant-scoped SQL definitions.
- Placeholder service files replaced with production implementations.
- Repository contract documentation expanded and aligned to release hardening posture.

### Removed
- Placeholder .gitkeep files across app, component, service, and library folders.

### Commit Segments
- 8c25e06 `feat(schema): harden tenant-scoped DB contract and migration tooling`
- 6432583 `feat(services): implement auth/rbac, AI boundaries, and domain services`
- 8c61bfd `test(reliability): add security, concurrency, and failure-injection suites`
- f8e2aca `feat(ui): wire auth, dashboard, admin, and employee operational surfaces`
- d07c50d `docs(release): codify operational contract, boundaries, and readiness artifacts`
