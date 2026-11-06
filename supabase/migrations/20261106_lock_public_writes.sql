-- The public (anon) key ships to every browser, so it may only READ.
-- Every write goes through the API routes with the service role, behind the admin code.
-- No DROP (it hangs the Supabase MCP): privileges are revoked and the old write policies neutralised.

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

alter policy "Anon insert players" on players with check (false);
alter policy "Anon update players" on players using (false) with check (false);
alter policy "Anon delete players" on players using (false);
alter policy "Anon insert matches" on matches with check (false);
alter policy "Anon insert race_results" on race_results with check (false);

-- Avatar uploads now go through POST /api/players/[id]/avatar (service role).
alter policy "Public avatars upload" on storage.objects with check (false);
alter policy "Public avatars update" on storage.objects using (false) with check (false);
alter policy "Public avatars delete" on storage.objects using (false);
