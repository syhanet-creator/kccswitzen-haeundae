export const BOARDS = {
  notice: { name: "공지사항", desc: "관리사무소·입주자대표회의 소식" },
  free: { name: "자유게시판·소모임", desc: "이웃과 이야기하고 모임을 만들어요" },
  market: { name: "중고장터·나눔", desc: "필요 없는 물건은 이웃에게" },
  complaint: { name: "민원·시설문의", desc: "작성자와 관리자에게만 보입니다" },
} as const;

export type BoardKey = keyof typeof BOARDS;
export const isBoard = (k: string): k is BoardKey => k in BOARDS;

export const STATUS_LABEL = { open: "접수", in_progress: "처리중", done: "완료" } as const;
