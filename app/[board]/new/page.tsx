"use client";
import { use, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, notFound } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { supabase } from "@/lib/supabase";
import { BOARDS, DEALS, isBoard, type BoardKey, type DealType } from "@/lib/boards";
import { TEMPLATES } from "@/lib/templates";
import { Gate, type Profile } from "@/components/Session";
import RichEditor from "@/components/RichEditor";
import {
  MAX_ATTACHMENTS, MAX_FILE_BYTES, checkFile, formatSize, removeUpload, uploadFile, type Attachment,
} from "@/lib/upload";

const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function Writer({ board, me }: { board: BoardKey; me: Profile }) {
  const router = useRouter();
  const b = BOARDS[board];
  const templates = TEMPLATES[board];
  const editorRef = useRef<Editor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [templateId, setTemplateId] = useState("blank");
  const [dealType, setDealType] = useState<DealType>("sell");
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);

  const onReady = useCallback((e: Editor) => { editorRef.current = e; }, []);

  function pickTemplate(id: string) {
    const t = templates.find((x) => x.id === id)!;
    const ed = editorRef.current;
    if (!ed) return;
    const dirty = !ed.isEmpty && !templates.some((x) => x.html && ed.getHTML() === x.html);
    if (dirty && !confirm("작성 중인 내용이 템플릿으로 바뀝니다. 계속할까요?")) return;
    setTemplateId(id);
    if (board === "market" && (id === "sell" || id === "share" || id === "wanted")) setDealType(id);
    if (t.title && (!title || templates.some((x) => x.title && x.title === title))) setTitle(t.title);
    if (!t.title && templates.some((x) => x.title && x.title === title)) setTitle("");
    ed.commands.setContent(t.html || "<p></p>", { emitUpdate: true });
    ed.commands.focus("start");
  }

  async function addFiles(list: File[]) {
    setErr("");
    const room = MAX_ATTACHMENTS - files.length - uploading;
    if (list.length > room) setErr(`첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 가능합니다. (${Math.max(room, 0)}개 더 추가 가능)`);
    const take = list.slice(0, Math.max(room, 0));
    for (const f of take) {
      const bad = checkFile(f);
      if (bad) { setErr(bad); continue; }
      setUploading((n) => n + 1);
      try {
        const up = await uploadFile(me.id, f);
        setFiles((cur) => [...cur, up]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "업로드에 실패했습니다.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function dropFile(i: number) {
    const f = files[i];
    setFiles((cur) => cur.filter((_, k) => k !== i));
    removeUpload(f.path).catch(() => {});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.getHTML();
    if (!title.trim()) return setErr("제목을 입력해 주세요.");
    if (!textOf(html) && !html.includes("<img")) return setErr("내용을 입력해 주세요.");
    if (uploading > 0) return setErr("파일 업로드가 끝난 뒤 등록해 주세요.");
    setSaving(true);
    const { error } = await supabase.from("posts").insert({
      board, title: title.trim(), body: html, author_id: me.id,
      ...(board === "market" ? { deal_type: dealType } : {}),
      attachments: files.map(({ name, url, path, size, type }) => ({ name, url, path, size, type })),
    });
    setSaving(false);
    if (error) return setErr(error.message);
    router.push(`/${board}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-3xl gap-5 py-6">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${b.tone}`}>{b.icon}</span>
        <div>
          <h1 className="text-xl font-bold">{b.name} 글쓰기</h1>
          <p className="text-sm text-gray-500">템플릿을 고르면 양식이 채워집니다. 언제든 바꿀 수 있어요.</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">템플릿 선택</h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {templates.map((t) => (
            <button key={t.id} type="button" onClick={() => pickTemplate(t.id)}
              className={`w-44 shrink-0 rounded-2xl border p-3 text-left transition sm:w-auto ${templateId === t.id ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"}`}>
              <div className="flex items-center gap-2"><span className="text-xl">{t.icon}</span><span className="font-semibold">{t.name}</span></div>
              <div className="mt-1 text-xs text-gray-500">{t.desc}</div>
              <div className="mt-2 line-clamp-2 min-h-8 rounded-lg bg-gray-50 px-2 py-1 text-[11px] leading-snug text-gray-400">
                {t.html ? textOf(t.html).slice(0, 60) : "아무것도 없는 빈 문서"}
              </div>
            </button>
          ))}
        </div>
      </section>

      {board === "market" && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">거래 유형</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DEALS) as DealType[]).map((k) => (
              <button key={k} type="button" onClick={() => setDealType(k)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${dealType === k ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"}`}>
                {DEALS[k].name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">등록 후 글 화면에서 &lsquo;{DEALS[dealType].done}&rsquo;로 전환할 수 있습니다.</p>
        </section>
      )}

      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="제목을 입력하세요"
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-lg font-semibold shadow-sm outline-none focus:border-blue-400" />

      <RichEditor userId={me.id} onReady={onReady} onChange={() => setErr("")} onError={setErr} />

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">첨부파일 <span className="font-normal text-gray-400">{files.length}/{MAX_ATTACHMENTS}</span></h2>
          <span className="text-xs text-gray-400">파일당 {formatSize(MAX_FILE_BYTES)} · 최대 {MAX_ATTACHMENTS}개</span>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles([...e.dataTransfer.files]); }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${drag ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
          📎 파일을 끌어다 놓거나 눌러서 선택하세요
        </div>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        {(files.length > 0 || uploading > 0) && (
          <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {files.map((f, i) => (
              <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">📄 {f.name} <span className="text-xs text-gray-400">{formatSize(f.size)}</span></span>
                <button type="button" onClick={() => dropFile(i)} className="shrink-0 text-xs text-red-600">삭제</button>
              </li>
            ))}
            {uploading > 0 && <li className="px-3 py-2 text-sm text-blue-600">업로드 중… ({uploading}개)</li>}
          </ul>
        )}
      </section>

      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      <div className="flex justify-end gap-2">
        <Link href={`/${board}`} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">취소</Link>
        <button disabled={saving || uploading > 0}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "등록 중…" : "등록"}
        </button>
      </div>
    </form>
  );
}

export default function NewPost({ params }: { params: Promise<{ board: string }> }) {
  const { board } = use(params);
  if (!isBoard(board)) notFound();
  return <Gate>{(me) => (board === "notice" && me.role !== "admin"
    ? <p className="py-10 text-center">공지사항은 관리자만 작성할 수 있습니다.</p>
    : <Writer board={board} me={me} />)}</Gate>;
}
