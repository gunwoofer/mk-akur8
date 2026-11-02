-- Decision 2026-11-02: Elo everywhere, from the very first GP (June 2026).
-- Seasons: monthly Elo reset to 1500. Global: all-time Elo, never reset.
-- Every GP is re-scored; winners of past seasons are unchanged (checked on test).
update scoring_settings set season_elo_from = '2026-06', global_elo_from = '2026-06' where id;
select rescore_from('-infinity', '00000000-0000-0000-0000-000000000000');
