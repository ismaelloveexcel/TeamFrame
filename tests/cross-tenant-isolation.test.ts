import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass Next's server-only guard so service modules can load under Node.
vi.mock("server-only", () => ({}));

type LeaveRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

// Mixed-tenant dataset. If the service-layer filter is removed (or weakened),
// rows from TENANT_B will leak into a TENANT_A actor's query result and these
// tests will fail loudly. RLS is bypassed by the service-role client in
// production, so this is the layer that must hold the line.
const MIXED_LEAVES: LeaveRow[] = [
  {
    id: "leave-a1",
    tenant_id: "TENANT_A",
    employee_id: "emp-a",
    start_date: "2026-06-01",
    end_date: "2026-06-02",
    status: "pending",
    created_at: "2026-05-30T00:00:00Z",
    updated_at: "2026-05-30T00:00:00Z",
  },
  {
    id: "leave-a2",
    tenant_id: "TENANT_A",
    employee_id: "emp-a",
    start_date: "2026-07-01",
    end_date: "2026-07-02",
    status: "approved",
    created_at: "2026-05-30T00:00:00Z",
    updated_at: "2026-05-30T00:00:00Z",
  },
  {
    id: "leave-b1",
    tenant_id: "TENANT_B",
    employee_id: "emp-b",
    start_date: "2026-06-15",
    end_date: "2026-06-16",
    status: "pending",
    created_at: "2026-05-30T00:00:00Z",
    updated_at: "2026-05-30T00:00:00Z",
  },
];

type FilterOp = { kind: "eq"; column: string; value: unknown };

function makeFilteringBuilder(table: string, dataset: ReadonlyArray<Record<string, unknown>>) {
  const filters: FilterOp[] = [];
  const builder: Record<string, unknown> = {};

  builder.select = (..._args: unknown[]) => builder;
  builder.order = (..._args: unknown[]) => builder;
  builder.limit = (..._args: unknown[]) => builder;
  builder.in = (..._args: unknown[]) => builder;

  builder.eq = (column: string, value: unknown) => {
    filters.push({ kind: "eq", column, value });
    return builder;
  };

  const resolve = () => {
    const filtered = dataset.filter((row) =>
      filters.every((f) => row[f.column] === f.value),
    );
    return { data: filtered, error: null };
  };

  builder.maybeSingle = async () => {
    const r = resolve();
    return { data: r.data[0] ?? null, error: r.error };
  };
  builder.single = async () => {
    const r = resolve();
    if (r.data.length === 0) return { data: null, error: { message: "no rows" } };
    return { data: r.data[0], error: r.error };
  };

  // Awaitable so `await supabase.from(table).select(...).eq(...)...` resolves
  // to PostgREST-shaped `{ data, error }`.
  (builder as { then: (resolve: (v: unknown) => unknown) => unknown }).then = (
    resolveFn,
  ) => resolveFn(resolve());

  // Surface table name on the builder for assertions if ever needed.
  (builder as { __table: string }).__table = table;

  return builder;
}

const fakeClient = {
  from: (table: string) => {
    if (table === "leaves") return makeFilteringBuilder(table, MIXED_LEAVES);
    // Other tables: return empty filtering builder so unrelated queries don't crash.
    return makeFilteringBuilder(table, []);
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

import { listLeavesForEmployee, listPendingLeavesWithEmployee } from "@/services/leaveService";
import type { Actor } from "@/middleware/rbac";

const actorA: Actor = {
  authUserId: "user-a",
  email: "admin-a@example.com",
  employeeId: "emp-a",
  tenantId: "TENANT_A",
  role: "admin",
};

const actorB: Actor = {
  authUserId: "user-b",
  email: "admin-b@example.com",
  employeeId: "emp-b",
  tenantId: "TENANT_B",
  role: "admin",
};

describe("leaveService cross-tenant isolation", () => {
  beforeEach(() => {
    // No shared mutable state per test beyond the dataset itself, which is read-only.
  });

  it("listLeavesForEmployee(actorA, 'emp-a') returns only TENANT_A rows from a mixed-tenant dataset", async () => {
    const result = await listLeavesForEmployee(actorA, "emp-a");

    expect(result).toHaveLength(2);
    for (const row of result) {
      // tenant_id is stripped from the returned shape, so we assert on ids.
      expect(["leave-a1", "leave-a2"]).toContain(row.id);
    }
    // The TENANT_B row must never appear.
    expect(result.find((r) => r.id === "leave-b1")).toBeUndefined();
  });

  it("listLeavesForEmployee(actorB, 'emp-b') returns only TENANT_B rows", async () => {
    const result = await listLeavesForEmployee(actorB, "emp-b");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("leave-b1");
  });

  it("listPendingLeavesWithEmployee(actorA) returns only TENANT_A pending rows", async () => {
    const result = await listPendingLeavesWithEmployee(actorA);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("leave-a1");
    // The TENANT_B pending row must not leak.
    expect(result.find((r) => r.id === "leave-b1")).toBeUndefined();
  });

  it("listPendingLeavesWithEmployee(actorB) returns only TENANT_B pending rows", async () => {
    const result = await listPendingLeavesWithEmployee(actorB);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("leave-b1");
  });
});
