-- Optional all-time Elo for the global rating (experiment). NULL = the average formula.
-- When set to a month, GPs from that month update the global rating as a never-reset
-- pairwise Elo (same K/scale as seasons), starting at season_elo_start for everyone.

alter table scoring_settings add column global_elo_from text;
alter table rating_changes add column global_kind text not null default 'average';

create or replace function score_gp(p_match uuid)
returns void language plpgsql set search_path = public as $$
declare
  v_played_at timestamptz;
  v_season    text;
  cfg         scoring_settings%rowtype;
  v_elo       boolean;
  v_gelo      boolean;
begin
  select played_at into v_played_at from matches where id = p_match;
  v_season := to_char(v_played_at at time zone 'America/Montreal', 'YYYY-MM');
  select * into cfg from scoring_settings;
  v_elo  := v_season >= cfg.season_elo_from;
  v_gelo := cfg.global_elo_from is not null and v_season >= cfg.global_elo_from;

  insert into rating_changes (
    match_id, player_id, played_at, season, position, points,
    total_points, gp_count, rating_before, rating_after,
    season_points, season_gp, season_p1, season_rating, season_kind, global_kind)
  with racers as (
    select rr.player_id, rr.position, coalesce(pp.points, 0) as points,
           coalesce(prev.total_points, 0) as prev_total,
           coalesce(prev.gp_count, 0)     as prev_gp,
           coalesce(prev.rating_after, 0) as prev_rating,
           case when prev.global_kind = 'elo' then prev.rating_after else cfg.season_elo_start end as gelo_before,
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
           ), 0) as surplus,
           coalesce(sum(
             case when a.position < b.position then 1.0 when a.position = b.position then 0.5 else 0.0 end
             - 1.0 / (1.0 + power(10.0, (b.gelo_before - a.gelo_before) / cfg.season_elo_scale))
           ), 0) as gsurplus
      from racers a
      left join racers b on b.player_id <> a.player_id
     group by a.player_id
  )
  select p_match, r.player_id, v_played_at, v_season, r.position, r.points,
         r.prev_total + r.points,
         r.prev_gp + 1,
         case when v_gelo then r.gelo_before else r.prev_rating end,
         case when v_gelo
           then r.gelo_before + case when d.opponents > 0 then cfg.season_elo_k * d.gsurplus / d.opponents else 0 end
           else round((r.prev_total + r.points)::numeric / (cfg.global_prior + r.prev_gp + 1), 4)
         end,
         r.prev_spts + r.points,
         r.prev_sgp + 1,
         r.prev_sp1 + (r.position = 1)::int,
         case when v_elo
           then r.elo_before + case when d.opponents > 0 then cfg.season_elo_k * d.surplus / d.opponents else 0 end
           else (r.prev_spts + r.points)::double precision / (cfg.season_prior + r.prev_sgp + 1)
         end,
         case when v_elo then 'elo' else 'average' end,
         case when v_gelo then 'elo' else 'average' end
    from racers r
    join duels d on d.player_id = r.player_id;
end;
$$;

revoke execute on function score_gp(uuid) from public, anon, authenticated;

-- Global Elo: fewer GPs than this = provisional (listed last, marked PROV).
alter table scoring_settings add column global_min_gp int not null default 10;
