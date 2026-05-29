import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const mode = process.argv[2] ?? "build";

const REQUIRED_BY_MODE = {
  build: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SITE_URL"],
  smoke: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  db: ["SUPABASE_DB_URL"],
};

if (!(mode in REQUIRED_BY_MODE)) {
  console.error(`✗ Unknown env validation mode: ${mode}`);
  console.error(`  Supported modes: ${Object.keys(REQUIRED_BY_MODE).join(", ")}`);
  process.exit(1);
}

const requiredVars = REQUIRED_BY_MODE[mode];
const missing = requiredVars.filter((name) => {
  const value = process.env[name];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(`✗ Missing required environment variables for mode '${mode}':`);
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

let sanitizedSiteUrl = "(not required for this mode)";
if (process.env.SITE_URL) {
  try {
    sanitizedSiteUrl = new URL(process.env.SITE_URL).origin;
  } catch {
    sanitizedSiteUrl = "invalid SITE_URL format";
  }
}

console.log(`✓ Environment validation passed for mode '${mode}'`);
console.log(`  Required vars present: ${requiredVars.join(", ")}`);
console.log(`  SITE_URL: ${sanitizedSiteUrl}`);
console.log(`  Has service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "no"}`);
console.log(`  Has DB URL: ${process.env.SUPABASE_DB_URL ? "yes" : "no"}`);