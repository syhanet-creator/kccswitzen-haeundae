-- KCC 스위첸 입주민 커뮤니티 스키마
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  dong text not null,
  ho text not null,
  role text not null default 'resident' check (role in ('resident','admin')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table posts (
  id bigserial primary key,
  board text not null check (board in ('notice','free','market','complaint')),
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  created_at timestamptz not null default now()
);
create index on posts (board, created_at desc);

create table comments (
  id bigserial primary key,
  post_id bigint not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create function is_approved() returns boolean language sql security definer stable as
$$ select coalesce((select approved from profiles where id = auth.uid()), false) $$;
create function is_admin() returns boolean language sql security definer stable as
$$ select coalesce((select role = 'admin' and approved from profiles where id = auth.uid()), false) $$;

alter table profiles enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;

-- 가입 시 role/approved 는 항상 기본값(관리자가 승인)
create policy "own profile read" on profiles for select using (id = auth.uid() or is_admin());
create policy "own profile insert" on profiles for insert
  with check (id = auth.uid() and role = 'resident' and approved = false);
create policy "admin update profiles" on profiles for update using (is_admin());

-- 게시글: 승인 입주민만 열람. 민원은 작성자·관리자만. 공지는 관리자만 작성.
create policy "read posts" on posts for select using (
  is_approved() and (board <> 'complaint' or author_id = auth.uid() or is_admin()));
create policy "write posts" on posts for insert with check (
  is_approved() and author_id = auth.uid() and (board <> 'notice' or is_admin()));
create policy "edit own posts" on posts for update using (author_id = auth.uid() or is_admin());
create policy "delete own posts" on posts for delete using (author_id = auth.uid() or is_admin());

create policy "read comments" on comments for select using (
  is_approved() and exists (select 1 from posts p where p.id = post_id));
create policy "write comments" on comments for insert with check (
  is_approved() and author_id = auth.uid());
create policy "delete own comments" on comments for delete using (author_id = auth.uid() or is_admin());
-- 가입(auth.users 생성) 시 프로필을 자동 생성. 이메일 인증을 켜도 동작한다.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname, dong, ho)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'dong', ''),
    coalesce(new.raw_user_meta_data->>'ho', '')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- 이미 가입했지만 프로필이 없는 계정 보정
insert into profiles (id, nickname, dong, ho)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'nickname',''), split_part(u.email,'@',1)),
       coalesce(u.raw_user_meta_data->>'dong',''), coalesce(u.raw_user_meta_data->>'ho','')
from auth.users u left join profiles p on p.id = u.id where p.id is null;
-- 관리자가 가입 신청을 거절(프로필 삭제)할 수 있게 한다.
create policy "admin delete profiles" on profiles for delete using (is_admin());
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
-- 중고장터·나눔: 거래 유형(판매/나눔/구해요). 완료 여부는 기존 status('open'/'done')를 쓴다.
alter table posts add column if not exists deal_type text;
alter table posts drop constraint if exists posts_deal_type_check;
alter table posts add constraint posts_deal_type_check check (deal_type is null or deal_type in ('sell','share','wanted'));
-- 글 수정 보안: 글쓴이가 자기 글의 게시판을 '공지사항'으로 바꿔 공지처럼 보이게 하는 것을 막는다.
-- (글쓴이는 계속 자기 글만 수정할 수 있고, 작성자 변경도 불가. 관리자는 제한 없음)
drop policy if exists "edit own posts" on posts;
create policy "edit own posts" on posts for update
  using (author_id = auth.uid() or is_admin())
  with check ((author_id = auth.uid() or is_admin()) and (board <> 'notice' or is_admin()));
