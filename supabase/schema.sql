-- Nokia 3310 Snake II Online — Supabase Schema
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> New query -> Run

create table if not exists public.players (
  name_lower text primary key,
  name text not null,
  key_hash text not null,
  created_at bigint not null
);

create table if not exists public.scores (
  id text primary key,
  name text not null,
  name_lower text not null references public.players(name_lower) on delete cascade on update cascade,
  score integer not null,
  start_speed integer not null default 1,
  top_speed integer not null,
  maze integer not null,
  foods integer not null,
  length integer not null,
  duration_ms integer not null,
  created_at bigint not null
);

create index if not exists idx_scores_score on public.scores (score desc);
create index if not exists idx_scores_created_at on public.scores (created_at desc);
create index if not exists idx_scores_name_lower on public.scores (name_lower);

-- Lock down direct public/anon access; the Node.js server uses the service_role / secret key.
alter table public.players enable row level security;
alter table public.scores enable row level security;
