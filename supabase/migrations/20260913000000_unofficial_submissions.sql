-- Adds support for player-submitted ("Unofficial") games.
-- Additive only: existing columns, rows, and RPCs (record_visit, cast_vote,
-- get_my_votes) are untouched.

alter table public.games
  add column if not exists category text not null default 'Official',
  add column if not exists status text not null default 'approved',
  add column if not exists description text,
  add column if not exists submitted_by text,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_category_check'
  ) then
    alter table public.games
      add constraint games_category_check check (category in ('Official', 'Unofficial'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'games_status_check'
  ) then
    alter table public.games
      add constraint games_status_check check (status in ('approved', 'rejected'));
  end if;
end $$;

-- One row per submission attempt (approved or not) — used for per-anon
-- rate limiting and as an audit trail. Only the edge function's service
-- role touches this table; no RLS policies are granted to anon.
create table if not exists public.game_submission_log (
  id bigint generated always as identity primary key,
  anon_id text not null,
  url text not null,
  slug text,
  verdict smallint,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.game_submission_log enable row level security;

create index if not exists game_submission_log_anon_id_created_at_idx
  on public.game_submission_log (anon_id, created_at);
