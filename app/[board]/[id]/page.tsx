"use client";
import { use, useCallback, useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STATUS_LABEL, isBoard } from "@/lib/boards";
import { Gate, type Profile } from "@/components/Session";

type Post = { id: number; title: string; body: string; status: keyof typeof STATUS_LABEL; author_id: string; created_at: string; profiles: { nickname: string } | null };
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
  return (
    <div className="grid gap-4 p-4">
      <div className="rounded-lg border bg-white p-4">
        <h1 className="text-lg font-bold">{post.title}</h1>
        <p className="mb-3 text-xs text-gray-500">{post.profiles?.nickname} · {post.created_at.slice(0, 10)}</p>
        <p className="whitespace-pre-wrap">{post.body}</p>
        <div className="mt-3 flex items-center gap-2">
          {board === "complaint" && (isAdmin ? (
            <select className="rounded border p-1 text-sm" value={post.status}
              onChange={async (e) => { await supabase.from("posts").update({ status: e.target.value }).eq("id", id); load(); }}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ) : <span className="text-sm text-blue-600">{STATUS_LABEL[post.status]}</span>)}
          {(post.author_id === me.id || isAdmin) && (
            <button className="text-sm text-red-600" onClick={async () => {
              if (!confirm("삭제할까요?")) return;
              await supabase.from("posts").delete().eq("id", id);
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
