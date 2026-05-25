# TeamFrame – 14 Day Execution Tracker

## Core Constraint
No work outside the Core Loop or the listed phases.
Every PR must answer: which loop step, which event, which invariant.
If none → reject PR.

---

## Core Loop (Non-Negotiable)

Add employee → Assign onboarding → Track completion → Request leave → Approve leave → Maintain records

Definition of Done:
- Completes in <30 minutes for a new admin
- Fully instrumented (events firing)
- Tenant-safe by default

---

## Instrumentation Events (must all fire by end of Phase 2)

- [ ] company_created
- [ ] first_employee_added
- [ ] first_onboarding_assigned
- [ ] first_onboarding_completed
- [ ] first_leave_requested
- [ ] first_leave_approved
- [ ] session_started
- [ ] activation_completed

KPIs:
- Time-to-first-employee
- Time-to-first-approval
- Onboarding completion rate
- Funnel drop-off per step

---

## Tenant Safety Invariants (acceptance for Phase 3)

- RLS enabled on every tenant-scoped table
- Deny-by-default policies (no implicit allow)
- Automated cross-tenant negative tests per sensitive table
- Service-role usage inventory + boundary tests
- CI gate blocks merges that break invariants

---

## Phase Progress

### Phase 1 — Surface Truth (Days 1–2)
- [ ] Kill List applied
- [ ] README aligned with shipped features
- [ ] Dashboard cleaned (live data or honest empty states)
- [ ] Dead nav routes removed
- [ ] API responses reconciled with UI claims

Success metric: zero false feature surfaces.

---

### Phase 2 — Core Loop + Instrumentation (Days 3–6)
- [ ] Create company first-run UX
- [ ] Add employee first-run UX
- [ ] Onboarding assignment + tracking
- [ ] Leave request flow
- [ ] Leave approval flow
- [ ] Empty-state + CTA system across loop
- [ ] 8 instrumentation events live
- [ ] Internal KPI / funnel view

Success metric: time-to-first-employee <5 min, time-to-first-approval <30 min.

---

### Phase 3 — Tenant Safety (Days 7–10)
- [ ] RLS audit per table (documented)
- [ ] Deny-by-default policies enforced
- [ ] Cross-tenant negative test suite
- [ ] Service-role usage inventory
- [ ] Service-role boundary tests
- [ ] CI gate for tenant safety tests
- [ ] Core Loop audit logging
- [ ] CSV export (trust layer)

Success metric: zero cross-tenant access possible via tests.

---

### Phase 4 — Commercial Activation (Days 11–14)
- [ ] Pricing page live (Starter / Growth / Scale)
- [ ] Migration narrative landing page (Notion/Sheets → TeamFrame)
- [ ] ICP outbound list (100 startups, 6–25 employees)
- [ ] 3-message outbound sequence
- [ ] Onboarding template pack
- [ ] Public security / privacy page
- [ ] 10 qualified conversations booked
- [ ] 3 trial signups
- [ ] 1 paid conversion in motion

Success metric: first repeatable conversion pipeline.

---

## Daily Discipline

1. Start each day by checking the active Phase column on the GitHub Project board.
2. Move issues across columns the moment status changes.
3. Close each day by ticking boxes in this file and pushing.
4. If a task is not on the board or in this file → it does not exist this sprint.

---

## Definition of Done (Day 14)

- Core Loop completes end-to-end in <30 minutes for a new admin
- No surface shows unfinished functionality
- RLS invariants enforced and tested in CI
- All 8 instrumentation events firing
- Pricing page live; outbound running; ≥3 trials; ≥1 paid conversion in motion
- Repo on `main` reflects only what is real and shippable
