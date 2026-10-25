export const BOARDS = {
  notice: { short: "공지사항", icon: "📢", tone: "bg-rose-50", name: "공지사항", desc: "관리사무소·입주자대표회의 소식" },
  free: { short: "자유게시판", icon: "💬", tone: "bg-blue-50", name: "자유게시판·소모임", desc: "이웃과 이야기하고 모임을 만들어요" },
  market: { short: "중고·나눔", icon: "🛍️", tone: "bg-amber-50", name: "중고장터·나눔", desc: "필요 없는 물건은 이웃에게" },
  complaint: { short: "민원·문의", icon: "🛠️", tone: "bg-emerald-50", name: "민원·시설문의", desc: "작성자와 관리자에게만 보입니다" },
} as const;

export type BoardKey = keyof typeof BOARDS;
export const isBoard = (k: string): k is BoardKey => k in BOARDS;

export const STATUS_LABEL = { open: "접수", in_progress: "처리중", done: "완료" } as const;

/** 중고장터·나눔 거래 유형과 상태 문구 */
export type DealType = "sell" | "share" | "wanted";
export const DEALS: Record<DealType, { name: string; ongoing: string; done: string; tone: string }> = {
  sell: { name: "판매", ongoing: "판매중", done: "판매완료", tone: "bg-blue-50 text-blue-700" },
  share: { name: "나눔", ongoing: "나눔중", done: "나눔완료", tone: "bg-emerald-50 text-emerald-700" },
  wanted: { name: "구해요", ongoing: "구하는 중", done: "구입완료", tone: "bg-amber-50 text-amber-700" },
};
export const dealOf = (t: string | null | undefined) => DEALS[(t as DealType) ?? "sell"] ?? DEALS.sell;
