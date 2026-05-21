# TeamFrame Rules

## Product Scope Lock
TeamFrame is a lightweight HR structure infrastructure product for startups (6–25 employees).

Allowed V1 modules:
- employee directory
- org chart
- onboarding document uploads
- minimal leave requests
- company announcements
- AI: CV-to-bio and contract template generation

## Anti-Drift Hard Limits
Do not introduce:
- payroll or benefits modules
- enterprise HRIS expansion
- analytics dashboards
- workflow engines
- notifications/reminders infrastructure
- Zapier/webhook ecosystems
- compliance automation
- e-signatures, approvals, document versioning workflows
- employee settings/preferences system
- AI scoring/ranking, personality inference, HR/compliance advisory

## Security and Architecture Enforcement
- Always enforce RBAC server-side.
- Never trust frontend authorization for access control.
- Keep flow: Frontend -> API/Server Action -> RBAC -> Service -> Database.

## AI Constraint Enforcement
Allowed AI functions only:
- generateBio(cvText)
- generateContract(employeeData)

AI cannot directly query the database or infer sensitive traits.
