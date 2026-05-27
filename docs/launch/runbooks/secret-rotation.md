# Secret Rotation Runbook

This runbook covers the steps for rotating production secrets. Each rotation must be completed fully before closing — partial rotations leave the system in an inconsistent state.

## SUPABASE_SERVICE_ROLE_KEY Rotation

_Generate new key in Supabase dashboard, update Vercel env, redeploy, verify._

Steps to complete with real dashboard/CLI instructions.

## Resend API Key Rotation

Steps to complete with real Resend dashboard/CLI instructions.

## Verification Steps After Rotation

Steps to confirm the rotated credentials are accepted and no errors appear in logs.
