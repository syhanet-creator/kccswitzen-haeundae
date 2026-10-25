"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize, FontFamily } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { RichTable, ALIGNS, BORDER_COLORS, BORDER_STYLES, BORDER_WIDTHS, currentTableEl, type TableAlign } from "@/lib/richTable";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import { checkFile, uploadFile } from "@/lib/upload";
import { FONTS, cssOf, fontOfCss } from "@/lib/fonts";
import SymbolPicker from "@/components/SymbolPicker";

const MAX_CHARS = 20000;
const COLORS = ["#111827", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];
const SIZES = [14, 16, 18, 20, 24, 28, 32];
const MARKS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];

type Props = {
  userId: string;
  onReady: (editor: Editor) => void;
  onChange: () => void;
  onError: (msg: string) => void;
};

function Btn({ on, active, disabled, title, children }: { on: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md px-2 text-sm transition disabled:opacity-30 ${active ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}>
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-gray-200" />;

function Swatches({ label, colors, onPick, onClear }: { label: string; colors: string[]; onPick: (c: string) => void; onClear: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative shrink-0">
      <summary title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()}
        className="flex h-9 min-w-9 cursor-pointer list-none items-center justify-center rounded-md px-1.5 text-sm text-gray-700 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="absolute left-0 top-10 z-20 flex gap-1.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
        {colors.map((c) => (
          <button key={c} type="button" aria-label={c} onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onPick(c); if (ref.current) ref.current.open = false; }}
            className="h-6 w-6 rounded-full border border-gray-200" style={{ background: c }} />
        ))}
        <button type="button" onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onClear(); if (ref.current) ref.current.open = false; }}
          className="rounded-full border border-gray-200 px-2 text-xs text-gray-500">없음</button>
      </div>
    </details>
  );
}

