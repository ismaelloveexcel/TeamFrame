"use client";

import { useFormStatus } from "react-dom";
import { sendMagicLink } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-ink-900 px-5 py-3 text-[15px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
    >
      {pending ? "Sending…" : "Send link"}
    </button>
  );
}

export function AuthForm({ errorMessage }: { errorMessage: string | null }) {
  return (
    <form action={sendMagicLink} className="mt-10 space-y-4">
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        inputMode="email"
        placeholder="you@company.com"
        className="w-full rounded-full border border-ink-300 bg-white px-5 py-3 text-[15px] outline-none transition focus:border-ink-900"
      />
      <SubmitButton />

      {errorMessage ? (
        <p role="alert" className="text-[13px] text-accent">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
