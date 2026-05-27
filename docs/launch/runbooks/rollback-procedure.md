# Rollback Procedure

This runbook covers the decision criteria and execution steps for rolling back a production deployment. Follow sections in order. Do not skip post-rollback verification.

## When to Roll Back

_Define threshold — e.g. auth broken, tenant data leak suspected, >10% 500 error rate._

Decision criteria to be documented here.

## Vercel Deploy Rollback Steps

Steps to complete with real Vercel dashboard or CLI instructions.

## Supabase Migration Rollback Steps

_Alembic downgrade command, verify data integrity after._

Steps to complete with real migration commands and integrity checks.

## Post-Rollback Verification

Steps to confirm the system is stable after rollback.
