import { useState } from "react";
import TonightPlanner, { type PlannerProps } from "./TonightPlanner";
import NightChartPanel from "./NightChartPanel";
import type { Target } from "./observing";
import styles from "./Observe.module.css";

export default function PlanningWorkspace(props: PlannerProps & { body: Target }) {
  const [tab, setTab] = useState("tonight");
  return <div className={styles.workspace}>
    <nav className={styles.toolTabs} aria-label="Planning tools">{[["tonight", "Tonight"], ["chart", "Night chart"]].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    <div hidden={tab !== "tonight"}><TonightPlanner {...props} active={props.active && tab === "tonight"} /></div>
    <div hidden={tab !== "chart"}><NightChartPanel {...props} active={props.active && tab === "chart"} /></div>
  </div>;
}
