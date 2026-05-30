# TeamFrame Blueprint — Locked

**Status:** Locked. Do not re-debate without explicit founder approval.
**Last updated:** 2026-05-30
**Owner:** Ismael

---

## Hard rules (non-negotiable)

These rules override anything else in this document or any future suggestion.

1. **TeamFrame ships as a complete working system, not a demo.** No half-built screens. No "mocked for now" data. No "we'll wire that up later" stubs. If a surface ships, it works end-to-end with real data, real signals, and real exports.
2. **Founder, not HR.** Every decision is filtered through "does this help a founder of a 5–20 person team?" If the answer requires an HR manager to make sense of it, it doesn't ship.
3. **Signal-driven, not record-driven.** TeamFrame is a risk engine with a UI on top. Features that don't produce or resolve a signal don't ship.
4. **Hard non-goals.** TeamFrame will never become: payroll engine, ATS, performance management, EOR, legal automation, compensation system. These are deletion-on-sight in any future proposal.
5. **Existing codebase pivots, not extends.** Surfaces that don't fit the new model are deleted, not preserved.

---

## 1. Product Definition

**TeamFrame is a Founder People-Ops Risk & Readiness System (FPORS).**

It helps founders see what is missing, expiring, non-compliant, overdue, or needs action now — across their team's contracts, documents, policies, assets, and lifecycle events.

**One-line positioning:**

> TeamFrame does more than manage your people — it prevents your people operations from breaking.

**What it is not:** an HR system. It does not store performance reviews, run payroll, post jobs, or handle compensation reviews.

---

## 2. Target Customer

- **Size:** 5–20 employees
- **Stage:** founder-led or COO-led, no HR function
- **Operating model:** remote or hybrid, contractors + full-time mix, multi-country hiring (EU / UAE)
- **Current state:** managing people via spreadsheets, Notion, or email
- **Buying motivation:** reduce operational mistakes, avoid compliance surprises, gain visibility without hiring an HR person

**We are not competing with BambooHR / HiBob / Zoho.** Those tools serve 50+ employee organisations with dedicated HR. We serve the gap between "no system" and "first HR hire" — a stage those tools are too heavy and too expensive for.

### Founder authority (moat)

TeamFrame is built by an HR practitioner with 15 years of real-world experience, including:

- Currently sole HR lead at a UAE startup (Baynunah Watergeneration) — i.e. the target customer
- HR Executive at Sinyar Holding (Royal Group, Abu Dhabi)
- Payroll Supervisor at BCP Bank (Mauritius, multi-country compliance)
- HR Officer at Bramer Bank (Mauritius)
- Hands-on experience with UAE labour law, EU/Mauritius compliance, full-cycle recruitment, onboarding, offboarding, policy creation, payroll
- Has automated HR workflows using Microsoft Power Automate, Power Apps, Excel — same spreadsheet pain TeamFrame replaces

**What this means for the product:**

- Country pack rules (UAE first) are documented from real practice, not researched
- Signal thresholds (visa expiry windows, contract requirements, offboarding checklist) come from someone who has run them
- Demo objections answered with "here is how I handle that in my own team today" — not "we'll add that"
- Marketing copy line: *"Built by an HR practitioner who has run people-ops across UAE, Mauritius and global banking."* This is rare in this segment and should be used.

---

## 3. Category Positioning

**Category:** Founder People-Ops System (FPORS)

**Not:** HRIS, payroll system, ATS, EOR, performance management.

**Core promise:** prevent people-ops from breaking.

---

## 4. System Principle

TeamFrame is an **event-driven risk engine**, not a record system.

The product works through one loop:

> **Signal → Action → Resolution**

Everything else (UI, exports, dashboards) is a thin shell over this loop.

---

## 5. Core Object Model (closed set)

Only these objects exist. New objects require explicit blueprint amendment.

- Person
- Employment
- Document
- Asset
- Policy
- PolicyAcknowledgement
- LeaveRequest
- Event
- RiskSignal
- ActionItem

Every feature must map to either a Signal or an Action. No standalone modules.

---

## 6. Lifecycle State Model

- `preboarding`
- `active`
- `on_leave`
- `offboarding`
- `exited`

Used only to generate signals and actions. Not exposed as a UI workflow.

---

## 7. Signal System

The product is defined by signals, not data storage.

### MVP signals (ship in v1)

These three signals cover the three core value props and require zero external integrations:

1. **Missing contract** — Person has employment record but no signed contract document on file.
2. **Expiring document** — Any document with an `expires_at` field within the warning window (yellow) or past it (red).
3. **Incomplete offboarding** — Person in `offboarding` or `exited` state with open checklist items (asset not recovered, access not revoked, exit pack not exported).

### Phase 2 signals (defer until v1 has paying customers)

