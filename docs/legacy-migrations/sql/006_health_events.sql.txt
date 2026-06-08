-- Meridian Health Agenda — Health Events
-- Creates the health_events table used by /timeline and the dashboard agenda card.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  event_type text not null default 'appointment'
    check (event_type in ('appointment', 'lab', 'inbody', 'imaging', 'other')),

  title text,
  specialty text not null,
  provider_name text,
  location text,
  is_virtual boolean not null default false,
  starts_at timestamptz not null,
  reason text,

  symptoms_notes text,
  medications_to_review text,
  supplements_to_review text,
  related_lab_ids uuid[] not null default '{}',
  things_to_bring text,
  user_questions text,

  ai_suggested_questions jsonb,
  prep_status text not null default 'not_started'
    check (prep_status in ('not_started', 'in_progress', 'ready')),

  outcome_notes text,
  follow_up_tasks text,
  follow_up_date date,

  status text not null default 'upcoming'
    check (status in ('upcoming', 'completed', 'cancelled', 'needs_follow_up')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_health_events_updated_at on public.health_events;
create trigger set_health_events_updated_at
before update on public.health_events
for each row
execute function public.set_updated_at();

alter table public.health_events enable row level security;

drop policy if exists "Users can view their own health events" on public.health_events;
create policy "Users can view their own health events"
on public.health_events
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own health events" on public.health_events;
create policy "Users can insert their own health events"
on public.health_events
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own health events" on public.health_events;
create policy "Users can update their own health events"
on public.health_events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own health events" on public.health_events;
create policy "Users can delete their own health events"
on public.health_events
for delete
using (auth.uid() = user_id);

create index if not exists health_events_user_id_idx
on public.health_events(user_id);

create index if not exists health_events_user_starts_at_idx
on public.health_events(user_id, starts_at);

create index if not exists health_events_user_status_starts_at_idx
on public.health_events(user_id, status, starts_at);
