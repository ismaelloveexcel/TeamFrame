"use client";

import { useState } from "react";

export function CopyInviteEmailButton({
  email,
  copyValue,
  idleLabel,
  copiedLabel,
}: {
  email: string;
  copyValue?: string;
  idleLabel?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const valueToCopy = copyValue ?? email;
  const idleText = idleLabel ?? "Copy invite email";
  const copiedText = copiedLabel ?? "Email copied";

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(valueToCopy);
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
      aria-label={`Copy value ${email}`}
    >
      {copied ? copiedText : idleText}
    </button>
  );
}
