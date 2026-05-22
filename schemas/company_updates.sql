-- TeamFrame V1 — company_updates
-- Scope lock: simple announcement feed. No targeting, no scheduling, no notification engine.

create table if not exists company_updates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid        not null references companies(id) on delete restrict,
  type       text        not null,
  content    text        not null,
  created_at timestamptz not null default now()
);

alter table company_updates add column if not exists tenant_id uuid;

update company_updates
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table company_updates
  alter column tenant_id set not null;

do $$ begin
  alter table company_updates
    add constraint company_updates_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists company_updates_created_at_idx on company_updates(created_at desc);
create index if not exists company_updates_tenant_id_idx  on company_updates(tenant_id);
