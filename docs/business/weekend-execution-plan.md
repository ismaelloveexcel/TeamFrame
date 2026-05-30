# TeamFrame — Weekend Execution Plan

**Dates:** Friday 30 May (evening prep) → Sunday 1 June 2026 (Sun evening close)
**Orchestrator:** Copilot (this agent)
**Founder availability:** 2–3 check-in windows per day for unblocks + PR approvals
**Co-equal goals:**
1. Ship pivot cleanup + Slice 1 (Missing Contract) + Slice 2 (Expiring Document) — both real, working, no mocks (Hard Rule 1)
2. Produce go-to-market assets: positioning one-pager, demo screenshots, outreach email template

**Status:** APPROVED — execution started Sat 30 May 2026.

## Priority filter (overrides all other considerations)

Every decision this weekend is filtered through one question:

> **"Will this help us acquire, demo, or convert customers?"**

If a trade-off appears between adding a feature and making the product easier to explain / demo / sell, the latter wins. No exceptions. This is a hard rule, not a guideline.

**Concretely:**
- If a signal type doesn't show well on a demo, defer it.
- If polish on the dashboard makes the screenshot look more credible, that beats a third signal.
- If a piece of copy needs to be founder-readable for the one-pager, that beats engineering elegance.
- Hard Rule 1 ("no mocks, ship real") still applies. GTM polish does not mean fake.

By Monday morning, TeamFrame must be in a state where Ismael can confidently begin outreach. The product, the screenshots, the one-pager, the outreach email, and the landing page must all support a 2-minute demo and a founder conversation.

---

## Default decisions confirmed (founder approved)

- Naming: keep DB table `employees`, rename in code/UX where founder-facing.
- `employee_profiles.sql` + `procedures.sql` + `audits/` markdown: I inspect and decide.
- External agents: GitHub Copilot coding agent (free with sub), Codex Cloud (cap $20), no v0.
- Pairing mode: 2–3 check-in windows per day, not full pairing.

---

## Friday evening prep (2 hours, you + me, 8pm–10pm)

This is the prep that makes the weekend actually work. Skip it and we lose Saturday morning to setup.

### What you do (45 min)

