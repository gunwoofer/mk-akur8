-- Reopens anon writes exactly as before 20261106_lock_public_writes.
grant insert, update, delete, truncate on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant insert, update, delete, truncate on tables to anon, authenticated;

alter policy "Anon insert players" on players with check (true);
alter policy "Anon update players" on players using (true) with check (true);
alter policy "Anon delete players" on players using (true);
alter policy "Anon insert matches" on matches with check (true);
alter policy "Anon insert race_results" on race_results with check (true);

alter policy "Public avatars upload" on storage.objects with check (bucket_id = 'avatars');
alter policy "Public avatars update" on storage.objects using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
alter policy "Public avatars delete" on storage.objects using (bucket_id = 'avatars');
