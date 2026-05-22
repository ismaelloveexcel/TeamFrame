/**
 * TeamFrame — lock Supabase Auth project config.
 *
 * Asserts the TeamFrame magic-link-only contract on the Supabase project:
 *   - email provider enabled
 *   - magic links enabled
 *   - password login DISABLED
 *   - open sign-up DISABLED
 *   - OAuth providers DISABLED
 *
 * Requires SUPABASE_ACCESS_TOKEN (Personal Access Token) in .env.local.
 * Get one at: https://supabase.com/dashboard/account/tokens
 *
 * Without the token, this script prints a guided manual checklist instead.
 *
 * Usage:
 *   npm run auth:lock
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL is missing.");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).host.split(".")[0];
const siteUrl = process.env.SITE_URL ?? "http://localhost:3030";

if (!ACCESS_TOKEN) {
  console.log("ℹ Supabase Management API token not found.");
  console.log("  Set SUPABASE_ACCESS_TOKEN in .env.local to automate this step.");
  console.log("  Get one at: https://supabase.com/dashboard/account/tokens\n");
  console.log("Manual checklist (Supabase Dashboard):\n");
  console.log(`  1. Open: https://supabase.com/dashboard/project/${projectRef}/auth/providers`);
  console.log("     → Email provider: ON");
  console.log("     → 'Confirm email': ON");
  console.log("     → Any password-related toggle: OFF");
  console.log("     → OAuth / Third-Party Auth providers: all OFF");
  console.log("");
  console.log(`  2. Open: https://supabase.com/dashboard/project/${projectRef}/auth/sign-in-up`);
  console.log("     → 'Allow new users to sign up': OFF");
  console.log("");
  console.log(`  3. Open: https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`);
  console.log(`     → Site URL: ${siteUrl}`);
  console.log(`     → Redirect URLs: include ${siteUrl}/auth/callback`);
  console.log("       and your production URL + /auth/callback when you deploy.");
  console.log("");
  console.log(`  4. Open: https://supabase.com/dashboard/project/${projectRef}/auth/templates`);
  console.log("     → Magic Link template link URL:");
  console.log(`       ${siteUrl}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`);
  process.exit(0);
}

const BASE = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

console.log("• Reading current auth config…");
const getRes = await fetch(BASE, {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
});
if (!getRes.ok) {
  console.error(`✗ GET ${BASE} failed: ${getRes.status} ${await getRes.text()}`);
  process.exit(1);
}
const current = await getRes.json();

const desired = {
  disable_signup: true,
  external_email_enabled: true,
  mailer_autoconfirm: false,
  external_anonymous_users_enabled: false,
};

const oauthProviderFields = Object.keys(current)
  .filter((key) => key.startsWith("external_") && key.endsWith("_enabled"))
  .filter((key) => !["external_email_enabled", "external_anonymous_users_enabled"].includes(key));

const passwordFieldCandidates = [
  "external_email_password_enabled",
  "email_password_enabled",
  "password_auth_enabled",
];
const passwordField = passwordFieldCandidates.find((key) => key in current);

const desiredWithProviders = {
  ...desired,
  ...(passwordField ? { [passwordField]: false } : {}),
  ...Object.fromEntries(oauthProviderFields.map((key) => [key, false])),
};

const unverifiable = [];
if (!passwordField) {
  unverifiable.push(
    "Could not find a password-login config field in the Management API response. Manually verify password login is off in the Supabase Dashboard.",
  );
}

if (unverifiable.length > 0) {
  console.error("✗ Cannot automatically prove the full TeamFrame auth contract:");
  for (const line of unverifiable) console.error(`  - ${line}`);
  process.exit(1);
}

const drift = Object.entries(desiredWithProviders).filter(([k, v]) => current[k] !== v);
if (drift.length === 0) {
  console.log("✓ Auth config already matches the TeamFrame contract.");
  process.exit(0);
}

console.log("• Drift detected. Updating:");
for (const [k, v] of drift) {
  console.log(`    - ${k}: ${current[k]} → ${v}`);
}

const patchRes = await fetch(BASE, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(desiredWithProviders),
});
if (!patchRes.ok) {
  console.error(`✗ PATCH failed: ${patchRes.status} ${await patchRes.text()}`);
  process.exit(1);
}

console.log("• Re-reading auth config to verify…");
const verifyRes = await fetch(BASE, {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
});
if (!verifyRes.ok) {
  console.error(`✗ Verification GET failed: ${verifyRes.status} ${await verifyRes.text()}`);
  process.exit(1);
}
const verified = await verifyRes.json();
const failures = Object.entries(desiredWithProviders).filter(([k, v]) => verified[k] !== v);
if (failures.length > 0) {
  console.error("✗ Auth config did not verify after PATCH:");
  for (const [k, v] of failures) {
    console.error(`  - ${k}: expected ${v}, got ${verified[k]}`);
  }
  process.exit(1);
}

console.log("\n✓ Auth config verified as magic-link-only.");
