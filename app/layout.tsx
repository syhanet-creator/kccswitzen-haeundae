import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Session";
import { fontsStylesheets } from "@/lib/fonts";
import { PwaRegister } from "@/components/Pwa";

export const metadata: Metadata = {
  title: "KCC 스위첸 입주민 커뮤니티",
  description: "해운대 좌동 KCC 스위첸 아파트 입주민 커뮤니티",
  applicationName: "스위첸 커뮤니티",
  appleWebApp: { capable: true, title: "스위첸 커뮤니티", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 글꼴마다 따로 불러와 하나가 실패해도 나머지는 적용된다. 실제 글자 파일은 쓰일 때만 내려받는다. */}
        {fontsStylesheets.map((href) => <link key={href} rel="stylesheet" href={href} />)}
      </head>
      <body className="min-h-screen bg-slate-50 text-gray-900">
        <PwaRegister />
        <Header />
        <main className="mx-auto max-w-6xl px-4">{children}</main>
      </body>
    </html>
  );
}
