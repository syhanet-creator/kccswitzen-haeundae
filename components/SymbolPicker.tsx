"use client";
import { useEffect, useMemo, useState } from "react";
import { SYMBOL_GROUPS, codePointLabel } from "@/lib/symbols";

const RECENT_KEY = "symbol-recent";

const loadRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
};
const saveRecent = (list: string[]) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* 저장 불가 환경은 무시 */ }
};

/** 문자표 대화상자. 문자를 누르면 바로 본문에 들어가고, 계속 눌러 여러 개를 넣을 수 있다. */
export default function SymbolPicker({ onPick, onClose }: { onPick: (ch: string) => void; onClose: () => void }) {
  const [gid, setGid] = useState(SYMBOL_GROUPS[0].id);
  const [recent, setRecent] = useState<string[]>([]);
  const [hover, setHover] = useState("");
  const [hex, setHex] = useState("");
  const group = SYMBOL_GROUPS.find((g) => g.id === gid)!;
  const chars = useMemo(() => group.chars(), [group]);

  useEffect(() => {
    setRecent(loadRecent());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(ch: string) {
    onPick(ch);
    const next = [ch, ...recent.filter((x) => x !== ch)].slice(0, 30);
    setRecent(next);
    saveRecent(next);
  }

  function pickHex() {
    const n = parseInt(hex.replace(/^u\+?/i, "").trim(), 16);
    if (!Number.isFinite(n) || n < 0x20 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return;
    pick(String.fromCodePoint(n));
    setHex("");
  }

  const keep = (e: React.MouseEvent) => e.preventDefault(); // 본문의 커서 위치를 유지한다
  const glyph = "font-['Noto_Sans_KR','Segoe_UI_Symbol','Apple_Symbols',sans-serif]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="문자표"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onMouseDown={keep}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="font-bold">문자표 <span className="ml-1 text-xs font-normal text-gray-400">누르면 본문에 바로 들어갑니다</span></h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">닫기</button>
        </div>

        {recent.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2">
            <span className="mr-1 shrink-0 text-xs text-gray-400">최근</span>
            {recent.map((ch) => (
              <button key={ch} type="button" onClick={() => pick(ch)} onMouseEnter={() => setHover(ch)}
                className={`h-8 min-w-8 shrink-0 rounded-md border border-gray-200 text-base hover:bg-blue-50 ${glyph}`}>{ch}</button>
            ))}
          </div>
        )}

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2" role="tablist">
          {SYMBOL_GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === gid} onClick={() => setGid(g.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${g.id === gid ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{g.name}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
            {chars.map((ch) => (
              <button key={ch} type="button" onClick={() => pick(ch)} onMouseEnter={() => setHover(ch)} title={codePointLabel(ch)}
                className={`flex h-10 items-center justify-center rounded-md border border-gray-100 text-lg hover:border-blue-300 hover:bg-blue-50 ${glyph}`}>{ch}</button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-3xl ${glyph}`}>{hover || "·"}</span>
            <span className="text-xs text-gray-500">{hover ? codePointLabel(hover) : `${chars.length.toLocaleString()}자`}</span>
          </div>
          <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); pickHex(); }}>
            <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="유니코드 16진수 (예: 2605)" aria-label="유니코드 16진수"
              className="h-9 w-48 rounded-lg border border-gray-200 px-2 text-sm" />
            <button className="h-9 rounded-lg bg-gray-800 px-3 text-sm text-white">넣기</button>
          </form>
        </div>
      </div>
    </div>
  );
}
