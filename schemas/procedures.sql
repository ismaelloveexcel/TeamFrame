-- TeamFrame V1 -- procedures
-- Scope lock: ordered operational instructions, tenant-scoped.

create table if not exists procedures (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  title       text        not null,
  body        text        not null,
  version     integer     not null default 1,
  is_published boolean    not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  check (version >= 1)
);

alter table procedures add column if not exists tenant_id uuid;
alter table procedures add column if not exists version integer not null default 1;
alter table procedures add column if not exists is_published boolean not null default true;
alter table procedures add column if not exists updated_at timestamptz not null default now();

update procedures
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table procedures
  alter column tenant_id set not null;

do $$ begin
  alter table procedures
    add constraint procedures_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists procedures_tenant_id_idx on procedures(tenant_id);
create index if not exists procedures_archived_at_idx on procedures(archived_at);
create index if not exists procedures_published_idx on procedures(is_published);

create or replace function procedures_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists procedures_set_updated_at on procedures;
create trigger procedures_set_updated_at
before update on procedures
for each row
execute function procedures_touch_updated_at();
