import Link from "next/link";
import { BOARDS } from "@/lib/boards";

export default function Home() {
  return (
    <div className="grid gap-3 p-4">
      <h1 className="text-xl font-bold">우리 단지 커뮤니티</h1>
      {Object.entries(BOARDS).map(([key, b]) => (
        <Link key={key} href={`/${key}`} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="font-semibold">{b.name}</div>
          <div className="text-sm text-gray-500">{b.desc}</div>
        </Link>
      ))}
    </div>
  );
}