- Unacknowledged policy (requires versioning + acknowledgement records)
- Active access after exit (requires Google Workspace + GitHub integrations — defer until integration strategy is decided)
- Missing jurisdiction requirement (depends on country pack completeness)
- Leave conflict
- Unreturned asset (covered partially by Incomplete offboarding)
- Incomplete onboarding (covered partially by Missing contract for v1)

### Signal structure (mandatory fields)

Every signal must include:
- `severity` (red / yellow / green)
- `subject` (person / asset / document reference)
- `trigger_reason` (machine-readable rule id)
- `created_at`
- `explanation` (plain language, founder-readable)
- `recommended_action`
- `action_item_id` (link to ActionItem)
- `audit_log_id`

### Thresholds (must be written before any UI work)

See `docs/business/signal-rules.md` (to be authored). Without explicit numeric thresholds, the dashboard is unbuildable.

---

## 8. Action System

Every signal produces an action. Actions must be one-click where possible, always auditable, always reduce risk state.

### MVP actions
- Fix this (opens contextual resolver)
- Request document (sends to person, logs the request)
- Mark complete (manual resolution with audit reason)
- Recover asset
- Revoke access (manual checklist for v1; auto for Phase 2)
- Export pack

---

## 9. Dashboard System

Single primary surface: the Risk Dashboard.

**Three sections only:**

- **RED** — immediate compliance risk (missing legal documents, expired critical items, exited person with open access)
- **YELLOW** — upcoming expiries, pending onboarding/offboarding steps, unresolved risks within the warning window
- **GREEN** — compliant employees, completed workflows, no active risks

**Dashboard must answer three questions and nothing else:**

1. What is broken right now?
2. What will break next?
3. What needs action today?

---

## 10. Modules (strict scope)

### A. Team Roster (backend view, not primary surface)
Stores identity, employment type, role, manager, country, start/end dates. Used to feed signals.

### B. Risk Dashboard (primary product surface)
Red/yellow/green view with action cards and Fix-This CTAs.

### C. Onboarding Readiness
Checklist-driven: missing documents, policy acknowledgements, equipment, access, completion tracking.

### D. Offboarding Readiness (high-value module)
Access revocation checklist, asset recovery, contract termination steps, exit validation, final export pack.

### E. Documents
Contracts, IDs, passports, visas, certificates. With expiry tracking, missing detection, reminders, audit history.

### F. Policies
Versioning, acknowledgement tracking, compliance proof layer, exportable audit trail.

### G. Assets
Issued, returned, missing, assignment history.

### H. Leave (minimal scope)
Request / approve / calendar / balance tracking. No analytics, no optimisation. Exists primarily to power leave-conflict signals and the offboarding handover view.

### I. Export System (high-value)

Three exports:

1. **Due Diligence Pack** — contracts, IDs, policy acknowledgements, employment records, asset logs.
2. **Audit Pack** — compliance evidence export, structured employee records.
3. **Finance Handoff Export** — structured finance-ready salary dataset.

#### Finance Handoff Export (specific rules)

TeamFrame does NOT run payroll. It generates a clean dataset for the founder's accountant / payroll provider to ingest.

Fields: employee name, employment type, country, salary amount, currency, payment method reference, start date, contract status, bank/account details (if stored).

Output: CSV + finance-friendly spreadsheet format.

**Hard rule:** no payroll calculation, no payments, no tax logic.

---

## 11. Compliance Layer — Country Packs

Rule-based checklists only. No legal interpretation.

### MVP packs (ship in v1)

- **EU** — grouped pack covering common employment-record + GDPR + visa requirements across member states. Country-specific overrides via flags.
- **UAE** — single pack (mainland; free zones may need separate variants in Phase 2).

### Phase 2 jurisdictions

- **APAC pack** — Singapore is parked until at least one second APAC country can group with it. Candidates: Hong Kong, Malaysia, Australia. Trigger to build: first paying customer in any APAC country.

### Each pack defines

- Required documents per employment type
- Expiry rules (visas, work permits, certifications)
- Missing-requirement detection
- Export readiness checks

---

## 12. Hard Boundaries (do not cross)

TeamFrame must NEVER become:
- payroll engine
- ATS / recruitment tool
- performance management system
- compensation system
- EOR platform
- legal automation system

Any feature proposal that drifts into these is rejected at intake.

---

## 13. Core UX Loop

1. System detects missing / expiring / incomplete item
2. Signal is created
3. Action is generated
4. Founder clicks "Fix This"
5. System resolves or reduces risk
6. Dashboard updates instantly

---

## 14. MVP Build Slice

Build only this end-to-end loop. Every step must be real, not mocked.

1. Create person
2. Assign employment details
3. Upload documents
4. Generate signals automatically (3 MVP signals from §7)
5. Show Red/Yellow/Green dashboard
6. Execute actions
7. Export: Due Diligence Pack + Finance Handoff Export

