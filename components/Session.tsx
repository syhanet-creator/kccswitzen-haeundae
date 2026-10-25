"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export type Profile = { id: string; nickname: string; dong: string; ho: string; role: string; approved: boolean };

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setProfile(null); setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(data); setLoading(false);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);
  return { profile, loading };
}

/** 로그인·승인된 입주민에게만 children 을 보여준다. */
export function Gate({ children }: { children: (p: Profile) => React.ReactNode }) {
  const { profile, loading } = useProfile();
  if (loading) return <p className="p-6 text-gray-500">불러오는 중…</p>;
  if (!profile) return <p className="p-6">입주민 전용입니다. <Link className="underline" href="/login">로그인/가입</Link></p>;
  if (!profile.approved) return <p className="p-6">관리사무소의 입주민 확인(승인) 후 이용할 수 있습니다.</p>;
  return <>{children(profile)}</>;
}

export function Header() {
  const { profile } = useProfile();
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between p-4">
        <Link href="/" className="font-bold">KCC 스위첸 해운대 좌동</Link>
        {profile ? (
          <button className="text-sm text-gray-600" onClick={() => supabase.auth.signOut()}>
            {profile.dong}동 {profile.ho}호 · 로그아웃
          </button>
        ) : (
          <Link href="/login" className="text-sm text-gray-600">로그인</Link>
        )}
      </div>
    </header>
  );
}
