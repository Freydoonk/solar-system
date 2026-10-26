import { useState } from "react";
import { FLAT_HORIZON, HORIZON_DIRECTIONS, validateHorizon, type HorizonProfile } from "./horizon";
import type { Site } from "./observing";
import styles from "./Observe.module.css";
export default function HorizonEditor({ site, horizon, onChange }: { site: Site | null; horizon: HorizonProfile; onChange: (profile: HorizonProfile) => void }) {
  const [draft, setDraft] = useState<{ site: Site | null; values: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const values = draft?.site === site ? draft.values : horizon.map(String);
  return <section className={styles.card} aria-label="Personal horizon"><h2>What blocks your horizon?</h2>
    <p className={styles.note}>Estimate the top of buildings, trees or hills in each direction. Heights interpolate between the eight bearings. Use true north. For example, a western building reaching 30° means W = 30.</p>
    <form onSubmit={event => { event.preventDefault(); try {
      if (values.some(value => !value.trim())) throw new Error("Fill every direction, using 0 for a clear horizon.");
      const next = values.map(Number); validateHorizon(next); onChange(next); setMessage("Horizon applied. Rebuild plans and searches to use it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Invalid horizon."); } }}>
      <div className={styles.horizonFields}>{HORIZON_DIRECTIONS.map((direction, index) => <label key={direction}>{direction} · {index * 45}°<input type="number" min="0" max="90" step="1" value={values[index]} required onChange={event => setDraft({ site, values: values.map((value, i) => i === index ? event.target.value : value) })} /></label>)}</div>
      <div className={styles.actions}><button disabled={!site}>Apply horizon</button><button type="button" onClick={() => { onChange(FLAT_HORIZON); setDraft(null); setMessage("Clear horizon restored."); }}>Reset to clear horizon</button></div>
    </form><p role="status">{message}</p>
    <svg className={styles.chart} viewBox="0 0 400 150" role="img" aria-label="Applied obstruction heights by compass bearing"><path d={`M20 120 ${[...horizon, horizon[0]].map((height, index) => `L${20 + index * 45} ${120 - height}`).join(" ")} L380 120Z`} fill="#a16c4f66" stroke="#f8cf8f" />{HORIZON_DIRECTIONS.map((direction, index) => <text key={direction} x={20 + index * 45} y="143" textAnchor="middle">{direction}</text>)}<text x="20" y="18">90°</text></svg>
    <p className={styles.note}>The applied mask affects the night plan, observing windows, pointing status and star atlas. It is kept only in this tab and resets when your site changes. Baseline target ≥20° and Sun ≤−6° rules still apply. Mask crossings are sampled every 30 seconds and refined; narrow or grazing gaps can be missed. Leave clearance above uncertain obstacles.</p>
  </section>;
}
