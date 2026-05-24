import "server-only";

import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type WorkspaceValidationState = {
  tenant_id: string;
  workspace_created_at: string;
  trial_status: "trial" | "pilot" | "active" | "expired";
  plan_label: string;
  activation_state: "not_started" | "activated";
  onboarding_completion_state: "not_started" | "in_progress" | "completed";
  first_import_completed_at: string | null;
  first_payroll_ready_validation_at: string | null;
  first_export_generated_at: string | null;
  onboarding_completed_at: string | null;
  export_count: number;
  last_export_at: string | null;
  unresolved_readiness_issues: number;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExportHistoryEntry = {
  id: string;
  tenant_id: string;
  actor_user_id: string;
  actor_email: string;
  export_type: string;
  record_count: number;
  readiness_status: "ready" | "blocked";
  unresolved_issues: number;
  include_inactive: boolean;
  created_at: string;
};

type ExportTrackingInput = {
  exportType: string;
  recordCount: number;
  unresolvedIssues: number;
  readinessStatus: "ready" | "blocked";
  includeInactive: boolean;
};

type ValidationProgressInput = {
  totalRecords: number;
  readyRecords: number;
  unresolvedIssues: number;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

async function ensureWorkspaceState(actor: Actor): Promise<WorkspaceValidationState> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data: existing, error: existingError } = await supabase
    .from("workspace_validation_states")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`VALIDATION_STATE_LOOKUP_FAILED: ${existingError.message}`);
  }

  if (existing) {
    return existing as WorkspaceValidationState;
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("created_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (companyError) {
    throw new Error(`VALIDATION_STATE_COMPANY_LOOKUP_FAILED: ${companyError.message}`);
  }

  const companyRow = company as { created_at?: string } | null;
  const workspaceCreatedAt =
    companyRow && typeof companyRow.created_at === "string"
      ? companyRow.created_at
      : new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("workspace_validation_states")
    .insert({
      tenant_id: tenantId,
      workspace_created_at: workspaceCreatedAt,
    } as never)
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`VALIDATION_STATE_CREATE_FAILED: ${insertError.message}`);
  }

  return inserted as WorkspaceValidationState;
}

export async function syncWorkspaceValidationProgress(
  actor: Actor,
  input: ValidationProgressInput,
): Promise<WorkspaceValidationState> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const state = await ensureWorkspaceState(actor);
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const onboardingState =
    state.first_export_generated_at || state.export_count > 0
      ? "completed"
      : input.totalRecords > 0
        ? "in_progress"
        : "not_started";

  const updates: Partial<WorkspaceValidationState> = {
    last_active_at: now,
    unresolved_readiness_issues: Math.max(0, input.unresolvedIssues),
    onboarding_completion_state: onboardingState,
    activation_state: state.export_count > 0 ? "activated" : state.activation_state,
  };

  if (input.totalRecords > 0 && !state.first_import_completed_at) {
    updates.first_import_completed_at = now;
  }
  if (input.readyRecords > 0 && !state.first_payroll_ready_validation_at) {
    updates.first_payroll_ready_validation_at = now;
  }
  if (onboardingState === "completed" && !state.onboarding_completed_at) {
    updates.onboarding_completed_at = state.first_export_generated_at ?? now;
  }

  const { data, error } = await supabase
    .from("workspace_validation_states")
    .update(updates as never)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`VALIDATION_STATE_UPDATE_FAILED: ${error.message}`);
  }

  return data as WorkspaceValidationState;
}

export async function trackExportEvent(
  actor: Actor,
  input: ExportTrackingInput,
): Promise<ExportHistoryEntry> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const state = await ensureWorkspaceState(actor);
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: history, error: historyError } = await supabase
    .from("export_history")
    .insert({
      tenant_id: tenantId,
      actor_user_id: actor.authUserId,
      actor_email: actor.email,
      export_type: input.exportType,
      record_count: Math.max(0, input.recordCount),
      readiness_status: input.readinessStatus,
      unresolved_issues: Math.max(0, input.unresolvedIssues),
      include_inactive: input.includeInactive,
    } as never)
    .select("*")
    .single();

  if (historyError) {
    throw new Error(`EXPORT_HISTORY_CREATE_FAILED: ${historyError.message}`);
  }

  const exportCount = state.export_count + 1;
  const updates: Partial<WorkspaceValidationState> = {
    export_count: exportCount,
    last_export_at: now,
    last_active_at: now,
    unresolved_readiness_issues: Math.max(0, input.unresolvedIssues),
    onboarding_completion_state: "completed",
    activation_state: "activated",
  };

  if (!state.first_export_generated_at) {
    updates.first_export_generated_at = now;
  }
  if (!state.onboarding_completed_at) {
    updates.onboarding_completed_at = now;
  }
  if (input.recordCount > 0 && !state.first_import_completed_at) {
    updates.first_import_completed_at = now;
  }
  if (input.readinessStatus === "ready" && !state.first_payroll_ready_validation_at) {
    updates.first_payroll_ready_validation_at = now;
  }

  const { error: updateError } = await supabase
    .from("workspace_validation_states")
    .update(updates as never)
    .eq("tenant_id", tenantId);

  if (updateError) {
    throw new Error(`VALIDATION_STATE_AFTER_EXPORT_UPDATE_FAILED: ${updateError.message}`);
  }

  return history as ExportHistoryEntry;
}

export async function listRecentExportHistory(
  actor: Actor,
  limit = 8,
): Promise<ExportHistoryEntry[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("export_history")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 30)));

  if (error) {
    throw new Error(`EXPORT_HISTORY_LIST_FAILED: ${error.message}`);
  }

  return (data ?? []) as ExportHistoryEntry[];
}
