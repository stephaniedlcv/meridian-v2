-- Meridian Health Agenda — Lab Documents
-- Creates the lab_documents table used by /timeline lab document attachments.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.lab_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  lab_date date,
  specialty text,

  storage_path text not null,
  file_name text,
  file_size bigint,
  file_type text,
  notes text,

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

drop trigger if exists set_lab_documents_updated_at on public.lab_documents;
create trigger set_lab_documents_updated_at
before update on public.lab_documents
for each row
execute function public.set_updated_at();

alter table public.lab_documents enable row level security;

drop policy if exists "Users can view their own lab documents" on public.lab_documents;
create policy "Users can view their own lab documents"
on public.lab_documents
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own lab documents" on public.lab_documents;
create policy "Users can insert their own lab documents"
on public.lab_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own lab documents" on public.lab_documents;
create policy "Users can update their own lab documents"
on public.lab_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own lab documents" on public.lab_documents;
create policy "Users can delete their own lab documents"
on public.lab_documents
for delete
using (auth.uid() = user_id);

create index if not exists lab_documents_user_id_idx
on public.lab_documents(user_id);

create index if not exists lab_documents_user_lab_date_idx
on public.lab_documents(user_id, lab_date desc nulls last);

create unique index if not exists lab_documents_storage_path_idx
on public.lab_documents(storage_path);

insert into storage.buckets (id, name, public)
values ('lab-documents', 'lab-documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own lab documents" on storage.objects;
create policy "Users can upload their own lab documents"
on storage.objects
for insert
with check (
  bucket_id = 'lab-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can view their own lab documents" on storage.objects;
create policy "Users can view their own lab documents"
on storage.objects
for select
using (
  bucket_id = 'lab-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own lab documents" on storage.objects;
create policy "Users can update their own lab documents"
on storage.objects
for update
using (
  bucket_id = 'lab-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'lab-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own lab documents" on storage.objects;
create policy "Users can delete their own lab documents"
on storage.objects
for delete
using (
  bucket_id = 'lab-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);
