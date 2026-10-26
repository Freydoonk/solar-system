import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { SolarSystem } from "./components/solar-system/SolarSystem";
import { usePwa } from "./pwa";
import "./App.css";

const Observe = lazy(() => import("./components/observing/Observe"));

export default function App() {
  const [page, setPage] = useState(() => window.location.hash === "#observe" ? "observe" : "explore");
  const [visitedObserve, setVisitedObserve] = useState(page === "observe");
  const installDialog = useRef<HTMLDialogElement>(null);
  const pwa = usePwa();
  useEffect(() => {
    const changed = () => {
      const next = window.location.hash === "#observe" ? "observe" : "explore";
      setPage(next);
      if (next === "observe") setVisitedObserve(true);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  return <div className="application">
    <header className="appBar">
      <nav aria-label="App sections">
        <a href="#explore" aria-current={page === "explore" ? "page" : undefined}>Explore</a>
        <a href="#observe" aria-current={page === "observe" ? "page" : undefined}>Observe</a>
      </nav>
      <div className="appActions">
        {pwa.offline && <span className="offlineBadge" role="status">Offline</span>}
        {pwa.updateAvailable && <button type="button" onClick={pwa.update}>Update</button>}
        <button type="button" onClick={() => installDialog.current?.showModal()}>{pwa.installed ? "App info" : "Install app"}</button>
      </div>
    </header>
    <div hidden={page !== "explore"}><SolarSystem active={page === "explore"} /></div>
    {visitedObserve && <div hidden={page !== "observe"}><Suspense fallback={<p className="appLoading">Opening your sky planner…</p>}>
      <Observe active={page === "observe"} />
    </Suspense></div>}
    <dialog ref={installDialog} className="installDialog" aria-labelledby="install-title">
      <h2 id="install-title">Take the sky with you</h2>
      <p>Install Solar System for a dedicated window and quick access at your telescope.</p>
      {pwa.canInstall ? <button type="button" onClick={() => void pwa.install()}>Install Solar System</button>
        : <p>{pwa.installed ? "The app is running in its installed window." : "Use your browser’s Install app or Add to Home Screen action. On iPhone or iPad, open in Safari, then Share → Add to Home Screen."}</p>}
      <p role="status">{pwa.error || (pwa.ready ? "Offline ready: the planner, simulation and surface maps are saved on this device."
        : import.meta.env.PROD ? "Keep this page open online while the offline files finish downloading." : "Offline installation is available in the production build.")}</p>
      <p>Offline, use device location if available or enter coordinates manually. IP location needs internet. Browser storage may be cleared by your device.</p>
      {pwa.updateAvailable && <p>A new version is ready. Updating reloads the app and resets this tab’s temporary settings.</p>}
      <button type="button" autoFocus onClick={() => installDialog.current?.close()}>Close</button>
    </dialog>
  </div>;
}
