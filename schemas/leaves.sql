-- TeamFrame V1 — leaves
-- Scope lock: minimal request/approve/reject only.
-- No accrual engine, no policy automation, no calendar integrations, no balances dashboard.

do $$ begin
  create type leave_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists leaves (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  employee_id uuid        not null references employees(id) on delete cascade,
  start_date  date        not null,
  end_date    date        not null,
  status      leave_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table leaves add column if not exists tenant_id uuid;
alter table leaves add column if not exists updated_at timestamptz not null default now();

update leaves l
set tenant_id = e.tenant_id
from employees e
where l.employee_id = e.id
  and l.tenant_id is null;

alter table leaves
  alter column tenant_id set not null;

do $$ begin
  alter table leaves
    add constraint leaves_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists leaves_employee_id_idx on leaves(employee_id);
create index if not exists leaves_tenant_id_idx   on leaves(tenant_id);
create index if not exists leaves_status_idx      on leaves(status);

create or replace function leaves_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists leaves_set_updated_at on leaves;
create trigger leaves_set_updated_at
before update on leaves
for each row
execute function leaves_touch_updated_at();
