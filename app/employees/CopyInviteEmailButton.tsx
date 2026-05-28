"use client";

import { useState } from "react";

export function CopyInviteEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyEmail}
      className="text-[13px] text-ink-700 underline decoration-ink-300 underline-offset-4"
      aria-label={`Copy invite email ${email}`}
    >
      {copied ? "Email copied" : "Copy invite email"}
    </button>
  );
}
