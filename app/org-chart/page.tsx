import { requireTenantActor } from "@/middleware/rbac";
import { listOrgChart } from "@/services/employeeService";
import { OrgChart } from "@/components/OrgChart";
import Link from "next/link";

export default async function OrgChartPage() {
  const actor = await requireTenantActor();
  const employees = await listOrgChart(actor);

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex items-end justify-between border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">People</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Org chart</h1>
        </div>
        <Link
          href="/employees"
          className="text-[14px] text-ink-500 hover:text-ink-900 transition"
        >
          ← Employees
        </Link>
      </div>
      <div className="mt-8">
        <OrgChart employees={employees} />
      </div>
    </main>
  );
}
