-- TeamFrame V1 — compensation
-- Scope lock: storage only. No payroll runs, no tax logic, no benefits, no benchmarking.
-- Access is admin-only and must never be exposed via the org chart or any employee-facing surface.

create table if not exists compensation (
  tenant_id    uuid        not null references companies(id) on delete restrict,
  employee_id  uuid primary key references employees(id) on delete cascade,
  base_salary  numeric(14,2) not null,
  currency     char(3)       not null,
  grade_band   text
);

alter table compensation drop constraint if exists compensation_pkey;

alter table compensation add column if not exists tenant_id uuid;

update compensation c
set tenant_id = e.tenant_id
from employees e
where c.employee_id = e.id
  and c.tenant_id is null;

alter table compensation
  alter column tenant_id set not null;

do $$ begin
  alter table compensation
    add constraint compensation_pkey primary key (employee_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table compensation
    add constraint compensation_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists compensation_tenant_id_idx on compensation(tenant_id);
