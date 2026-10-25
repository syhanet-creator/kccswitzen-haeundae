-- 리치 에디터 / 사진·파일 첨부
-- 1) 게시글 첨부파일 목록 (최대 10개)
alter table posts add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table posts drop constraint if exists attachments_max;
alter table posts add constraint attachments_max
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 10);

-- 2) 업로드 버킷 (파일당 20MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 20971520)
on conflict (id) do update set public = true, file_size_limit = 20971520;

-- 3) 승인된 입주민만 본인 폴더(<user id>/...)에 업로드, 본인 파일만 삭제
drop policy if exists "upload own folder" on storage.objects;
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text and is_approved());

drop policy if exists "delete own uploads" on storage.objects;
create policy "delete own uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
