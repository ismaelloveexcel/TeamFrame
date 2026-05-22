-- TeamFrame V1 — companies (tenant root)
-- Every operational row in TeamFrame is scoped to exactly one company.

create extension if not exists "pgcrypto";

create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists companies_slug_idx on companies(slug);

-- Bootstrap a deterministic local tenant so schema upgrades can backfill rows.
insert into companies (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'Default Company',
  'default-company'
)
on conflict (id) do nothing;
