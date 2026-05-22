-- TeamFrame V1 -- policies
-- Scope lock: versioned governance rules, tenant-scoped.

create table if not exists policies (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  title       text        not null,
  body        text        not null,
  version     integer     not null default 1,
  is_published boolean    not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  check (version >= 1)
);

alter table policies add column if not exists tenant_id uuid;
alter table policies add column if not exists version integer not null default 1;
alter table policies add column if not exists is_published boolean not null default false;
alter table policies add column if not exists updated_at timestamptz not null default now();

update policies
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table policies
  alter column tenant_id set not null;

do $$ begin
  alter table policies
    add constraint policies_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists policies_tenant_id_idx on policies(tenant_id);
create index if not exists policies_archived_at_idx on policies(archived_at);
create index if not exists policies_published_idx on policies(is_published);

create or replace function policies_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists policies_set_updated_at on policies;
create trigger policies_set_updated_at
before update on policies
for each row
execute function policies_touch_updated_at();
