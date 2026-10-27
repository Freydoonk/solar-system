import { useEffect, useMemo, useRef, useState } from "react";
import { Body } from "astronomy-engine";
import { angularSeparation, dateInputValue, directionName, formatRA, parseObservationTime, skyPosition,
  TARGETS, type SearchRequest, type Site, type Target, type Window } from "./observing";
import styles from "./Observe.module.css";
import EyepiecePreview from "./EyepiecePreview";
import PlanningWorkspace from "./PlanningWorkspace";
import { useNotebook } from "./useNotebook";
import type { HorizonProfile } from "./horizon";
import type { ObserverLocation } from "./useObserverLocation";
import LocationControls from "./LocationControls";
import FieldMode from "./FieldMode";
import type { TonightPlan } from "./tonight";

export default function Observe({ active, location }: { active: boolean; location: ObserverLocation }) {
  const notebook = useNotebook();
  const { site, horizon } = location;
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldSession, setFieldSession] = useState<{ site: Site; horizon: HorizonProfile; plan: TonightPlan } | null>(null);
  const fieldPlan = fieldSession?.site === site && fieldSession.horizon === horizon ? fieldSession.plan : null;
  const workspaceActive = active && !fieldOpen;
  const [tool, setTool] = useState("tonight");
  const [atlasVisited, setAtlasVisited] = useState(false);
  const locationDialog = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState<Target>(Body.Saturn);
  const [time, setTime] = useState(Date.now);
  const [live, setLive] = useState(true);
  const [utc, setUtc] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const [timeError, setTimeError] = useState("");
  const [mount, setMount] = useState("altaz");
  const [epoch, setEpoch] = useState("date");
  const [days, setDays] = useState(30);
  const [request, setRequest] = useState<SearchRequest | null>(null);
  const [result, setResult] = useState<{ request: SearchRequest; windows?: Window[]; error?: string } | null>(null);
  const [pointing, setPointing] = useState({ azimuth: "", altitude: "" });
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = utc ? "UTC" : deviceZone;
  const searchActive = workspaceActive && tool === "windows";
  const formatTime = (value: number) => new Intl.DateTimeFormat(undefined, {
    timeZone: zone, month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(value);

  useEffect(() => {
    if (!live || !active) return;
    const update = () => { if (!document.hidden) setTime(Date.now()); };
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [live, active]);

  useEffect(() => {
    if (!request || !searchActive) return;
    const worker = new Worker(new URL("./observing.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ windows?: Window[]; error?: string }>) => setResult({ request, ...event.data });
    worker.onerror = () => setResult({ request, error: "Search unavailable. Reload the app and try again." });
    worker.postMessage(request);
    return () => worker.terminate();
  }, [request, searchActive]);

  const sky = useMemo(() => site ? TARGETS.map((target) => skyPosition(target, site, time, horizon)) : [], [site, time, horizon]);
  const selected = sky.find((item) => item.body === body);
  const requestMatches = request?.body === body && request.site === site && request.days === days && request.horizon === horizon;
  const displayedResult = result?.request === request && requestMatches ? result : null;
  const searching = !!request && requestMatches && !displayedResult;
  const azimuth = Number(pointing.azimuth);
  const altitude = Number(pointing.altitude);
  const validPointing = pointing.azimuth.trim() !== "" && pointing.altitude.trim() !== ""
    && Number.isFinite(azimuth) && Number.isFinite(altitude) && azimuth >= 0 && azimuth <= 360 && altitude >= 0 && altitude <= 90;
  const nearby = validPointing ? sky.filter((item) => item.altitude >= 0)
    .map((item) => ({ ...item, separation: angularSeparation(item, { azimuth, altitude }) }))
    .filter((item) => item.separation <= 10).sort((a, b) => a.separation - b.separation) : [];

  function chooseTime(value: number) {
    setTime(value); setLive(false); setDraftTime(null); setTimeError("");
  }

  function chooseNow() {
    setTime(Date.now()); setLive(true); setDraftTime(null); setTimeError("");
  }

  function openField(plan: TonightPlan | null = fieldPlan) {
    if (!site) return;
    setFieldSession(plan ? { site, horizon, plan } : null);
    if (plan?.stops.length) setBody(plan.stops.find(stop => stop.body === body)?.body ?? plan.stops[0].body);
    chooseNow(); setFieldOpen(true);
  }

  return <><main className={styles.observe}>
    <header className={styles.intro}><div><span className={styles.eyebrow}>YOUR LOCAL SKY</span>
      <h1>Plan a night outside</h1><p>Find a planet, choose a time, and point your telescope.</p></div>
      <span className={styles.live}>{live ? "LIVE SKY" : "PLANNED TIME"}</span>
    </header>
    <div className={styles.contextBar}>
      <div><strong>{site?.label ?? "Choose your observing location"}</strong><span>{formatTime(time)} · {body}</span></div>
      <div className={styles.contextActions}><button onClick={() => locationDialog.current?.showModal()}>Location &amp; time</button><button disabled={!site} onClick={() => openField()}>Field mode</button></div>
    </div>
    {!site && <p className={styles.note}>Set a location using the button above to calculate your sky. Events and Notebook also work without a location.</p>}
    <dialog className={styles.siteDialog} ref={locationDialog} aria-label="Location and time settings">
      <div className={styles.dialogHeading}><strong>Location &amp; time</strong><button onClick={() => locationDialog.current?.close()}>Done</button></div>
      <section className={styles.card} aria-label="Location and observing time">
        <h2>Where &amp; when</h2>
        <LocationControls location={location} />
        <label>Time zone<select value={utc ? "utc" : "device"} onChange={(event) => { setUtc(event.target.value === "utc"); setDraftTime(null); setTimeError(""); }}>
          <option value="device">{deviceZone} (device)</option><option value="utc">UTC</option></select></label>
        <label>Date &amp; time<input type="datetime-local" min="1900-01-01T00:00" max="2100-12-31T23:59"
          value={draftTime ?? dateInputValue(time, utc)} onFocus={() => setLive(false)} onChange={(event) => {
            setLive(false); setDraftTime(event.target.value);
            const parsed = parseObservationTime(event.target.value, utc);
            setTimeError(parsed === null ? "Choose a valid time from 1900 to 2100. A skipped daylight-saving time is not valid." : "");
            if (parsed !== null) setTime(parsed);
          }} /></label>
        {timeError && <p role="alert" className={styles.warning}>{timeError}</p>}
        <p className={styles.note}>{formatTime(time)}<br />UTC: {new Date(time).toISOString().slice(0, 19).replace("T", " ")}</p>
        <button type="button" onClick={chooseNow}>Now · live</button>
        <p className={styles.note}>This clock is independent of Explore. Device/manual coordinates stay in this tab. Approximate IP lookup uses GeoJS.</p>
      </section>
    </dialog>
      <PlanningWorkspace site={site} time={time} body={body} horizon={horizon} onHorizonChange={location.setHorizon} onUsePlan={openField} notebook={notebook} active={workspaceActive} formatTime={formatTime}
        tab={tool} atlasVisited={atlasVisited} onTabChange={next => { setTool(next); if (next === "atlas") setAtlasVisited(true); }}
        choose={(target, value) => { setBody(target); chooseTime(value); }} openPreview={(target, value) => { setBody(target); chooseTime(value); setTool("eyepiece"); }}>
      <div className={styles.scopeHeading}><label>Telescope target<select value={body} onChange={event => setBody(event.target.value as Target)}>{TARGETS.map(target => <option key={target}>{target}</option>)}</select></label><p className={styles.note}>One target and time across pointing, eyepiece and observing windows.</p></div>
      <section hidden={tool !== "pointing"} className={styles.card} aria-label="Telescope pointing guide">
        <div className={styles.cardHeading}><h2>Point your telescope</h2><span className={styles.eyebrow}>TRUE NORTH</span></div>
        {!selected ? <p className={styles.empty}>Choose a location to calculate your sky.</p> : <>
          <p className={selected.suitable ? styles.good : styles.warning} role="status">{selected.altitude < 0 ? "Below your horizon"
            : selected.obstructed ? "Behind your personal horizon mask"
            : selected.sunAltitude > -6 ? "Daylight / twilight: wait for a night-time window"
            : selected.geometricAltitude < 20 ? "Low in the sky: a higher view is preferable" : "Good geometry for observing"}</p>
          <div className={styles.readings}><div><span>AZIMUTH · {selected.direction}</span><strong>{selected.azimuth.toFixed(1)}°</strong></div>
            <div><span>ALTITUDE</span><strong>{selected.altitude.toFixed(1)}°</strong></div></div>
          <p className={styles.note}>Azimuth runs clockwise: north 0°, east 90°, south 180°, west 270°. Altitude is above a level horizon; 90° is overhead. Use true north, not an uncorrected magnetic compass.</p>
          <label>Mount type<select value={mount} onChange={(event) => setMount(event.target.value)}>
            <option value="altaz">Alt-azimuth</option><option value="equatorial">Equatorial / GoTo</option></select></label>
          {mount === "altaz" ? <ol className={styles.steps}><li>Level the mount and align its azimuth reference with true north.</li>
            <li>{selected.suitable ? "Turn toward " + selected.direction + " (" + selected.azimuth.toFixed(1) + "°), then raise to " + selected.altitude.toFixed(1) + "°." : "Use Find a better time to choose an observing window before aiming."}</li>
            <li>Start with a low-power eyepiece and center the target in the finder. Refine alignment before increasing magnification.</li></ol>
            : <><label>Coordinate epoch<select value={epoch} onChange={(event) => setEpoch(event.target.value)}><option value="date">Equator of date</option><option value="j2000">J2000</option></select></label>
              <div className={styles.equatorial}><span>RA <strong>{formatRA(epoch === "date" ? selected.ra : selected.j2000Ra)}</strong></span>
                <span>Dec <strong>{(epoch === "date" ? selected.dec : selected.j2000Dec).toFixed(4)}°</strong></span></div>
              <p className={styles.note}>Set location and time on the mount, polar-align if required, and complete its alignment procedure. Match the coordinate epoch. For GoTo mounts, prefer the built-in planet catalogue. These are observer-relative coordinates, not motor commands.</p></>}
          <p className={styles.warning}>Never aim a telescope or finder at the Sun. This guide is for night-time observing.</p>
          <p className={styles.note}>Pointing includes standard refraction; observing status also checks your personal horizon. Clouds, unrecorded obstructions, seeing, light pollution and mount alignment affect the view; Uranus and Neptune may require an optical finder/chart.</p>
        </>}
        <div className={styles.actions}><button onClick={() => setTool("eyepiece")}>Open eyepiece preview</button><button onClick={() => setTool("windows")}>Find a better time</button></div>
      </section>

      <div hidden={tool !== "eyepiece"}><EyepiecePreview body={body} site={site} time={time} timeLabel={formatTime(time)} altitude={selected?.altitude} sunAltitude={selected?.sunAltitude} active={workspaceActive && tool === "eyepiece"} notebook={notebook} /></div>

      <section hidden={tool !== "windows"} className={styles.card} aria-label="Observing windows">
        <h2>When can I see {body}?</h2><p className={styles.note}>Next windows with the target at least 20° high, above your personal horizon, and the Sun at least 6° below the horizon. Highest altitude within each window is highlighted.</p>
        <div className={styles.fields}><label>Search ahead<select value={days} onChange={(event) => setDays(Number(event.target.value))}>
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={365}>1 year</option></select></label>
          <button type="button" disabled={!site || !!timeError || searching} onClick={() => {
            if (site) { setRequest({ body, site, start: time, days, horizon }); setResult(null); }
          }}>{searching ? "Searching…" : "Find observing times"}</button>
          {searching && <button type="button" onClick={() => { setRequest(null); setResult(null); }}>Cancel</button>}</div>
        <div aria-live="polite">
          {requestMatches && request && <p className={styles.note}>Search begins {formatTime(request.start)}. Change the time and search again for a different starting point.</p>}
          {displayedResult?.error && <p role="alert" className={styles.warning}>{displayedResult.error}</p>}
          {displayedResult?.windows?.length === 0 && <p>No qualifying window in this range. Try another date or a longer range; polar daylight and low target altitude can prevent a window.</p>}
          {displayedResult?.windows?.map((window) => <article className={styles.window} key={window.start}>
            <strong>{formatTime(window.best)}</strong><span>{window.altitude.toFixed(1)}° high · {directionName(window.azimuth)} {window.azimuth.toFixed(1)}°</span>
            <small>Window: {formatTime(window.start)} to {formatTime(window.end)}</small>
            <button type="button" onClick={() => { chooseTime(window.best); setTool("pointing"); }}>Use this time for pointing</button></article>)}
        </div>
      </section>

      <section hidden={tool !== "directions"} className={styles.card} aria-label="Sky directions">
        <h2>What is in that direction?</h2>
        <p className={styles.note}>Compass map: north at the top, east to the right; the center is overhead. Shows planets and the Moon above your horizon, not stars or deep-sky objects.</p>
        {site && <svg className={styles.skyMap} viewBox="0 0 320 320" role="img" aria-label="Planet and Moon positions on a compass map">
          {[130, 87, 43].map((radius) => <circle key={radius} cx="160" cy="160" r={radius} fill="none" stroke="#83e5bc33" />)}
          <path d="M30 160H290M160 30V290" stroke="#83e5bc22" />
          <text x="160" y="18">N · 0°</text><text x="303" y="164">E</text><text x="160" y="312">S · 180°</text><text x="17" y="164">W</text>
          <text x="160" y="155" className={styles.mapHint}>90°</text>
          {sky.filter((item) => item.altitude >= 0).map((item) => {
            const radius = 130 * (90 - item.altitude) / 90;
            const x = 160 + radius * Math.sin(item.azimuth * Math.PI / 180);
            const y = 160 - radius * Math.cos(item.azimuth * Math.PI / 180);
            return <g key={item.body}><circle cx={x} cy={y} r={item.body === body ? 6 : 4} fill={item.body === body ? "#ffc458" : "#83e5bc"} />
              <text x={Math.min(278, Math.max(42, x))} y={y - 10}>{item.body}</text></g>;
          })}
        </svg>}
        <div className={styles.fields}><label>Looking toward (azimuth °)<input type="number" min="0" max="360" step="0.1" value={pointing.azimuth}
          onChange={(event) => setPointing({ ...pointing, azimuth: event.target.value })} /></label>
          <label>Looking up (altitude °)<input type="number" min="0" max="90" step="0.1" value={pointing.altitude}
            onChange={(event) => setPointing({ ...pointing, altitude: event.target.value })} /></label></div>
        {validPointing && site && <p role="status">{nearby.length ? nearby.map((item) => item.body + " · " + item.separation.toFixed(1) + "° away").join(" / ")
          : "No listed planet or Moon within 10° of that direction at this time."}</p>}
        {sky.length > 0 && <div className={styles.targetList}>{sky.map((item) => <button key={item.body} type="button" onClick={() => setBody(item.body)} aria-pressed={item.body === body}>
          <span>{item.body}</span><small>{item.altitude < 0 ? "Below horizon" : item.direction + " " + item.azimuth.toFixed(1) + "° · up " + item.altitude.toFixed(1) + "°"}</small></button>)}</div>}
      </section>
    </PlanningWorkspace>
    <footer className={styles.note}>Calculated locally with <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Astronomy Engine</a>.
      Coordinates include observer location and light travel time. Location stays in this tab. Notebook entries and equipment are saved only by your explicit actions.</footer>
  </main>{fieldOpen && active && site && <FieldMode site={site} horizon={horizon} body={body} time={time} live={live} plan={fieldPlan} formatTime={formatTime}
    onTarget={setBody} onTime={chooseTime} onNow={chooseNow} onClose={() => setFieldOpen(false)} />}</>;
}
