/**
 * TeamFrame — storage bucket setup.
 *
 * Creates the single `documents` bucket used by the document hub.
 * Bucket is private — all reads/writes go through server-side signed URLs
 * issued by /services/documentService after RBAC checks.
 *
 * Idempotent: safe to re-run; will only create if missing.
 *
 * Usage:
 *   npm run storage:setup
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "documents";
const BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: 10 * 1024 * 1024,
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
};

console.log("• Listing existing buckets…");
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("✗ Failed to list buckets:", listErr.message);
  process.exit(1);
}

const existing = buckets.find((b) => b.name === BUCKET);

if (existing) {
  console.log(`✓ Bucket "${BUCKET}" already exists (public=${existing.public}).`);
  console.log("• Updating bucket configuration to TeamFrame defaults…");
  const { error: updErr } = await supabase.storage.updateBucket(BUCKET, BUCKET_CONFIG);
  if (updErr) {
    console.error("✗ Failed to update bucket:", updErr.message);
    process.exit(1);
  }
  console.log("✓ Bucket configuration updated.");
} else {
  console.log(`• Creating bucket "${BUCKET}"…`);
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, BUCKET_CONFIG);
  if (createErr) {
    console.error("✗ Failed to create bucket:", createErr.message);
    process.exit(1);
  }
  console.log(`✓ Bucket "${BUCKET}" created (private, 10MB limit, PDF/DOC/images).`);
}

console.log("\n✓ Storage ready.");
