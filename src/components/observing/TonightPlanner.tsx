import { useState } from "react";
import { directionName, type Site, type Target } from "./observing";
import type { TonightPlan } from "./tonight";
import type { PlanningRequest } from "./planning.worker";
import { usePlanning } from "./usePlanning";
import styles from "./Observe.module.css";
import type { HorizonProfile } from "./horizon";

export type PlannerProps = { site: Site | null; time: number; active: boolean; horizon: HorizonProfile; formatTime: (time: number) => string; choose: (body: Target, time: number) => void; openPreview?: (body: Target, time: number) => void };

export default function TonightPlanner({ site, time, active, horizon, formatTime, choose, openPreview, onUsePlan }: PlannerProps & { onUsePlan: (plan: TonightPlan) => void }) {
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState<"eyes" | "optics">("eyes");
  const [request, setRequest] = useState<PlanningRequest | null>(null);
  const result = usePlanning<TonightPlan>(request, active);
  const matches = request?.kind === "tonight" && request.input.site === site && request.input.minutes === minutes && request.input.equipment === equipment && request.input.horizon === horizon;
  const pending = matches && !result;
  const plan = matches ? result?.value : undefined;
  return <section className={styles.card} aria-label="Tonight planner">
    <span className={styles.eyebrow}>A NIGHT WORTH LOOKING UP</span><h2>What can I see tonight?</h2>
    <p className={styles.note}>Find a session in the next 24 hours from your selected time. Each target gets ten minutes, including time to move your equipment.</p>
    <div className={styles.fields}><label>Time available<select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
      {[30, 60, 120, 240].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label>
      <label>Viewing with<select value={equipment} onChange={e => setEquipment(e.target.value as typeof equipment)}><option value="eyes">Unaided eyes</option><option value="optics">Binoculars / telescope</option></select></label></div>
    <div className={styles.actions}><button disabled={!site || pending} onClick={() => site && setRequest({ kind: "tonight", input: { site, start: time, minutes, equipment, horizon } })}>{pending ? "Planning…" : "Build my night"}</button>
      {pending && <button onClick={() => setRequest(null)}>Cancel planning</button>}</div>
    {!site && <p className={styles.note}>Set your location with Location &amp; time first.</p>}
    <div aria-live="polite">{matches && request && <p className={styles.note}>Search starts {formatTime(request.input.start)}. Rebuild after changing the time.</p>}
      {matches && result?.error && <p role="alert">{result.error}</p>}
      {plan && !plan.stops.length && <p>No ten-minute visits fit. Try another date or equipment choice. Polar daylight and low targets can leave an empty night.</p>}
      {!!plan?.stops.length && <><p>Suggested session: <strong>{formatTime(plan.start)}</strong> to {formatTime(plan.end)}</p>
        <button onClick={() => onUsePlan(plan)}>Take this plan outside</button><p className={styles.note}>Opens the dim red field display with live pointing and these targets in order.</p>
        <ol className={styles.planList}>{plan.stops.map(stop => <li key={stop.body}>
          <div><strong>{stop.body}</strong><span>{formatTime(stop.start)} to {formatTime(stop.end)}</span></div>
          <p>{stop.altitude.toFixed(0)}° high at mid-visit · {directionName(stop.azimuth)}. {stop.altitude >= 40 ? "Higher in the sky, with less atmosphere in the way." : "Above the 20° planning threshold."}</p>
          <small>Available: {formatTime(stop.window.start)} to {formatTime(stop.window.end)}</small>
          <button onClick={() => (openPreview ?? choose)(stop.body, stop.start + 5 * 60_000)}>View {stop.body} in the eyepiece</button>
        </li>)}</ol></>}
    </div><p className={styles.note}>Ranked by how many targets fit, then their altitude. Sun ≤ −6°, targets ≥ 20°. Unaided mode excludes Uranus and Neptune; visibility still depends on brightness, sky conditions and obstructions. Optical mode does not guarantee every target suits your equipment.</p>
  </section>;
}
