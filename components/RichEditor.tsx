"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import { checkFile, uploadFile } from "@/lib/upload";

const MAX_CHARS = 20000;
const COLORS = ["#111827", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];
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
      className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 text-sm transition disabled:opacity-30 ${active ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}>
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
        className="flex h-8 min-w-8 cursor-pointer list-none items-center justify-center rounded-md px-1.5 text-sm text-gray-700 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="absolute left-0 top-9 z-20 flex gap-1.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
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

export default function RichEditor({ userId, onReady, onChange, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [busy, setBusy] = useState(false);

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
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "내용을 입력하세요. 사진은 끌어다 놓거나 붙여넣을 수 있습니다." }),
      Table.configure({ resizable: false }),
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
  const c = editor.chain().focus();
  const e = editor;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm focus-within:border-blue-400">
      <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-gray-100 bg-white/95 p-1.5 backdrop-blur">
        <Btn title="실행 취소" on={() => c.undo().run()} disabled={!e.can().undo()}>↶</Btn>
        <Btn title="다시 실행" on={() => c.redo().run()} disabled={!e.can().redo()}>↷</Btn>
        <Sep />
        <select aria-label="문단 스타일" className="h-8 shrink-0 rounded-md border-0 bg-transparent px-1 text-sm text-gray-700 hover:bg-gray-100"
          value={e.isActive("heading", { level: 1 }) ? "1" : e.isActive("heading", { level: 2 }) ? "2" : e.isActive("heading", { level: 3 }) ? "3" : "0"}
          onChange={(ev) => {
            const v = Number(ev.target.value);
            if (v) c.setHeading({ level: v as 1 | 2 | 3 }).run();
            else c.setParagraph().run();
          }}>
          <option value="0">본문</option><option value="1">제목 1</option><option value="2">제목 2</option><option value="3">제목 3</option>
        </select>
        <Sep />
        <Btn title="굵게" active={e.isActive("bold")} on={() => c.toggleBold().run()}><b>B</b></Btn>
        <Btn title="기울임" active={e.isActive("italic")} on={() => c.toggleItalic().run()}><i>I</i></Btn>
        <Btn title="밑줄" active={e.isActive("underline")} on={() => c.toggleUnderline().run()}><u>U</u></Btn>
        <Btn title="취소선" active={e.isActive("strike")} on={() => c.toggleStrike().run()}><s>S</s></Btn>
        <Swatches label="A̲ 글자색" colors={COLORS} onPick={(col) => c.setColor(col).run()} onClear={() => c.unsetColor().run()} />
        <Swatches label="🖍 형광펜" colors={MARKS} onPick={(col) => c.toggleHighlight({ color: col }).run()} onClear={() => c.unsetHighlight().run()} />
        <Sep />
        <Btn title="왼쪽 정렬" active={e.isActive({ textAlign: "left" })} on={() => c.setTextAlign("left").run()}>⇤</Btn>
        <Btn title="가운데 정렬" active={e.isActive({ textAlign: "center" })} on={() => c.setTextAlign("center").run()}>↔</Btn>
        <Btn title="오른쪽 정렬" active={e.isActive({ textAlign: "right" })} on={() => c.setTextAlign("right").run()}>⇥</Btn>
        <Sep />
        <Btn title="글머리 기호" active={e.isActive("bulletList")} on={() => c.toggleBulletList().run()}>• ≡</Btn>
        <Btn title="번호 목록" active={e.isActive("orderedList")} on={() => c.toggleOrderedList().run()}>1.≡</Btn>
        <Btn title="체크리스트" active={e.isActive("taskList")} on={() => c.toggleTaskList().run()}>☑</Btn>
        <Btn title="인용" active={e.isActive("blockquote")} on={() => c.toggleBlockquote().run()}>❝</Btn>
        <Btn title="코드 블록" active={e.isActive("codeBlock")} on={() => c.toggleCodeBlock().run()}>{"</>"}</Btn>
        <Btn title="구분선" on={() => c.setHorizontalRule().run()}>―</Btn>
        <Sep />
        <Btn title="링크" active={e.isActive("link")} on={() => {
          const prev = e.getAttributes("link").href as string | undefined;
          const url = window.prompt("링크 주소 (비우면 링크 삭제)", prev ?? "https://");
          if (url === null) return;
          if (url.trim() === "") return void c.extendMarkRange("link").unsetLink().run();
          if (!/^https?:\/\//i.test(url)) return onError("링크는 http:// 또는 https:// 로 시작해야 합니다.");
          c.extendMarkRange("link").setLink({ href: url }).run();
        }}>🔗</Btn>
        <Btn title="사진 넣기" disabled={busy} on={() => fileRef.current?.click()}>{busy ? "…" : "🖼"}</Btn>
        <Btn title="표 넣기" active={e.isActive("table")} on={() => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</Btn>
        {e.isActive("table") && (
          <>
            <Btn title="행 추가" on={() => c.addRowAfter().run()}>＋행</Btn>
            <Btn title="열 추가" on={() => c.addColumnAfter().run()}>＋열</Btn>
            <Btn title="행 삭제" on={() => c.deleteRow().run()}>－행</Btn>
            <Btn title="열 삭제" on={() => c.deleteColumn().run()}>－열</Btn>
            <Btn title="표 삭제" on={() => c.deleteTable().run()}>🗑</Btn>
          </>
        )}
        <Sep />
        <Btn title="서식 지우기" on={() => c.clearNodes().unsetAllMarks().run()}>Tx</Btn>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(ev) => { insertImages([...(ev.target.files ?? [])]); ev.target.value = ""; }} />
      </div>
      <EditorContent editor={editor} />
      <div className="flex justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
        <span>{busy ? "사진 업로드 중…" : "사진은 끌어다 놓거나 붙여넣기(Ctrl+V)도 됩니다"}</span>
        <span>{e.storage.characterCount.characters().toLocaleString()} / {MAX_CHARS.toLocaleString()}자</span>
      </div>
    </div>
  );
}
