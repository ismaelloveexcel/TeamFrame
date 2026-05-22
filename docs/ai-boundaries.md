# AI Boundaries

AI in TeamFrame V1 is **strictly limited**. It exists in exactly one folder, `/lib/ai`, behind exactly two functions, callable from server code only.

## Allowed Functions

### 1. `generateBio(cvText: string): Promise<string>`
- **Input**: CV text **only**. No employee record. No compensation. No metadata beyond the raw text the admin pasted/uploaded.
- **Output**: a 3–5 sentence professional bio.
- **Caller**: admin-scoped server action.

### 2. `generateContract(employeeData: ContractInput): Promise<string>`
- **Input**: a narrow, explicitly-typed struct of contract fields (name, role, start date, base salary, currency, jurisdiction, etc.). No free-form employee record. No DB handle.
- **Output**: a populated contract template (text/markdown).
- **Caller**: admin-scoped server action.

That is the entire AI surface. No third function gets added without removing one first.

## Hard Prohibitions
AI in TeamFrame must **never**:
- query the database directly (no Supabase client inside `/lib/ai`)
- receive an unscoped employee object
- read compensation unless `generateContract` is explicitly invoked with it
- act as an HR advisor or chatbot
- generate compliance, legal, or tax advice
- score, rank, or compare employees
- infer personality, performance, sentiment, or fit
- generate analytics or insights
- be called from client components or the browser

## Network and Provider Rules
- Provider is **OpenAI only**. No multi-provider abstraction, no gateway, no fallback chain — that is V2 architecture creep.
- The API key (`OPENAI_API_KEY`) is loaded from server env only.
- All calls happen server-side (Server Action, API Route, or service function).
- No streaming to the client in V1.

## Prompt Hygiene
- Prompts are static templates in `/lib/ai`, parameterized only by the typed input.
- Do not interpolate raw DB rows.
- Do not include compensation, personal details, or other employee fields beyond what each function explicitly accepts.

## Failure Mode
If the AI call fails, the surrounding feature must degrade to manual entry. AI is an **assist**, not a dependency.
