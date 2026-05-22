import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/db/supabaseServer";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();

  const url = new URL("/auth", request.url);
  url.searchParams.set("signed_out", "1");
  return NextResponse.redirect(url, { status: 303 });
}
