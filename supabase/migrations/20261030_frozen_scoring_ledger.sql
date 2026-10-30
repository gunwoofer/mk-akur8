-- Frozen scoring: every GP writes its scores into rating_changes once, at submission.
-- Changing position_points / scoring_settings only affects GPs submitted afterwards.
-- Deleting a GP re-scores the GPs after it (with the current rules).

alter table players add column if not exists archived_at timestamptz;

create table rating_changes (
  match_id      uuid not null references matches(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  played_at     timestamptz not null,
  season        text not null,              -- YYYY-MM in America/Montreal
  position      int not null,
  points        int not null,
  total_points  int not null,
  gp_count      int not null,
  rating_before double precision not null,
  rating_after  double precision not null,
  season_points int not null,
  season_gp     int not null,
  season_p1     int not null,
  season_rating double precision not null,
  primary key (match_id, player_id)
);
create index rating_changes_player_order on rating_changes (player_id, played_at, match_id);
create index matches_order on matches (played_at, id);

alter table rating_changes enable row level security;
create policy "Public read rating_changes" on rating_changes for select using (true);

-- A player's standing in a season = their last ledger row in that month.
create view season_standings with (security_invoker = true) as
select distinct on (season, player_id)
       season, player_id, season_points, season_gp, season_p1, season_rating,
       rating_after as global_rating
  from rating_changes
 order by season, player_id, played_at desc, match_id desc;

create view season_summaries with (security_invoker = true) as
select season, count(distinct match_id)::int as gp_count
  from rating_changes
 group by season;

create or replace function score_gp(p_match uuid)
returns void language plpgsql as $$
declare
  v_played_at    timestamptz;
  v_season       text;
  v_global_prior int;
  v_season_prior int;
  r              record;
  v_points       int;
  v_prev_total   int;
  v_prev_gp      int;
  v_prev_rating  double precision;
  v_prev_season  text;
  v_prev_spts    int;
  v_prev_sgp     int;
  v_prev_sp1     int;
  v_total        int;
  v_gp           int;
begin
  select played_at into v_played_at from matches where id = p_match;
  v_season := to_char(v_played_at at time zone 'America/Montreal', 'YYYY-MM');
  select global_prior, season_prior into v_global_prior, v_season_prior from scoring_settings;

  for r in select player_id, position from race_results where match_id = p_match loop
    v_points := coalesce((select points from position_points where position = r.position), 0);

    select total_points, gp_count, rating_after, season, season_points, season_gp, season_p1
      into v_prev_total, v_prev_gp, v_prev_rating, v_prev_season, v_prev_spts, v_prev_sgp, v_prev_sp1
      from rating_changes
     where player_id = r.player_id
       and (played_at, match_id) < (v_played_at, p_match)
     order by played_at desc, match_id desc
     limit 1;

    if v_prev_season is distinct from v_season then
      v_prev_spts := 0; v_prev_sgp := 0; v_prev_sp1 := 0;
    end if;

    v_total := coalesce(v_prev_total, 0) + v_points;
    v_gp    := coalesce(v_prev_gp, 0) + 1;

    insert into rating_changes values (
      p_match, r.player_id, v_played_at, v_season, r.position, v_points,
      v_total, v_gp,
      coalesce(v_prev_rating, 0),
      round(v_total::numeric / (v_global_prior + v_gp), 4),
      v_prev_spts + v_points,
      v_prev_sgp + 1,
      v_prev_sp1 + (r.position = 1)::int,
      (v_prev_spts + v_points)::double precision / (v_season_prior + v_prev_sgp + 1)
    );
  end loop;
end;
$$;

-- players.rating / gp_played mirror each player's latest ledger row.
create or replace function sync_player_ratings()
returns void language sql as $$
  update players p
     set rating = coalesce(l.rating_after, 0), gp_played = coalesce(l.gp_count, 0)
    from players p2
    left join lateral (
      select rating_after, gp_count from rating_changes rc
       where rc.player_id = p2.id
       order by played_at desc, match_id desc limit 1
    ) l on true
   where p.id = p2.id
     and (p.rating is distinct from coalesce(l.rating_after, 0)
          or p.gp_played is distinct from coalesce(l.gp_count, 0));
$$;

create or replace function rescore_from(p_played_at timestamptz, p_match uuid)
returns void language plpgsql as $$
declare
  m record;
begin
  delete from rating_changes where (played_at, match_id) >= (p_played_at, p_match);
  for m in select id from matches where (played_at, id) >= (p_played_at, p_match) order by played_at, id loop
    perform score_gp(m.id);
  end loop;
  perform sync_player_ratings();
end;
$$;

create or replace function submit_gp(p_results jsonb)
returns uuid language plpgsql as $$
declare
  v_match uuid;
begin
  insert into matches default values returning id into v_match;
  insert into race_results (match_id, player_id, position)
  select v_match, (e->>'player_id')::uuid, (e->>'position')::int
    from jsonb_array_elements(p_results) e;
  perform score_gp(v_match);
  perform sync_player_ratings();
  return v_match;
end;
$$;

create or replace function delete_gp(p_match uuid)
returns void language plpgsql as $$
declare
  v_played_at timestamptz;
begin
  select played_at into v_played_at from matches where id = p_match;
  if not found then raise exception 'GP % not found', p_match; end if;
  delete from matches where id = p_match;
  perform rescore_from(v_played_at, p_match);
end;
$$;

revoke execute on function score_gp(uuid), sync_player_ratings(), rescore_from(timestamptz, uuid),
  submit_gp(jsonb), delete_gp(uuid) from public, anon, authenticated;

alter function score_gp(uuid) set search_path = public;
alter function sync_player_ratings() set search_path = public;
alter function rescore_from(timestamptz, uuid) set search_path = public;
alter function submit_gp(jsonb) set search_path = public;
alter function delete_gp(uuid) set search_path = public;

-- Scores now come from the ledger; the old recompute-from-scratch path goes away.
drop trigger if exists trg_recalculate_ratings on race_results;
drop function if exists recalculate_ratings();
drop function if exists recalculate_all_ratings();
drop function if exists recalculate_ratings_for(uuid[]);

-- Backfill: replay every existing GP in order with today's rules.
select rescore_from('-infinity', '00000000-0000-0000-0000-000000000000');
