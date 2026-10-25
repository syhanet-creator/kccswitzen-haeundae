"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// 서버(web-push)가 쓰는 base64url(패딩 없음)로 저장한다
const b64 = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

type State = "checking" | "unsupported" | "need-install" | "denied" | "off" | "on";

/** 관리자용: 이 기기로 가입 신청 푸시 알림을 받을지 켜고 끈다. */
export default function PushToggle({ userId }: { userId: string }) {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // 아이폰은 홈 화면에 설치한 앱에서만 푸시를 지원한다
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      return setState(ios && VAPID ? "need-install" : "unsupported");
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function enable() {
    setBusy(true); setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID) }));
      const { error } = await supabase.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) },
        { onConflict: "endpoint" },
      );
      if (error) throw new Error(error.message);
      await reg.showNotification("알림이 켜졌어요", { body: "새 가입 신청이 오면 이 기기로 알려 드릴게요.", icon: "/icons/icon-192.png", tag: "test" });
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "알림을 켜지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "알림을 끄지 못했습니다.");
    } finally { setBusy(false); }
  }

  const note: Partial<Record<State, string>> = {
    unsupported: "이 브라우저는 푸시 알림을 지원하지 않습니다. 안드로이드·PC의 크롬이나 엣지를 쓰세요.",
    "need-install": "아이폰은 먼저 사이트를 홈 화면에 추가(앱 설치)한 뒤, 그 앱에서 알림을 켜야 합니다.",
    denied: "브라우저 설정에서 이 사이트의 알림이 차단되어 있습니다. 차단을 풀고 다시 시도해 주세요.",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <div className="font-semibold">🔔 가입 신청 알림</div>
        <p className="mt-0.5 text-xs text-gray-500">
          {state === "on" ? "이 기기로 새 가입 신청 알림을 받고 있어요." : note[state] ?? "새 가입 신청이 오면 이 기기로 알려 드려요."}
        </p>
        {msg && <p role="alert" className="mt-1 text-xs text-red-600">{msg}</p>}
      </div>
      {state === "off" && (
        <button type="button" disabled={busy} onClick={enable} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? "켜는 중…" : "알림 켜기"}
        </button>
      )}
      {state === "on" && (
        <button type="button" disabled={busy} onClick={disable} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {busy ? "끄는 중…" : "알림 끄기"}
        </button>
      )}
    </div>
  );
}
