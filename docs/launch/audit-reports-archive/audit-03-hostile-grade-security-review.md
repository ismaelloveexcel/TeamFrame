# Audit 03 — Hostile-Grade Security Review

## Audit Context
This was the most aggressive and technically detailed security review conducted during the TeamFrame hardening process.

The purpose of the audit was not to validate expected behavior, but to actively search for:

- cross-tenant escape paths
- direct REST API exploitation
- policy bypasses
- callback/session corruption paths
- metadata poisoning risks
- operational abuse vectors

This review introduced the majority of the launch-blocking security findings.

---

## Threat Model
The review assumed:

- hostile authenticated users
- direct Supabase REST API access
- replay attempts
- stale-session abuse
- cross-tenant probing
- admin privilege escalation attempts
- malformed auth state recovery

The review explicitly rejected the assumption that UI restrictions equal security boundaries.

---

## Major Findings

### 1. Employee table visibility was too broad
Critical finding.

The review determined that employee visibility rules were overly permissive.

Specifically:

- standard employees could potentially enumerate broader employee datasets than operationally necessary
- policy scope did not clearly separate:self visibility
- tenant directory visibility
- admin visibility

The review recommended:

- self-only full access
- admin full access
- creation of a safe tenant-wide public projection (`employees_public`)
- explicit policy separation

Risk:

- internal information disclosure
- organizational enumeration
- privilege boundary confusion

Later tracked as:

- M7

---

### 2. Callback failure path could wipe valid active sessions
Critical auth-flow finding.

The callback route contained failure handling logic that could:

- clear active auth cookies
- destroy valid user sessions
- incorrectly treat PKCE verifier cleanup as full session invalidation

Risk:

- unexpected logout behavior
- auth instability
- session corruption
- difficult-to-debug support incidents

The review explicitly recommended:

- only clearing PKCE verifier cookies
- never wiping active sessions during callback recovery failures

Later tracked as:

- M8

---

### 3. `inviteEmployeeAuthUser` vulnerable to metadata overwrite patterns
The audit identified a dangerous assumption inside the employee invitation flow.

Risk:

- cross-tenant metadata overwrite
- tenant identity poisoning
- accidental reassignment behavior

Recommendation:

- explicit overwrite guards
- deterministic tenant ownership checks
- refusal of conflicting writes

Later tracked as:

- M5

---

### 4. RLS assumptions required direct verification
The review criticized relying on:

- assumed policy correctness
- indirect UI testing
- implementation confidence without adversarial validation

The audit explicitly required:

- persona-by-persona RLS verification
- direct REST API testing
- cross-tenant access attempts
- anonymous-user verification

This directly led to:

- the later verification checklists
- security smoke-test artifacts
- the "prove there are no unknown holes" standard

---

### 5. Browser protections remained incomplete
The hostile-grade review reinforced the earlier header findings.

The audit emphasized:

- CSP enforcement
- strict browser-side protections
- reduction of unnecessary client attack surface

Later tracked as:

- M3

---

## Security Philosophy Introduced
This audit introduced the most important security framing used throughout the remainder of the hardening sprint:

> The goal is not merely to fix known holes.
> The goal is to prove there are no unknown holes remaining in tenant isolation.
This framing later became the dominant launch standard.

---

## Immediate Recommendations

### Launch blockers

- employee table RLS redesign
- callback session recovery fix
- metadata overwrite protections
- RLS verification sweep
- direct REST API persona testing

### High priority

- CSP + browser protections
- auth abuse throttling
- audit logging hardening

---

## Historical Notes
This audit intentionally used worst-case framing.

Some architectural concerns raised here were later downgraded by the meta-review from:

- immediate redesign requirements
- to deferred architectural debt with compensating controls.

However:

- the employee RLS issue
- callback session handling
- metadata overwrite protections

all remained launch-critical findings.
