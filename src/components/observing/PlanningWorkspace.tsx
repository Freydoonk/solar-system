import { lazy, Suspense, type ReactNode } from "react";
import TonightPlanner, { type PlannerProps } from "./TonightPlanner";
import NightChartPanel from "./NightChartPanel";
import EventCalendar from "./EventCalendar";
import NotebookPanel from "./NotebookPanel";
import type { NotebookStore } from "./useNotebook";
import HorizonEditor from "./HorizonEditor";
import type { HorizonProfile } from "./horizon";
import type { Target } from "./observing";
import styles from "./Observe.module.css";
const SkyAtlasPanel = lazy(() => import("./SkyAtlasPanel"));

export default function PlanningWorkspace(props: PlannerProps & { body: Target; notebook: NotebookStore; onHorizonChange: (profile: HorizonProfile) => void; tab: string; onTabChange: (tab: string) => void; atlasVisited: boolean; children: ReactNode }) {
  const { tab, atlasVisited } = props;
  return <div className={styles.workspace}>
    <nav className={styles.toolTabs} aria-label="Observing tools">{[["tonight", "Night plan"], ["chart", "Night chart"], ["events", "Events"], ["atlas", "Star atlas"], ["telescope", "Telescope"], ["notebook", "Notebook"], ["horizon", "My horizon"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => props.onTabChange(id)}>{label}</button>)}</nav>
    <div hidden={tab !== "tonight"}><TonightPlanner {...props} active={props.active && tab === "tonight"} /></div>
    <div hidden={tab !== "chart"}><NightChartPanel {...props} active={props.active && tab === "chart"} /></div>
    <div hidden={tab !== "events"}><EventCalendar {...props} active={props.active && tab === "events"} /></div>
    <div hidden={tab !== "notebook"}><NotebookPanel {...props} active={props.active && tab === "notebook"} /></div>
    <div hidden={tab !== "horizon"}><HorizonEditor site={props.site} horizon={props.horizon} onChange={props.onHorizonChange} /></div>
    <div hidden={tab !== "telescope"}>{props.children}</div>
    {atlasVisited && <div hidden={tab !== "atlas"}><Suspense fallback={<p>Opening offline atlas…</p>}><SkyAtlasPanel {...props} active={props.active && tab === "atlas"} /></Suspense></div>}
  </div>;
}
