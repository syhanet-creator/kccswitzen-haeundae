import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KCC 스위첸 입주민 커뮤니티",
    short_name: "스위첸 커뮤니티",
    description: "해운대 좌동 KCC 스위첸 아파트 입주민 커뮤니티",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
    lang: "ko",
    dir: "ltr",
    categories: ["social", "lifestyle", "news"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // 앱 아이콘을 길게 눌렀을 때 나오는 바로가기
    shortcuts: [
      { name: "공지사항", short_name: "공지", url: "/notice", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "자유게시판·소모임", short_name: "자유게시판", url: "/free", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "중고장터·나눔", short_name: "중고·나눔", url: "/market", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "민원·시설문의", short_name: "민원", url: "/complaint", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
