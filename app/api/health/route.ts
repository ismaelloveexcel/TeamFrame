/**
 * TeamFrame — /api/health
 *
 * Public:  GET /api/health
 *   → 200 { status: "ok" }  |  503 { status: "degraded" }
 *
 * Authenticated (X-Healthcheck-Key header matches HEALTHCHECK_SECRET):
 *   → 200 { status, subsystems: { db, storage }, timestamp }
 *   → 503 same shape when any subsystem is degraded
 *
 * Design decisions:
 *  - force-dynamic: never cached by Next.js or a CDN
 *  - DB check: lightweight HEAD query via service-role client
 *  - Storage check: listBuckets() via service-role client
 *  - Subsystems run concurrently via Promise.allSettled
 *  - Each subsystem has a 2 s internal timeout
 *  - Overall response ceiling: 2.5 s (safety net via Promise.race)
 *  - Secret comparison: crypto.timingSafeEqual (constant-time)
 *  - Unauthenticated callers never see error details or stack traces
 *  - Auth subsystem probe: auth.admin.listUsers({ page: 1, perPage: 1 }) with 2 s timeout
 */

import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

export const dynamic = "force-dynamic";

const SUBSYSTEM_TIMEOUT_MS = 2000;
const AUTH_PROBE_TIMEOUT_MS = 2000;
const RESPONSE_CEILING_MS = 2500;

type SubsystemStatus = "ok" | "fail";

interface HealthResult {
  db: SubsystemStatus;
  storage: SubsystemStatus;
  auth: SubsystemStatus;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function checkDb(): Promise<SubsystemStatus> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await withTimeout(
      // HEAD query — no rows transferred, just tests the connection.
      supabase
        .from("companies")
        .select("id", { count: "planned", head: true })
        .limit(1) as unknown as Promise<{ error: unknown }>,
      SUBSYSTEM_TIMEOUT_MS,
    );
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

async function checkStorage(): Promise<SubsystemStatus> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await withTimeout(
      supabase.storage.listBuckets(),
      SUBSYSTEM_TIMEOUT_MS,
    );
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

async function checkAuth(): Promise<SubsystemStatus> {
  try {
    const supabase = createServiceRoleClient();
    // Attach .catch to prevent unhandled-rejection if this promise loses the race.
    const authPromise = supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    authPromise.catch(() => {});
    const { error } = await withTimeout(authPromise, AUTH_PROBE_TIMEOUT_MS);
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

/**
 * Constant-time secret comparison.
 * Compares BYTE-length (not String.length / UTF-16 code units) before passing
 * to timingSafeEqual, which requires equal-byte-length buffers and throws
 * RangeError otherwise. A non-ASCII header value with the same JS string
 * length as an ASCII secret would otherwise crash this public endpoint.
 */
function safeCompareSecret(candidate: string, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");
  if (candidateBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(candidateBuf, secretBuf);
}

function isAuthenticated(req: NextRequest): boolean {
  const secret = process.env.HEALTHCHECK_SECRET;
  if (!secret || secret.length === 0) return false;

  const candidate = req.headers.get("x-healthcheck-key") ?? "";
  return safeCompareSecret(candidate, secret);
}

// ─── route handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authenticated = isAuthenticated(req);
  const requestId = crypto.randomUUID();
  const start = Date.now();

  // Ceiling sentinel: resolves to null after 2.5 s.
  const ceiling = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), RESPONSE_CEILING_MS),
  );

  // Run subsystem checks concurrently, race against the overall ceiling.
  const checksPromise = Promise.allSettled([checkDb(), checkStorage(), checkAuth()]);
  const raceResult = await Promise.race([checksPromise, ceiling]);

  let result: HealthResult;

  if (raceResult === null) {
    // Ceiling exceeded — mark everything degraded and return immediately.
    result = { db: "fail", storage: "fail", auth: "fail" };

    const msg = "Health ceiling exceeded";
    logAction({
      action: "healthcheck",
      actorUserId: null,
      actorTenantId: null,
      durationMs: Date.now() - start,
      outcome: "fail",
      error: new Error(`[HEALTHCHECK_FAIL] ${msg}`),
      requestId,
    });
    captureActionError("healthcheck", new Error(msg), { requestId });
  } else {
    const [dbSettled, storageSettled, authSettled] = raceResult;

    const dbStatus: SubsystemStatus =
      dbSettled.status === "fulfilled" ? dbSettled.value : "fail";
    const storageStatus: SubsystemStatus =
      storageSettled.status === "fulfilled" ? storageSettled.value : "fail";
    const authStatus: SubsystemStatus =
      authSettled.status === "fulfilled" ? authSettled.value : "fail";

    result = { db: dbStatus, storage: storageStatus, auth: authStatus };

    const anyFail = dbStatus === "fail" || storageStatus === "fail" || authStatus === "fail";
    if (anyFail) {
      const msg = `[HEALTHCHECK_FAIL] db=${dbStatus} storage=${storageStatus} auth=${authStatus}`;
      logAction({
        action: "healthcheck",
        actorUserId: null,
        actorTenantId: null,
        durationMs: Date.now() - start,
        outcome: "fail",
        error: new Error(msg),
        requestId,
      });
      captureActionError("healthcheck", new Error(msg), { requestId });
    }
  }

  const overallStatus =
    result.db === "ok" && result.storage === "ok" && result.auth === "ok" ? "ok" : "degraded";
  const httpStatus = overallStatus === "ok" ? 200 : 503;

  if (authenticated) {
    return NextResponse.json(
      {
        status: overallStatus,
        subsystems: result,
        timestamp: new Date().toISOString(),
      },
      { status: httpStatus },
    );
  }

  // Unauthenticated callers receive only the terse status — no subsystem detail.
  return NextResponse.json({ status: overallStatus }, { status: httpStatus });
}
