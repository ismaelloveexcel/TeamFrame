"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { assignOnboardingTask, completeOnboardingTask } from "@/services/onboardingService";

const AssignSchema = z.object({
  employee_id: z.string().uuid(),
  title: z.string().trim().min(1),
});

const CompleteSchema = z.object({
  task_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const match = error.message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function assignOnboardingTaskAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  try {
    const actor = await requireTenantActor();
    const parsed = AssignSchema.parse({
      employee_id: formData.get("employee_id"),
      title: formData.get("title"),
    });
    await assignOnboardingTask(actor, {
      employeeId: parsed.employee_id,
      title: parsed.title,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/onboarding?status=assigned");
}

export async function completeOnboardingTaskAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  try {
    const actor = await requireTenantActor();
    const parsed = CompleteSchema.parse({
      task_id: formData.get("task_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });
    await completeOnboardingTask(actor, parsed.task_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/onboarding?status=completed");
}
