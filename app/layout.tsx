import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Session";

export const metadata: Metadata = {
  title: "KCC 스위첸 입주민 커뮤니티",
  description: "해운대 좌동 KCC 스위첸 아파트 입주민 커뮤니티",
  appleWebApp: { capable: true, title: "스위첸 커뮤니티", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-gray-900">
        <Header />
        <main className="mx-auto max-w-6xl px-4">{children}</main>
      </body>
    </html>
  );
}
