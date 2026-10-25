"use client";
import { useEffect, useState } from "react";
import { FxPanel, StocksPanel, WeatherPanel } from "@/components/LivePanels";

const TABS = [
  { id: "news", label: "📰 뉴스" },
  { id: "weather", label: "🌤 날씨" },
  { id: "stocks", label: "📈 증시" },
  { id: "fx", label: "💱 환율" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** 메인 화면 탭. 뉴스는 서버에서 만든 화면을 그대로 받고, 나머지는 보일 때만 실시간으로 불러온다. */
export default function HomeTabs({ news }: { news: React.ReactNode }) {
  const [tab, setTab] = useState<TabId>("news");

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function pick(id: TabId) {
    setTab(id);
    history.replaceState(null, "", id === "news" ? window.location.pathname : `#${id}`);
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div role="tablist" aria-label="정보 탭" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-w-0">
        {tab === "news" && news}
        {tab === "weather" && <WeatherPanel />}
        {tab === "stocks" && <StocksPanel />}
        {tab === "fx" && <FxPanel />}
      </div>
    </div>
  );
}
