-- TeamFrame V1 — audit_logs
-- Scope lock: append-only trail for sensitive admin actions.
-- No compliance dashboards, no automated retention, no analytics.

create table if not exists audit_logs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid        not null references companies(id) on delete restrict,
  actor_user_id  uuid        not null,
  action_type    text        not null,
  target_id      uuid,
  "timestamp"    timestamptz not null default now()
);

alter table audit_logs add column if not exists tenant_id uuid;

update audit_logs
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table audit_logs
  alter column tenant_id set not null;

do $$ begin
  alter table audit_logs
    add constraint audit_logs_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists audit_logs_actor_idx     on audit_logs(actor_user_id);
create index if not exists audit_logs_target_idx    on audit_logs(target_id);
create index if not exists audit_logs_timestamp_idx on audit_logs("timestamp" desc);
create index if not exists audit_logs_tenant_id_idx on audit_logs(tenant_id);
