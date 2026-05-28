"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
  disabledLabel?: string;
};

export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  disabled = false,
  disabledLabel,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  const label = pending ? pendingLabel : disabled && disabledLabel ? disabledLabel : idleLabel;

  return (
    <button type="submit" disabled={isDisabled} className={className}>
      {label}
    </button>
  );
}
