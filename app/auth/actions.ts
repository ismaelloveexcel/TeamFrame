"use server";

/**
 * Auth server actions.
 *
 * Magic-link only. No password flow. No OAuth.
 * The browser never holds a Supabase admin/service-role key.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/db/env";
import { createServerClient } from "@/lib/db/supabaseServer";

const EmailSchema = z.string().trim().toLowerCase().email();

export async function sendMagicLink(formData: FormData): Promise<void> {
  const raw = formData.get("email");
  const parsed = EmailSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/auth?error=invalid_email`);
  }
  const email = parsed.data;

  const supabase = await createServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    const code = typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : null;
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null;
    console.warn("AUTH_SEND_MAGIC_LINK_DIAGNOSTIC", {
      email,
      code,
      status,
      message: error.message,
    });
  }
  // In all cases land on /auth/check-email — never reveal whether the email
  // is a known user (prevents enumeration).

  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/auth?signed_out=1");
}
