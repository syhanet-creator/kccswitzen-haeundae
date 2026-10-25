"use client";
import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let hooked = false;
function setupHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    // 이미지는 이 서비스의 업로드 저장소 것만 허용 (외부 추적 이미지 차단)
    if (node.tagName === "IMG") {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      if (!node.getAttribute("src")?.startsWith(`${base}/storage/`)) node.remove();
    }
    // 인라인 스타일은 글자색·형광펜·정렬·글자 크기·글꼴만 허용 (화면을 덮는 스타일 등 차단)
    const st = node.getAttribute?.("style");
    if (st) {
      const keep = st.split(";").map((d) => d.trim()).filter((d) => !/url\(|expression/i.test(d) && (
        /^(color|background-color|text-align)\s*:\s*[#\w(),.\s%-]+$/i.test(d) ||
        /^font-size\s*:\s*\d{1,2}px$/i.test(d) ||
        /^font-family\s*:\s*(serif|sans-serif|monospace|cursive)$/i.test(d)));
      if (keep.length) node.setAttribute("style", keep.join("; "));
      else node.removeAttribute("style");
    }
    if (node.tagName === "INPUT") node.setAttribute("disabled", "");
  });
}

/** 게시글 본문(에디터 HTML 또는 예전 일반 텍스트)을 안전하게 보여준다. 정리(sanitize)는 브라우저에서만 한다. */
export default function PostBody({ html }: { html: string }) {
  const [clean, setClean] = useState("");
  useEffect(() => {
    setupHooks();
    const src = /^\s*</.test(html) ? html : `<p>${esc(html).replace(/\n/g, "<br>")}</p>`;
    setClean(DOMPurify.sanitize(src, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "form", "iframe"] }));
  }, [html]);
  return <div className="rich" dangerouslySetInnerHTML={{ __html: clean }} />;
}