---

## 15. Build Order (resolves "back-end never finalises")

This section addresses the recurring problem: back-end builds keep expanding and never reach "done", which pushed the founder toward a front-end-first approach.

**The fix is not "build front-end first".** A front-end without a finished engine ships either fake data (which violates Hard Rule 1) or a UI that gets rebuilt when the engine arrives. The real fix is **vertical slices with locked scope**.

### Build rule

For each MVP signal, build a complete vertical slice end-to-end before starting the next signal. A slice = schema migration + signal generator + action handler + dashboard card + export row + audit log entry + tests.

### Sequence

1. **Lock thresholds** — author `docs/business/signal-rules.md` with exact numeric thresholds for the 3 MVP signals. Without this, scope drifts. (1 day)
2. **Pivot cleanup** — delete surfaces that don't fit the new blueprint (`/org-chart`, the non-admin org chart view on `/employees`, the activity-timeline dashboard, `/me` portal). Replace with placeholders that route to the new Risk Dashboard. (1 day)
3. **Slice 1: Missing contract** — vertical, end-to-end. Person + Employment + Document objects, the signal rule, the dashboard card, the Fix-This action, the audit log entry. (1 week)
4. **Slice 2: Expiring document** — adds the scheduled job + warning window logic. Reuses the dashboard pattern from Slice 1. (3–4 days)
5. **Slice 3: Incomplete offboarding** — adds the Asset object, the offboarding checklist UI, the export pack. (1 week)
6. **Country pack: UAE** — first because it's the smaller ruleset and easier to validate end-to-end. (3–4 days)
7. **Country pack: EU** — broader, second. (1 week)
8. **Self-signup + Stripe + DPA + landing page** — without these, no money can be taken. (1 week)
9. **First 10 outbound conversations** — channel from `customer-zero.md` Q4. Iterate based on what they say.

### Why this kills the back-end-never-finalises problem

- Each slice has a **definition of done** that includes the front-end surface for that signal. The back-end cannot quietly expand because the slice ends when a founder can see and resolve the signal on the dashboard.
- No backend feature exists without a UI surface that exercises it. No UI surface exists without a real backend behind it. They ship together or not at all.
- Total v1 scope is bounded: 3 signals × ~1 week per slice + country packs + commercial layer ≈ 5–6 weeks.

---

## 16. Packaging options (decide before pricing page)

Self-serve SaaS is one path. The founder has 15 years of HR practitioner experience, which opens a hybrid model. Three tiers to keep open until customer-zero conversations point to one.

| Tier | Who it's for | What's included | Indicative price |
|---|---|---|---|
| **Self-serve (tool only)** | Founders who already have HR knowledge or are confident DIY | Software, country packs, default templates | £6–12/seat/month |
| **Founder Setup (one-off)** | Founders who want it done right but no ongoing help | Tool + founder personally onboards them in 1–2 weeks: loads team, configures country pack, writes first 5 policies, sets up offboarding checklist | £1,500–3,000 one-off + tool subscription |
| **Fractional HR (ongoing)** | Founders who realise they need an HR person but can't afford a full hire | Tool + 4–8 hours/month founder time on complex cases (terminations, disputes, hiring policy, performance issues) | £800–2,000/month including tool |

### Why the hybrid model accelerates path to £10k MRR

- Pure SaaS: 80–100 customers at £100/mo to reach £10k MRR
- 5 Founder Setup × £2k one-off = £10k cash up front + recurring tool subs to fund the build
- 3 Fractional HR × £1,500/mo = £4,500 MRR with high stickiness
- Mix of all three reaches £10k MRR materially faster than pure self-serve

### Risk to manage

Services don't scale linearly. If pursued, the plan must include a **taper**: raise services prices over 12 months as self-serve adoption grows, so services revenue funds the build *and then steps down*. Without a taper plan, you build a consultancy with a SaaS attached, not a SaaS with services attached. Different business, different valuation, different exit.

### Decision trigger

Pick a tier (or combination) once `customer-zero.md` Q1 (target customer) and Q4 (distribution channel) are answered. Not before.

---

## 17. Open decisions (block the build)

These must be answered before Slice 1 starts:

- [ ] **Distribution channel** (`customer-zero.md` Q4) — who hears about TeamFrame first?
- [ ] **Finance handoff validation** — has one real founder + one real finance person confirmed the export format would save them time?
- [ ] **Signal thresholds** — `signal-rules.md` authored.
- [ ] **Pivot deletion list** — explicit list of routes/components to delete.

---

## 18. Locked status

This blueprint is locked. Changes require:
- explicit founder approval
- a written reason that doesn't violate Hard Rules 1–5
- a re-ordering of the build sequence (§15) if scope changes
