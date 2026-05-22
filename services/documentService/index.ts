/**
 * Document service — server-side only.
 *
 * Scope lock (see docs/drift-guard.md):
 *  - upload, download, soft-delete, grouped export (ZIP/PDF)
 *  - NO e-signatures, approvals, versioning, retention engines, legal workflow
 *
 * Storage: Supabase Storage. Signed URLs are issued only after RBAC checks.
 */

import "server-only";
import type { Actor } from "@/middleware/rbac";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type DocumentType = "CV" | "CONTRACT" | "JD" | "PHOTO";

export type DocumentRecord = {
  id: string;
  employee_id: string;
  type: DocumentType;
  file_url: string;
  created_at: string;
};

type DocumentRow = DocumentRecord & {
  tenant_id: string;
  deleted_at: string | null;
};

const DOCUMENT_BUCKET = "documents";

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

async function writeAudit(actor: Actor, actionType: string, targetId?: string): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
}

function toPublicRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    employee_id: row.employee_id,
    type: row.type,
    file_url: row.file_url,
    created_at: row.created_at,
  };
}

function buildStoragePath(tenantId: string, employeeId: string, fileName: string): string {
  const safeName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "document.bin";
  return `${tenantId}/${employeeId}/${randomUUID()}-${safeName}`;
}

async function canReadEmployeeDocuments(actor: Actor, employeeId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  return actor.employeeId === employeeId;
}

export async function listDocumentsForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<DocumentRecord[]> {
  const tenantId = requireTenant(actor);
  if (!(await canReadEmployeeDocuments(actor, employeeId))) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, type, file_url, created_at, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`DOCUMENT_LIST_FAILED: ${error.message}`);
  }

  return ((data ?? []) as DocumentRow[]).map(toPublicRecord);
}

export async function uploadDocument(
  actor: Actor,
  input: { employeeId: string; type: DocumentType; file: File },
): Promise<DocumentRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const path = buildStoragePath(tenantId, input.employeeId, input.file.name ?? "document.bin");
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, bytes, { contentType: input.file.type || "application/octet-stream", upsert: false });

  if (uploadError) {
    throw new Error(`DOCUMENT_UPLOAD_FAILED: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      employee_id: input.employeeId,
      type: input.type,
      file_url: path,
    } as never)
    .select("id, tenant_id, employee_id, type, file_url, created_at, deleted_at")
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
    throw new Error(`DOCUMENT_RECORD_CREATE_FAILED: ${error.message}`);
  }

  const created = data as DocumentRow;
  await writeAudit(actor, "document.uploaded", created.id);
  return toPublicRecord(created);
}

export async function getSignedDownloadUrl(
  actor: Actor,
  documentId: string,
): Promise<string> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, type, file_url, created_at, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`DOCUMENT_FETCH_FAILED: ${error.message}`);
  }
  if (!data) throw new Error("NOT_FOUND");
  if (!(await canReadEmployeeDocuments(actor, (data as DocumentRow).employee_id))) {
    throw new Error("FORBIDDEN");
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl((data as DocumentRow).file_url, 60 * 10);

  if (signedErr || !signed?.signedUrl) {
    throw new Error(`DOCUMENT_SIGNED_URL_FAILED: ${signedErr?.message ?? "missing signed URL"}`);
  }

  return signed.signedUrl;
}

export async function softDeleteDocument(actor: Actor, documentId: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .select("id, tenant_id, employee_id, type, file_url, created_at, deleted_at")
    .maybeSingle();

  if (error) {
    throw new Error(`DOCUMENT_DELETE_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("NOT_FOUND");
  }

  await writeAudit(actor, "document.deleted", documentId);
}

export async function exportEmployeeDocumentsZip(
  actor: Actor,
  employeeId: string,
): Promise<Blob> {
  requireAdmin(actor);
  const docs = await listDocumentsForEmployee(actor, employeeId);
  const payload = JSON.stringify({
    generated_at: new Date().toISOString(),
    employee_id: employeeId,
    document_count: docs.length,
    documents: docs,
  });
  await writeAudit(actor, "document.assigned", employeeId);
  return new Blob([payload], { type: "application/json" });
}