1. **Install / verify VS Code extensions** (15 min). List below in §VS Code Upgrades.
2. **Sign into Codex Cloud or equivalent** (10 min). I'll point you at the right link based on which you pick.
3. **Authorise GitHub Copilot coding agent** on the TeamFrame repo (5 min).
4. **Create a `weekend-pivot` GitHub milestone** with the 4 waves as issues (10 min, I'll generate the issue bodies).
5. **Approve `pivot-deletion-list.md` and `signal-rules.md`** (5 min — you've already read them).

### What I do in parallel (2 hours)

1. Generate the 4 wave issues with detailed acceptance criteria + file-ownership boundaries.
2. Set up parallel branch strategy + branch protection adjustments so subagents don't collide.
3. Draft the Friday-night-only PR: rename existing branches that conflict, archive old sprint tracker doc, ensure `main` is clean.
4. Pre-write the test scaffolding for Slice 1 so Saturday morning starts with green tests.

**End of Friday state:** clean `main`, 4 issues live, all tooling authorised, both docs approved.

---

## Wave plan (Saturday + Sunday)

Each wave has: a primary agent (Copilot CLI subagent or GitHub Copilot coding agent), a no-conflict file scope, a definition of done, and a check-in window where I need 5 minutes of you.

### Wave 1 — Pivot Cleanup (Sat 8am–12pm, 4hr)

**Agent:** I drive this directly (too cross-cutting for a subagent — risks deleting wrong things).

**Scope (from `pivot-deletion-list.md`):**
- Delete: `app/org-chart/`, `app/me/`, `components/OrgChart/`, `schemas/company_updates.sql`, non-admin branch in `app/employees/page.tsx`
- Stub: `app/dashboard/page.tsx` becomes a placeholder linking to "Coming Saturday afternoon"
- Stub: `app/employees/page.tsx` admin view loses schema-visibility + limited-telemetry panels
- Single migration adding: `lifecycle_state`, `start_date`, `end_date`, `country` to `employees`; `expires_at`, `document_type`, `signed_at`, `subject_person_id` to `documents`
- Delete tests covering removed surfaces; keep the cross-tenant test framework
- New empty schemas committed: `risk_signals.sql`, `action_items.sql`

**Definition of done:**
- `npm run lint && npm test && npm run build` all pass on `main`
- App loads, you can sign in, you see placeholder dashboard, no broken links
- New schema columns exist in DB

**Check-in #1 (12pm Sat, 10 min):** I show you the cleaned app in browser. You confirm "nothing important deleted." I merge the pivot PR.

---

### Wave 2 — Slice 1: Missing Contract — Backend (Sat 12pm–6pm, 6hr)

**Agent:** GitHub Copilot coding agent, assigned to issue `slice-1-missing-contract-backend`.

**Scope (file ownership — these files only):**
- `services/signalEngine/missingContract.ts` (new)
- `services/signalEngine/index.ts` (new — generic signal runner)
- `services/documentService/` (extend — add document_type, signed_at handling)
- `schemas/risk_signals.sql` (populate)
- `schemas/action_items.sql` (populate)
- Tests for above

**Acceptance criteria (must pass before PR merges):**
- Creating an employee with no contract document generates a `missing_contract` signal with correct severity (yellow if preboarding 7+ days, red otherwise — per `signal-rules.md` Rule 1)
- Uploading a signed contract clears the signal
- Audit log records signal creation + resolution
- Unit tests cover all severity transitions
- Multi-tenant isolation test passes (signals don't leak across tenants)

**Check-in #2 (6pm Sat, 15 min):** I walk you through the backend behaviour in a terminal demo (creating a person, signal appears in DB, uploading contract, signal clears). You approve. I merge.

---

### Wave 3 — Slice 1: Risk Dashboard UI + Slice 2 backend (Sun 8am–2pm, 6hr in parallel)

Two streams running simultaneously.

#### Stream A — Risk Dashboard UI (I drive directly, 6hr)

This is the primary surface. Too important to delegate.

**Scope:**
- `app/dashboard/page.tsx` (full rewrite as Risk Dashboard)
- `app/dashboard/RiskCard.tsx` (new component)
- `app/dashboard/SignalSection.tsx` (new — Red/Yellow/Green lane)
- `app/dashboard/actions.ts` (Fix-This server actions)
- Loading + empty states (Hard Rule 1 — empty state must say something useful, not "no signals")

**Acceptance criteria:**
- Three-lane layout: RED, YELLOW, GREEN
- Each signal renders as a card with: subject person, plain-language explanation, recommended action, Fix-This button
- Fix-This button for missing contract opens document upload flow
- Empty state ("no risks detected") includes a "looking good" message with last-checked timestamp + 2–3 example signals the system is watching for, so a demo viewer immediately understands what the product does
- Works on mobile (founders will demo on phones)

#### Stream B — Slice 2: Expiring Document backend (Copilot coding agent, 4hr)

**Scope (file ownership):**
- `services/signalEngine/expiringDocument.ts` (new)
- `services/signalEngine/scheduledRunner.ts` (new — for the periodic check)
- `services/documentService/` (extend — expiry windows by type)
- Tests

**Acceptance criteria:**
- A document with `expires_at` within the type-specific yellow window generates `expiring_document` signal
- A document past `expires_at` generates `expired_document` signal
- Replacing the document with a future expiry clears the signal
- Multi-tenant isolation test passes

**Check-in #3 (2pm Sun, 15 min):** I show you the Risk Dashboard in browser with real signals from both slices. You approve. I merge both PRs.

---

### Wave 4 — GTM assets + polish (Sun 2pm–8pm, 6hr)

This is the new wave added by your latest message. Without this, the product is invisible.

#### 4A — Demo seed script (1hr, I drive)
A `scripts/seed-demo.mjs` that creates a realistic 12-person UAE tech startup with:
- 8 active employees (mix of full-time + contractors, mix of UAE/EU)
- 1 preboarding employee with no contract (generates yellow `missing_contract`)
- 1 active employee with expired Emirates ID (red `expired_document`)
- 1 active employee with passport expiring in 45 days (yellow `expiring_document`)
- 1 employee in offboarding state (sets up Slice 3 if we get there)

Result: you can `npm run seed:demo` any time and have a believable populated dashboard for screenshots/demos.

#### 4B — Screenshots for outreach (1hr, I drive)
Use the demo data to capture 5 screenshots:
1. The Risk Dashboard with red + yellow + green lanes populated — the "hero shot"
2. A close-up of a single red signal card with the Fix-This action
3. The contract upload modal mid-resolution
4. The Risk Dashboard after Fix-This — signal moved from Red to Green with timestamp
5. The empty-but-watching state ("you have no risks — here's what we're monitoring")

Stored in `docs/marketing/screenshots/`.

#### 4C — Positioning one-pager (1hr, I draft, you edit)
`docs/marketing/one-pager.md`:
- Headline (your sharper version: "TeamFrame does more than manage your people — it prevents your people-ops from breaking")
- Sub-headline (who it's for, what it does, why it's different)
- The 3 signals that ship today with screenshots
- Founder-built credibility line
- Pricing placeholder (TBD pending packaging tier decision)
- One CTA: "Reply to this email to set up a 15-minute call"

Single-page Markdown that converts cleanly to PDF or LinkedIn post.

#### 4D — Outreach email template (30min, I draft)
`docs/marketing/outreach-email.md`:
- Two variants: warm (your network) and cold (LinkedIn outbound)
- Subject lines for each
- Bodies under 120 words
- Specific opener that references the prospect's company stage (5–20 people)

#### 4E — Landing-page hero update (1hr, I drive)
Update `app/page.tsx` with the new headline + sub-headline + a single screenshot of the dashboard + one CTA ("Get a demo"). Stops being a "calm directory" page. Still minimal — full marketing site is a later weekend.

#### 4F — Polish pass on the dashboard (30min, I drive)
- Final copy review on every visible string
- Make sure nothing engineering-shaped is visible (no "schema visibility", no console errors, no broken images)
- Mobile check
- Demo recording: 2-minute Loom-style screen recording you can attach to outreach emails (you record on Sun evening from a quiet room — I write the script)

**Check-in #4 (8pm Sun, 30 min):** Sit together (virtually). Walk through:
- The product (you click Fix-This on a real signal)
- The one-pager
- The outreach email
- The screenshots
You record the 2-minute demo. We close the weekend.

---

## End-of-weekend state

By Sunday 8pm you have:

**Product:**
- Working pivot to FPORS model
- Risk Dashboard live with 2 real signal types
- 12-person demo company you can show any prospect on 10 seconds' notice
- All real, no mocks, no demos-only paths

**GTM kit ready to use Monday morning:**
- One-pager (PDF + Markdown)
- 2 outreach email templates (warm + cold)
- 5 screenshots
- 2-minute demo video
- Updated landing page headline

**Build foundation for next weekend:**
- Signal engine pattern proven — Slice 3 (Incomplete Offboarding) takes 4 hours not a week
- Schema/services aligned to blueprint
- Cleanup debt at zero

---

## What we explicitly do NOT do this weekend

- Slice 3 (Incomplete Offboarding) — defer to next weekend
- Country packs (UAE/EU) — defer to next weekend
- Self-signup + Stripe + DPA — defer to weekend after that
- Full marketing website — defer
- Onboarding Readiness redesign — defer
- Notifications system — defer
- Customer-zero Q1 + Q4 answers — they're your homework during the week, not weekend work

---

## Rollback plan

Each wave merges as its own PR. If a wave breaks something fundamental:

- **Wave 1 (pivot) breaks:** revert PR, weekend cancelled, debug Monday. Highest blast radius — that's why I drive it.
- **Wave 2 (Slice 1 backend) breaks:** revert PR, fall back to Wave 3 Stream A only (dashboard with stubbed signals — violates Hard Rule 1 so we'd skip Wave 3 entirely and use Sunday for Slice 1 retry).
- **Wave 3 Stream B (Slice 2 backend) breaks:** ship with Slice 1 only. Still a valid weekend outcome.
- **Wave 4 (GTM) breaks:** unlikely — it's mostly markdown + screenshots. Worst case, screenshots get retaken Monday.

CI gates on every PR. Nothing merges to `main` without lint + test + build green.

---

## VS Code & tooling upgrades (install Friday evening)

Current setup is fine but missing accelerators. Install in order of impact:

### Must-install (15 min total)

1. **GitHub Copilot coding agent** — already have Copilot, just need to enable the cloud agent in repo settings. Lets us delegate Wave 2 + Wave 3 Stream B in parallel.
2. **GitLens** (you have GitKraken MCP — even better, no install needed). Skip if you already use the GitKraken extension.
3. **Error Lens** — inline error display. Cuts debug time materially.
4. **Pretty TypeScript Errors** — readable TS errors instead of nested-generic walls of text.

### Recommended (10 min)

5. **Tailwind CSS IntelliSense** — autocomplete for the Tailwind classes used in the dashboard rewrite.
6. **Vitest extension** — run tests inline from the editor. Faster than terminal.
7. **PostgreSQL extension (cweijan)** — query Supabase directly from VS Code. Useful for demo data work.

### Optional / nice-to-have (5 min)

8. **Mermaid Preview** — for blueprint diagrams later.
9. **Markdown All in One** — for the GTM markdown work.

### What you're already using well

- Copilot Chat (the conversation we're having)
- Pylance (for Python in other repos)
- GitKraken MCP
- Multiple memory scopes

### What you're underusing

- **`@workspace` queries in Copilot Chat** — instead of asking me to search, you can use `@workspace where is X defined` and get instant answers without my latency.
- **Slash commands like `/explain`, `/tests`, `/doc`** — useful for the moments I'm not on. You can self-serve.
- **`#file` references in chat** — pin specific files for follow-up questions.

### Beyond VS Code

- **Claude Opus 4.7 for everything is overkill for some tasks.** Strategic conversations (like this weekend planning) — Opus. Routine code generation — Copilot's faster, cheaper, in-editor model is fine. Use the right tool for the task.
- **Codex Cloud (or equivalent autonomous agent)** — lets you say "go finish Slice 2 backend" and walk away. Worth the $20 if you want to be hands-off Sunday morning.

---

## Pre-execution checklist (sign-off gate)

Before I touch `main` on Friday evening, confirm:

- [ ] Weekend dates correct (Sat 31 May + Sun 1 June 2026)
- [ ] Check-in windows OK (12pm Sat, 6pm Sat, 2pm Sun, 8pm Sun — adjust to your timezone)
- [ ] Codex Cloud cap of $20 OK
- [ ] OK to delete `/org-chart`, `/me`, non-admin `/employees`, `company_updates.sql`
- [ ] OK to reorder Sunday to ship GTM kit instead of Slice 3
- [ ] Friday 8pm–10pm available for prep
- [ ] OK for me to author one-pager + outreach email drafts (you'll edit, not me write final copy)
- [ ] OK to update landing page hero this weekend

Sign off with "yes, execute" and I start Friday 8pm.

Edits or pushback welcome — better to argue now than mid-wave Saturday.
