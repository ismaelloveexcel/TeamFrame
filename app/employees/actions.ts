"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import {
  createEmployee,
  reinviteEmployee,
  softDeleteEmployee,
  updateEmployee,
} from "@/services/employeeService";

const CreateInputSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  role_title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
});

const UpdateInputSchema = z.object({
  employee_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  role_title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  status: z.enum(["active", "on_leave", "inactive"]),
});

const ArchiveInputSchema = z.object({
  employee_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const ReinviteInputSchema = z.object({
  employee_id: z.string().uuid(),
});

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const message = error.message;
    const match = message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  try {
    const actor = await requireTenantActor();
    const parsed = CreateInputSchema.parse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      role_title: formData.get("role_title"),
      department: formData.get("department"),
      timezone: formData.get("timezone"),
    });

    await createEmployee(actor, parsed);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/employees?error=${encodeURIComponent(errorCode)}`);
  }

  redirect("/employees?status=created");
}

export async function updateEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  try {
    const actor = await requireTenantActor();
    const parsed = UpdateInputSchema.parse({
      employee_id: formData.get("employee_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      role_title: formData.get("role_title"),
      department: formData.get("department"),
      status: formData.get("status"),
    });

    await updateEmployee(
      actor,
      parsed.employee_id,
      {
        role_title: parsed.role_title,
        department: parsed.department,
        status: parsed.status,
      },
      parsed.expected_updated_at,
    );
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/employees?error=${encodeURIComponent(errorCode)}`);
  }

  redirect("/employees?status=updated");
}

export async function archiveEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  try {
    const actor = await requireTenantActor();
    const parsed = ArchiveInputSchema.parse({
      employee_id: formData.get("employee_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });

    await softDeleteEmployee(actor, parsed.employee_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/employees?error=${encodeURIComponent(errorCode)}`);
  }

  redirect("/employees?status=archived");
}

export async function reinviteEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";

  try {
    const actor = await requireTenantActor();
    const parsed = ReinviteInputSchema.parse({
      employee_id: formData.get("employee_id"),
    });
    employeeId = parsed.employee_id;

    await reinviteEmployee(actor, parsed.employee_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/employees?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`/employees?status=reinvited&employee=${encodeURIComponent(employeeId)}`);
}
