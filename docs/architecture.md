# TeamFrame Architecture Notes

## Purpose
Define the minimum architecture contract for TeamFrame V1 and prevent platform drift.

## Request Flow Contract
Frontend -> API Routes / Server Actions -> RBAC Middleware -> Service Layer -> Database

## Security Baseline
- Server-side RBAC is mandatory for all protected operations.
- Frontend role checks are UX-only and cannot grant access.
- Database access is mediated through service-layer logic.

## V1 Domain Boundaries
- employee directory
- org visibility
- onboarding documents
- minimal leave tracking
- company announcements
- constrained AI helpers (bio + contract template)
