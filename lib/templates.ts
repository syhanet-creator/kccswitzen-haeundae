import type { BoardKey } from "@/lib/boards";

export type Template = { id: string; icon: string; name: string; desc: string; title: string; html: string };

const blank: Template = { id: "blank", icon: "📝", name: "빈 문서", desc: "자유롭게 작성합니다", title: "", html: "" };

export const TEMPLATES: Record<BoardKey, Template[]> = {
  notice: [
    blank,
    { id: "general", icon: "📢", name: "일반 공지", desc: "일반 안내문", title: "[공지] ",
      html: "<h2>안내 말씀</h2><p>입주민 여러분께 안내드립니다.</p><h3>주요 내용</h3><ul><li>내용을 입력하세요</li></ul><h3>문의</h3><p>관리사무소 (☎ 000-0000)</p>" },
    { id: "maintenance", icon: "🔧", name: "점검·단수 안내", desc: "일정과 영향 범위 안내", title: "[점검] ",
      html: "<h2>시설 점검 및 단수 안내</h2><table><tbody><tr><th>일시</th><td>0월 0일(요일) 00:00 ~ 00:00</td></tr><tr><th>대상</th><td>동·라인</td></tr><tr><th>영향</th><td>단수 / 정전 / 엘리베이터 정지 등</td></tr></tbody></table><p>불편을 드려 죄송합니다. 협조 부탁드립니다.</p>" },
    { id: "event", icon: "🎉", name: "행사 안내", desc: "일시·장소·참여 방법", title: "[행사] ",
      html: "<h2>행사 안내</h2><p>행사 소개를 입력하세요.</p><ul><li><strong>일시:</strong> </li><li><strong>장소:</strong> </li><li><strong>참여 방법:</strong> </li></ul><blockquote>많은 참여 부탁드립니다.</blockquote>" },
  ],
  free: [
    blank,
    { id: "talk", icon: "💬", name: "이야기 나누기", desc: "자유로운 글", title: "", html: "<p>이웃과 나누고 싶은 이야기를 적어 주세요.</p>" },
    { id: "club", icon: "🤝", name: "소모임 모집", desc: "모임 소개와 모집 요강", title: "[소모임] ",
      html: "<h2>모임 소개</h2><p>어떤 모임인지 소개해 주세요.</p><h3>모집 요강</h3><ul><li><strong>모임 일정:</strong> </li><li><strong>모이는 곳:</strong> </li><li><strong>모집 인원:</strong> </li><li><strong>회비:</strong> </li></ul><p>댓글로 참여 의사를 남겨 주세요!</p>" },
    { id: "question", icon: "❓", name: "동네 질문", desc: "이웃에게 물어보기", title: "[질문] ",
      html: "<h3>궁금한 점</h3><p>질문 내용을 적어 주세요.</p><h3>참고 사항</h3><p>이미 알아본 내용이 있다면 함께 적어 주세요.</p>" },
  ],
  market: [
    blank,
    { id: "sell", icon: "🏷️", name: "판매", desc: "가격·상태·거래 방법", title: "[판매] ",
      html: "<h2>판매합니다</h2><table><tbody><tr><th>품목</th><td></td></tr><tr><th>가격</th><td>0,000원 (네고 가능/불가)</td></tr><tr><th>상태</th><td>상 / 중 / 하 · 사용 기간</td></tr><tr><th>거래 방법</th><td>단지 내 직거래 · 시간 협의</td></tr></tbody></table><p>사진을 아래에 올려 주세요.</p>" },
    { id: "share", icon: "🎁", name: "나눔", desc: "필요한 분께 무료로", title: "[나눔] ",
      html: "<h2>나눔합니다</h2><ul><li><strong>품목:</strong> </li><li><strong>상태:</strong> </li><li><strong>수령 방법:</strong> </li></ul><p>댓글로 신청해 주세요. 먼저 신청하신 분께 드립니다.</p>" },
    { id: "wanted", icon: "🔎", name: "구해요", desc: "필요한 물건 찾기", title: "[구해요] ",
      html: "<h2>구합니다</h2><ul><li><strong>찾는 물건:</strong> </li><li><strong>희망 가격:</strong> </li></ul><p>있으신 분은 댓글 부탁드립니다.</p>" },
  ],
  complaint: [
    blank,
    { id: "noise", icon: "🔊", name: "층간소음", desc: "발생 시간과 상황", title: "[층간소음] ",
      html: "<h2>층간소음 문의</h2><table><tbody><tr><th>발생 위치</th><td>위층 / 아래층 / 옆집</td></tr><tr><th>주로 발생하는 시간</th><td></td></tr><tr><th>소음 종류</th><td>발소리 / 가구 끄는 소리 / 기타</td></tr></tbody></table><p>상황을 구체적으로 적어 주세요.</p>" },
    { id: "facility", icon: "🛠️", name: "시설 고장·수리", desc: "위치와 증상", title: "[시설] ",
      html: "<h2>시설 고장 신고</h2><table><tbody><tr><th>위치</th><td>동·층·장소</td></tr><tr><th>증상</th><td></td></tr><tr><th>발견 시기</th><td></td></tr></tbody></table><p>사진을 첨부하면 처리가 빨라집니다.</p>" },
    { id: "parking", icon: "🚗", name: "주차·차량", desc: "차량 번호와 위치", title: "[주차] ",
      html: "<h2>주차 문의</h2><ul><li><strong>위치:</strong> </li><li><strong>차량 번호:</strong> </li><li><strong>내용:</strong> </li></ul>" },
  ],
};
