import { useEffect, useRef, useState } from "react";

type InstallEvent = Event & { prompt(): Promise<{ outcome: "accepted" | "dismissed" }> };

export function usePwa() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState("");
  const applying = useRef(false);
  useEffect(() => {
    let mounted = true;
    const prompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const installedEvent = () => { setInstalled(true); setInstallEvent(null); };
    const network = () => setOffline(!navigator.onLine);
    const controller = () => { if (applying.current) window.location.reload(); };
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installedEvent);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    navigator.serviceWorker?.addEventListener("controllerchange", controller);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js", { scope: import.meta.env.BASE_URL }).then((registration) => {
        const inspect = () => {
          if (!mounted) return;
          setReady(!!registration.active);
          setWaiting(registration.waiting);
        };
        inspect();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            inspect();
            if (mounted && worker.state === "redundant" && !registration.active) setError("Offline download did not finish. Reopen online to retry.");
          });
        });
        void navigator.serviceWorker.ready.then(() => { if (mounted) setReady(true); });
      }).catch(() => { if (mounted) setError("Offline setup could not finish. Reopen online to retry."); });
    }
    return () => {
      mounted = false;
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installedEvent);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      navigator.serviceWorker?.removeEventListener("controllerchange", controller);
    };
  }, []);
  return {
    installed, offline, ready, error, canInstall: !!installEvent, updateAvailable: !!waiting,
    async install() {
      if (!installEvent) return;
      try { await installEvent.prompt(); }
      catch { setError("Use your browser’s Install app or Add to Home Screen action."); }
      finally { setInstallEvent(null); }
    },
    update() { applying.current = true; waiting?.postMessage({ type: "SKIP_WAITING" }); },
  };
}
