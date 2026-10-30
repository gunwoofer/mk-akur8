create table scoring_settings (
  id           boolean primary key default true check (id),
  global_prior int not null check (global_prior > 0),
  season_prior int not null check (season_prior >= 0)
);
insert into scoring_settings (id, global_prior, season_prior) values (true, 20, 5);

alter table scoring_settings enable row level security;
create policy "Public read scoring_settings" on scoring_settings for select using (true);

create or replace function recalculate_ratings_for(p_ids uuid[])
returns void language sql as $$
  update players p
     set rating    = round(s.pts / (cfg.global_prior + s.gp), 4),
         gp_played = s.gp
    from (select pl.id, coalesce(sum(pp.points), 0)::numeric pts, count(rr.id)::int gp
            from players pl
            left join race_results rr on rr.player_id = pl.id
            left join position_points pp on pp.position = rr.position
           where pl.id = any(p_ids)
           group by pl.id) s,
         scoring_settings cfg
   where p.id = s.id;
$$;

create or replace function recalculate_ratings()
returns trigger language plpgsql as $$
begin
  perform recalculate_ratings_for(array(
    select distinct player_id from race_results where match_id = new.match_id
  ));
  return new;
end;
$$;

-- Run manually after changing scoring_settings or position_points.
create or replace function recalculate_all_ratings()
returns void language sql as $$
  select recalculate_ratings_for(array(select id from players));
$$;
revoke execute on function recalculate_all_ratings() from public, anon, authenticated;
