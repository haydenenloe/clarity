insert into storage.buckets (id, name, public) values ('session-audio', 'session-audio', false) on conflict do nothing;

create policy "Users can upload their own audio" on storage.objects
  for insert with check (bucket_id = 'session-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own audio" on storage.objects
  for select using (bucket_id = 'session-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own audio" on storage.objects
  for delete using (bucket_id = 'session-audio' and auth.uid()::text = (storage.foldername(name))[1]);
