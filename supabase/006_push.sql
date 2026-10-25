-- 가입 승인 요청 푸시 알림
-- 실행 전에 __PUSH_SECRET__ 을 Vercel 환경변수 PUSH_WEBHOOK_SECRET 과 같은 값으로 바꾼다(저장소에는 실제 값을 두지 않는다).

-- 1) 관리자 기기 구독 정보
create table if not exists push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists "admin manages own subscriptions" on push_subscriptions;
create policy "admin manages own subscriptions" on push_subscriptions for all to authenticated
  using (user_id = auth.uid() and is_admin())
  with check (user_id = auth.uid() and is_admin());

-- 2) 서버 호출용 비밀값(정책이 없어 API 로는 읽을 수 없다)
create table if not exists app_secrets (key text primary key, value text not null);
alter table app_secrets enable row level security;
insert into app_secrets (key, value) values ('push_webhook', '__PUSH_SECRET__')
  on conflict (key) do update set value = excluded.value;

-- 3) 비밀값을 아는 서버만 관리자 구독 목록을 읽거나(만료된 구독은) 지울 수 있다
create or replace function get_admin_push_subscriptions(p_secret text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from app_secrets where key = 'push_webhook') then
    raise exception 'forbidden';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth
    from push_subscriptions s join profiles p on p.id = s.user_id
    where p.role = 'admin' and p.approved;
end $$;

create or replace function remove_push_subscription(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select value from app_secrets where key = 'push_webhook') then
    raise exception 'forbidden';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end $$;

revoke all on function get_admin_push_subscriptions(text) from public;
revoke all on function remove_push_subscription(text, text) from public;
grant execute on function get_admin_push_subscriptions(text) to anon, authenticated;
grant execute on function remove_push_subscription(text, text) to anon, authenticated;

-- 4) 새 프로필(가입 신청)이 생기면 사이트의 알림 주소를 호출한다
create extension if not exists pg_net with schema extensions;

create or replace function notify_new_signup() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  select value into s from app_secrets where key = 'push_webhook';
  perform net.http_post(
    url := 'https://kccswitzen-haeundae.vercel.app/api/push/new-signup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', s),
    body := jsonb_build_object('nickname', new.nickname, 'dong', new.dong, 'ho', new.ho)
  );
  return new;
exception when others then
  return new; -- 알림이 실패해도 가입은 막지 않는다
end $$;

drop trigger if exists on_profile_created_notify on profiles;
create trigger on_profile_created_notify after insert on profiles
  for each row when (new.approved = false) execute function notify_new_signup();
