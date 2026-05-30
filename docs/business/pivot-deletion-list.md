# TeamFrame — Pivot Deletion List

**Status:** Draft v1. Awaiting founder sign-off before any code is deleted.
**Context:** `blueprint-locked.md` Hard Rule 5 — *"Existing codebase pivots, not extends. Surfaces that don't fit the new model are deleted, not preserved."*
**Purpose:** Map every existing surface in the codebase to one of three fates: **KEEP** / **REPURPOSE** / **DELETE**.
**Outcome:** A clean codebase aligned with the FPORS object model, ready for Slice 1.

---

## Decision rule

Each surface is judged against three filters from the blueprint:

1. **Object model fit (§5):** does it touch one of the 10 closed-set objects?
2. **Signal/action mapping (§4):** does it produce a signal, resolve a signal, or render dashboard state?
3. **Founder-not-HR (Hard Rule 2):** does a founder of a 5–20 person team need this surface?

Fail any filter → DELETE or REPURPOSE.

---

## App routes (`app/`)

| Route | Current purpose | Filter check | Fate | Reasoning |
|---|---|---|---|---|
| `/` | Marketing landing | n/a (public) | **REPURPOSE** | Replace copy/CTA to match new positioning ("more than manage your people — prevents people-ops from breaking"). Keep structure. Defer until Slice 8 (commercial layer). |
| `/auth` | Magic-link sign-in | n/a (auth) | **KEEP** | No change. Already solid. |
| `/auth/check-email` | "Link sent" page | n/a (auth) | **KEEP** | Minor copy tweak only. |
| `/auth/callback` | OAuth callback | n/a (auth) | **KEEP** | No change. |
| `/dashboard` | Admin home with activity timeline, first-run guide, manager action center, stats grid | Fails filter 2 (renders state, doesn't surface signals) and partially filter 3 (manager-centric, not risk-centric) | **DELETE & REPLACE** | This is the most important deletion. The current dashboard is HR-shaped (queues, recent activity). The new Risk Dashboard (blueprint §10B) is fundamentally different: Red/Yellow/Green signal lanes with Fix-This actions. Rebuild from scratch in Slice 1. Do not preserve any current components. |
| `/employees` (admin view) | CRUD employees, invite states, schema visibility panel | Partially passes filter 1 (Person + Employment objects) | **REPURPOSE** | Becomes the Team Roster (blueprint §10A — backend view, not primary surface). Strip: schema visibility panel, limited-telemetry banner, invite-state UX (move to a simpler "Invite" action on each person row). Add: lifecycle state (preboarding/active/on_leave/offboarding/exited) as a visible field. |
| `/employees` (non-admin view) | Org chart for employees | Fails filter 3 (employee-facing, not founder-facing) | **DELETE** | Employees are not TeamFrame's user. Founder is. Remove the non-admin branch entirely. |
| `/org-chart` | Standalone org chart route | Fails filter 1 (not in object model) and filter 3 | **DELETE** | Org chart is a visualisation, not a signal/action. Out of scope for FPORS v1. Delete route + `components/OrgChart/` directory. |
| `/onboarding` | Admin task assignment + employee task view | Partially passes filter 1 (touches Person + ActionItem) | **REPURPOSE** | Becomes Onboarding Readiness (blueprint §10C — checklist-driven). Strip: free-form task assignment (title-only is too thin), employee-facing completion view. Add: checklist templates per country pack, missing-document detection, signal generation. Rebuild substantially in a later slice (not Slice 1). |
| `/leaves` | Admin approval queue + employee request view | Passes filter 1 (LeaveRequest object) | **KEEP, SLIM** | Minimal scope per blueprint §10H. Strip: employee-facing leave history page (`/me` removal absorbs this). Keep: admin approval queue, leave conflict detection feeding signals (Phase 2 signal). Defer all enhancements until Phase 2. |
| `/me` | Employee self-service portal (onboarding tasks + leave + profile) | Fails filter 3 (employee-facing) | **DELETE** | TeamFrame is a founder tool, not an employee portal. Employees interact with the founder, not the system. If a Phase 2 customer demands employee self-service, revisit then. |
| `/api/*` | API routes | n/a | **AUDIT** | Walk each route, delete any that exclusively serves `/me`, `/org-chart`, or non-admin `/employees`. List below once each is enumerated. |

---

## Components (`components/`)

| Component | Used by | Fate | Reasoning |
|---|---|---|---|
| `ConfirmSubmitButton.tsx` | `/leaves` reject action | **KEEP** | Generic, useful in future Fix-This destructive actions. |
| `PendingSubmitButton.tsx` | Multiple forms | **KEEP** | Generic, useful everywhere. |
| `OrgChart/` (directory) | `/org-chart`, non-admin `/employees` | **DELETE** | No surface uses it after pivot. |

---

## Services (`services/`)

| Service | Fate | Reasoning |
|---|---|---|
| `activationService/` | **KEEP** | Underpins auth flow + first-run experience. Still needed. |
| `documentService/` | **KEEP, EXPAND** | Becomes central to Slice 1 (Missing Contract) and Slice 2 (Expiring Document). Add: `expires_at` field, document type taxonomy, signal generation hooks. |
| `employeeService/` | **REPURPOSE** | Rename internally to `personEmploymentService/` (or split into `personService/` + `employmentService/`) to match the new object model. Add: lifecycle state transitions. |
| `leaveService/` | **KEEP** | Minimal scope. No expansion until Phase 2 (leave conflict signal). |
| `onboardingService/` | **REPURPOSE** | Becomes `onboardingReadinessService/` and `offboardingReadinessService/`. Current free-form task model is replaced by template-driven checklist. Substantial rewrite in a later slice. |

---

## Schemas (`schemas/`)

| Schema file | Fate | Reasoning |
|---|---|---|
| `companies.sql` | **KEEP** | Tenant boundary. |
| `employees.sql` | **REPURPOSE** | Rename to `persons.sql` (or keep filename and rename table) to match object model. Add: `lifecycle_state`, `start_date`, `end_date`, `country`. Migration required. |
| `employee_profiles.sql` | **REVIEW** | If it's storing employee-facing profile data (photo, bio), DELETE. If it's storing employment metadata, fold into `employments` table. |
| `compensation.sql` | **KEEP** | Feeds Finance Handoff Export. May need shape changes. |
| `documents.sql` | **KEEP, EXPAND** | Add: `expires_at`, `document_type` enum, `signed_at`, `subject_person_id` link. |
| `policies.sql` | **KEEP** | Used in Phase 2 (unacknowledged policy signal). No changes in v1. |
| `acknowledgements.sql` | **KEEP** | Used in Phase 2. No changes in v1. |
| `procedures.sql` | **REVIEW** | Unclear what this models. If it overlaps with policies/onboarding, fold in. Likely DELETE. |
| `onboarding_tasks.sql` | **REPURPOSE** | Becomes `readiness_checklist_items.sql` or similar. Schema changes to support templates + completion + skip-with-reason. |
| `leaves.sql` | **KEEP** | Minimal scope, no changes in v1. |
| `audit_logs.sql` | **KEEP, EXPAND** | Add: `signal_id` link, `action_item_id` link, `trigger_reason` field for signal-driven entries. |
| `analytics_events.sql` | **KEEP** | Telemetry layer. Update event names to match new object model in Slice 1. |
| `company_updates.sql` | **DELETE** | Parked feature (per 14-day-sprint-tracker). Not in object model. Drop the schema file and the table. |
| `tenancy_rls.sql` | **KEEP** | Critical security layer. No changes. |

**New schemas needed (created during slice work, not now):**
- `risk_signals.sql` — the RiskSignal object (Slice 1)
- `action_items.sql` — the ActionItem object (Slice 1)
- `assets.sql` — the Asset object (Slice 3)
- `employments.sql` — separate from persons (Slice 1 if splitting, otherwise stays inside persons)

---

## Scripts (`scripts/`)

| Script | Fate | Reasoning |
|---|---|---|
| `seed-admin.mjs` | **KEEP** | Needed until self-signup ships. |
| `apply-schemas.mjs` | **KEEP** | Schema migration tool. |
| `reset-and-apply.mjs` | **KEEP** | Dev convenience. |
| `schema-order.mjs` | **KEEP** | Dependency ordering for schemas. |
| `force-create-admin.mjs` | **KEEP** | Dev convenience. |
| `gen-magic-link.mjs` | **KEEP** | Dev convenience. |
| `inspect-db.mjs` | **KEEP** | Dev convenience. |
| `setup-storage.mjs` | **KEEP** | Storage bucket bootstrap. |
| `smoke-core-loop.mjs` | **REWRITE** | Current "core loop" is the old HR loop (add employee → assign onboarding → request leave → approve). Rewrite to test the new core loop: create person → upload document → signal generated → action resolved → audit log entry. |
| `validate-env.mjs` | **KEEP** | Env validation. |

---

## Docs (`docs/`)

| Doc | Fate | Reasoning |
|---|---|---|
| `architecture.md` | **REWRITE** | Reflects old HR-system architecture. Rewrite to describe the signal engine + object model. Defer until after Slice 1 ships so the rewrite reflects actual implementation. |
| `auth-rules.md` | **KEEP** | Auth unchanged. |
| `rbac-rules.md` | **KEEP** | RBAC unchanged. |
| `ai-boundaries.md` | **REVIEW** | If it references removed AI features (generateBio, generateContract — already deleted in Phase 1), update to reflect "no AI in v1" boundary. |
| `14-day-sprint-tracker.md` | **ARCHIVE** | Superseded by `blueprint-locked.md`. Move to `docs/archive/` for history. |
| `audits/` | **KEEP** | Historical audit reports. |
| `launch/` | **REVIEW** | Update or replace once commercial layer (Slice 8) is in flight. |

---

## Execution plan

This is the sequence to execute the pivot. **Do not run any of these steps without explicit founder sign-off on this list.**

1. **Sign-off** (founder reviews this doc, edits, approves)
2. **Branch** — single PR `pivot/fpors-cleanup`
3. **Delete in this order** (least risky first):
   1. `app/org-chart/` route
   2. `components/OrgChart/` directory
   3. `app/me/` route + associated API routes
   4. Non-admin branch in `app/employees/page.tsx`
   5. `schemas/company_updates.sql` + drop the table
4. **Repurpose stubs** — for routes flagged REPURPOSE, replace their current contents with a placeholder page that says "Coming in [Slice N]" and routes to `/dashboard` (which itself will be a placeholder until Slice 1 ships the Risk Dashboard).
5. **Schema renames + new columns** — single migration adding `lifecycle_state`, `start_date`, `end_date`, `country` to persons; `expires_at`, `document_type`, `signed_at`, `subject_person_id` to documents.
6. **Tests** — delete cross-tenant-isolation tests that cover deleted surfaces. Keep the framework, retest after Slice 1.
7. **Merge** — squash, delete branch, tag release as `v0.0.0-pivot`.

Estimated effort: **1.5–2 days**. This is the cleanup before Slice 1, not slice work itself.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Deleting `/me` removes a route a future customer expects | Acceptable. Customer-zero is founder, not employee. Document that "employee portal" is a Phase 2 decision. |
| Renaming `employees` → `persons` breaks every existing reference | Do it in one migration with explicit search-and-replace. Don't dribble it across slices. |
| Schema migration breaks existing seeded data | Use a destructive reset for dev (existing `reset-and-apply.mjs`). Production has no data yet (no paying customers). |
| Loss of activity timeline removes a "looks operational" feature | Replaced by the Risk Dashboard. New dashboard is a stronger signal of product working, not weaker. |
| Loss of org chart removes the only visualisation surface | Confirmed not in scope. Founders of 5–20 person teams know who works for them; they don't need a visualisation. |

---

## Open questions for founder

These don't block the deletion but should be answered before some of the renames land:

- [ ] **Persons vs Employees naming:** keep table name `employees` (less churn) or rename to `persons` (matches object model)? Recommendation: keep table name, rename only in code/UX where founder-facing.
- [ ] **`employee_profiles.sql`:** what does it actually store? Decides whether it's deleted or folded in.
- [ ] **`procedures.sql`:** what does it model? Decides keep or delete.
- [ ] **Existing `audits/` markdown files:** any of them blocked by pivot work, or all historical?

---

## Sign-off

- [ ] Founder approves deletion list
- [ ] Founder answers open questions above
- [ ] PR `pivot/fpors-cleanup` opened and merged
- [ ] Slice 1 (Missing Contract) begins
