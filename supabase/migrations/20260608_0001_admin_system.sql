-- ══════════════════════════════════════════════════════════════════
-- Meridian Admin System — Migration 001
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════════════

-- ── Admin Users ───────────────────────────────────────────────────
create table if not exists admin_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  role         text not null check (role in ('super_admin','admin','analyst','support','clinician_readonly')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists admin_users_user_id_idx on admin_users(user_id);

-- ── Admin Activity Logs ───────────────────────────────────────────
create table if not exists admin_activity_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references auth.users(id),
  action         text not null,
  resource_type  text,
  resource_id    text,
  metadata       jsonb,
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index if not exists admin_activity_logs_admin_user_id_idx on admin_activity_logs(admin_user_id);
create index if not exists admin_activity_logs_created_at_idx   on admin_activity_logs(created_at desc);

-- ── Notifications ─────────────────────────────────────────────────
create table if not exists notifications (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  body             text not null,
  type             text not null check (type in ('in_app','email','push','system_alert','safety_alert')),
  status           text not null default 'draft' check (status in ('draft','scheduled','sending','sent','archived')),
  target_segment   text not null default 'all',
  segment_filters  jsonb,
  recipient_count  integer default 0,
  created_by       uuid references auth.users(id),
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists notifications_status_idx     on notifications(status);
create index if not exists notifications_created_at_idx on notifications(created_at desc);

-- ── Notification Recipients ───────────────────────────────────────
create table if not exists notification_recipients (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references notifications(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  delivered        boolean not null default false,
  opened           boolean not null default false,
  clicked          boolean not null default false,
  delivered_at     timestamptz,
  opened_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique(notification_id, user_id)
);

create index if not exists notification_recipients_notification_id_idx on notification_recipients(notification_id);
create index if not exists notification_recipients_user_id_idx         on notification_recipients(user_id);

-- ── Row Level Security ────────────────────────────────────────────
-- All admin tables are locked to service role only.
-- Application layer uses the service role key — RLS is a hard backstop.

alter table admin_users            enable row level security;
alter table admin_activity_logs    enable row level security;
alter table notifications          enable row level security;
alter table notification_recipients enable row level security;

-- No public/anon/authenticated access — service role bypasses RLS automatically
drop policy if exists "no_public_access" on admin_users;
create policy "no_public_access" on admin_users            for all to public using (false);
drop policy if exists "no_public_access" on admin_activity_logs;
create policy "no_public_access" on admin_activity_logs    for all to public using (false);
drop policy if exists "no_public_access" on notifications;
create policy "no_public_access" on notifications          for all to public using (false);
drop policy if exists "no_public_access" on notification_recipients;
create policy "no_public_access" on notification_recipients for all to public using (false);

-- ── Seed: insert your own user_id as super_admin ─────────────────
-- Replace <YOUR_AUTH_USER_ID> with your UUID from auth.users
-- insert into admin_users (user_id, role) values ('<YOUR_AUTH_USER_ID>', 'super_admin');
