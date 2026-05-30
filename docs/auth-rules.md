# Auth Rules

## Auth model (V1 — locked)

- **Authentication method**: Magic Link only (Supabase Auth, email OTP)
- **No passwords** exist in the system
- **No password reset flows** exist
- **No OAuth providers** allowed (Google / GitHub / Microsoft / etc.)
- **No MFA** in V1

User identity is always:
- a Supabase Auth user, keyed by email
- the session is resolved **server-side only** via the Supabase SSR cookie

## Login flow

```
1. User enters email on /auth
2. Server action calls supabase.auth.signInWithOtp({ email })
3. User receives a magic link email
4. User clicks link → /auth/callback?token_hash=...&type=magiclink → session cookie set
5. Server resolves the actor:
     auth.users.id (session)
     → employees.email match
     → employees.id
     → app_metadata.role  →  'admin' | 'employee'
6. Redirect to /dashboard
```

## Role assignment

Roles are **server-controlled** and never derived from client input.

- The `admin` role is set **only** via:
  - The Supabase Dashboard, or
  - The bootstrap script (`npm run seed:admin -- email@company.com`)
- Employees are created by an admin via the in-product flow. The admin's
  action triggers `supabase.auth.admin.inviteUserByEmail()` and inserts a
  row in `employees`. The first magic-link sign-in links the auth user to
  the employee record by email.

**Never** allow:
- self-role escalation
- role passed in a request body, cookie, header, or query string
- role inferred from email domain or any heuristic

## Forbidden in V1

- Sign-up form / open registration
- Password fields anywhere in the product
- "Continue with Google" or any OAuth provider
- TOTP, WebAuthn, SMS, or any MFA
- Account-deletion self-service (admins handle this server-side)

## Supabase project configuration

In the Supabase Dashboard (or via Management API), the following must be true:

| Setting | Value |
|---|---|
| Email provider | enabled |
| Magic Link | enabled |
| **Password login** | **disabled** |
| **Allow new users to sign up** | **disabled** (admin-invite only) |
| Confirm email | enabled |
| OAuth providers | all disabled |

`npm run auth:lock` will assert these settings and refuse to proceed if any
are misconfigured.

## Magic-link email template

For local development, the Supabase **Magic Link** email template must use the
`token_hash` callback shape. This avoids PKCE verifier mismatch when the user
opens the link on a different device or after an older link was generated.

In Supabase Dashboard → Authentication → Emails → Magic Link, set the link URL
to:

```text
http://localhost:3030/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
```

For production, replace the host with the production `SITE_URL`:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
```

Do not use password reset, invite-acceptance, OAuth, or MFA templates as product
entry points in V1.

## Auth regression checklist

Run this after any change to `app/auth/**`, `middleware.ts`, the Supabase email
template, or the `SITE_URL` / redirect-allowlist configuration. PKCE-class bugs
tend to silently reappear during auth refactors.

Manual round-trip — all must pass:

- [ ] Newest magic link works (fresh email → click → land on role default)
- [ ] Reused link fails gracefully (`/auth?error=callback_failed`, no crash)
- [ ] Stale/expired link fails gracefully (same error page)
- [ ] Gmail / webmail click works (no prefetch consumption of the code)
- [ ] Cross-browser click works (link issued in browser A, opened in browser B)
- [ ] No infinite redirect loop after successful login
- [ ] Logout → login again works in the same browser session
- [ ] Admin lands on `/dashboard` (employee accounts share the same dashboard in V1 — single workspace for the founder)

Diagnostic signature in dev logs after the `token_hash` switch — a successful
login must look like:

```text
[callback] code=none token_hash=abc12345 cookies=[...] code_verifier_present=false
```

If you ever see `code=...` or `code challenge does not match previously saved
code verifier` on a successful path, the email template has reverted to
`{{ .ConfirmationURL }}` or some emails are still using the old template.
