"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BOARDS, STATUS_LABEL, dealOf, isBoard } from "@/lib/boards";
import { Gate } from "@/components/Session";

type Row = { id: number; title: string; status: keyof typeof STATUS_LABEL; deal_type: string | null; created_at: string; profiles: { nickname: string } | null };

function List({ board, canWrite }: { board: keyof typeof BOARDS; canWrite: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("posts").select("id,title,status,deal_type,created_at,profiles(nickname)").eq("board", board)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [board]);
  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${BOARDS[board].tone}`}>{BOARDS[board].icon}</span>
          <div>
            <h1 className="text-xl font-bold">{BOARDS[board].name}</h1>
            <p className="text-sm text-gray-500">{BOARDS[board].desc}</p>
          </div>
        </div>
        {canWrite && <Link href={`/${board}/new`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">글쓰기</Link>}
      </div>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/${board}/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50">
              <span className="min-w-0 truncate font-medium">
                {board === "complaint" && <b className="mr-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{STATUS_LABEL[r.status]}</b>}
                {board === "market" && (
                  <>
                    <b className={`mr-1.5 rounded px-1.5 py-0.5 text-xs ${dealOf(r.deal_type).tone}`}>{dealOf(r.deal_type).name}</b>
                    {r.status === "done" && <b className="mr-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">{dealOf(r.deal_type).done}</b>}
                  </>
                )}
                <span className={board === "market" && r.status === "done" ? "text-gray-400 line-through" : ""}>{r.title}</span>
              </span>
              <span className="shrink-0 text-xs text-gray-400">{r.profiles?.nickname} · {r.created_at.slice(0, 10)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-10 text-center text-gray-400">아직 글이 없습니다. 첫 글을 남겨 보세요.</li>}
      </ul>
    </div>
  );
}

export default function BoardPage({ params }: { params: Promise<{ board: string }> }) {
  const { board } = use(params);
  if (!isBoard(board)) notFound();
  return <Gate>{(p) => <List board={board} canWrite={board !== "notice" || p.role === "admin"} />}</Gate>;
}
