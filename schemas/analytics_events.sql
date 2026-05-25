-- TeamFrame V1 — analytics_events
-- Scope: internal, server-only funnel telemetry. No third-party analytics.
-- Emitted only from successful server mutations (never from the client).

create table if not exists analytics_events (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        references companies(id) on delete cascade,
  user_id           uuid,
  event_name        text        not null,
  event_properties  jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists analytics_events_tenant_idx  on analytics_events(tenant_id);
create index if not exists analytics_events_event_idx   on analytics_events(event_name);
create index if not exists analytics_events_created_idx on analytics_events(created_at desc);

-- 'first_*' events fire at most once per tenant.
create unique index if not exists analytics_events_first_unique
  on analytics_events(tenant_id, event_name)
  where event_name like 'first_%' and tenant_id is not null;
