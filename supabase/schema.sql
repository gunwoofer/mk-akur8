-- =============================================================
-- MK Akur8 — Full Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- ── Enable UUID generation ──────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Players ─────────────────────────────────────────────────
create table if not exists players (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  character_avatar text not null default '🏎️',
  rating           float not null default 0.0,
  gp_played        int not null default 0,
  created_at       timestamptz not null default now()
);

-- ── Matches ─────────────────────────────────────────────────
create table if not exists matches (
  id        uuid primary key default gen_random_uuid(),
  played_at timestamptz not null default now()
);

-- ── Race Results ─────────────────────────────────────────────
create table if not exists race_results (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  position  int not null check (position between 1 and 24),
  unique (match_id, player_id),
  unique (match_id, position)
);

-- ── Points table (lookup) ────────────────────────────────────
create table if not exists position_points (
  position int primary key check (position between 1 and 24),
  points   int not null
);

insert into position_points (position, points) values
  (1,  15), (2,  12), (3,  10), (4,   9),
  (5,   8), (6,   7), (7,   6), (8,   5),
  (9,   4), (10,  3), (11,  2), (12,  1),
  (13,  0), (14,  0), (15,  0), (16,  0),
  (17,  0), (18,  0), (19,  0), (20,  0),
  (21,  0), (22,  0), (23,  0), (24,  0)
on conflict do nothing;

-- =============================================================
-- BAYESIAN RATING STORED PROCEDURE
-- Fires after every insert into race_results.
--
-- Formula:  R = SUM(player_points) / (C + v)
--   C  = 20  fixed phantom games at 0 pts (confidence prior)
--   v  = this player's total GP count
--
-- Semantics: every player starts as if they played 20 races
-- scoring zero. Rating is earned purely through real results.
-- Max rating approaches 15 (P1 every race) asymptotically.
-- A newcomer needs ~20 real GPs to dilute the prior enough
-- to challenge a consistent front-runner with the same count.
-- =============================================================

create or replace function recalculate_ratings()
returns trigger
language plpgsql
as $$
declare
  rec          record;
  v_sum_points float;
  v_gp_count   int;
begin
  for rec in
    select distinct player_id
      from race_results
     where match_id = new.match_id
  loop
    select coalesce(sum(pp.points), 0), count(*)
      into v_sum_points, v_gp_count
      from race_results rr
      join position_points pp on pp.position = rr.position
     where rr.player_id = rec.player_id;

    -- R = sum_points / (20 + gp_count)
    update players
       set rating    = round((v_sum_points / (20.0 + v_gp_count))::numeric, 4),
           gp_played = v_gp_count
     where id = rec.player_id;
  end loop;

  return new;
end;
$$;

-- Trigger: fires once per row inserted into race_results
drop trigger if exists trg_recalculate_ratings on race_results;
create trigger trg_recalculate_ratings
  after insert on race_results
  for each row
  execute function recalculate_ratings();

-- =============================================================
-- ROW LEVEL SECURITY (open read, anon can insert via API key)
-- =============================================================

alter table players      enable row level security;
alter table matches      enable row level security;
alter table race_results enable row level security;

-- Public read
create policy "Public read players"      on players      for select using (true);
create policy "Public read matches"      on matches      for select using (true);
create policy "Public read race_results" on race_results for select using (true);

-- Anon insert (admin app uses anon key)
create policy "Anon insert players"      on players      for insert with check (true);
create policy "Anon insert matches"      on matches      for insert with check (true);
create policy "Anon insert race_results" on race_results for insert with check (true);

-- Anon update (ratings updated by trigger, and player CRUD)
create policy "Anon update players"      on players      for update using (true);
create policy "Anon delete players"      on players      for delete using (true);

-- =============================================================
-- REALTIME: enable publications for live leaderboard
-- =============================================================

-- Supabase Realtime listens to the supabase_realtime publication.
-- Add our tables so the dashboard receives push updates.
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table race_results;
