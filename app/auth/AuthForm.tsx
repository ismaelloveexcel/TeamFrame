"use client";

import { useFormStatus } from "react-dom";
import { sendMagicLink } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tf-button-primary w-full justify-center rounded-full px-5 py-3 text-[15px] disabled:cursor-not-allowed disabled:bg-ink-300"
    >
      {pending ? "Sending access link..." : "Send secure access link"}
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
        className="tf-input w-full rounded-full px-5 py-3 text-[15px]"
      />
      <p className="text-[12px] text-ink-500">Use the email already attached to your data record.</p>
      <SubmitButton />

      {errorMessage ? (
        <p role="alert" className="rounded-md border border-accent/35 bg-white/80 px-3 py-2 text-[13px] text-accent">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
