"use client";
import { use, useState } from "react";
import { useRouter, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BOARDS, isBoard } from "@/lib/boards";
import { Gate } from "@/components/Session";

export default function NewPost({ params }: { params: Promise<{ board: string }> }) {
  const { board } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  if (!isBoard(board)) notFound();

  return (
    <Gate>
      {(p) => (
        <form className="grid gap-3 p-4" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("posts").insert({ board, title, body, author_id: p.id });
          if (error) return setErr(error.message);
          router.push(`/${board}`);
        }}>
          <h1 className="text-xl font-bold">{BOARDS[board].name} 글쓰기</h1>
          <input className="rounded border p-2" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="h-48 rounded border p-2" placeholder="내용" value={body} onChange={(e) => setBody(e.target.value)} required />
          <button className="rounded bg-blue-600 p-2 text-white">등록</button>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </form>
      )}
    </Gate>
  );
}
