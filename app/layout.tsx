import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Session";

export const metadata: Metadata = {
  title: "KCC 스위첸 입주민 커뮤니티",
  description: "해운대 좌동 KCC 스위첸 아파트 입주민 커뮤니티",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900">
        <Header />
        <main className="mx-auto max-w-2xl">{children}</main>
      </body>
    </html>
  );
}
