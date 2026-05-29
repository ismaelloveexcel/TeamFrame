"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { assignOnboardingTask, completeOnboardingTask } from "@/services/onboardingService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

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

  // Observability instrumentation (Phase 1B).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
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
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("assignOnboardingTask", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "assignOnboardingTask",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "assignOnboardingTask",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
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
