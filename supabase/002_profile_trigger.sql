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
