"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile, type Profile } from "@/components/Session";
import PushToggle from "@/components/PushToggle";

type Row = Profile & { created_at: string };

function Admin({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setApproved(id: string, approved: boolean) {
    const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
    if (error) setErr(error.message);
    load();
  }
  async function remove(id: string) {
    if (!confirm("가입 신청을 거절(삭제)할까요?")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) setErr(error.message);
    load();
  }

  const pending = rows.filter((r) => !r.approved);
  const approved = rows.filter((r) => r.approved);
  const Item = ({ r }: { r: Row }) => (
    <li className="flex items-center justify-between gap-2 p-3">
      <div>
        <div className="font-medium">{r.nickname} {r.role === "admin" && <b className="text-xs text-blue-600">관리자</b>}</div>
        <div className="text-xs text-gray-500">{r.dong}동 {r.ho}호 · {r.created_at.slice(0, 10)}</div>
      </div>
      <div className="flex gap-2 text-sm">
        {r.approved ? (
          r.role !== "admin" && <button className="text-gray-600" onClick={() => setApproved(r.id, false)}>승인 취소</button>
        ) : (
          <>
            <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => setApproved(r.id, true)}>승인</button>
            <button className="text-red-600" onClick={() => remove(r.id)}>거절</button>
          </>
        )}
      </div>
    </li>
  );

  return (
    <div className="mx-auto grid max-w-3xl gap-4 py-6">
      <h1 className="text-xl font-bold">입주민 가입 승인</h1>
      <PushToggle userId={userId} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <section>
        <h2 className="mb-2 font-semibold">승인 대기 ({pending.length})</h2>
        <ul className="divide-y rounded-lg border bg-white">
          {pending.map((r) => <Item key={r.id} r={r} />)}
          {pending.length === 0 && <li className="p-4 text-gray-500">대기 중인 신청이 없습니다.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">승인된 입주민 ({approved.length})</h2>
        <ul className="divide-y rounded-lg border bg-white">
          {approved.map((r) => <Item key={r.id} r={r} />)}
        </ul>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const { profile, loading } = useProfile();
  if (loading) return <p className="p-6 text-gray-500">불러오는 중…</p>;
  if (!profile || profile.role !== "admin" || !profile.approved) return <p className="p-6">관리자만 접근할 수 있습니다.</p>;
  return <Admin userId={profile.id} />;
}
