import { lazy, Suspense, useState } from "react";
import TonightPlanner, { type PlannerProps } from "./TonightPlanner";
import NightChartPanel from "./NightChartPanel";
import EventCalendar from "./EventCalendar";
import type { Target } from "./observing";
import styles from "./Observe.module.css";
const SkyAtlasPanel = lazy(() => import("./SkyAtlasPanel"));

export default function PlanningWorkspace(props: PlannerProps & { body: Target }) {
  const [tab, setTab] = useState("tonight");
  const [atlasVisited, setAtlasVisited] = useState(false);
  return <div className={styles.workspace}>
    <nav className={styles.toolTabs} aria-label="Planning tools">{[["tonight", "Tonight"], ["chart", "Night chart"], ["events", "Events"], ["atlas", "Star atlas"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); if (id === "atlas") setAtlasVisited(true); }}>{label}</button>)}</nav>
    <div hidden={tab !== "tonight"}><TonightPlanner {...props} active={props.active && tab === "tonight"} /></div>
    <div hidden={tab !== "chart"}><NightChartPanel {...props} active={props.active && tab === "chart"} /></div>
    <div hidden={tab !== "events"}><EventCalendar {...props} active={props.active && tab === "events"} /></div>
    {atlasVisited && <div hidden={tab !== "atlas"}><Suspense fallback={<p>Opening offline atlas…</p>}><SkyAtlasPanel {...props} active={props.active && tab === "atlas"} /></Suspense></div>}
  </div>;
}
