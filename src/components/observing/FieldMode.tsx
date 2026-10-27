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
    <header className={styles.header}><h2 id="field-title">Field mode</h2><button onClick={onClose}>Exit field mode</button></header>
    <div className={styles.content} style={{ "--field-brightness": brightness / 100 } as CSSProperties}>
      <div className={styles.clock}><strong>{live ? "LIVE SKY" : "PLANNED TIME"}</strong><time dateTime={new Date(time).toISOString()}>{formatTime(time)}</time><span>{site.label}</span></div>
      {!live && <p className={styles.notice}>Previewing a scheduled time. Select Now · live before pointing outside.</p>}
      <div className={styles.targetHeading}><span>{session ? `Visit ${index + 1} of ${targets.length}` : `Target ${index + 1} of ${targets.length}`}</span><h1>{body}</h1></div>
      <div className={styles.readings}>
        <div><span>Azimuth · {position.direction}</span><strong>{position.azimuth.toFixed(1)}°</strong><small>Clockwise from true north</small></div>
        <div><span>Altitude</span><strong>{position.altitude.toFixed(1)}°</strong><small>Above a level horizon</small></div>
      </div>
      <p role="status" className={styles.status}>{status}</p>
      <nav className={styles.targetActions} aria-label="Field targets">
        <button disabled={index <= 0} onClick={() => select(targets[index - 1])}>← Previous</button>
        <button disabled={index < 0 || index >= targets.length - 1} onClick={() => select(targets[index + 1])}>Next →</button>
      </nav>
      <div className={styles.timeActions}><button aria-pressed={live} onClick={onNow}>Now · live</button>
        {visit && <button aria-pressed={!live} onClick={() => onTime((visit.start + visit.end) / 2)}>Preview visit time</button>}</div>
      {visit && <p className={styles.note}>Scheduled: {formatTime(visit.start)} to {formatTime(visit.end)}. {time > visit.end ? "This visit has ended." : time < visit.start ? "This visit is upcoming." : "Within this visit."}</p>}
      <details><summary>{session ? "Session targets" : "Choose a target"}</summary><div className={styles.targetList}>{targets.map(target => <button key={target} aria-pressed={body === target} onClick={() => select(target)}>{target}</button>)}</div>
        {!!plan?.stops.length && <div className={styles.timeActions}><button onClick={() => {
          setUseSession(!useSession);
          if (!useSession) {
            const stop = plan.stops.find(item => item.body === body) ?? plan.stops[0];
            onTarget(stop.body); if (!live) onTime((stop.start + stop.end) / 2);
          }
        }}>{useSession ? "Browse all targets" : "Return to session targets"}</button></div>}
      </details>
      <label className={styles.brightness}>Dim red display <span>{brightness}%</span><input aria-label="Red display brightness" type="range" min="35" max="100" step="5" value={brightness} onChange={event => setBrightness(Number(event.target.value))} /></label>
      <p className={styles.note}>Lower your device brightness too. Browser controls, notifications and system dialogs keep their normal colors.</p>
      <p className={styles.note}>Never aim a telescope or finder at the Sun. Pointing uses standard refraction; status uses geometric altitude, your horizon and the Sun below −6°. Weather and alignment are not predicted.</p>
    </div>
  </dialog>;
}
