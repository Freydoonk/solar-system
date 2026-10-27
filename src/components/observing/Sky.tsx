import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ObserverLocation } from "./useObserverLocation";
import LocationControls from "./LocationControls";
import { useSkyMotion } from "./useSkyMotion";
import { alignmentOffset, deviceQuaternion, manualQuaternion, viewDirection, wrapBearing } from "./skyOrientation";
import { buildSkyView, isDaylightMarker, skyNightVisibility } from "./skyViewModel";
import { angularSeparation, directionName } from "./observing";
import SkyScene from "./SkyScene";
import styles from "./Sky.module.css";
import observeStyles from "./Observe.module.css";

const subscribeVisibility = (change: () => void) => { document.addEventListener("visibilitychange", change); return () => document.removeEventListener("visibilitychange", change); };
const visible = () => !document.hidden;

export default function Sky({ active, location }: { active: boolean; location: ObserverLocation }) {
  const foreground = useSyncExternalStore(subscribeVisibility, visible);
  const running = active && foreground;
  const [time, setTime] = useState(Date.now);
  const [manual, setManual] = useState({ azimuth: 0, altitude: 30 });
  const [fov, setFov] = useState(65);
  const [lines, setLines] = useState(true), [deep, setDeep] = useState(false), [labels, setLabels] = useState(true);
  const [matchDaylight, setMatchDaylight] = useState(false);
  const [aligned, setAligned] = useState<{ offset: number; absolute: boolean; session: number } | null>(null);
  const [alignError, setAlignError] = useState("");
  const settings = useRef<HTMLDialogElement>(null);
  const motion = useSkyMotion(running && !!location.site);
  const reading = motion.reading;
  const alignment = reading && aligned?.session === reading.session && aligned.absolute === reading.sample.absolute ? aligned : null;
  const tracking = !!reading && (reading.sample.absolute || !!alignment);
  const pose = tracking && reading ? deviceQuaternion(reading.sample, reading.screenAngle, alignment?.offset ?? 0)! : manualQuaternion(manual.azimuth, manual.altitude);
  const direction = viewDirection(pose);
  const minute = Math.floor(time / 60000) * 60000;
  const { site, horizon } = location;
  const model = useMemo(() => running && site ? buildSkyView(site, minute, horizon) : null, [running, site, minute, horizon]);
  const nearby = model?.markers.filter(marker => marker.kind !== "compass" && (deep || marker.kind !== "messier"))
    .filter(marker => (lines || marker.kind !== "constellation") && (!matchDaylight || skyNightVisibility(model.sun.altitude) > 0 || isDaylightMarker(marker)))
    .map(marker => ({ ...marker, separation: angularSeparation(marker, direction) })).filter(marker => marker.separation < 8).sort((a, b) => a.separation - b.separation)[0];
  const motionStatus = !reading ? motion.status : !tracking ? "Motion ready. Face true north with the phone upright, then select Align to north."
    : alignment ? "Motion tracking with your north alignment. Re-align if the view drifts."
    : "Compass estimate. Check a known direction and align to true north if needed.";
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (!active) settings.current?.close();
  }, [active]);

  function alignNorth() {
    if (!reading) return;
    const offset = alignmentOffset(reading.sample, reading.screenAngle, 0);
    if (offset === null) { setAlignError("Hold the phone upright, facing the northern horizon, before aligning."); return; }
    setAligned({ offset, absolute: reading.sample.absolute, session: reading.session }); setAlignError("");
  }
  function drag(dx: number, dy: number) {
    if (!dx && !dy) return;
    if (motion.enabled) { motion.stop(); setManual({ azimuth: wrapBearing(direction.azimuth + dx), altitude: Math.max(-89.5, Math.min(89.5, direction.altitude + dy)) }); }
    else setManual(previous => ({ azimuth: wrapBearing(previous.azimuth + dx), altitude: Math.max(-89.5, Math.min(89.5, previous.altitude + dy)) }));
  }
  const zoom = (delta: number) => setFov(value => Math.max(25, Math.min(95, value + delta)));

  return <main className={styles.sky}>
    <header className={styles.header}>
      <div><h1>Your sky, live</h1><p><span className={styles.live}>LIVE</span> {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {site?.label ?? "Set your location"}</p></div>
      <button onClick={() => settings.current?.showModal()}>Location &amp; controls</button>
    </header>
    <div className={styles.viewport}>
      {model ? <SkyScene model={model} horizon={horizon} pose={pose} fov={fov} lines={lines} deep={deep} labels={labels} matchDaylight={matchDaylight} motion={tracking} onDrag={drag} onZoom={zoom} />
        : <div className={styles.empty}><h2>Look around your local sky</h2><p>See the Sun, Moon, planets, stars and constellations in your local sky.</p><button onClick={() => settings.current?.showModal()}>Set your location</button></div>}
      {model && <div className={styles.skyStatus}>
        {site?.source === "approximate" && <span>Approximate location. Check in Location &amp; controls.</span>}
        {model.sun.altitude > -12 && <span>{!matchDaylight ? "Daylight / twilight: stars are shown as a guide." : model.sun.altitude >= 0 ? "Daylight sky" : "Twilight sky"}</span>}
        {!model.sun.visible && <span>{model.sun.altitude < 0 ? "Sun below the horizon" : "Sun hidden by My horizon"}</span>}
      </div>}
      {model && <div className={styles.focusReading}><strong>{nearby?.name ?? (direction.altitude < 0 ? "Below the horizon" : "Explore the sky")}</strong>
        <span>{nearby ? `${nearby.separation.toFixed(1)}° from center · ` : ""}{directionName(direction.azimuth)} {direction.azimuth.toFixed(0)}° · altitude {direction.altitude.toFixed(0)}°</span>
        <small>{tracking ? alignment ? "Aligned to true north" : "Estimated compass direction" : "Manual view"} · {fov}° vertical field</small></div>}
      <div className={styles.zoom}><button aria-label="Zoom in" onClick={() => zoom(-5)}>+</button><button aria-label="Zoom out" onClick={() => zoom(5)}>−</button></div>
    </div>
    <footer className={styles.footer}>
      <div className={styles.motionActions}><button disabled={!site} aria-pressed={motion.enabled} onClick={() => { if (motion.enabled) { setManual(direction); motion.stop(); } else void motion.start(); }}>{motion.enabled ? "Use drag controls" : "Enable phone motion"}</button>
        {reading && <button onClick={alignNorth}>Align to north</button>}
        {model?.sun.visible && <button onClick={() => { motion.stop(); setManual({ azimuth: model.sun.azimuth, altitude: model.sun.altitude }); }}>Show Sun</button>}
      </div>
      <p role="status">{alignError || motionStatus}</p>
    </footer>
    <dialog ref={settings} className={`${observeStyles.observe} ${observeStyles.siteDialog}`} aria-label="Sky location and controls">
      <div className={observeStyles.dialogHeading}><strong>Sky settings</strong><button onClick={() => settings.current?.close()}>Done</button></div>
      <section className={observeStyles.card}><h2>Your observing location</h2><LocationControls location={location} />
        <p className={observeStyles.note}>Sky always follows the current time. Location and My horizon are shared with Observe in this tab; the Explore and Observe clocks stay independent.</p>
        <h2>Show in the sky</h2><div className={observeStyles.actions}>
          <button aria-pressed={lines} onClick={() => setLines(!lines)}>Constellations</button><button aria-pressed={labels} onClick={() => setLabels(!labels)}>Labels</button><button aria-pressed={deep} onClick={() => setDeep(!deep)}>Messier objects</button>
          <button aria-pressed={matchDaylight} onClick={() => setMatchDaylight(!matchDaylight)}>Match daylight</button>
        </div>
        <p className={observeStyles.note}>The default dark map shows objects at their current positions, even in daylight. Enable Match daylight to adjust sky brightness to the Sun at your location and fade stars, planets, constellation patterns and Messier markers through twilight. The Sun and Moon keep their position markers above your horizon. Both modes use the same live positions. Clouds, weather, light pollution and exact naked-eye visibility are not simulated.</p>
        <h2 className={styles.settingsHeading}>Using phone motion</h2>
        <p>Enable phone motion and allow the browser request. Hold the screen toward you, with the back of the phone pointing at the sky. Portrait and landscape both work.</p>
        <p>If north is unavailable (including relative-only browsers), point toward a known true-north landmark, then select Align to north. Avoid metal and magnets; re-align if the view drifts. An uncorrected magnetic compass can differ from true north.</p>
        <p>Motion needs HTTPS and a supported phone. Dragging switches to manual control. Arrow keys move the view; + and − zoom. The 3D scene is a simulated sky with no camera access.</p>
        <p className={observeStyles.note}>Sun, Moon, star and planet markers, constellation lines and Messier symbols are finding annotations, not physical sizes or a prediction of visibility. Show Sun centers the simulated view and switches to manual control. The green ground includes your personal horizon. Positions refresh every minute using geometric altitude, without refraction. Stellar annual aberration/parallax is omitted. Telescope solar pointing is excluded from Observe.</p>
        <p className={observeStyles.note}>HYG 4.1 / David Nash (CC BY-SA 4.0); D3-Celestial / Olaf Frohn (BSD). <a href={`${import.meta.env.BASE_URL}catalogue/ATTRIBUTION.md`} target="_blank" rel="noreferrer">Data sources &amp; licences</a>.</p>
      </section>
    </dialog>
  </main>;
}
