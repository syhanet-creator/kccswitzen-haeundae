/**
 * 코스피·코스닥 지수와 원/달러·원/엔·원/위안 환율.
 * 지수는 네이버 증권(실시간)을 먼저, 환율은 야후 파이낸스(거의 실시간)를 먼저 쓰고,
 * 서로를 대체 자료원으로 쓴다. 환율은 마지막 수단으로 일 1회 갱신 환율(open.er-api.com)을 쓴다.
 */
const NAVER = process.env.NAVER_API_BASE ?? "https://m.stock.naver.com";
const YAHOO = process.env.YAHOO_API_BASE ?? "https://query1.finance.yahoo.com";
const ER = process.env.ER_API_BASE ?? "https://open.er-api.com";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type Quote = {
  id: string;
  name: string;
  sub?: string;       // 단위 설명 (예: 100엔)
  flag?: string;
  price: number;
  change: number;     // 전일 대비(부호 있음)
  pct: number;        // 등락률 %
  prevClose: number | null;
  high: number | null;
  low: number | null;
  time: string | null; // ISO
  state: "open" | "closed" | "live" | "daily";
  spark: number[];
  source: "naver" | "yahoo" | "er-api";
};

export const INDICES = [
  { id: "KOSPI", name: "코스피", yahoo: "^KS11" },
  { id: "KOSDAQ", name: "코스닥", yahoo: "^KQ11" },
] as const;

export const CURRENCIES = [
  { id: "USD", name: "미국 달러", sub: "1달러", flag: "🇺🇸", yahoo: "USDKRW=X", mult: 1 },
  { id: "JPY", name: "일본 엔", sub: "100엔", flag: "🇯🇵", yahoo: "JPYKRW=X", mult: 100 },
  { id: "CNY", name: "중국 위안", sub: "1위안", flag: "🇨🇳", yahoo: "CNYKRW=X", mult: 1 },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const n = Number(v.replace(/,/g, "").trim()); return v.trim() !== "" && Number.isFinite(n) ? n : null; }
  return null;
};

