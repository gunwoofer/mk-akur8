-- Optional race-by-race details for a GP (track + each human's finish per race).
-- Purely informational: nothing here feeds the Elo. Rollback: supabase/rollback/20261104_race_tracks_down.sql

create table tracks (
  id         text primary key,
  name       text not null,
  kind       text not null check (kind in ('main', 'snes')),
  image      text not null,
  sort_order int  not null,
  active     boolean not null default true
);

insert into tracks (id, name, kind, image, sort_order) values
  ('mario-bros-circuit', 'Mario Bros. Circuit', 'main', '/tracks/mario-bros-circuit.jpg', 1),
  ('crown-city', 'Crown City', 'main', '/tracks/crown-city.jpg', 2),
  ('whistlestop-summit', 'Whistlestop Summit', 'main', '/tracks/whistlestop-summit.jpg', 3),
  ('dk-spaceport', 'DK Spaceport', 'main', '/tracks/dk-spaceport.jpg', 4),
  ('desert-hills', 'Desert Hills', 'main', '/tracks/desert-hills.jpg', 5),
  ('shy-guy-bazaar', 'Shy Guy Bazaar', 'main', '/tracks/shy-guy-bazaar.jpg', 6),
  ('wario-stadium', 'Wario Stadium', 'main', '/tracks/wario-stadium.jpg', 7),
  ('airship-fortress', 'Airship Fortress', 'main', '/tracks/airship-fortress.jpg', 8),
  ('starview-peak', 'Starview Peak', 'main', '/tracks/starview-peak.jpg', 9),
  ('sky-high-sundae', 'Sky-High Sundae', 'main', '/tracks/sky-high-sundae.jpg', 10),
  ('wario-shipyard', 'Wario Shipyard', 'main', '/tracks/wario-shipyard.jpg', 11),
  ('dk-pass', 'DK Pass', 'main', '/tracks/dk-pass.jpg', 12),
  ('koopa-troopa-beach', 'Koopa Troopa Beach', 'main', '/tracks/koopa-troopa-beach.jpg', 13),
  ('faraway-oasis', 'Faraway Oasis', 'main', '/tracks/faraway-oasis.jpg', 14),
  ('peach-stadium', 'Peach Stadium', 'main', '/tracks/peach-stadium.jpg', 15),
  ('salty-salty-speedway', 'Salty Salty Speedway', 'main', '/tracks/salty-salty-speedway.jpg', 16),
  ('dino-dino-jungle', 'Dino Dino Jungle', 'main', '/tracks/dino-dino-jungle.jpg', 17),
  ('great-block-ruins', 'Great ? Block Ruins', 'main', '/tracks/great-block-ruins.jpg', 18),
  ('peach-beach', 'Peach Beach', 'main', '/tracks/peach-beach.jpg', 19),
  ('cheep-cheep-falls', 'Cheep Cheep Falls', 'main', '/tracks/cheep-cheep-falls.jpg', 20),
  ('dandelion-depths', 'Dandelion Depths', 'main', '/tracks/dandelion-depths.jpg', 21),
  ('boo-cinema', 'Boo Cinema', 'main', '/tracks/boo-cinema.jpg', 22),
  ('dry-bones-burnout', 'Dry Bones Burnout', 'main', '/tracks/dry-bones-burnout.jpg', 23),
  ('moo-moo-meadows', 'Moo Moo Meadows', 'main', '/tracks/moo-moo-meadows.jpg', 24),
  ('choco-mountain', 'Choco Mountain', 'main', '/tracks/choco-mountain.jpg', 25),
  ('toads-factory', 'Toad''s Factory', 'main', '/tracks/toads-factory.jpg', 26),
  ('bowsers-castle', 'Bowser''s Castle', 'main', '/tracks/bowsers-castle.jpg', 27),
  ('acorn-heights', 'Acorn Heights', 'main', '/tracks/acorn-heights.jpg', 28),
  ('mario-circuit', 'Mario Circuit', 'main', '/tracks/mario-circuit.jpg', 29),
  ('rainbow-road', 'Rainbow Road', 'main', '/tracks/rainbow-road.jpg', 30),
  ('snes-mario-circuit-1', 'SNES Mario Circuit 1', 'snes', '/tracks/snes-mario-circuit-1.jpg', 31),
  ('snes-mario-circuit-2', 'SNES Mario Circuit 2', 'snes', '/tracks/snes-mario-circuit-2.jpg', 32),
  ('snes-mario-circuit-3', 'SNES Mario Circuit 3', 'snes', '/tracks/snes-mario-circuit-3.jpg', 33),
  ('snes-ghost-valley-1', 'SNES Ghost Valley 1', 'snes', '/tracks/snes-ghost-valley-1.jpg', 34),
  ('snes-ghost-valley-2', 'SNES Ghost Valley 2', 'snes', '/tracks/snes-ghost-valley-2.jpg', 35),
  ('snes-ghost-valley-3', 'SNES Ghost Valley 3', 'snes', '/tracks/snes-ghost-valley-3.jpg', 36),
  ('snes-choco-island-1', 'SNES Choco Island 1', 'snes', '/tracks/snes-choco-island-1.jpg', 37),
  ('snes-choco-island-2', 'SNES Choco Island 2', 'snes', '/tracks/snes-choco-island-2.jpg', 38),
  ('snes-koopa-beach-1', 'SNES Koopa Beach 1', 'snes', '/tracks/snes-koopa-beach-1.jpg', 39),
  ('snes-vanilla-lake-1', 'SNES Vanilla Lake 1', 'snes', '/tracks/snes-vanilla-lake-1.jpg', 40);

create table gp_races (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  race_number int  not null check (race_number between 1 and 6),
  track_id    text not null references tracks(id),
  unique (match_id, race_number)
);

create table race_finishes (
  race_id   uuid not null references gp_races(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  position  int  not null check (position between 1 and 24),
  primary key (race_id, player_id)
);

create index gp_races_track on gp_races (track_id);
create index race_finishes_player on race_finishes (player_id);

alter table tracks        enable row level security;
alter table gp_races      enable row level security;
alter table race_finishes enable row level security;
create policy "Public read tracks"        on tracks        for select using (true);
create policy "Public read gp_races"      on gp_races      for select using (true);
create policy "Public read race_finishes" on race_finishes for select using (true);

-- submit_gp gains an optional p_races: [{track_id, finishes: [{player_id, position}]}, ...].
-- Without it the behaviour is exactly the previous one. The old one-argument version is
-- renamed rather than dropped (DROP statements hang the Supabase MCP connector).
create function submit_gp(p_results jsonb, p_races jsonb default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_match uuid;
begin
  insert into matches default values returning id into v_match;
  insert into race_results (match_id, player_id, position)
  select v_match, (e->>'player_id')::uuid, (e->>'position')::int
    from jsonb_array_elements(p_results) e;

  insert into gp_races (match_id, race_number, track_id)
  select v_match, r.ord, r.value->>'track_id'
    from jsonb_array_elements(coalesce(p_races, '[]'::jsonb)) with ordinality as r(value, ord);

  insert into race_finishes (race_id, player_id, position)
  select g.id, (f->>'player_id')::uuid, (f->>'position')::int
    from jsonb_array_elements(coalesce(p_races, '[]'::jsonb)) with ordinality as r(value, ord)
    join gp_races g on g.match_id = v_match and g.race_number = r.ord
    cross join jsonb_array_elements(r.value->'finishes') f;

  perform score_gp(v_match);
  perform sync_player_ratings();
  return v_match;
end;
$$;
revoke execute on function submit_gp(jsonb, jsonb) from public, anon, authenticated;

alter function submit_gp(jsonb) rename to submit_gp_legacy;
