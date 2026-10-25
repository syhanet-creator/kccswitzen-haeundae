"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WeatherData, Grade } from "@/lib/weather";
import type { Quote } from "@/lib/markets";

/** 주기적으로 API 를 불러온다. 탭이 숨겨져 있으면 멈추고, 다시 보이면 바로 갱신한다. */
function usePolling<T>(url: string, everyMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState<number | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!alive.current) return;
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json); setError(""); setAt(Date.now());
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    load();
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => { alive.current = false; clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [load, everyMs]);

  return { data, error, loading, at, reload: load };
}

const fmt = (n: number, d = 2) => n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmm = (iso: string | number | null) => iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }) : "";
const md = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }) : "";

function Shell({ title, note, children, error, loading, onRetry, stale }: { title: string; note?: React.ReactNode; children?: React.ReactNode; error: string; loading: boolean; onRetry: () => void; stale: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-xs text-gray-400">{note}</span>
      </div>
      {loading && <p className="py-10 text-center text-sm text-gray-400">불러오는 중…</p>}
      {!loading && error && !stale && (
        <div className="py-10 text-center text-sm text-gray-500">
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200">다시 시도</button>
        </div>
      )}
      {!loading && error && stale && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">최신 정보를 불러오지 못해 이전 값을 보여 드립니다.</p>}
      {children}
    </div>
  );
}

// ───────── 날씨 ─────────
const TONE: Record<Grade["tone"], string> = { good: "bg-sky-50 text-sky-700", normal: "bg-green-50 text-green-700", bad: "bg-orange-50 text-orange-700", worst: "bg-red-50 text-red-700" };

export function WeatherPanel() {
  const { data: w, error, loading, at, reload } = usePolling<WeatherData>("/api/weather", 10 * 60_000);
  const min = w ? Math.min(...w.daily.map((d) => d.min ?? 99)) : 0;
  const max = w ? Math.max(...w.daily.map((d) => d.max ?? -99)) : 1;
  return (
    <Shell title={`🌤 ${w?.place ?? "해운대구 좌동"} 날씨`} note={at ? `${hhmm(at)} 갱신 · Open-Meteo` : ""} error={error} loading={loading} onRetry={reload} stale={!!w}>
      {w && (
        <div className="grid min-w-0 gap-5">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-4">
              <span className="text-6xl leading-none" aria-hidden>{w.current.icon}</span>
              <div>
                <div className="text-5xl font-bold tracking-tight">{w.current.temp}°</div>
                <div className="text-sm text-gray-500">{w.current.label} · 체감 {w.current.feels}°</div>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              {[["습도", `${w.current.humidity}%`], ["바람", `${w.current.wind} m/s`], ["강수", `${w.current.rain} mm`]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-2 py-2"><dt className="text-xs text-gray-400">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
          </div>

          {w.air && (
            <div className="flex flex-wrap gap-2 text-sm">
              {([["미세먼지(PM10)", w.air.pm10, w.air.grade10], ["초미세먼지(PM2.5)", w.air.pm25, w.air.grade25]] as const).map(([k, v, g]) => v !== null && g && (
                <span key={k} className={`rounded-full px-3 py-1 ${TONE[g.tone]}`}>{k} {v}㎍/㎥ · <b>{g.label}</b></span>
              ))}
              <span className="self-center text-xs text-gray-400">예측 모델 기준</span>
            </div>
          )}

          <section className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-gray-600">시간별</h3>
            <ul className="-mx-1 flex gap-1 overflow-x-auto pb-1">
              {w.hourly.map((h, i) => (
                <li key={h.time} className="w-14 shrink-0 rounded-xl bg-slate-50 py-2 text-center text-xs">
                  <div className="text-gray-400">{i === 0 ? "지금" : `${Number(h.time.slice(11, 13))}시`}</div>
                  <div className="my-1 text-xl" aria-label={h.label}>{h.icon}</div>
                  <div className="font-semibold">{h.temp}°</div>
                  <div className="text-sky-600">{h.pop ?? 0}%</div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-600">주간 예보</h3>
            <ul className="divide-y divide-gray-100">
              {w.daily.map((d, i) => (
                <li key={d.date} className="grid grid-cols-[2.6rem_2rem_2.4rem_1fr_4.6rem] items-center gap-2 py-2 text-sm sm:grid-cols-[4rem_2.2rem_3rem_1fr_5rem]">
                  <span className={`font-medium ${d.weekday === "일" ? "text-red-600" : d.weekday === "토" ? "text-blue-600" : ""}`}>{i === 0 ? "오늘" : d.weekday}</span>
                  <span className="text-xl" aria-label={d.label}>{d.icon}</span>
                  <span className="text-xs text-sky-600">{d.pop ?? 0}%</span>
                  <span className="relative mx-1 h-1.5 rounded-full bg-gray-100" aria-hidden>
                    <span className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 to-orange-400"
                      style={{ left: `${(((d.min ?? min) - min) / Math.max(1, max - min)) * 100}%`, right: `${((max - (d.max ?? max)) / Math.max(1, max - min)) * 100}%` }} />
                  </span>
                  <span className="whitespace-nowrap text-right"><span className="text-blue-600">{d.min}°</span> <span className="text-gray-300">/</span> <span className="text-red-600">{d.max}°</span></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Shell>
  );
}

// ───────── 시세 공통 ─────────
function Spark({ values, prev, up }: { values: number[]; prev: number | null; up: boolean }) {
  if (values.length < 2) return <div className="h-14" />;
  const lo = Math.min(...values, prev ?? Infinity), hi = Math.max(...values, prev ?? -Infinity);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - lo) / span) * 100}`).join(" ");
  const py = prev === null ? null : 100 - ((prev - lo) / span) * 100;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label="오늘 흐름">
      {py !== null && <line x1="0" x2="100" y1={py} y2={py} stroke="#d1d5db" strokeDasharray="2 2" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />}
      <polyline points={pts} fill="none" stroke={up ? "#dc2626" : "#2563eb"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function QuoteCard({ q }: { q: Quote }) {
  const up = q.change > 0, down = q.change < 0;
  const color = up ? "text-red-600" : down ? "text-blue-600" : "text-gray-600";
  const live = q.state === "open" || q.state === "live";
  return (
    <div className="rounded-2xl border border-gray-100 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">{q.flag && <span aria-hidden>{q.flag}</span>}{q.name}{q.sub && <span className="text-xs font-normal text-gray-400">{q.sub}</span>}</div>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${live ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
          {q.state === "open" ? "장중" : q.state === "live" ? "실시간" : q.state === "daily" ? "일 1회" : "장마감"}
        </span>
      </div>
      <div className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>{fmt(q.price)}</div>
      <div className={`text-sm font-medium ${color}`}>
        {q.state === "daily" ? <span className="text-gray-400">전일 대비 정보 없음</span> : <>{up ? "▲" : down ? "▼" : "–"} {fmt(Math.abs(q.change))} ({up ? "+" : down ? "−" : ""}{fmt(Math.abs(q.pct))}%)</>}
      </div>
      <Spark values={q.spark} prev={q.prevClose} up={!down} />
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{q.high !== null && q.low !== null ? `고 ${fmt(q.high)} · 저 ${fmt(q.low)}` : " "}</span>
        <span>{q.time ? `${md(q.time)} ${hhmm(q.time)} 기준` : ""}</span>
      </div>
    </div>
  );
}

type Quotes = { items: Quote[]; errors: string[]; fetchedAt: string };

export function StocksPanel() {
  const { data, error, loading, at, reload } = usePolling<Quotes>("/api/stocks", 20_000);
  const anyLive = data?.items.some((q) => q.state === "open");
  return (
    <Shell title="📈 코스피·코스닥" note={at ? `${hhmm(at)} 갱신 · ${anyLive ? "20초마다 자동 갱신" : "장마감 · 마지막 시세"}` : ""} error={error} loading={loading} onRetry={reload} stale={!!data}>
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">{data.items.map((q) => <QuoteCard key={q.id} q={q} />)}</div>
          <p className="mt-3 text-xs text-gray-400">정규장 평일 09:00~15:30. 자료 제공 환경에 따라 수 분 지연될 수 있으며 투자 판단의 근거로 사용할 수 없습니다.</p>
        </>
      )}
    </Shell>
  );
}

export function FxPanel() {
  const { data, error, loading, at, reload } = usePolling<Quotes>("/api/fx", 30_000);
  const daily = data?.items.some((q) => q.state === "daily");
  return (
    <Shell title="💱 환율 (원 기준)" note={at ? `${hhmm(at)} 갱신 · 30초마다 자동 갱신` : ""} error={error} loading={loading} onRetry={reload} stale={!!data}>
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">{data.items.map((q) => <QuoteCard key={q.id} q={q} />)}</div>
          <p className="mt-3 text-xs text-gray-400">
            원/엔은 100엔 기준입니다. 은행 고시 환율(매매기준율·송금·현찰)과는 다를 수 있습니다.
            {daily && " 일부 통화는 실시간 시세를 받지 못해 하루 한 번 갱신되는 환율을 보여 드립니다."}
          </p>
        </>
      )}
    </Shell>
  );
}
