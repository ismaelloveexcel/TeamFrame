"use client";

import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className: string;
  confirmMessage: string;
};

export function ConfirmSubmitButton({
  idleLabel,
  pendingLabel,
  className,
  confirmMessage,
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (pending) return;
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
