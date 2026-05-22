# Drift Guard

This document is the **explicit allow/deny list** for TeamFrame V1. If a proposed feature is not on the allow list, it is V2.

## Anti-Drift Objective
Keep TeamFrame focused on **lightweight HR structure** for startups with 6–25 employees. The product must remain installable in 48–72 hours by a founder.

## Globally Forbidden (never in V1)
- payroll, benefits, accounting, tax
- compliance engines / advisory
- analytics dashboards, HR metrics, trend lines, engagement scoring
- AI HR advisor / chatbot
- employee scoring, ranking, personality inference
- hiring pipelines / ATS
- onboarding *workflows* (tasks, reminders, checklists, automation states)
- reminders / notifications engine
- approvals engine, e-signatures, document versioning, retention engines
- performance reviews, compensation benchmarking
- integrations marketplace, Zapier / webhooks ecosystem
- workflow orchestration, automation platform
- enterprise admin systems, SSO/SCIM provisioning beyond Supabase Auth basics

If a feature resembles enterprise HRIS, workflow automation, or AI assistant platform behavior — **reject it**.

## Drift Area 1 — Onboarding

**Allowed**
- `employees.setup_status` enum (`incomplete` / `ready` / `active`)
- a simple readiness indicator in the UI

**Banned**
- onboarding task lists
- onboarding workflows / state machines
- reminders, due dates, escalations
- automation triggers

## Drift Area 2 — Documents

**Allowed**
- upload to Supabase Storage
- download
- grouped export as ZIP/PDF (admin only)

**Banned**
- e-signatures
- approval workflows
- versioning / history / diff
- legal workflows
- retention engines / auto-deletion policies

## Drift Area 3 — Dashboard

**Allowed**
- active employee count
- pending leave count
- latest joiners (simple list)
- latest company updates (simple list)

**Banned**
- charts, graphs, trend lines
- engagement metrics
- HR insights / recommendations
- scoring, ranking, segmentation

## Drift Area 4 — AI

See `ai-boundaries.md`. AI is locked to two functions. No expansion in V1.

## Drift Area 5 — Architecture

**Banned**
- plugin / extension systems
- workflow / DAG engines
- background job platforms beyond a single Vercel cron if absolutely required
- microservices, message buses, event sourcing
- multi-tenant sharding logic

## Sanity Check (apply before every feature)
1. Does this move setup closer to or further from 72-hour readiness?
2. Does it reuse existing entities and tables, or invent a new subsystem?
3. Does it introduce workflow automation, HR ops logic, analytics, or AI scope creep?
4. Can it ship without a new background process, queue, or scheduler?

If the feature increases operational complexity, workflow complexity, compliance surface, AI scope, HRIS similarity, or onboarding automation — it is **V2** and must be rejected.
