import { locationLabel } from "../../i18n/display";
import { getLocale, t } from "../../i18n/messages";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ObserverLocation } from "./useObserverLocation";
import LocationControls from "./LocationControls";
import { useSkyMotion } from "./useSkyMotion";
import { alignmentOffset, deviceQuaternion, manualQuaternion, viewDirection, wrapBearing } from "./skyOrientation";
import { buildSkyView } from "./skyViewModel";
import { DEFAULT_SKY_LAYERS, markerVisible, SKY_LAYERS } from "./skyDisplay";
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
  const [layers, setLayers] = useState(DEFAULT_SKY_LAYERS);
  const [matchDaylight, setMatchDaylight] = useState(false);
  const [aligned, setAligned] = useState<{ offset: number; absolute: boolean; session: number } | null>(null);
  const [alignError, setAlignError] = useState("");
  const settings = useRef<HTMLDialogElement>(null);
  const layerMenu = useRef<HTMLDetailsElement>(null);
  const motion = useSkyMotion(running && !!location.site);
  const reading = motion.reading;
  const alignment = reading && aligned?.session === reading.session && aligned.absolute === reading.sample.absolute ? aligned : null;
  const tracking = !!reading && (reading.sample.absolute || !!alignment);
  const pose = tracking && reading ? deviceQuaternion(reading.sample, reading.screenAngle, alignment?.offset ?? 0)! : manualQuaternion(manual.azimuth, manual.altitude);
  const direction = viewDirection(pose);
  const minute = Math.floor(time / 60000) * 60000;
  const { site, horizon } = location;
  const model = useMemo(() => running && site ? buildSkyView(site, minute, horizon) : null, [running, site, minute, horizon]);
  const nearby = model?.markers.filter(marker => marker.kind !== "compass" && markerVisible(marker, layers, matchDaylight, model.sun.altitude))
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
    if (!active) {
      settings.current?.close();
      if (layerMenu.current) layerMenu.current.open = false;
    }
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
      <div><h1>{t("Your sky, live")}</h1><p><span className={styles.live}>{t("LIVE")}</span> {new Date(time).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })} · {site ? locationLabel(site) : t("Set your location")}</p></div>
      <div className={styles.headerActions}>
        <details className={styles.layerMenu} ref={layerMenu} onKeyDown={event => {
          if (event.key === "Escape" && layerMenu.current?.open) {
            layerMenu.current.open = false; layerMenu.current.querySelector("summary")?.focus();
          }
        }}><summary>{t("Display")}</summary><div className={styles.layerPanel}>
          <fieldset><legend>{t("Show in the sky")}</legend><div className={styles.layerChoices}>
            {SKY_LAYERS.map(layer => <label key={layer.key}><input type="checkbox" checked={layers[layer.key]}
              onChange={event => setLayers(current => ({ ...current, [layer.key]: event.target.checked }))} />{t(layer.label)}</label>)}
          </div></fieldset>
          <label className={styles.daylightChoice}><input type="checkbox" checked={matchDaylight} onChange={event => setMatchDaylight(event.target.checked)} />{t("Match daylight")}</label>
          <div className={styles.layerActions}><button onClick={() => { setLayers(DEFAULT_SKY_LAYERS); setMatchDaylight(false); }}>{t("Reset display")}</button>
            <button onClick={() => { if (layerMenu.current) { layerMenu.current.open = false; layerMenu.current.querySelector("summary")?.focus(); } }}>{t("Done")}</button></div>
        </div></details>
        <button className={styles.settingsButton} aria-label={t("Location & controls")} title={t("Location & controls")} onClick={() => { if (layerMenu.current) layerMenu.current.open = false; settings.current?.showModal(); }}><span aria-hidden="true">⚙</span></button>
      </div>
    </header>
    <div className={styles.viewport}>
      {model ? <SkyScene model={model} horizon={horizon} pose={pose} fov={fov} layers={layers} matchDaylight={matchDaylight} motion={tracking} onDrag={drag} onZoom={zoom} />
        : <div className={styles.empty}><h2>{t("Look around your local sky")}</h2><p>{t("See the Sun, Moon, planets, stars and constellations in your local sky.")}</p><button onClick={() => settings.current?.showModal()}>{t("Set your location")}</button></div>}
      {model && <div className={styles.skyStatus}>
        {site?.source === "approximate" && <span>{t("Approximate location. Check in Location & controls.")}</span>}
        {model.sun.altitude > -12 && <span>{!matchDaylight ? t("Daylight / twilight: enabled objects are shown as guides.") : model.sun.altitude >= 0 ? t("Daylight sky") : t("Twilight sky")}</span>}
        {layers.sun && !model.sun.visible && <span>{model.sun.altitude < 0 ? t("Sun below the horizon") : t("Sun hidden by My horizon")}</span>}
      </div>}
      {model && <div className={styles.focusReading}><strong>{t(nearby?.name ?? (direction.altitude < 0 ? "Below the horizon" : "Explore the sky"))}</strong>
        <span>{nearby ? t("{value1}° from center · ", { value1: nearby.separation.toFixed(1) }) : ""}{t(directionName(direction.azimuth))} {t("{value1}° · altitude {value2}°", { value1: direction.azimuth.toFixed(0), value2: direction.altitude.toFixed(0) })}</span>
        <small>{t("{value1} · {value2}° vertical field", { value1: tracking ? alignment ? t("Aligned to true north") : t("Estimated compass direction") : t("Manual view"), value2: fov })}</small></div>}
      <div className={styles.zoom}><button aria-label={t("Zoom in")} onClick={() => zoom(-5)}>+</button><button aria-label={t("Zoom out")} onClick={() => zoom(5)}>−</button></div>
    </div>
    <footer className={styles.footer}>
      <div className={styles.motionActions}><button disabled={!site} aria-pressed={motion.enabled} onClick={() => { if (motion.enabled) { setManual(direction); motion.stop(); } else void motion.start(); }}>{motion.enabled ? t("Use drag controls") : t("Enable phone motion")}</button>
        {reading && <button onClick={alignNorth}>{t("Align to north")}</button>}
        {model?.sun.visible && <button onClick={() => { motion.stop(); setLayers(current => ({ ...current, sun: true })); setManual({ azimuth: model.sun.azimuth, altitude: model.sun.altitude }); }}>{t("Show Sun")}</button>}
      </div>
      <p role="status">{t(alignError || motionStatus)}</p>
    </footer>
    <dialog ref={settings} className={`${observeStyles.observe} ${observeStyles.siteDialog}`} aria-label={t("Sky location and controls")}>
      <div className={observeStyles.dialogHeading}><strong>{t("Sky settings")}</strong><button onClick={() => settings.current?.close()}>{t("Done")}</button></div>
      <section className={observeStyles.card}><h2>{t("Your observing location")}</h2><LocationControls location={location} />
        <p className={observeStyles.note}>{t("Sky always follows the current time. Location and My horizon are shared with Observe in this tab; the Explore and Observe clocks stay independent.")}</p>
        <h2>{t("Show in the sky")}</h2><p>{t("Use Display above the sky to choose visible objects, labels and compass directions. Your choices stay in this tab.")}</p>
        <p className={observeStyles.note}>{t("The default dark map shows objects at their current positions, even in daylight. Enable Match daylight to adjust sky brightness to the Sun at your location and fade stars, planets, constellation patterns and Messier markers through twilight. Enabled Sun and Moon layers keep their position markers above your horizon. Both modes use the same live positions. Clouds, weather, light pollution and exact naked-eye visibility are not simulated.")}</p>
        <h2 className={styles.settingsHeading}>{t("Using phone motion")}</h2>
        <p>{t("Enable phone motion and allow the browser request. Hold the screen toward you, with the back of the phone pointing at the sky. Portrait and landscape both work.")}</p>
        <p>{t("If north is unavailable (including relative-only browsers), point toward a known true-north landmark, then select Align to north. Avoid metal and magnets; re-align if the view drifts. An uncorrected magnetic compass can differ from true north.")}</p>
        <p>{t("Motion needs HTTPS and a supported phone. Dragging switches to manual control. Arrow keys move the view; + and − zoom. The 3D scene is a simulated sky with no camera access.")}</p>
        <p className={observeStyles.note}>{t("Sun, Moon, star and planet markers, constellation lines and Messier symbols are finding annotations, not physical sizes or a prediction of visibility. Show Sun centers the simulated view and switches to manual control. The green ground includes your personal horizon. Positions refresh every minute using geometric altitude, without refraction. Stellar annual aberration/parallax is omitted. Telescope solar pointing is excluded from Observe.")}</p>
        <p className={observeStyles.note}>{t("HYG 4.1 / David Nash (CC BY-SA 4.0); D3-Celestial / Olaf Frohn (BSD). ")}<a href={`${import.meta.env.BASE_URL}catalogue/ATTRIBUTION.md`} target="_blank" rel="noreferrer">{t("Data sources & licences")}</a>.</p>
      </section>
    </dialog>
  </main>;
}
