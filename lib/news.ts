export type Article = { title: string; link: string; source: string; date: number };

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const pick = (xml: string, tag: string) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]).trim() : "";
};

/** 구글 뉴스 RSS 응답을 기사 목록으로 변환 */
export function parseRss(xml: string): Article[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const source = pick(item, "source");
    let title = pick(item, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    return { title, link: pick(item, "link"), source, date: Date.parse(pick(item, "pubDate")) || 0 };
  }).filter((a) => a.title && a.link);
}

/**
 * 구글 뉴스에서 query 로 검색한 최근 기사. 제목에 mustHave 가 들어간 것만 남긴다
 * (구글은 본문 옆 목록의 글자까지 읽어 관련 없는 기사를 섞기 때문).
 */
export async function fetchNews(query: string, limit: number, mustHave: RegExp, days = 7): Promise<Article[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const seen = new Set<string>();
    return parseRss(await res.text())
      .filter((a) => mustHave.test(a.title))
      .sort((a, b) => b.date - a.date)
      .filter((a) => {
        const key = a.title.replace(/\s/g, "").slice(0, 20);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function timeAgo(ms: number, now = Date.now()) {
  const m = Math.floor((now - ms) / 60000);
  if (m < 60) return `${Math.max(m, 1)}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}
