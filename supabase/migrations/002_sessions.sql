create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audio_path text,
  status text not null default 'uploading', -- uploading | transcribing | analyzing | complete | error
  transcript text,
  notes jsonb, -- structured session notes from Claude
  session_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Users can only access their own sessions" on public.sessions
  for all using (auth.uid() = user_id);

create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_date_idx on public.sessions(session_date desc);
