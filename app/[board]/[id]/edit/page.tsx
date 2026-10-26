"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isBoard, type BoardKey, type DealType } from "@/lib/boards";
import { Gate, type Profile } from "@/components/Session";
import PostForm, { type PostInitial } from "@/components/PostForm";
import type { Attachment } from "@/lib/upload";

type Row = { id: number; board: string; title: string; body: string; author_id: string; deal_type: DealType | null; attachments: Attachment[] | null };

function Loader({ board, id, me }: { board: BoardKey; id: number; me: Profile }) {
  const [state, setState] = useState<"loading" | "missing" | "forbidden" | { initial: PostInitial }>("loading");
  useEffect(() => {
    supabase.from("posts").select("id,board,title,body,author_id,deal_type,attachments").eq("id", id).maybeSingle().then(({ data }) => {
      const p = data as Row | null;
      if (!p || p.board !== board) return setState("missing");
      if (p.author_id !== me.id) return setState("forbidden"); // 글쓴이만 수정할 수 있다
      setState({ initial: { id: p.id, title: p.title, body: p.body, attachments: p.attachments ?? [], dealType: p.deal_type } });
    });
  }, [board, id, me.id]);

  if (state === "loading") return <p className="py-10 text-center text-gray-400">불러오는 중…</p>;
  if (state === "missing") return <p className="py-10 text-center text-gray-500">글을 찾을 수 없습니다.</p>;
  if (state === "forbidden")
    return (
      <p className="py-10 text-center text-gray-500">
        글쓴이만 수정할 수 있습니다. <Link className="underline" href={`/${board}/${id}`}>글로 돌아가기</Link>
      </p>
    );
  return <PostForm board={board} me={me} initial={state.initial} />;
}

export default function EditPost({ params }: { params: Promise<{ board: string; id: string }> }) {
  const { board, id } = use(params);
  if (!isBoard(board) || !Number.isInteger(Number(id))) notFound();
  return <Gate>{(me) => <Loader board={board} id={Number(id)} me={me} />}</Gate>;
}
