-- Rollback of 20261104_race_tracks.sql: removes race details and puts back the
-- one-argument submit_gp. GPs, results and Elo scores are untouched.
--
-- Run it in the Supabase SQL Editor: DROP statements hang the Supabase MCP connector.

alter function submit_gp(jsonb, jsonb) rename to submit_gp_races;
alter function submit_gp_legacy(jsonb) rename to submit_gp;
drop function submit_gp_races(jsonb, jsonb);

drop table if exists race_finishes;
drop table if exists gp_races;
drop table if exists tracks;
