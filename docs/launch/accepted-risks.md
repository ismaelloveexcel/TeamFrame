# Accepted Risks and Deferred Work

This document tracks architectural debt and consciously deferred items that are NOT considered launch blockers. Items listed here have been evaluated and intentionally scheduled for post-launch. This prevents deferred decisions from becoming forgotten decisions. When a revisit trigger is hit, move the item to the hardening backlog and open a tracking issue.

| ID | Deferred Item | Reason Deferred | Planned Window | Revisit Trigger |
|----|--------------|-----------------|---------------|----------------|
| DR-01 | Membership-table tenant identity redesign | Current model is operationally safe with overwrite guards + deterministic fallback; full redesign is a multi-day refactor too risky pre-launch | V1.1 (weeks 4–8 post-launch) | First customer with duplicate email across tenants, OR any tenant-isolation incident |
| DR-02 | MFA / WebAuthn | V1 scope-locked per docs/auth-rules.md; magic-link only is acceptable for SMB target market | V1.2 or first enterprise prospect | First customer that asks for it, or first security questionnaire that requires it |
| DR-03 | JWT forced invalidation on role change | Stale-claims window is ~1 hour; app-level RBAC via resolveIdentity() is always current; impacts approximately zero users at launch scale | V1.1 | First role-change incident, or customer with frequent admin/employee role transitions |
| DR-04 | Immutable forensic audit architecture | Current audit_logs are append-only via service-layer pattern; DB-level immutability constraints are hardening, not blocking | V1.2 | First compliance questionnaire requiring tamper-evident logs |
| DR-05 | Deep column-level RLS refinements | Row-level scoping is the critical layer; column-level least-privilege is refinement after row-level is proven | V1.1–V1.2 | Any column-level data disclosure incident |
| DR-06 | Advanced abuse/rate-limiting beyond magic-link throttle | Basic IP+email throttle ships in M16; advanced bot detection / WAF rules are post-launch maturity work | V1.1 | Observed abuse pattern in logs, or customer count exceeds 100 |
