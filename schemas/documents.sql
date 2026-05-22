-- TeamFrame V1 — documents
-- Scope lock: upload, download, grouped export only.
-- No e-signatures, no approvals, no versioning, no retention engine, no legal workflow.

do $$ begin
  create type document_type as enum ('CV', 'CONTRACT', 'JD', 'PHOTO');
exception when duplicate_object then null; end $$;

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  employee_id uuid        not null references employees(id) on delete cascade,
  type        document_type not null,
  file_url    text        not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

alter table documents add column if not exists tenant_id uuid;

update documents d
set tenant_id = e.tenant_id
from employees e
where d.employee_id = e.id
  and d.tenant_id is null;

alter table documents
  alter column tenant_id set not null;

do $$ begin
  alter table documents
    add constraint documents_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists documents_employee_id_idx on documents(employee_id);
create index if not exists documents_tenant_id_idx   on documents(tenant_id);
create index if not exists documents_type_idx        on documents(type);
create index if not exists documents_deleted_at_idx  on documents(deleted_at);
