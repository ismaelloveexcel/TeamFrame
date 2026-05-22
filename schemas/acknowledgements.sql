-- TeamFrame V1 -- acknowledgements
-- Immutable acceptance events of a specific policy version by an employee.

create table if not exists acknowledgements (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid        not null references companies(id) on delete restrict,
  policy_id      uuid        not null references policies(id) on delete restrict,
  policy_version integer     not null,
  employee_id    uuid        not null references employees(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  check (policy_version >= 1)
);

alter table acknowledgements add column if not exists tenant_id uuid;
alter table acknowledgements add column if not exists policy_version integer not null default 1;

update acknowledgements a
set tenant_id = e.tenant_id
from employees e
where a.employee_id = e.id
  and a.tenant_id is null;

alter table acknowledgements
  alter column tenant_id set not null;

do $$ begin
  alter table acknowledgements
    add constraint acknowledgements_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acknowledgements_unique_policy_employee_version'
      and conrelid = 'acknowledgements'::regclass
  ) then
    alter table acknowledgements
      add constraint acknowledgements_unique_policy_employee_version
        unique (tenant_id, policy_id, policy_version, employee_id);
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create index if not exists acknowledgements_tenant_id_idx on acknowledgements(tenant_id);
create index if not exists acknowledgements_employee_id_idx on acknowledgements(employee_id);
create index if not exists acknowledgements_policy_id_idx on acknowledgements(policy_id);
create index if not exists acknowledgements_acknowledged_at_idx on acknowledgements(acknowledged_at desc);
