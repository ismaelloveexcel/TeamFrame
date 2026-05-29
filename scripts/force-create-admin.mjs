import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
const email = process.argv[2];
if (!email) { console.error("usage: node force-create-admin.mjs <email>"); process.exit(1); }
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// find existing
let user = null;
let page = 1;
while (page <= 25) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error(error.message); process.exit(1); }
  const hit = data.users.find(u => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (hit) { user = hit; break; }
  if (data.users.length < 200) break;
  page++;
}

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (error) { console.error("createUser failed:", error.message); process.exit(1); }
  user = data.user;
  console.log("CREATED user id:", user.id);
} else {
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), role: "admin" },
    email_confirm: true,
  });
  if (error) { console.error("update failed:", error.message); process.exit(1); }
  console.log("UPDATED user id:", user.id);
}
