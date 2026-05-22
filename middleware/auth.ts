/**
 * TeamFrame — auth middleware
 *
 * Resolves the current Supabase session on the server.
 * Used by API Routes and Server Actions before any RBAC check.
 *
 * Contract:
 *  - server-only (never imported into a client component)
 *  - returns null on no session; callers must reject unauthenticated requests
 *  - does NOT perform role checks (see ./rbac.ts)
 */

import "server-only";
import { createServerClient } from "@/lib/db/supabaseServer";

export type AuthSession = {
  userId: string;
  email: string;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  return {
    userId: user.id,
    email: user.email,
  };
}

export async function requireAuthSession(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
