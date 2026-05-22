# TeamFrame — Cursor Rules
# Version 2.1 | Updated 2026-05-22

---

## 0. PHASE GATE — READ THIS FIRST

TeamFrame uses a phase-based development model. **Do not build anything from a later phase while the current phase is unstable.**

### Phase 1 — Foundation (current)
Status: 🔴 In progress — do not expand until this is stable

All 7 modules must be working, tested, and not crashing before any Phase 2 work begins:
- [ ] Employee Directory
- [ ] Org Chart
- [ ] Onboarding Document Uploads
- [ ] Leave Requests (submit / approve / reject)
- [ ] Company Announcements
- [ ] AI CV-to-Bio (`generateBio`)
- [ ] AI Contract Template Generation (`generateContract`)
- [ ] Dashboard (4 widgets: active employees, pending leaves, latest joiners, latest announcements)

**Phase 1 is stable when:** All modules load without errors, RBAC is enforced on every write, RLS policies are in place on every table, and no module breaks when another is used concurrently.

### Phase 2 — Planned (do not start yet)
- Policies & Procedures library (upload, categorise, employee acknowledgement)
- Notification preferences (in-app only, no external infra yet)
- Basic reporting (headcount over time, leave summary)

### Phase 3 — Future (do not plan or scaffold yet)
- Payroll integrations (read-only)
- E-signature for contracts
- Compliance tracking
- Multi-tenant / SaaS billing

### Rule
If a request is for Phase 2 or later, stop and say:
> "Phase 1 isn't marked stable yet. Should we finish and stabilise Phase 1 first, or are you explicitly unlocking Phase 2?"

This prevents the pattern of adding new features on top of unstable foundations — which is how projects get scrapped.

---

## 1. PHASE 1 SCOPE — WHAT TO BUILD NOW

### Modules in scope
- Employee Directory (CRUD, profile fields, avatar upload)
- Org Chart (visual hierarchy from DB relationships)
- Onboarding Document Uploads (file storage via Supabase Storage)
- Leave Requests — minimal: submit, approve/reject, view status
- Company Announcements (post, list, pin)
- AI CV-to-Bio: `generateBio(cvText: string): string`
- AI Contract Template Generation: `generateContract(employeeData: EmployeeData): string`
- Dashboard: active employee count, pending leaves, latest joiners, latest announcements

### Deferred to Phase 2+ (not blocked forever — just not yet)
- Policies & Procedures → Phase 2
- Notifications → Phase 2
- Reporting / analytics → Phase 2
- Payroll → Phase 3
- E-signature → Phase 3
- Compliance automation → Phase 3
- AI HR advisor / chat → Phase 3
- Multi-tenant billing → Phase 3

**If asked to build something from Phase 2+, apply the Phase Gate check (Section 0) first.**

---

## 2. ARCHITECTURE — NON-NEGOTIABLE

### Stack
- Next.js App Router (TypeScript, strict mode)
- Supabase (Postgres, Auth, Storage, RLS)
- pnpm workspaces / Turborepo (if monorepo)
- Tailwind CSS
- Lemon Squeezy (payments, if added later — use shared package)

### Data flow — always this, never shortcut
```
Frontend Component
  → Server Action / API Route
  → RBAC check (server-side, always)
  → Service layer
  → Supabase client
  → Database
```

**Never call Supabase directly from client components.** Always go through a server action or API route.

### RBAC rules
- Roles: `owner`, `admin`, `employee`
- Every write operation checks role before executing
- RLS policies must match the server-side checks — they are the last line of defense
- Never use `service_role` key on the frontend

### AI constraints
- Only 2 AI functions are allowed in Phase 1:
  - `generateBio(cvText: string): string` — CV text in, bio paragraph out
  - `generateContract(employeeData: EmployeeData): string` — structured data in, contract markdown out
- No streaming, no chat UI, no AI-powered search
- Both functions call a `/api/ai/*` route, never call OpenAI/Anthropic directly from components

---

## 3. AUTONOMY — DO NOT WAIT FOR MANUAL REVIEW

Cursor must operate autonomously. Do not pause and say "review this with ChatGPT" or "check this manually." Complete the full task.

### Before writing code — check these yourself
1. **Supabase MCP**: Read the current schema. Never assume — always read it.
2. **GitHub MCP**: Check the latest commit on `main` before starting.
3. **Figma MCP**: If the task involves UI, fetch the relevant frame before writing components.

### After writing code — self-audit before marking done

#### TypeScript
- [ ] No `any` types — use proper interfaces or `unknown` with type guards
- [ ] All async functions have explicit return types
- [ ] No implicit `undefined` — use optional chaining and nullish coalescing

#### Security
- [ ] Every Server Action has RBAC check at the top
- [ ] RLS policy exists for every new table (verify via Supabase MCP)
- [ ] No secrets or tokens in client-side code
- [ ] No `dangerouslySetInnerHTML` unless content is sanitized

#### Database
- [ ] New tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Migrations use `IF NOT EXISTS` for idempotency
- [ ] Foreign keys have proper `ON DELETE` behavior defined
- [ ] Indexes on columns used in WHERE clauses

#### Error handling
- [ ] All Server Actions return `{ data, error }` shape — never throw raw errors to client
- [ ] Loading and error states handled in UI
- [ ] File uploads validate type and size before hitting storage

#### Accessibility
- [ ] Interactive elements have `aria-label` if no visible text
- [ ] Form inputs have associated `<label>` elements
- [ ] Images have `alt` text

#### Scope check
- [ ] Nothing built is outside Phase 1 scope (re-read Section 1 if unsure)

---

## 4. BROWSER USAGE — USE PLAYWRIGHT MCP AUTONOMOUSLY

When a task requires checking a live URL, reading a rendered page, or debugging a UI issue, use the Playwright MCP tools directly. Do not ask the user to check it manually.

- `playwright_navigate` → open `http://localhost:3000` to check current app state
- `playwright_screenshot` → capture UI to verify against Figma design
- `playwright_click` / `playwright_fill` → test forms and interactions
- Use after every UI change — don't ship without visual verification

---

## 5. FIGMA MCP — READ DESIGNS BEFORE BUILDING UI

Always fetch the Figma design before writing components. Figma is the source of truth. Code follows Figma.

---

## 6. SUPABASE MCP — READ SCHEMA, WRITE MIGRATIONS

Never hardcode column names or assume table structure. Always check first.

Migration conventions:
- Location: `supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Always idempotent: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Include RLS enable + policies in the same migration file as the table

---

## 7. GITHUB MCP — USE FOR COMMITS AND PRs

Commit message format: `feat(scope): description` | `fix(scope): description` | `chore: description`

---

## 8. NOTION MCP — CHECK API VAULT FIRST

Before asking for any API key: search Notion vault by service name. Only ask the user if not found.

---

## 9. TASK EXECUTION RULES

### Starting a task
1. Read relevant files via GitHub MCP
2. Check Supabase schema if DB is involved
3. Fetch Figma frame if UI is involved
4. Plan the change in 3-5 bullet points before writing code

### Finishing a task
1. Run full self-audit checklist
2. Use Playwright MCP to visually verify if UI was changed
3. Commit via GitHub MCP with a descriptive message
4. Report back: files changed + any follow-up needed

---

## 10. ANTI-PATTERNS

- Never suggest features outside Phase 1 without checking the phase gate
- Never create new abstractions unless 3+ files need them
- Never install a package without checking if the functionality exists in the current stack
- Never skip the RBAC check because "it's just a GET request"
- Never leave a `TODO` comment — implement now or create a GitHub issue
- Never use `console.log` in production code
- Never ask the user to manually verify something you can check with a tool
