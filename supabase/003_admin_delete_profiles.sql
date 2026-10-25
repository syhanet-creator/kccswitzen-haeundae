-- 관리자가 가입 신청을 거절(프로필 삭제)할 수 있게 한다.
create policy "admin delete profiles" on profiles for delete using (is_admin());
