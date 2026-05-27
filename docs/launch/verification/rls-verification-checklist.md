# RLS Verification Checklist

This file records the results of per-table RLS verification after Batch 1 of the hardening sprint. Each table must be tested from each persona before the batch is considered complete.

Personas: **anon**, **employee (own row)**, **employee (other row same tenant)**, **employee (cross-tenant)**, **admin (same tenant)**, **admin (cross-tenant)**

---

## companies

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | 0 rows | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | own tenant only | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## employees

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | own row via employees_public | | | |
| employee (other row same tenant) | SELECT | safe columns only via employees_public | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | full rows, own tenant only | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## employee_profiles

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | own profile | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | own tenant only | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## onboarding_tasks

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | own tasks only | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | own tenant only | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## policies

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | published only, own tenant | | | |
| employee (other row same tenant) | SELECT | published only, own tenant | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | all rows, own tenant | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## procedures

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | published only, own tenant | | | |
| employee (other row same tenant) | SELECT | published only, own tenant | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | all rows, own tenant | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## leaves

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | own rows only | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | all rows, own tenant | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## documents

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | own rows only | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | all rows, own tenant | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## compensation

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | own row only | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | all rows, own tenant | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |

## audit_logs

| Persona | Operation | Expected | Actual | Pass/Fail | Date |
|---------|-----------|----------|--------|-----------|------|
| anon | SELECT | 0 rows | | | |
| employee (own row) | SELECT | 0 rows | | | |
| employee (other row same tenant) | SELECT | 0 rows | | | |
| employee (cross-tenant) | SELECT | 0 rows | | | |
| admin (same tenant) | SELECT | own tenant only | | | |
| admin (cross-tenant) | SELECT | 0 rows | | | |
