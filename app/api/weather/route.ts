import { getWeather } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getWeather(), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
