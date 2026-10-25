import { getIndices } from "@/lib/markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getIndices();
  if (!data.items.length) return Response.json({ error: "시세를 불러오지 못했습니다.", errors: data.errors }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } });
}
