"use client";

import { useEffect } from "react";
import { logoutAction } from "@/app/auth/actions";
import { captureActionError } from "@/lib/telemetry/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("APP_ERROR_BOUNDARY", error);
    captureActionError("app_error_boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Something went wrong</p>
          <h1 className="mt-2 text-[32px] leading-tight tracking-tight">Session recovery</h1>
          <p className="mt-3 text-[15px] text-ink-700">
            We hit an unexpected error. Retry first. If it persists, sign out and start a fresh session.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700"
            >
              Retry
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-ink-300 px-5 py-2 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
              >
                Sign out and retry
              </button>
            </form>
          </div>
        </main>
      </body>
    </html>
  );
}
