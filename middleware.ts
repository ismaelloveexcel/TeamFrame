import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard", "/employees", "/admin", "/org-chart"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToAuth(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return redirectToAuth(request);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToAuth(request);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const role = (user.app_metadata as { role?: unknown } | null)?.role;
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/employees/:path*", "/admin/:path*", "/org-chart/:path*"],
};
