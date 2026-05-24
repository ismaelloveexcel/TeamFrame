"use server";

import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { trackExportEvent } from "@/services/validationService";

const ExportTrackSchema = z.object({
  exportType: z.string().trim().min(1).max(50),
  recordCount: z.number().int().min(0),
  unresolvedIssues: z.number().int().min(0),
  includeInactive: z.boolean(),
  readinessStatus: z.enum(["ready", "blocked"]),
});

export async function trackExportAction(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requireTenantActor();
    const parsed = ExportTrackSchema.parse(input);

    await trackExportEvent(actor, {
      exportType: parsed.exportType,
      recordCount: parsed.recordCount,
      unresolvedIssues: parsed.unresolvedIssues,
      includeInactive: parsed.includeInactive,
      readinessStatus: parsed.readinessStatus,
    });

    return { ok: true };
  } catch {
    return { ok: false, message: "Could not store export history. Retry tracking." };
  }
}
