# Audit 02 — Follow-up Functional and Security Review

## Audit Context
This review expanded beyond functional correctness into deeper security and multi-tenant boundary validation.

The purpose of the audit was to determine whether TeamFrame's documented tenant-isolation model actually matched the implemented Supabase/Postgres RLS behavior.

This audit preceded the hostile-grade exploit review but introduced many of the concerns later formalized into the M1–M20 hardening list.

---

## Primary Focus Areas

- RLS coverage
- tenant isolation
- logout behavior
- auth flow integrity
- HTTP security posture
- deterministic tenant resolution
- operational abuse resistance

---

## Major Findings

### 1. `companies` table missing tenant protections
The audit identified that:

- tenant protections were incomplete
- RLS enforcement required validation
- policy coverage was insufficiently explicit

Risk:

- cross-tenant visibility
- accidental enumeration
- future exploit surface

Later tracked as:

- M1

---

### 2. `onboarding_tasks` had RLS enabled but no policies
Critical discovery.

The table had:

- RLS enabled
- but zero effective tenant policies

Risk:

- broken access assumptions
- future exposure if accessed directly
- misleading security posture

Later tracked as:

- M2

---

### 3. Missing HTTP security headers
The application lacked:

- CSP
- HSTS
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

Risk:

- clickjacking
- downgraded browser protections
- unnecessary exploit surface

Later tracked as:

- M3

---

### 4. Policies/procedures visibility rules too broad
The audit questioned whether unpublished internal policies could become visible to standard employees.

Recommendation:

- published-only access for non-admin users
- explicit visibility filtering

Later tracked as:

- M13

---

### 5. Tenant resolution fallback was nondeterministic
The audit identified that:

- email-based tenant resolution fallback behavior could become nondeterministic
- duplicate-email edge cases were not sufficiently constrained

Recommendation:

- deterministic ordering
- explicit fallback guarantees
- uniqueness assumptions documented

Later tracked as:

- M14

---

### 6. Logout architecture relied on route handler pattern
The logout flow used a route handler where a server action would provide:

- better consistency
- simpler auth handling
- improved operational clarity

Later tracked as:

- M15

---

### 7. Magic-link abuse protections insufficient
The auth flow lacked:

- meaningful throttling
- abuse resistance
- IP/email request limits

Risk:

- spam
- auth abuse
- operational instability

Later tracked as:

- M16

---

## Positive Findings
The audit also noted:

- auth boundaries were conceptually strong
- RBAC documentation was unusually mature
- schema naming discipline was strong
- operational simplicity remained intact

---

## Recommendations

### Immediate

- complete RLS review
- add HTTP security headers
- implement throttling
- tighten publication visibility

### Deferred

- full tenant identity redesign
- advanced auth hardening
- MFA/WebAuthn

---

## Historical Notes
Some concerns raised in this audit were later reclassified by the meta-review:

- the tenant identity model was ultimately considered launch-safe with compensating controls
- several architectural concerns were downgraded from "urgent redesign" to "documented deferred work"

The later hostile-grade review substantially expanded the employee-table findings.
