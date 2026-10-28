import { t } from "../../i18n/messages";
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
  return <section className={styles.card} aria-label={t("Tonight planner")}>
    <span className={styles.eyebrow}>{t("A NIGHT WORTH LOOKING UP")}</span><h2>{t("What can I see tonight?")}</h2>
    <p className={styles.note}>{t("Find a session in the next 24 hours from your selected time. Each target gets ten minutes, including time to move your equipment.")}</p>
    <div className={styles.fields}><label>{t("Time available")}<select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
      {[30, 60, 120, 240].map(value => <option key={value} value={value}>{t("{value1} minutes", { value1: value })}</option>)}</select></label>
      <label>{t("Viewing with")}<select value={equipment} onChange={e => setEquipment(e.target.value as typeof equipment)}><option value="eyes">{t("Unaided eyes")}</option><option value="optics">{t("Binoculars / telescope")}</option></select></label></div>
    <div className={styles.actions}><button disabled={!site || pending} onClick={() => site && setRequest({ kind: "tonight", input: { site, start: time, minutes, equipment, horizon } })}>{pending ? t("Planning…") : t("Build my night")}</button>
      {pending && <button onClick={() => setRequest(null)}>{t("Cancel planning")}</button>}</div>
    {!site && <p className={styles.note}>{t("Set your location with Location & time first.")}</p>}
    <div aria-live="polite">{matches && request && <p className={styles.note}>{t("Search starts {value1}. Rebuild after changing the time.", { value1: formatTime(request.input.start) })}</p>}
      {matches && result?.error && <p role="alert">{t(result.error)}</p>}
      {plan && !plan.stops.length && <p>{t("No ten-minute visits fit. Try another date or equipment choice. Polar daylight and low targets can leave an empty night.")}</p>}
      {!!plan?.stops.length && <><p>{t("Suggested session: ")}<strong>{formatTime(plan.start)}</strong>{t(" to {value1}", { value1: formatTime(plan.end) })}</p>
        <button onClick={() => onUsePlan(plan)}>{t("Take this plan outside")}</button><p className={styles.note}>{t("Opens the dim red field display with live pointing and these targets in order.")}</p>
        <ol className={styles.planList}>{plan.stops.map(stop => <li key={stop.body}>
          <div><strong>{t(stop.body)}</strong><span>{t("{value1} to {value2}", { value1: formatTime(stop.start), value2: formatTime(stop.end) })}</span></div>
          <p>{t("{value1}° high at mid-visit · {value2}. {value3}", { value1: stop.altitude.toFixed(0), value2: t(directionName(stop.azimuth)), value3: stop.altitude >= 40 ? t("Higher in the sky, with less atmosphere in the way.") : t("Above the 20° planning threshold.") })}</p>
          <small>{t("Available: {value1} to {value2}", { value1: formatTime(stop.window.start), value2: formatTime(stop.window.end) })}</small>
          <button onClick={() => (openPreview ?? choose)(stop.body, stop.start + 5 * 60_000)}>{t("View {value1} in the eyepiece", { value1: t(stop.body) })}</button>
        </li>)}</ol></>}
    </div><p className={styles.note}>{t("Ranked by how many targets fit, then their altitude. Sun ≤ −6°, targets ≥ 20°. Unaided mode excludes Uranus and Neptune; visibility still depends on brightness, sky conditions and obstructions. Optical mode does not guarantee every target suits your equipment.")}</p>
  </section>;
}
