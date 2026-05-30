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
-- Formula:  R = ( (C * m) + SUM(player_points) ) / (C + v)
--   C  = average gp_played across all players (confidence weight)
--   m  = global mean score of all positions ever played
--   v  = this player's total GP count
-- =============================================================

create or replace function recalculate_ratings()
returns trigger
language plpgsql
as $$
declare
  v_global_avg_gp   float;
  v_global_avg_pts  float;
  rec               record;
  v_sum_points      float;
  v_gp_count        int;
  v_new_rating      float;
begin
  -- 1. Global average GP count across all players (C)
  select coalesce(avg(gp_played), 1)
    into v_global_avg_gp
    from players;

  -- 2. Global average points per race entry (m)
  --    = avg of all position_points joined to all race_results
  select coalesce(avg(pp.points), 0)
    into v_global_avg_pts
    from race_results rr
    join position_points pp on pp.position = rr.position;

  -- 3. For each player that appears in the triggering match,
  --    recalculate their full rating.
  for rec in
    select distinct player_id
      from race_results
     where match_id = new.match_id
  loop
    -- Sum of all points this player has ever scored
    select coalesce(sum(pp.points), 0), count(*)
      into v_sum_points, v_gp_count
      from race_results rr
      join position_points pp on pp.position = rr.position
     where rr.player_id = rec.player_id;

    -- Bayesian average
    -- R = ( (C * m) + sum(points) ) / (C + v)
    v_new_rating := (
      (v_global_avg_gp * v_global_avg_pts) + v_sum_points
    ) / (v_global_avg_gp + v_gp_count);

    update players
       set rating    = round(v_new_rating::numeric, 4),
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
