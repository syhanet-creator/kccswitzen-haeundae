"use client";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** 서비스 워커 등록, 새 버전 안내, 오프라인 안내. 화면 맨 위에 얇은 띠로 나온다. */
export function PwaRegister() {
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    let reloading = false;
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const hadController = !!navigator.serviceWorker.controller; // 처음 설치될 때는 새로고침하지 않는다(새 버전으로 바뀔 때만)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || !hadController) return;
        reloading = true;
        window.location.reload();
      });
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
        const watch = (w: ServiceWorker | null) => {
          if (!w) return;
          w.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) setUpdate(w); // 새 버전 대기 중
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg.waiting);
        watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing));
        // 앱을 오래 켜 두는 경우를 위해 가끔 새 버전을 확인한다.
        const timer = setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        return () => clearInterval(timer);
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && !update) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-gray-900 px-4 py-2 text-sm text-white"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      {!online ? (
        <span>오프라인 상태입니다. 이전에 본 화면만 볼 수 있어요.</span>
      ) : (
        <>
          <span>새 버전이 있습니다.</span>
          <button type="button" className="rounded-full bg-white px-3 py-1 font-semibold text-gray-900" onClick={() => update?.postMessage("SKIP_WAITING")}>
            새로고침
          </button>
        </>
      )}
    </div>
  );
}

/** 헤더의 '앱 설치' 버튼. 안드로이드·PC 는 설치 창을, 아이폰은 '홈 화면에 추가' 방법을 보여준다. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true); // 판단이 끝나기 전에는 숨긴다
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    const early = (window as unknown as { __installPrompt?: InstallPrompt | null }).__installPrompt;
    if (early) setPrompt(early); // 화면이 준비되기 전에 이미 도착한 신호
    const onReady = () => setPrompt((window as unknown as { __installPrompt?: InstallPrompt | null }).__installPrompt ?? null);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("installprompt-ready", onReady);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("installprompt-ready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setPrompt(null);
    } else {
      setHelp(true);
    }
  }

  return (
    <>
      <button type="button" onClick={install}
        className="mr-3 whitespace-nowrap rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">
        앱 설치
      </button>
      {help && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="앱 설치 방법"
          onClick={(e) => e.target === e.currentTarget && setHelp(false)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            <h2 className="text-lg font-bold">홈 화면에 앱 추가</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Safari 아래(또는 위)의 <b>공유 버튼</b> <span aria-hidden>⬆️</span> 을 누르세요.</li>
              <li><b>홈 화면에 추가</b>를 고르세요.</li>
              <li><b>추가</b>를 누르면 홈 화면에 앱 아이콘이 생깁니다.</li>
            </ol>
            <p className="mt-3 text-xs text-gray-400">크롬·네이버 앱 등 다른 브라우저에서는 Safari 로 열어야 추가할 수 있습니다.</p>
            <button type="button" className="mt-4 w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white" onClick={() => setHelp(false)}>확인</button>
          </div>
        </div>
      )}
    </>
  );
}