/** 한국 증시 정규장(평일 09:00~15:30 KST) 여부. 공휴일은 알 수 없어 상태 값이 있으면 그것을 우선한다. */
export function krxOpen(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const dow = kst.getUTCDay();
  const min = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return dow >= 1 && dow <= 5 && min >= 9 * 60 && min < 15 * 60 + 30;
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000), headers: { "User-Agent": UA, Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ───────── 야후 파이낸스 ─────────
type YahooChart = {
  chart?: { result?: { meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
};

export type YahooQuote = { price: number; prevClose: number | null; high: number | null; low: number | null; time: string | null; spark: number[] };

export function parseYahoo(json: YahooChart): YahooQuote | null {
  const r = json.chart?.result?.[0];
  const m = r?.meta;
  const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const price = toNum(m?.regularMarketPrice) ?? closes.at(-1) ?? null;
  if (price === null) return null;
  const t = toNum(m?.regularMarketTime);
  return {
    price,
    prevClose: toNum(m?.chartPreviousClose) ?? toNum(m?.previousClose),
    high: toNum(m?.regularMarketDayHigh),
    low: toNum(m?.regularMarketDayLow),
    time: t ? new Date(t * 1000).toISOString() : null,
    spark: closes,
  };
}

async function yahoo(symbol: string): Promise<YahooQuote | null> {
  const json = await getJson<YahooChart>(`${YAHOO}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`);
  return parseYahoo(json);
}

// ───────── 네이버 증권(국내 지수) ─────────
type NaverIndex = {
  closePrice?: unknown; compareToPreviousClosePrice?: unknown; fluctuationsRatio?: unknown;
  compareToPreviousPrice?: { name?: string; code?: string; text?: string };
  marketStatus?: string; localTradedAt?: string; highPrice?: unknown; lowPrice?: unknown;
};

export function parseNaverIndex(json: NaverIndex): { price: number; change: number; pct: number; high: number | null; low: number | null; time: string | null; open: boolean | null } | null {
  const price = toNum(json.closePrice);
  if (price === null) return null;
  let change = Math.abs(toNum(json.compareToPreviousClosePrice) ?? 0);
  let pct = Math.abs(toNum(json.fluctuationsRatio) ?? 0);
  const dir = `${json.compareToPreviousPrice?.name ?? ""}${json.compareToPreviousPrice?.text ?? ""}`.toUpperCase();
  const down = /FALL|LOWER|하락|하한/.test(dir) || (!/RIS|UPPER|상승|상한|보합|UNCHANG/.test(dir) && ((toNum(json.compareToPreviousClosePrice) ?? 0) < 0 || (toNum(json.fluctuationsRatio) ?? 0) < 0));
  if (down) { change = -change; pct = -pct; }
  const status = json.marketStatus?.toUpperCase();
  return {
    price, change, pct,
    high: toNum(json.highPrice), low: toNum(json.lowPrice),
    time: json.localTradedAt ?? null,
    open: status ? status === "OPEN" : null,
  };
}

async function naver(code: string) {
  const json = await getJson<NaverIndex>(`${NAVER}/api/index/${code}/basic`, { Referer: "https://m.stock.naver.com/" });
  return parseNaverIndex(json);
}

export type Result<T> = { items: T[]; errors: string[]; fetchedAt: string };

export async function getIndices(): Promise<Result<Quote>> {
  const errors: string[] = [];
  const items = (await Promise.all(INDICES.map(async (ix): Promise<Quote | null> => {
    const [n, y] = await Promise.all([
      naver(ix.id).catch((e) => { errors.push(`${ix.id} naver: ${e.message}`); return null; }),
      yahoo(ix.yahoo).catch((e) => { errors.push(`${ix.id} yahoo: ${e.message}`); return null; }),
    ]);
    if (!n && !y) return null;
    const price = n?.price ?? y!.price;
    const prev = y?.prevClose ?? (n ? n.price - n.change : null);
    const change = n ? n.change : prev !== null ? price - prev : 0;
    const pct = n ? n.pct : prev ? ((price - prev) / prev) * 100 : 0;
    return {
      id: ix.id, name: ix.name, price: r2(price), change: r2(change), pct: r2(pct),
      prevClose: prev === null ? null : r2(prev), high: n?.high ?? y?.high ?? null, low: n?.low ?? y?.low ?? null,
      time: n?.time ?? y?.time ?? null,
      state: n?.open != null ? (n.open ? "open" : "closed") : krxOpen() ? "open" : "closed",
      spark: y?.spark ?? [], source: n ? "naver" : "yahoo",
    };
  }))).filter((q): q is Quote => q !== null);
  return { items, errors, fetchedAt: new Date().toISOString() };
}

// ───────── 환율 ─────────
export async function getFx(): Promise<Result<Quote>> {
  const errors: string[] = [];
  const out: Quote[] = [];
  const missing: (typeof CURRENCIES)[number][] = [];

  await Promise.all(CURRENCIES.map(async (c) => {
    try {
      const y = await yahoo(c.yahoo);
      if (!y) throw new Error("empty");
      const price = y.price * c.mult;
      const prev = y.prevClose === null ? null : y.prevClose * c.mult;
      out.push({
        id: c.id, name: c.name, sub: c.sub, flag: c.flag, price: r2(price), prevClose: prev === null ? null : r2(prev),
        change: prev === null ? 0 : r2(price - prev), pct: prev ? r2(((price - prev) / prev) * 100) : 0,
        high: y.high === null ? null : r2(y.high * c.mult), low: y.low === null ? null : r2(y.low * c.mult),
        time: y.time, state: "live", spark: y.spark.map((v) => v * c.mult), source: "yahoo",
      });
    } catch (e) { errors.push(`${c.id} yahoo: ${(e as Error).message}`); missing.push(c); }
  }));

  if (missing.length) { // 대체: 일 1회 갱신 환율(전일 대비 정보 없음)
    try {
      const j = await getJson<{ rates?: Record<string, number>; time_last_update_unix?: number }>(`${ER}/v6/latest/USD`);
      const krw = j.rates?.KRW;
      if (!krw) throw new Error("no KRW");
      for (const c of missing) {
        const per = c.id === "USD" ? krw : j.rates?.[c.id] ? krw / j.rates[c.id]! : null;
        if (per === null) continue;
        out.push({
          id: c.id, name: c.name, sub: c.sub, flag: c.flag, price: r2(per * c.mult), prevClose: null, change: 0, pct: 0,
          high: null, low: null, time: j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString() : null,
          state: "daily", spark: [], source: "er-api",
        });
      }
    } catch (e) { errors.push(`fallback er-api: ${(e as Error).message}`); }
  }
  out.sort((a, b) => CURRENCIES.findIndex((c) => c.id === a.id) - CURRENCIES.findIndex((c) => c.id === b.id));
  return { items: out, errors, fetchedAt: new Date().toISOString() };
}
