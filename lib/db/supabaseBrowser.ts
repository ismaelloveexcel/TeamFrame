/**
 * Browser Supabase client for TeamFrame.
 *
 * Anon key only. This client never has elevated privileges.
 * It is used for: session refresh, auth UI, signed-storage URL handling.
 *
 * It is NEVER used to bypass server-side RBAC. All protected reads/writes
 * go through API Routes or Server Actions.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase public env vars.");
  }
  return createBrowserClient(url, anonKey);
}
