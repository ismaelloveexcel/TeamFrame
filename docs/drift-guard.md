# Drift Guard

This document is the **explicit allow/deny list** for TeamFrame V1. If a proposed feature is not on the allow list, it is V2.

## Anti-Drift Objective
Keep TeamFrame focused on a **payroll-ready employee data layer** for startup finance teams at companies with 6–25 employees. The product must remain installable in 48–72 hours by a founder.

## Launch Lock Identity (Permanent)

TeamFrame identity is locked:
- payroll input + export layer for startup finance teams
- finance-ready employee dataset system
- export-first operations layer
- payroll preparation workflow
- structured employee record source for finance

TeamFrame is not:
- payroll software
- payroll execution infrastructure
- HRIS
- people operations suite
- compliance engine
- tax engine
- workforce management platform

## Globally Forbidden (never in V1)
- payroll execution, benefits, accounting system-of-record features, tax computation
- payment processing or money movement
- compliance engines / advisory
- analytics dashboards, people-ops metrics, trend lines, engagement scoring
- AI HR, payroll, or finance advisor / chatbot
- employee scoring, ranking, personality inference
- hiring pipelines / ATS
- onboarding *workflows* (tasks, reminders, checklists, automation states)
- reminders / notifications engine
- approvals engine, e-signatures, document versioning, retention engines
- performance reviews, compensation benchmarking
- integrations marketplace, Zapier / webhooks ecosystem
- workflow orchestration, automation platform
- enterprise admin systems, SSO/SCIM provisioning beyond Supabase Auth basics

Also forbidden by launch lock:
- enterprise HR workflows and enterprise module patterns
- heavy approval chains or multi-stage workflow gates
- feature-dense, multi-module suite expansion
- product positioning as HR platform, payroll processor, or compliance/tax tool

## UI and Vocabulary Lock

Required tone in UI copy:
- startup-native
- calm and operational
- finance-ops oriented
- lightweight modern SaaS

Avoid in user-facing copy:
- enterprise HR tone
- generic team management language
- corporate process-heavy phrasing
- analytics-heavy positioning

Preferred vocabulary:
- payroll input
- payroll-ready record
- finance export
- export readiness
- dataset freeze
- batch handoff

Disallowed positioning vocabulary (except in explicit non-goal lists):
- HR platform
- people operations platform
- workforce management
- payroll processor
- compliance automation tool

If a feature resembles payroll execution software, enterprise HRIS, workflow automation, or AI assistant platform behavior — **reject it**.

## Drift Area 1 - Payroll Input Layer

**Allowed**
- employee data as the source of truth for payroll inputs
- payroll snapshot as a time-based dataset freeze
- export-first payroll-ready CSV/Excel handoff for finance
- validation of required payroll fields and readiness state

**Banned**
- payroll calculation engines
- tax withholding logic
- payment initiation or payout workflows
- statutory compliance automation

## Drift Area 2 - Onboarding

**Allowed**
- `employees.setup_status` enum (`incomplete` / `ready` / `active`)
- a simple readiness indicator in the UI

**Banned**
- onboarding task lists
- onboarding workflows / state machines
- reminders, due dates, escalations
- automation triggers

## Drift Area 3 - Documents

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

## Drift Area 4 - Dashboard

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

## Drift Area 5 - AI

See `ai-boundaries.md`. AI is locked to two functions. No expansion in V1.

## Drift Area 6 - Architecture

**Banned**
- plugin / extension systems
- workflow / DAG engines
- background job platforms beyond a single Vercel cron if absolutely required
- microservices, message buses, event sourcing
- multi-tenant sharding logic

## Sanity Check (apply before every feature)
1. Does this move setup closer to or further from 72-hour readiness?
2. Does it reuse existing entities and tables, or invent a new subsystem?
3. Does it introduce payroll execution, workflow automation, tax/compliance logic, analytics, or AI scope creep?
4. Can it ship without a new background process, queue, or scheduler?
5. Does the copy and UX language keep TeamFrame in finance export posture (not HR, payroll execution, or enterprise workflow posture)?

If the feature increases operational complexity, workflow complexity, compliance surface, payroll-system similarity, AI scope, HRIS similarity, or onboarding automation — it is **V2** and must be rejected.
