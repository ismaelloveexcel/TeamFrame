-- TeamFrame V1 — employee_profiles
-- Scope lock: lightweight profile fields only. No personality data, no scoring, no inferred traits.

create table if not exists employee_profiles (
  tenant_id         uuid        not null references companies(id) on delete restrict,
  employee_id      uuid primary key references employees(id) on delete cascade,
  bio              text,
  photo_url        text,
  personal_details jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

alter table employee_profiles add column if not exists tenant_id uuid;

update employee_profiles ep
set tenant_id = e.tenant_id
from employees e
where ep.employee_id = e.id
  and ep.tenant_id is null;

alter table employee_profiles
  alter column tenant_id set not null;

do $$ begin
  alter table employee_profiles
    add constraint employee_profiles_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists employee_profiles_tenant_id_idx on employee_profiles(tenant_id);
