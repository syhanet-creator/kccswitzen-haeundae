"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BOARDS, STATUS_LABEL, isBoard } from "@/lib/boards";
import { Gate } from "@/components/Session";

type Row = { id: number; title: string; status: keyof typeof STATUS_LABEL; created_at: string; profiles: { nickname: string } | null };

function List({ board, canWrite }: { board: keyof typeof BOARDS; canWrite: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("posts").select("id,title,status,created_at,profiles(nickname)").eq("board", board)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [board]);
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">{BOARDS[board].name}</h1>
        {canWrite && <Link href={`/${board}/new`} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">글쓰기</Link>}
      </div>
      <ul className="divide-y rounded-lg border bg-white">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/${board}/${r.id}`} className="flex justify-between p-3">
              <span>{board === "complaint" && <b className="mr-2 text-xs text-blue-600">[{STATUS_LABEL[r.status]}]</b>}{r.title}</span>
              <span className="text-xs text-gray-500">{r.profiles?.nickname} · {r.created_at.slice(0, 10)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-gray-500">글이 없습니다.</li>}
      </ul>
    </div>
  );
}

export default function BoardPage({ params }: { params: Promise<{ board: string }> }) {
  const { board } = use(params);
  if (!isBoard(board)) notFound();
  return <Gate>{(p) => <List board={board} canWrite={board !== "notice" || p.role === "admin"} />}</Gate>;
}
