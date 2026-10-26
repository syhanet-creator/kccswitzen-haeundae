-- 글 수정 보안: 글쓴이가 자기 글의 게시판을 '공지사항'으로 바꿔 공지처럼 보이게 하는 것을 막는다.
-- (글쓴이는 계속 자기 글만 수정할 수 있고, 작성자 변경도 불가. 관리자는 제한 없음)
drop policy if exists "edit own posts" on posts;
create policy "edit own posts" on posts for update
  using (author_id = auth.uid() or is_admin())
  with check ((author_id = auth.uid() or is_admin()) and (board <> 'notice' or is_admin()));