/** 표 속성: 테두리 모양·굵기·색, 배치, 너비·높이 */
function TablePanel({ editor }: { editor: Editor }) {
  const a = editor.getAttributes("table") as Record<string, unknown>;
  const set = (attrs: Record<string, unknown>) => editor.chain().focus().updateAttributes("table", attrs).run();
  const num = (v: unknown) => (typeof v === "number" ? Math.round(v) : "");
  const setAlign = (al: TableAlign) => {
    const attrs: Record<string, unknown> = { tbAlign: al };
    // 정렬·둘러싸기는 표가 본문보다 좁아야 눈에 보이므로 폭이 없으면 60%로 줄인다.
    if (al !== "inline" && !a.tbWidth) attrs.tbWidth = Math.round((currentTableEl(editor)?.offsetWidth ?? 600) * 0.6);
    set(attrs);
  };
  const sel = "h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm";
  return (
    <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2">테두리
          <select aria-label="테두리 모양" className={sel} value={(a.tbBorderStyle as string) ?? "solid"} onChange={(ev) => set({ tbBorderStyle: ev.target.value })}>
            {BORDER_STYLES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">굵기
          <select aria-label="테두리 굵기" className={sel} value={(a.tbBorderWidth as number) ?? 1} onChange={(ev) => set({ tbBorderWidth: Number(ev.target.value) })}>
            {BORDER_WIDTHS.map((w) => <option key={w} value={w}>{w}px</option>)}
          </select>
        </label>
        <span className="flex items-center gap-1.5">색
          {BORDER_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`테두리 색 ${c}`} onClick={() => set({ tbBorderColor: c })}
              className={`h-6 w-6 rounded-full border ${(a.tbBorderColor ?? "#e5e7eb") === c ? "ring-2 ring-blue-400 ring-offset-1" : ""}`} style={{ background: c }} />
          ))}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1">배치</span>
        {ALIGNS.map(([v, n]) => (
          <button key={v} type="button" onClick={() => setAlign(v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs ${(a.tbAlign ?? "inline") === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{n}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5">너비
          <input key={`w${a.tbWidth}`} type="number" min={120} className={`${sel} w-24`} defaultValue={num(a.tbWidth)} placeholder="자동" aria-label="표 너비(px)"
            onBlur={(ev) => ev.target.value && set({ tbWidth: Math.max(120, Number(ev.target.value)) })} />px
          <button type="button" className="text-xs text-blue-600" onClick={() => set({ tbWidth: null })}>100%</button>
        </span>
        <span className="flex items-center gap-1.5">높이
          <input key={`h${a.tbHeight}`} type="number" min={40} className={`${sel} w-24`} defaultValue={num(a.tbHeight)} placeholder="자동" aria-label="표 높이(px)"
            onBlur={(ev) => ev.target.value && set({ tbHeight: Math.max(40, Number(ev.target.value)) })} />px
          <button type="button" className="text-xs text-blue-600" onClick={() => set({ tbHeight: null })}>자동</button>
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-400">
        표 안에서 <b>Ctrl+A</b>로 표 전체를 선택한 뒤 <b>Ctrl+←/→</b> 폭, <b>Ctrl+↑/↓</b> 높이를 조절할 수 있습니다.
        &lsquo;글자처럼 취급&rsquo;은 본문 폭에 맞춰 문단처럼 놓이고, 둘러싸기는 표 옆으로 글이 흐릅니다.
      </p>
    </div>
  );
}

export default function RichEditor({ userId, onReady, onChange, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [tablePanel, setTablePanel] = useState(false);
  const [symbols, setSymbols] = useState(false);

  async function insertImages(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setBusy(true);
    for (const f of images) {
      try {
        const bad = checkFile(f);
        if (bad) throw new Error(bad);
        const up = await uploadFile(userId, f);
        editorRef.current?.chain().focus().setImage({ src: up.url, alt: f.name }).run();
      } catch (e) {
        onError(e instanceof Error ? e.message : "이미지 업로드에 실패했습니다.");
      }
    }
    setBusy(false);
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }),
      Image.configure({ allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "내용을 입력하세요. 사진은 끌어다 놓거나 붙여넣을 수 있습니다." }),
      RichTable.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount.configure({ limit: MAX_CHARS }),
    ],
    editorProps: {
      attributes: { class: "rich min-h-[320px] px-4 py-3 outline-none" },
      handlePaste: (_v, e) => {
        const files = [...(e.clipboardData?.files ?? [])];
        if (files.some((f) => f.type.startsWith("image/"))) { insertImages(files); return true; }
        return false;
      },
      handleDrop: (_v, e) => {
        const files = [...((e as DragEvent).dataTransfer?.files ?? [])];
        if (files.some((f) => f.type.startsWith("image/"))) { insertImages(files); return true; }
        return false;
      },
    },
    onUpdate: () => onChange(),
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor) onReady(editor);
  }, [editor, onReady]);

  if (!editor) return <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />;
  // 렌더 중에 chain().focus() 를 만들면 그 즉시 포커스 명령이 실행돼 제목 입력 등을 가로챈다. 클릭 시점에만 만든다.
  const c = () => editor.chain().focus();
  const e = editor;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm focus-within:border-blue-400">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 p-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-0.5">
        <Btn title="실행 취소" on={() => c().undo().run()} disabled={!e.can().undo()}>↶</Btn>
        <Btn title="다시 실행" on={() => c().redo().run()} disabled={!e.can().redo()}>↷</Btn>
        <Sep />
        <select aria-label="문단 스타일" className="h-9 shrink-0 rounded-md border-0 bg-transparent px-1 text-sm text-gray-700 hover:bg-gray-100"
          value={e.isActive("heading", { level: 1 }) ? "1" : e.isActive("heading", { level: 2 }) ? "2" : e.isActive("heading", { level: 3 }) ? "3" : "0"}
          onChange={(ev) => {
            const v = Number(ev.target.value);
            if (v) c().setHeading({ level: v as 1 | 2 | 3 }).run();
            else c().setParagraph().run();
          }}>
          <option value="0">본문</option><option value="1">제목 1</option><option value="2">제목 2</option><option value="3">제목 3</option>
        </select>
        <select aria-label="글꼴" className="h-9 w-32 shrink-0 rounded-md border-0 bg-transparent px-1 text-sm text-gray-700 hover:bg-gray-100"
          value={fontOfCss(e.getAttributes("textStyle").fontFamily as string | undefined).label}
          onChange={(ev) => {
            const f = FONTS.find((x) => x.label === ev.target.value)!;
            const ch = e.chain().focus();
            if (f.family) ch.setFontFamily(cssOf(f)).run(); else ch.unsetFontFamily().run();
          }}>
          {FONTS.map((f) => <option key={f.label} value={f.label} style={f.family ? { fontFamily: cssOf(f) } : undefined}>{f.label}</option>)}
        </select>
        <select aria-label="글자 크기" className="h-9 shrink-0 rounded-md border-0 bg-transparent px-1 text-sm text-gray-700 hover:bg-gray-100"
          value={(e.getAttributes("textStyle").fontSize as string | undefined) ?? ""}
          onChange={(ev) => { const ch = e.chain().focus(); if (ev.target.value) ch.setFontSize(ev.target.value).run(); else ch.unsetFontSize().run(); }}>
          <option value="">크기</option>
          {SIZES.map((n) => <option key={n} value={`${n}px`}>{n}</option>)}
        </select>
        <Sep />
        <Btn title="굵게" active={e.isActive("bold")} on={() => c().toggleBold().run()}><b>B</b></Btn>
        <Btn title="기울임" active={e.isActive("italic")} on={() => c().toggleItalic().run()}><i>I</i></Btn>
        <Btn title="밑줄" active={e.isActive("underline")} on={() => c().toggleUnderline().run()}><u>U</u></Btn>
        <Btn title="취소선" active={e.isActive("strike")} on={() => c().toggleStrike().run()}><s>S</s></Btn>
        <Swatches label="A̲ 글자색" colors={COLORS} onPick={(col) => c().setColor(col).run()} onClear={() => c().unsetColor().run()} />
        <Swatches label="🖍 형광펜" colors={MARKS} onPick={(col) => c().toggleHighlight({ color: col }).run()} onClear={() => c().unsetHighlight().run()} />
        <Sep />
        <Btn title="왼쪽 정렬" active={e.isActive({ textAlign: "left" })} on={() => c().setTextAlign("left").run()}>⇤</Btn>
        <Btn title="가운데 정렬" active={e.isActive({ textAlign: "center" })} on={() => c().setTextAlign("center").run()}>↔</Btn>
        <Btn title="오른쪽 정렬" active={e.isActive({ textAlign: "right" })} on={() => c().setTextAlign("right").run()}>⇥</Btn>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-0.5 border-t border-gray-100 pt-1">
        <Btn title="글머리 기호" active={e.isActive("bulletList")} on={() => c().toggleBulletList().run()}>• ≡</Btn>
        <Btn title="번호 목록" active={e.isActive("orderedList")} on={() => c().toggleOrderedList().run()}>1.≡</Btn>
        <Btn title="체크리스트" active={e.isActive("taskList")} on={() => c().toggleTaskList().run()}>☑</Btn>
        <Btn title="인용" active={e.isActive("blockquote")} on={() => c().toggleBlockquote().run()}>❝</Btn>
        <Btn title="코드 블록" active={e.isActive("codeBlock")} on={() => c().toggleCodeBlock().run()}>{"</>"}</Btn>
        <Btn title="구분선" on={() => c().setHorizontalRule().run()}>―</Btn>
        <Sep />
        <Btn title="링크" active={e.isActive("link")} on={() => {
          const prev = e.getAttributes("link").href as string | undefined;
          const url = window.prompt("링크 주소 (비우면 링크 삭제)", prev ?? "https://");
          if (url === null) return;
          if (url.trim() === "") return void c().extendMarkRange("link").unsetLink().run();
          if (!/^https?:\/\//i.test(url)) return onError("링크는 http:// 또는 https:// 로 시작해야 합니다.");
          c().extendMarkRange("link").setLink({ href: url }).run();
        }}>🔗</Btn>
        <Btn title="사진 넣기" disabled={busy} on={() => fileRef.current?.click()}>{busy ? "…" : "🖼"}</Btn>
        <Btn title="표 넣기" active={e.isActive("table")} on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</Btn>
        {e.isActive("table") && (
          <>
            <Btn title="행 추가" on={() => c().addRowAfter().run()}>＋행</Btn>
            <Btn title="열 추가" on={() => c().addColumnAfter().run()}>＋열</Btn>
            <Btn title="행 삭제" on={() => c().deleteRow().run()}>－행</Btn>
            <Btn title="열 삭제" on={() => c().deleteColumn().run()}>－열</Btn>
            <Btn title="표 삭제" on={() => c().deleteTable().run()}>🗑</Btn>
            <Btn title="표 속성" active={tablePanel} on={() => setTablePanel((v) => !v)}>⚙ 표 속성</Btn>
          </>
        )}
        <Sep />
        <Btn title="문자표" active={symbols} on={() => setSymbols(true)}>Ω 문자표</Btn>
        <Btn title="서식 지우기" on={() => c().clearNodes().unsetAllMarks().run()}>Tx</Btn>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(ev) => { insertImages([...(ev.target.files ?? [])]); ev.target.value = ""; }} />
      </div>
      {tablePanel && e.isActive("table") && <TablePanel editor={e} />}
      </div>
      <EditorContent editor={editor} />
      {symbols && <SymbolPicker onClose={() => setSymbols(false)} onPick={(ch) => c().insertContent(ch).run()} />}
      <div className="flex justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
        <span>{busy ? "사진 업로드 중…" : "사진은 끌어다 놓거나 붙여넣기(Ctrl+V)도 됩니다"}</span>
        <span>{e.storage.characterCount.characters().toLocaleString()} / {MAX_CHARS.toLocaleString()}자</span>
      </div>
    </div>
  );
}
