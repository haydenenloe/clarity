-- Clarity waitlist table
-- Run this in the Supabase SQL Editor or via Supabase CLI

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- Index for quick email lookups
create index if not exists waitlist_email_idx on public.waitlist (email);

-- Enable Row Level Security
alter table public.waitlist enable row level security;

-- Allow anyone to INSERT (anonymous waitlist signup)
create policy "Allow public insert" on public.waitlist
  for insert
  with check (true);

-- Only authenticated users (you) can SELECT
create policy "Allow authenticated select" on public.waitlist
  for select
  using (auth.role() = 'authenticated');
