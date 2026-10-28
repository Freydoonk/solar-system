import { locationLabel } from "../../i18n/display";
import { t } from "../../i18n/messages";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { skyPosition, TARGETS, type Site, type Target } from "./observing";
import type { HorizonProfile } from "./horizon";
import type { TonightPlan } from "./tonight";
import styles from "./FieldMode.module.css";

type Props = {
  site: Site; horizon: HorizonProfile; body: Target; time: number; live: boolean;
  plan: TonightPlan | null; formatTime: (time: number) => string;
  onTarget: (target: Target) => void; onTime: (time: number) => void;
  onNow: () => void; onClose: () => void;
};

export default function FieldMode({ site, horizon, body, time, live, plan, formatTime, onTarget, onTime, onNow, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [brightness, setBrightness] = useState(75);
  const [useSession, setUseSession] = useState(!!plan?.stops.length);
  const session = useSession && plan?.stops.length ? plan : null;
  const targets = session ? session.stops.map(stop => stop.body) : [...TARGETS];
  const index = targets.indexOf(body);
  const visit = session?.stops.find(stop => stop.body === body);
  const position = skyPosition(body, site, time, horizon);
  const status = position.geometricAltitude < 0 ? "Below the horizon"
    : position.obstructed ? "Blocked by your personal horizon"
    : position.sunAltitude > -6 ? "Daylight or twilight: wait for darkness"
    : position.geometricAltitude < 20 ? "Low target: wait for a higher view"
    : "Above your horizon and dark enough";

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  function select(target: Target) {
    onTarget(target);
    const stop = session?.stops.find(item => item.body === target);
    if (!live && stop) onTime((stop.start + stop.end) / 2);
  }

  return <dialog ref={dialog} className={styles.fieldDialog} aria-labelledby="field-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className={styles.header}><h2 id="field-title">{t("Field mode")}</h2><button onClick={onClose}>{t("Exit field mode")}</button></header>
    <div className={styles.content} style={{ "--field-brightness": brightness / 100 } as CSSProperties}>
      <div className={styles.clock}><strong>{live ? t("LIVE SKY") : t("PLANNED TIME")}</strong><time dateTime={new Date(time).toISOString()}>{formatTime(time)}</time><span>{locationLabel(site)}</span></div>
      {!live && <p className={styles.notice}>{t("Previewing a scheduled time. Select Now · live before pointing outside.")}</p>}
      <div className={styles.targetHeading}><span>{session ? t("Visit {value1} of {value2}", { value1: index + 1, value2: targets.length }) : t("Target {value1} of {value2}", { value1: index + 1, value2: targets.length })}</span><h1>{t(body)}</h1></div>
      <div className={styles.readings}>
        <div><span>{t("Azimuth · {value1}", { value1: t(position.direction) })}</span><strong>{position.azimuth.toFixed(1)}°</strong><small>{t("Clockwise from true north")}</small></div>
        <div><span>{t("Altitude")}</span><strong>{position.altitude.toFixed(1)}°</strong><small>{t("Above a level horizon")}</small></div>
      </div>
      <p role="status" className={styles.status}>{t(status)}</p>
      <nav className={styles.targetActions} aria-label={t("Field targets")}>
        <button disabled={index <= 0} onClick={() => select(targets[index - 1])}>{t("← Previous")}</button>
        <button disabled={index < 0 || index >= targets.length - 1} onClick={() => select(targets[index + 1])}>{t("Next →")}</button>
      </nav>
      <div className={styles.timeActions}><button aria-pressed={live} onClick={onNow}>{t("Now · live")}</button>
        {visit && <button aria-pressed={!live} onClick={() => onTime((visit.start + visit.end) / 2)}>{t("Preview visit time")}</button>}</div>
      {visit && <p className={styles.note}>{t("Scheduled: {value1} to {value2}. {value3}", { value1: formatTime(visit.start), value2: formatTime(visit.end), value3: time > visit.end ? t("This visit has ended.") : time < visit.start ? t("This visit is upcoming.") : t("Within this visit.") })}</p>}
      <details><summary>{session ? t("Session targets") : t("Choose a target")}</summary><div className={styles.targetList}>{targets.map(target => <button key={target} aria-pressed={body === target} onClick={() => select(target)}>{t(target)}</button>)}</div>
        {!!plan?.stops.length && <div className={styles.timeActions}><button onClick={() => {
          setUseSession(!useSession);
          if (!useSession) {
            const stop = plan.stops.find(item => item.body === body) ?? plan.stops[0];
            onTarget(stop.body); if (!live) onTime((stop.start + stop.end) / 2);
          }
        }}>{useSession ? t("Browse all targets") : t("Return to session targets")}</button></div>}
      </details>
      <label className={styles.brightness}>{t("Dim red display ")}<span>{brightness}%</span><input aria-label={t("Red display brightness")} type="range" min="35" max="100" step="5" value={brightness} onChange={event => setBrightness(Number(event.target.value))} /></label>
      <p className={styles.note}>{t("Lower your device brightness too. Browser controls, notifications and system dialogs keep their normal colors.")}</p>
      <p className={styles.note}>{t("Never aim a telescope or finder at the Sun. Pointing uses standard refraction; status uses geometric altitude, your horizon and the Sun below −6°. Weather and alignment are not predicted.")}</p>
    </div>
  </dialog>;
}
