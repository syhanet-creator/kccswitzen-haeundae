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
