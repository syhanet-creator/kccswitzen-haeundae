/** 에디터에서 고를 수 있는 한글 글꼴(구글 폰트). name 은 구글 폰트의 family 이름. */
export const FONTS = [
  { label: "기본 고딕", family: "" },
  { label: "본고딕", family: "Noto Sans KR", generic: "sans-serif" },
  { label: "본명조", family: "Noto Serif KR", generic: "serif" },
  { label: "나눔고딕", family: "Nanum Gothic", generic: "sans-serif" },
  { label: "나눔명조", family: "Nanum Myeongjo", generic: "serif" },
  { label: "고운돋움", family: "Gowun Dodum", generic: "sans-serif" },
  { label: "고운바탕", family: "Gowun Batang", generic: "serif" },
  { label: "IBM 플렉스", family: "IBM Plex Sans KR", generic: "sans-serif" },
  { label: "주아 (둥근)", family: "Jua", generic: "sans-serif" },
  { label: "도현 (제목용)", family: "Do Hyeon", generic: "sans-serif" },
  { label: "검은고딕 (굵은)", family: "Black Han Sans", generic: "sans-serif" },
  { label: "나눔고딕코딩 (고정폭)", family: "Nanum Gothic Coding", generic: "monospace" },
  { label: "나눔 펜 (손글씨)", family: "Nanum Pen Script", generic: "cursive" },
  { label: "나눔 붓 (손글씨)", family: "Nanum Brush Script", generic: "cursive" },
  { label: "개구 (손글씨)", family: "Gaegu", generic: "cursive" },
  { label: "싱글데이 (손글씨)", family: "Single Day", generic: "cursive" },
] as const;

export type FontDef = (typeof FONTS)[number];

export const cssOf = (f: FontDef) => (f.family ? `'${f.family}', ${f.generic}` : "");

const norm = (s: string) => s.replace(/["']/g, "").replace(/\s+/g, "").toLowerCase();

/** 저장된 font-family 값에서 어느 글꼴인지 찾는다. 없으면 기본. */
export const fontOfCss = (css: string | undefined): FontDef =>
  FONTS.find((f) => f.family && css && norm(css).startsWith(norm(f.family))) ?? FONTS[0];

/** 본문 정리(sanitize) 때 허용할 font-family 값인지 검사한다(목록에 있는 글꼴만). */
export const isAllowedFontFamily = (css: string) =>
  /^(serif|sans-serif|monospace|cursive)$/i.test(css.trim()) ||
  FONTS.some((f) => f.family && norm(css) === norm(`'${f.family}', ${f.generic}`));

export const fontsStylesheets = FONTS.filter((f) => f.family).map(
  (f) => `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, "+")}&display=swap`,
);
