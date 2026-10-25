# KCC 스위첸 입주민 커뮤니티 (해운대 좌동)

Next.js + Supabase 기반 입주민 전용 커뮤니티 웹앱.

기능: 공지사항(관리자만 작성) · 자유게시판/소모임 · 중고장터/나눔 · 민원/시설문의(작성자·관리자만 열람, 처리상태 표시)

## 시작하기
1. Supabase 프로젝트 생성 후 `supabase/schema.sql` 실행
2. `.env.example` 을 `.env.local` 로 복사해 URL/anon key 입력
3. `npm install && npm run dev`
4. 가입 후 Supabase에서 첫 관리자 지정:
   `update profiles set role='admin', approved=true where id='<user id>';`
   이후 입주민은 `approved=true` 로 승인합니다(동·호 확인 후).
