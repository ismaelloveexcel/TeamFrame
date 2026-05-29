-- DEPRECATED: This file is superseded by schemas/tenancy_rls_v2.sql (Weekend 1 Phase 1A).
-- The email-fallback path in current_actor_tenant_id() has been removed in v2.
-- V2 has been applied to staging. Do NOT re-add the fallback.
-- Function BODIES below are intentionally unchanged — v2 redefines only
-- current_actor_tenant_id() and adds a comment on current_actor_email().
-- Apply v2 AFTER this file. See docs/launch/weekend-1-report.md for context.
-- TeamFrame V1 — tenant helpers + row level security
-- These policies are designed for authenticated JWT sessions.

create or replace function app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'employee'
  )::text;
$$;

create or replace function current_actor_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function current_actor_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    (
      select e.tenant_id
      from employees e
      where lower(e.email) = current_actor_email()
        and e.deleted_at is null
      order by e.created_at asc, e.id asc
      limit 1
    )
  );
$$;

create or replace function is_current_actor_admin()
returns boolean
language sql
stable
as $$
  select app_role() = 'admin';
$$;

alter table companies enable row level security;
alter table employees enable row level security;
alter table employee_profiles enable row level security;
alter table compensation enable row level security;
alter table documents enable row level security;
alter table leaves enable row level security;
alter table company_updates enable row level security;
alter table audit_logs enable row level security;
alter table analytics_events enable row level security;
alter table policies enable row level security;
alter table procedures enable row level security;
alter table acknowledgements enable row level security;
alter table onboarding_tasks enable row level security;

drop policy if exists analytics_events_select on analytics_events;
create policy analytics_events_select on analytics_events
for select
using (
  is_current_actor_admin()
  and (tenant_id is null or tenant_id = current_actor_tenant_id())
);

drop policy if exists companies_select_tenant_scoped on companies;
create policy companies_select_tenant_scoped on companies
for select
using (
  id = current_actor_tenant_id()
);

drop policy if exists companies_write_admin on companies;
create policy companies_write_admin on companies
for all
using (
  is_current_actor_admin()
  and id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and id = current_actor_tenant_id()
);

drop policy if exists employees_select on employees;
create policy employees_select on employees
for select
using (
  tenant_id = current_actor_tenant_id()
  and deleted_at is null
  and (
    is_current_actor_admin()
    or lower(email) = current_actor_email()
  )
);

drop policy if exists employees_insert on employees;
create policy employees_insert on employees
for insert
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists employees_update on employees;
create policy employees_update on employees
for update
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists employee_profiles_select on employee_profiles;
create policy employee_profiles_select on employee_profiles
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id
      from employees
      where lower(email) = current_actor_email()
        and tenant_id = current_actor_tenant_id()
        and deleted_at is null
    )
  )
);

drop policy if exists onboarding_tasks_select on onboarding_tasks;
create policy onboarding_tasks_select on onboarding_tasks
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id
      from employees
      where lower(email) = current_actor_email()
        and tenant_id = current_actor_tenant_id()
        and deleted_at is null
    )
  )
);

drop policy if exists onboarding_tasks_insert_admin on onboarding_tasks;
create policy onboarding_tasks_insert_admin on onboarding_tasks
for insert
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists onboarding_tasks_update_admin on onboarding_tasks;
create policy onboarding_tasks_update_admin on onboarding_tasks
for update
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists employee_profiles_write_admin on employee_profiles;
create policy employee_profiles_write_admin on employee_profiles
for all
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists compensation_admin_only on compensation;
create policy compensation_admin_only on compensation
for all
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists documents_select on documents;
create policy documents_select on documents
for select
using (
  tenant_id = current_actor_tenant_id()
  and deleted_at is null
  and (
    is_current_actor_admin()
    or employee_id in (
      select id
      from employees
      where lower(email) = current_actor_email()
        and deleted_at is null
    )
  )
);

drop policy if exists documents_write_admin on documents;
create policy documents_write_admin on documents
for all
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists leaves_select on leaves;
create policy leaves_select on leaves
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id
      from employees
      where lower(email) = current_actor_email()
        and deleted_at is null
    )
  )
);

drop policy if exists leaves_insert_self on leaves;
create policy leaves_insert_self on leaves
for insert
with check (
  tenant_id = current_actor_tenant_id()
  and employee_id in (
    select id
    from employees
    where lower(email) = current_actor_email()
      and deleted_at is null
  )
);

drop policy if exists leaves_update_admin on leaves;
create policy leaves_update_admin on leaves
for update
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists company_updates_select on company_updates;
create policy company_updates_select on company_updates
for select
using (
  tenant_id = current_actor_tenant_id()
);

drop policy if exists company_updates_write_admin on company_updates;
create policy company_updates_write_admin on company_updates
for all
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists audit_logs_admin_only on audit_logs;
create policy audit_logs_admin_only on audit_logs
for select
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists audit_logs_insert_admin on audit_logs;
create policy audit_logs_insert_admin on audit_logs
for insert
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists policies_select on policies;
create policy policies_select on policies
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or is_published
  )
);

drop policy if exists policies_write_admin on policies;
create policy policies_write_admin on policies
for all
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists procedures_select on procedures;
create policy procedures_select on procedures
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or is_published
  )
);

drop policy if exists procedures_write_admin on procedures;
create policy procedures_write_admin on procedures
for all
using (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
)
with check (
  is_current_actor_admin()
  and tenant_id = current_actor_tenant_id()
);

drop policy if exists acknowledgements_select on acknowledgements;
create policy acknowledgements_select on acknowledgements
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id
      from employees
      where lower(email) = current_actor_email()
        and deleted_at is null
    )
  )
);

drop policy if exists acknowledgements_insert on acknowledgements;
create policy acknowledgements_insert on acknowledgements
for insert
with check (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id
      from employees
      where lower(email) = current_actor_email()
        and deleted_at is null
    )
  )
);
