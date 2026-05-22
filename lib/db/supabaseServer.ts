/**
 * Server-side Supabase clients for TeamFrame.
 *
 * Two flavors:
 *  1) createServerClient()       — cookie-bound, runs as the authenticated user.
 *                                  Used by middleware/auth.ts to read the session.
 *  2) createServiceRoleClient()  — service-role key, no user binding.
 *                                  Used ONLY inside service-layer code for admin
 *                                  operations and audit writes. Never reachable
 *                                  from a client component.
 */

import "server-only";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // No-op in server components where cookies are read-only.
        }
      },
    },
  });
}

let serviceRoleClient: ReturnType<typeof createClient> | null = null;

export function createServiceRoleClient() {
  if (serviceRoleClient) return serviceRoleClient;
  serviceRoleClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceRoleClient;
}
