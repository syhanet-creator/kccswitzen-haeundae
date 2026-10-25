import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Supabase 트리거(pg_net)가 새 가입 신청 때 호출한다. 공유 비밀값(x-webhook-secret)이 맞아야 하고,
 * 등록된 관리자 기기들에 웹 푸시를 보낸다.
 */
export async function POST(req: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !pub || !priv) return Response.json({ error: "not configured" }, { status: 503 });
  if (!sameSecret(req.headers.get("x-webhook-secret") ?? "", secret)) return Response.json({ error: "forbidden" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const who = clip(body.nickname, 20) || "새 입주민";
  const unit = [clip(body.dong, 6) && `${clip(body.dong, 6)}동`, clip(body.ho, 6) && `${clip(body.ho, 6)}호`].filter(Boolean).join(" ");
  const payload = JSON.stringify({
    title: "새 가입 신청",
    body: `${who}${unit ? ` (${unit})` : ""}님이 승인을 기다리고 있어요.`,
    url: "/admin",
    tag: "signup",
  });

  webpush.setVapidDetails("https://kccswitzen-haeundae.vercel.app", pub, priv);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: subs, error } = await supabase.rpc("get_admin_push_subscriptions", { p_secret: secret });
  if (error) return Response.json({ error: "subscriptions unavailable" }, { status: 502 });

  let sent = 0, removed = 0, failed = 0;
  await Promise.all(
    (subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { // 앱을 지웠거나 알림을 끈 기기: 목록에서 정리
          await supabase.rpc("remove_push_subscription", { p_secret: secret, p_endpoint: s.endpoint });
          removed++;
        } else failed++;
      }
    }),
  );
  return Response.json({ sent, removed, failed });
}
