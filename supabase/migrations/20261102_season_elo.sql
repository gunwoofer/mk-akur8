-- Seasons from 2026-11 are scored with a pairwise Elo, reset each month.
-- Global rating formula is unchanged. Older seasons keep their average formula,
-- even if one of their GPs is re-scored later (season_elo_from decides per season).

alter table scoring_settings
  add column season_elo_from  text not null default '2026-11',
  add column season_elo_start int  not null default 1500,
  add column season_elo_k     int  not null default 32,
  add column season_elo_scale int  not null default 400,
  add column season_min_gp    int  not null default 5;

alter table rating_changes add column season_kind text not null default 'average';

create or replace view season_standings with (security_invoker = true) as
select distinct on (season, player_id)
       season, player_id, season_points, season_gp, season_p1, season_rating,
       rating_after as global_rating, season_kind
  from rating_changes
 order by season, player_id, played_at desc, match_id desc;

-- Season Elo: every pair of humans in the GP is a duel (ahead = 1, shared position = 0.5).
-- Change = K × Σ(score − expected) / opponents, so a 2- and a 4-player GP weigh the same.
create or replace function score_gp(p_match uuid)
returns void language plpgsql set search_path = public as $$
declare
  v_played_at timestamptz;
  v_season    text;
  cfg         scoring_settings%rowtype;
  v_elo       boolean;
begin
  select played_at into v_played_at from matches where id = p_match;
  v_season := to_char(v_played_at at time zone 'America/Montreal', 'YYYY-MM');
  select * into cfg from scoring_settings;
  v_elo := v_season >= cfg.season_elo_from;

  insert into rating_changes (
    match_id, player_id, played_at, season, position, points,
    total_points, gp_count, rating_before, rating_after,
    season_points, season_gp, season_p1, season_rating, season_kind)
  with racers as (
    select rr.player_id, rr.position, coalesce(pp.points, 0) as points,
           coalesce(prev.total_points, 0) as prev_total,
           coalesce(prev.gp_count, 0)     as prev_gp,
           coalesce(prev.rating_after, 0) as prev_rating,
           case when prev.season = v_season then prev.season_points else 0 end as prev_spts,
           case when prev.season = v_season then prev.season_gp     else 0 end as prev_sgp,
           case when prev.season = v_season then prev.season_p1     else 0 end as prev_sp1,
           case when prev.season = v_season then prev.season_rating else cfg.season_elo_start end as elo_before
      from race_results rr
      left join position_points pp on pp.position = rr.position
      left join lateral (
        select * from rating_changes rc
         where rc.player_id = rr.player_id
           and (rc.played_at, rc.match_id) < (v_played_at, p_match)
         order by rc.played_at desc, rc.match_id desc
         limit 1
      ) prev on true
     where rr.match_id = p_match
  ),
  duels as (
    select a.player_id,
           count(b.player_id) as opponents,
           coalesce(sum(
             case when a.position < b.position then 1.0 when a.position = b.position then 0.5 else 0.0 end
             - 1.0 / (1.0 + power(10.0, (b.elo_before - a.elo_before) / cfg.season_elo_scale))
           ), 0) as surplus
      from racers a
      left join racers b on b.player_id <> a.player_id
     group by a.player_id
  )
  select p_match, r.player_id, v_played_at, v_season, r.position, r.points,
         r.prev_total + r.points,
         r.prev_gp + 1,
         r.prev_rating,
         round((r.prev_total + r.points)::numeric / (cfg.global_prior + r.prev_gp + 1), 4),
         r.prev_spts + r.points,
         r.prev_sgp + 1,
         r.prev_sp1 + (r.position = 1)::int,
         case when v_elo
           then r.elo_before + case when d.opponents > 0 then cfg.season_elo_k * d.surplus / d.opponents else 0 end
           else (r.prev_spts + r.points)::double precision / (cfg.season_prior + r.prev_sgp + 1)
         end,
         case when v_elo then 'elo' else 'average' end
    from racers r
    join duels d on d.player_id = r.player_id;
end;
$$;

revoke execute on function score_gp(uuid) from public, anon, authenticated;

-- Re-score November's GPs (all played before this migration) under the season Elo.
-- Global values are recomputed with the unchanged formula, so they come out identical.
select rescore_from(m.played_at, m.id)
  from (select played_at, id from matches
         where to_char(played_at at time zone 'America/Montreal', 'YYYY-MM') >= '2026-11'
         order by played_at, id limit 1) m;
