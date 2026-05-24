-- TeamFrame V1 -- validation tracking
-- Scope: minimal, tenant-scoped operational telemetry for launch validation.

create table if not exists workspace_validation_states (
  tenant_id                             uuid primary key references companies(id) on delete restrict,
  workspace_created_at                  timestamptz not null default now(),
  trial_status                          text        not null default 'trial',
  plan_label                            text        not null default 'validation',
  activation_state                      text        not null default 'not_started',
  onboarding_completion_state           text        not null default 'not_started',
  first_import_completed_at             timestamptz,
  first_payroll_ready_validation_at     timestamptz,
  first_export_generated_at             timestamptz,
  onboarding_completed_at               timestamptz,
  export_count                          integer     not null default 0,
  last_export_at                        timestamptz,
  unresolved_readiness_issues           integer     not null default 0,
  last_active_at                        timestamptz,
  created_at                            timestamptz not null default now(),
  updated_at                            timestamptz not null default now(),
  check (trial_status in ('trial', 'pilot', 'active', 'expired')),
  check (activation_state in ('not_started', 'activated')),
  check (onboarding_completion_state in ('not_started', 'in_progress', 'completed')),
  check (export_count >= 0),
  check (unresolved_readiness_issues >= 0)
);

create table if not exists export_history (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid        not null references companies(id) on delete restrict,
  actor_user_id         text        not null,
  actor_email           text        not null,
  export_type           text        not null default 'finance_csv',
  record_count          integer     not null,
  readiness_status      text        not null,
  unresolved_issues     integer     not null,
  include_inactive      boolean     not null default false,
  created_at            timestamptz not null default now(),
  check (record_count >= 0),
  check (unresolved_issues >= 0),
  check (readiness_status in ('ready', 'blocked'))
);

create index if not exists export_history_tenant_created_idx
  on export_history(tenant_id, created_at desc);

create index if not exists export_history_tenant_type_idx
  on export_history(tenant_id, export_type);

create or replace function workspace_validation_states_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists workspace_validation_states_set_updated_at on workspace_validation_states;
create trigger workspace_validation_states_set_updated_at
before update on workspace_validation_states
for each row
execute function workspace_validation_states_touch_updated_at();

insert into workspace_validation_states (tenant_id, workspace_created_at)
select c.id, c.created_at
from companies c
on conflict (tenant_id) do nothing;
