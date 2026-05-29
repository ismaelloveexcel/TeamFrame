import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });
const email = process.argv[2];
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: "http://localhost:3030/auth/callback" },
});
if (error) { console.error("ERR:", error.message); process.exit(1); }
console.log("PROPS:", JSON.stringify(data.properties, null, 2));
const hashed = data.properties.hashed_token;
console.log("CALLBACK_URL: http://localhost:3030/auth/callback?token_hash=" + hashed + "&type=magiclink");
