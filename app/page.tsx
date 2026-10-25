import Link from "next/link";
import { BOARDS } from "@/lib/boards";
import { clusterArticles, fetchNews, timeAgo, type Article } from "@/lib/news";

export const revalidate = 900;

const LOCAL = /해운대|좌동|센텀|송정|재송|반여|반송/;

const TOPICS = [
  { key: "road", name: "도로·교통", icon: "🚗", color: "bg-sky-50 text-sky-700", query: "해운대 도로 교통",
    links: [["국가교통정보센터", "https://www.its.go.kr"], ["해운대구청", "https://www.haeundae.go.kr"]] },
  { key: "house", name: "주택·부동산", icon: "🏢", color: "bg-amber-50 text-amber-700", query: "해운대 아파트 부동산",
    links: [["실거래가 공개시스템", "https://rt.molit.go.kr"], ["공동주택관리정보", "https://www.k-apt.go.kr"]] },
  { key: "safe", name: "치안·안전", icon: "🛡️", color: "bg-emerald-50 text-emerald-700", query: "해운대 치안 경찰 범죄",
    links: [["생활안전지도", "https://www.safemap.go.kr"], ["경찰청", "https://www.police.go.kr"]] },
] as const;

function Item({ a }: { a: Article }) {
  return (
    <a href={a.link} target="_blank" rel="noopener noreferrer" className="group block py-3">
      <div className="text-[15px] font-medium leading-snug text-gray-900 group-hover:text-blue-700">{a.title}</div>
      <div className="mt-1 text-xs text-gray-400">{a.source} · {timeAgo(a.date)}</div>
    </a>
  );
}

/** 유사 기사는 한 박스로 묶어 보여준다. */
function Headlines({ items, max, empty }: { items: Article[]; max: number; empty: string }) {
  const groups = clusterArticles(items).slice(0, max);
  if (groups.length === 0) return <p className="py-6 text-center text-sm text-gray-400">{empty}</p>;
  return (
    <div className="divide-y divide-gray-100">
      {groups.map((g) =>
        g.length === 1 ? (
          <Item key={g[0].link} a={g[0]} />
        ) : (
          <div key={g[0].link} className="my-2 rounded-xl border border-blue-100 bg-blue-50/40">
            <div className="px-3 pt-2 text-xs font-semibold text-blue-700">
              유사 기사 {g.length}건 · 언론사 {new Set(g.map((x) => x.source)).size}곳
            </div>
            <div className="divide-y divide-blue-100/70 px-3">
              {g.map((a) => <Item key={a.link} a={a} />)}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export default async function Home() {
  const [main, ...topics] = await Promise.all([
    fetchNews("해운대구", 40, LOCAL),
    ...TOPICS.map((t) => fetchNews(t.query, 20, LOCAL, 14)),
  ]);

  return (
    <div className="grid gap-8 py-6">
      <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-sky-500 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm text-blue-100">해운대 좌동</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">KCC 스위첸 입주민 커뮤니티</h1>
        <p className="mt-2 text-sm text-blue-50">이웃과 소통하고, 우리 동네 소식을 한눈에 확인하세요.</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold">📰 해운대구 주요 뉴스</h2>
            <span className="text-xs text-gray-400">최근 7일 · 구글 뉴스</span>
          </div>
          <Headlines items={main} max={12} empty="뉴스를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." />
        </div>

        <div className="grid content-start gap-4 lg:col-span-2">
          {TOPICS.map((t, i) => (
            <div key={t.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${t.color}`}>{t.icon}</span>
                <h2 className="font-bold">{t.name}</h2>
              </div>
              <Headlines items={topics[i]} max={4} empty="최근 관련 뉴스가 없습니다." />
              <div className="mt-1 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {t.links.map(([name, href]) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200">{name} ↗</a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">입주민 게시판</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(BOARDS).map(([key, b]) => (
            <Link key={key} href={`/${key}`}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${b.tone}`}>{b.icon}</span>
              <div className="mt-3 font-semibold group-hover:text-blue-700">{b.name}</div>
              <div className="mt-1 text-sm text-gray-500">{b.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
