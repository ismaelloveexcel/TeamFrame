-- TeamFrame V1 — onboarding_tasks
-- Scope lock: assign + complete only.
-- No multi-step workflows, no templates, no due dates, no notifications.

do $$ begin
  create type onboarding_task_status as enum ('pending', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists onboarding_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid        not null references companies(id) on delete restrict,
  employee_id  uuid        not null references employees(id) on delete cascade,
  title        text        not null check (char_length(trim(title)) > 0),
  status       onboarding_task_status not null default 'pending',
  assigned_by  uuid        not null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint onboarding_completed_at_check check (
    (status = 'completed' and completed_at is not null) or
    (status = 'pending'   and completed_at is null)
  )
);

create index if not exists onboarding_tasks_employee_id_idx on onboarding_tasks(employee_id);
create index if not exists onboarding_tasks_tenant_id_idx   on onboarding_tasks(tenant_id);
create index if not exists onboarding_tasks_status_idx      on onboarding_tasks(status);

create or replace function onboarding_tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists onboarding_tasks_set_updated_at on onboarding_tasks;
create trigger onboarding_tasks_set_updated_at
before update on onboarding_tasks
for each row
execute function onboarding_tasks_touch_updated_at();
