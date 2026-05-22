/**
 * TeamFrame — bootstrap an admin.
 *
 * Idempotent. For a given email, this script will:
 *   1. Ensure the Supabase auth user exists (invites by magic link if not).
 *   2. Stamp `app_metadata.role = 'admin'` on the auth user.
 *   3. Ensure a matching row exists in `employees` (creates a minimal one if not).
 *
 * Usage:
 *   npm run seed:admin -- admin@yourcompany.com
 *   npm run seed:admin -- admin@yourcompany.com "Full Name" "Founder" "Leadership" "UTC"
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
dotenv.config({ path: join(repoRoot, ".env.local") });

const [, , emailArg, nameArg, titleArg, deptArg, tzArg] = process.argv;

if (!emailArg) {
  console.error("Usage: npm run seed:admin -- admin@yourcompany.com [name] [title] [department] [timezone]");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const fullName = (nameArg ?? "Admin").trim();
const roleTitle = (titleArg ?? "Founder").trim();
const department = (deptArg ?? "Leadership").trim();
const timezone = (tzArg ?? "UTC").trim();
const inferredCompanyName = email.split("@")[1]?.split(".")[0] ?? "Default Company";

function toSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(targetEmail) {
  // listUsers paginates. For a fresh bootstrap project, page 1 is enough.
  let page = 1;
  const perPage = 200;
  // Limit defensively to avoid runaway pagination on a misconfigured project.
  while (page <= 25) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

console.log(`• Bootstrapping admin: ${email}\n`);

let user = await findAuthUserByEmail(email);

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const REDIRECT_TO = `${SITE_URL}/auth/callback`;

if (!user) {
  console.log("• No auth user found — sending magic-link invite…");
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: REDIRECT_TO,
  });
  if (error) {
    console.error("✗ Invite failed:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`✓ Invite sent. Auth user id: ${user.id}`);
} else {
  console.log(`✓ Auth user already exists. Id: ${user.id}`);
}

console.log("• Stamping app_metadata.role = 'admin' and confirming email…");
{
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), role: "admin" },
    email_confirm: true,
  });
  if (error) {
    console.error("✗ Failed to update auth user:", error.message);
    process.exit(1);
  }
  console.log("✓ Role stamped, email confirmed.");
}

console.log("• Ensuring employees row exists…");
{
  const companySlug = toSlug(inferredCompanyName) || "default-company";
  const companyName = inferredCompanyName.charAt(0).toUpperCase() + inferredCompanyName.slice(1);

  const { data: existingCompany, error: companySelErr } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", companySlug)
    .maybeSingle();

  if (companySelErr) {
    console.error("✗ companies lookup failed:", companySelErr.message);
    process.exit(1);
  }

  let tenantId = existingCompany?.id;
  if (!tenantId) {
    const { data: insertedCompany, error: companyInsErr } = await supabase
      .from("companies")
      .insert({ name: companyName, slug: companySlug })
      .select("id")
      .single();
    if (companyInsErr) {
      console.error("✗ Failed to create company row:", companyInsErr.message);
      process.exit(1);
    }
    tenantId = insertedCompany.id;
    console.log(`✓ company created. Id: ${tenantId}`);
  } else {
    console.log(`✓ company already exists. Id: ${tenantId}`);
  }

  const { data: existing, error: selErr } = await supabase
    .from("employees")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (selErr) {
    console.error("✗ employees lookup failed:", selErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from("employees")
      .update({ tenant_id: tenantId, auth_user_id: user.id })
      .eq("id", existing.id);
    if (updErr) {
      console.error("✗ employees update failed:", updErr.message);
      process.exit(1);
    }
    console.log(`✓ employees row already exists. Id: ${existing.id}`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("employees")
      .insert({
        tenant_id: tenantId,
        auth_user_id: user.id,
        full_name: fullName,
        email,
        role_title: roleTitle,
        department,
        timezone,
        status: "active",
        setup_status: "active",
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("✗ Failed to create employees row:", insErr.message);
      process.exit(1);
    }
    console.log(`✓ employees row created. Id: ${inserted.id}`);
  }
}

console.log("\n✓ Admin bootstrap complete.");
console.log("\nNext: open your email and click the magic link to sign in.");
