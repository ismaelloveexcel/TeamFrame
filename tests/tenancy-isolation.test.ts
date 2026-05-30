import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass Next's server-only guard so the service module can load under Node.
vi.mock("server-only", () => ({}));

// Record every chained Supabase call. The terminal awaited result is { data, error }.
type Call = { method: string; args: unknown[] };
const calls: Call[] = [];

function makeBuilder(terminalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "eq", "in", "order", "limit", "single", "maybeSingle", "insert", "update", "delete"]) {
    builder[m] = chain(m);
  }
  // Make the builder awaitable so `await supabase.from(..).select(..)..` resolves.
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(terminalResult);
  return builder;
}

const fakeClient = {
  from: (table: string) => {
    calls.push({ method: "from", args: [table] });
    return makeBuilder({
      data: [
        {
          id: "leave-1",
          tenant_id: "TENANT_A",
          employee_id: "emp-1",
          start_date: "2026-06-01",
          end_date: "2026-06-02",
          status: "pending",
          created_at: "2026-05-30T00:00:00Z",
          updated_at: "2026-05-30T00:00:00Z",
        },
      ],
      error: null,
    });
  },
};

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => fakeClient,
  createServerClient: () => fakeClient,
}));

// Avoid pulling Sentry/telemetry side effects.
vi.mock("@/lib/telemetry/track", () => ({ track: vi.fn(async () => {}) }));
vi.mock("@/services/onboardingService", () => ({
  maybeFireActivationCompleted: vi.fn(async () => {}),
}));

import { listLeavesForEmployee } from "@/services/leaveService";
import type { Actor } from "@/middleware/rbac";

beforeEach(() => {
  calls.length = 0;
});

describe("leaveService.listLeavesForEmployee tenancy filter", () => {
  it("applies exactly one .eq('tenant_id', actor.tenantId) filter and returns data", async () => {
    const actor: Actor = {
      authUserId: "user-1",
      email: "admin@example.com",
      employeeId: "emp-1",
      tenantId: "TENANT_A",
      role: "admin",
    };

    const result = await listLeavesForEmployee(actor, "emp-1");

    const tenantFilterCalls = calls.filter(
      (c) => c.method === "eq" && c.args[0] === "tenant_id",
    );

    // Regression guard: must be exactly one .eq("tenant_id", ...) and value must match actor.
    expect(tenantFilterCalls).toHaveLength(1);
    expect(tenantFilterCalls[0]?.args[1]).toBe("TENANT_A");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("leave-1");
  });
});
