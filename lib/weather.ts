/** 해운대구 좌동 날씨: Open-Meteo(무료·키 없음) 응답을 화면용 데이터로 바꾼다. */
export const PLACE = { name: "해운대구 좌동", lat: 35.1707, lon: 129.1772 };

const BASE = process.env.WEATHER_API_BASE ?? "https://api.open-meteo.com";
const AIR_BASE = process.env.AIR_API_BASE ?? "https://air-quality-api.open-meteo.com";

// WMO 날씨 코드 → 한글·아이콘
export function describe(code: number, isDay = true): { label: string; icon: string } {
  if (code === 0) return isDay ? { label: "맑음", icon: "☀️" } : { label: "맑음", icon: "🌙" };
  if (code === 1) return isDay ? { label: "대체로 맑음", icon: "🌤️" } : { label: "대체로 맑음", icon: "🌙" };
  if (code === 2) return { label: "구름 조금", icon: "⛅" };
  if (code === 3) return { label: "흐림", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "안개", icon: "🌫️" };
  if (code >= 51 && code <= 55) return { label: "이슬비", icon: "🌦️" };
  if (code === 56 || code === 57) return { label: "어는 이슬비", icon: "🌧️" };
  if (code === 61) return { label: "약한 비", icon: "🌧️" };
  if (code === 63) return { label: "비", icon: "🌧️" };
  if (code === 65) return { label: "강한 비", icon: "🌧️" };
  if (code === 66 || code === 67) return { label: "어는 비", icon: "🌧️" };
  if (code === 71 || code === 73 || code === 75 || code === 77) return { label: "눈", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "소나기", icon: "🌦️" };
  if (code === 85 || code === 86) return { label: "소낙눈", icon: "🌨️" };
  if (code === 95) return { label: "뇌우", icon: "⛈️" };
  if (code === 96 || code === 99) return { label: "우박 동반 뇌우", icon: "⛈️" };
  return { label: "알 수 없음", icon: "❔" };
}

export type Grade = { label: string; tone: "good" | "normal" | "bad" | "worst" };

/** 한국 대기환경 기준 등급 */
export function gradePm10(v: number): Grade {
  return v <= 30 ? { label: "좋음", tone: "good" } : v <= 80 ? { label: "보통", tone: "normal" } : v <= 150 ? { label: "나쁨", tone: "bad" } : { label: "매우 나쁨", tone: "worst" };
}
export function gradePm25(v: number): Grade {
  return v <= 15 ? { label: "좋음", tone: "good" } : v <= 35 ? { label: "보통", tone: "normal" } : v <= 75 ? { label: "나쁨", tone: "bad" } : { label: "매우 나쁨", tone: "worst" };
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (v: number | null, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

type Raw = {
  current?: Record<string, unknown>;
  hourly?: { time?: string[]; temperature_2m?: (number | null)[]; precipitation_probability?: (number | null)[]; weather_code?: (number | null)[] };
  daily?: Record<string, unknown[]> & { time?: string[] };
};
type AirRaw = { current?: { pm10?: number | null; pm2_5?: number | null } };

export function parseWeather(raw: Raw, air: AirRaw | null) {
  const c = raw.current;
  const d = raw.daily;
  if (!c || !d?.time || num(c.temperature_2m) === null) throw new Error("unexpected weather response");
  const isDay = c.is_day !== 0;
  const code = num(c.weather_code) ?? -1;

  const nowHour = String(c.time ?? "").slice(0, 13); // "2026-10-26T14"
  const h = raw.hourly;
  const hourly: { time: string; temp: number | null; pop: number | null; icon: string; label: string }[] = [];
  if (h?.time) {
    for (let i = 0; i < h.time.length && hourly.length < 12; i++) {
      if (h.time[i].slice(0, 13) < nowHour) continue;
      const hour = Number(h.time[i].slice(11, 13));
      const wc = num(h.weather_code?.[i]) ?? -1;
      hourly.push({ time: h.time[i], temp: round(num(h.temperature_2m?.[i]) ?? null), pop: num(h.precipitation_probability?.[i]), ...describe(wc, hour >= 6 && hour < 19) });
    }
  }

  const daily = d.time.map((date, i) => {
    const wc = num(d.weather_code?.[i]) ?? -1;
    return {
      date,
      weekday: WEEK[new Date(date + "T12:00:00+09:00").getUTCDay()], // 한국 날짜 기준 요일
      min: round(num(d.temperature_2m_min?.[i])),
      max: round(num(d.temperature_2m_max?.[i])),
      pop: num(d.precipitation_probability_max?.[i]),
      rain: round(num(d.precipitation_sum?.[i]), 1),
      ...describe(wc, true),
    };
  });

  const pm10 = num(air?.current?.pm10);
  const pm25 = num(air?.current?.pm2_5);
  return {
    place: PLACE.name,
    updatedAt: String(c.time ?? ""),
    current: {
      temp: round(num(c.temperature_2m)),
      feels: round(num(c.apparent_temperature)),
      humidity: round(num(c.relative_humidity_2m)),
      wind: round(num(c.wind_speed_10m), 1),
      rain: round(num(c.precipitation), 1),
      ...describe(code, isDay),
    },
    air: pm10 === null && pm25 === null ? null : {
      pm10: round(pm10), pm25: round(pm25),
      grade10: pm10 === null ? null : gradePm10(pm10),
      grade25: pm25 === null ? null : gradePm25(pm25),
    },
    hourly,
    daily,
  };
}

export type WeatherData = ReturnType<typeof parseWeather>;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getWeather(): Promise<WeatherData> {
  const q = `latitude=${PLACE.lat}&longitude=${PLACE.lon}&timezone=Asia%2FSeoul`;
  const [raw, air] = await Promise.all([
    getJson<Raw>(`${BASE}/v1/forecast?${q}&forecast_days=7&wind_speed_unit=ms` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum`),
    getJson<AirRaw>(`${AIR_BASE}/v1/air-quality?${q}&current=pm10,pm2_5`).catch(() => null), // 미세먼지는 없어도 날씨는 보여 준다
  ]);
  return parseWeather(raw, air);
}
