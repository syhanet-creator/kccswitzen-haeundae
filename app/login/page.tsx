"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ email: "", password: "", nickname: "", dong: "", ho: "" });
  const [msg, setMsg] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) return setMsg(error.message);
      return router.push("/");
    }
    const { error } = await supabase.auth.signUp({
      email: f.email,
      password: f.password,
      options: {
        data: { nickname: f.nickname, dong: f.dong, ho: f.ho },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return setMsg(error.message);
    setMsg("가입 완료. 이메일 인증 후 로그인하세요. 관리사무소 확인(승인) 후 이용할 수 있습니다.");
  }

  const input = "w-full rounded border p-2";
  return (
    <form onSubmit={submit} className="mx-auto mt-10 grid max-w-sm gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">{mode === "in" ? "로그인" : "입주민 가입"}</h1>
      <input className={input} type="email" placeholder="이메일" value={f.email} onChange={set("email")} required />
      <input className={input} type="password" placeholder="비밀번호(6자 이상)" value={f.password} onChange={set("password")} required minLength={6} />
      {mode === "up" && (
        <>
          <input className={input} placeholder="닉네임" value={f.nickname} onChange={set("nickname")} required />
          <div className="flex gap-2">
            <input className={input} placeholder="동" value={f.dong} onChange={set("dong")} required />
            <input className={input} placeholder="호" value={f.ho} onChange={set("ho")} required />
          </div>
        </>
      )}
      <button className="rounded bg-blue-600 p-2 text-white">{mode === "in" ? "로그인" : "가입"}</button>
      <button type="button" className="text-sm text-gray-600 underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "처음이신가요? 입주민 가입" : "이미 계정이 있어요"}
      </button>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </form>
  );
}
