"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STATUS_LABEL, dealOf, isBoard } from "@/lib/boards";
import { Gate, type Profile } from "@/components/Session";
import PostBody from "@/components/PostBody";
import { formatSize, removeUpload, type Attachment } from "@/lib/upload";

type Post = { id: number; title: string; body: string; status: keyof typeof STATUS_LABEL; author_id: string; deal_type: string | null; created_at: string; attachments: Attachment[]; profiles: { nickname: string } | null };
type Comment = { id: number; body: string; author_id: string; profiles: { nickname: string } | null };

function Detail({ board, id, me }: { board: string; id: number; me: Profile }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const isAdmin = me.role === "admin";

  const load = useCallback(async () => {
    const p = await supabase.from("posts").select("*,profiles(nickname)").eq("id", id).maybeSingle();
    setPost(p.data as unknown as Post | null);
    const c = await supabase.from("comments").select("*,profiles(nickname)").eq("post_id", id).order("created_at");
    setComments((c.data as unknown as Comment[]) ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!post) return <p className="p-4 text-gray-500">글을 찾을 수 없습니다.</p>;
  const deal = dealOf(post.deal_type);
  const isDone = post.status === "done";
  const canManage = post.author_id === me.id || isAdmin;
  return (
    <div className="mx-auto grid max-w-3xl gap-4 py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {board === "market" && (
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${deal.tone}`}>{deal.name}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isDone ? "bg-gray-200 text-gray-600" : "bg-green-50 text-green-700"}`}>
              {isDone ? deal.done : deal.ongoing}
            </span>
          </div>
        )}
        <h1 className={`text-lg font-bold ${board === "market" && isDone ? "text-gray-400 line-through" : ""}`}>{post.title}</h1>
        <p className="mb-3 text-xs text-gray-500">{post.profiles?.nickname} · {post.created_at.slice(0, 10)}</p>
        <PostBody html={post.body} />
        {post.attachments?.length > 0 && (
          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="mb-1 text-xs font-semibold text-gray-500">첨부파일 {post.attachments.length}개</div>
            <ul className="divide-y divide-gray-100">
              {post.attachments.map((f) => (
                <li key={f.path}>
                  <a href={`${f.url}?download=${encodeURIComponent(f.name)}`} rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-700">
                    <span className="min-w-0 truncate">📄 {f.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatSize(f.size)} ⬇</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {board === "market" && canManage && (
          <button type="button"
            onClick={async () => {
              const next = isDone ? "open" : "done";
              if (next === "done" && !confirm(`${deal.done}로 전환할까요?`)) return;
              await supabase.from("posts").update({ status: next }).eq("id", id);
              load();
            }}
            className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold transition ${isDone ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
            {isDone ? `${deal.ongoing}으로 되돌리기` : `${deal.done}로 전환`}
          </button>
        )}
        <div className="mt-3 flex items-center gap-2">
          {board === "complaint" && (isAdmin ? (
            <select className="rounded border p-1 text-sm" value={post.status}
              onChange={async (e) => { await supabase.from("posts").update({ status: e.target.value }).eq("id", id); load(); }}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ) : <span className="text-sm text-blue-600">{STATUS_LABEL[post.status]}</span>)}
          {post.author_id === me.id && (
            <Link href={`/${board}/${id}/edit`} className="rounded-lg border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50">수정</Link>
          )}
          {(post.author_id === me.id || isAdmin) && (
            <button className="text-sm text-red-600" onClick={async () => {
              if (!confirm("삭제할까요?")) return;
              await supabase.from("posts").delete().eq("id", id);
              post.attachments?.forEach((f) => removeUpload(f.path).catch(() => {}));
              router.push(`/${board}`);
            }}>삭제</button>
          )}
        </div>
      </div>
      <ul className="grid gap-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded border bg-white p-3 text-sm">
            <b>{c.profiles?.nickname}</b> {c.body}
            {(c.author_id === me.id || isAdmin) && (
              <button className="ml-2 text-xs text-red-600" onClick={async () => { await supabase.from("comments").delete().eq("id", c.id); load(); }}>삭제</button>
            )}
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        await supabase.from("comments").insert({ post_id: id, body: text, author_id: me.id });
        setText(""); load();
      }}>
        <input className="flex-1 rounded border p-2" placeholder="댓글" value={text} onChange={(e) => setText(e.target.value)} required />
        <button className="rounded bg-blue-600 px-3 text-white">등록</button>
      </form>
    </div>
  );
}

export default function PostPage({ params }: { params: Promise<{ board: string; id: string }> }) {
  const { board, id } = use(params);
  if (!isBoard(board) || !Number.isInteger(Number(id))) notFound();
  return <Gate>{(me) => <Detail board={board} id={Number(id)} me={me} />}</Gate>;
}
