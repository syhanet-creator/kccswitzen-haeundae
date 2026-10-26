"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import { isBoard } from "@/lib/boards";
import { Gate } from "@/components/Session";
import PostForm from "@/components/PostForm";

export default function NewPost({ params }: { params: Promise<{ board: string }> }) {
  const { board } = use(params);
  if (!isBoard(board)) notFound();
  return <Gate>{(me) => (board === "notice" && me.role !== "admin"
    ? <p className="py-10 text-center">공지사항은 관리자만 작성할 수 있습니다.</p>
    : <PostForm board={board} me={me} />)}</Gate>;
}
