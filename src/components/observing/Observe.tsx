import { useEffect, useMemo, useRef, useState } from "react";
import { Body } from "astronomy-engine";
import { loadApproximateLocation } from "../solar-system/location";
import { angularSeparation, dateInputValue, directionName, formatRA, parseObservationTime, skyPosition,
  TARGETS, validSite, type SearchRequest, type Site, type Target, type Window } from "./observing";
import styles from "./Observe.module.css";
import EyepiecePreview from "./EyepiecePreview";

export default function Observe({ active }: { active: boolean }) {
  const [site, setSite] = useState<Site | null>(null);
  const [locationStatus, setLocationStatus] = useState("Finding approximate location…");
  const [locating, setLocating] = useState(false);
  const locationChoice = useRef(0);
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "", elevation: "0" });
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
  const formatTime = (value: number) => new Intl.DateTimeFormat(undefined, {
    timeZone: zone, month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(value);

  useEffect(() => {
    let mounted = true;
    void loadApproximateLocation().then((location) => {
      if (!mounted || locationChoice.current !== 0) return;
      if (location) setSite((current) => current ?? { ...location, elevation: 0, source: "approximate" });
      setLocationStatus(location ? "IP estimate. Check the location before pointing." : "Approximate location unavailable. Use device location or enter coordinates.");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!live || !active) return;
    const timer = window.setInterval(() => setTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live, active]);

  useEffect(() => {
    if (!request) return;
    const worker = new Worker(new URL("./observing.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ windows?: Window[]; error?: string }>) => setResult({ request, ...event.data });
    worker.onerror = () => setResult({ request, error: "Search unavailable. Reload the app and try again." });
    worker.postMessage(request);
    return () => worker.terminate();
  }, [request]);

  const sky = useMemo(() => site ? TARGETS.map((target) => skyPosition(target, site, time)) : [], [site, time]);
  const selected = sky.find((item) => item.body === body);
  const requestMatches = request?.body === body && request.site === site && request.days === days;
  const displayedResult = result?.request === request && requestMatches ? result : null;
  const searching = !!request && requestMatches && !displayedResult;
  const azimuth = Number(pointing.azimuth);
  const altitude = Number(pointing.altitude);
  const validPointing = pointing.azimuth.trim() !== "" && pointing.altitude.trim() !== ""
    && Number.isFinite(azimuth) && Number.isFinite(altitude) && azimuth >= 0 && azimuth <= 360 && altitude >= 0 && altitude <= 90;
  const nearby = validPointing ? sky.filter((item) => item.altitude >= 0)
    .map((item) => ({ ...item, separation: angularSeparation(item, { azimuth, altitude }) }))
    .filter((item) => item.separation <= 10).sort((a, b) => a.separation - b.separation) : [];

  function deviceLocation() {
    const choice = ++locationChoice.current;
    if (!navigator.geolocation) { setLocationStatus("Device location is unavailable. Enter coordinates below."); return; }
    setLocating(true);
    setLocationStatus("Waiting for device location permission…");
    navigator.geolocation.getCurrentPosition((position) => {
      if (choice !== locationChoice.current) return;
      const next: Site = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        elevation: position.coords.altitude ?? 0, label: "Device location", source: "device", accuracy: position.coords.accuracy };
      if (!validSite(next)) { setLocationStatus("Device returned invalid coordinates. Enter them manually."); }
      else { setSite(next); setLocationStatus("Device location received. Coordinates stay in this tab."); }
      setLocating(false);
    }, (error) => {
      if (choice !== locationChoice.current) return;
      setLocating(false);
      setLocationStatus(error.code === 1 ? "Location permission denied. Your current location choice is unchanged; manual entry is available."
        : "Device location could not be obtained. Try again or enter coordinates.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function chooseTime(value: number) {
    setTime(value); setLive(false); setDraftTime(null); setTimeError("");
  }

  return <main className={styles.observe}>
    <header className={styles.intro}><div><span className={styles.eyebrow}>YOUR LOCAL SKY</span>
      <h1>Plan a night outside</h1><p>Find a planet, choose a time, and point your telescope.</p></div>
      <span className={styles.live}>{live ? "LIVE SKY" : "PLANNED TIME"}</span>
    </header>
    <div className={styles.layout}>
      <section className={styles.card} aria-label="Location and observing time">
        <h2>Where &amp; when</h2>
        {site && <p><strong>{site.label}</strong><br /><span className={styles.muted}>{site.latitude.toFixed(4)}°, {site.longitude.toFixed(4)}° · {Math.round(site.elevation)} m
          {site.source === "approximate" ? " · approximate IP location" : site.accuracy !== undefined ? " · accuracy about " + Math.round(site.accuracy) + " m" : " · manual coordinates"}</span></p>}
        <button type="button" onClick={deviceLocation} disabled={locating}>{locating ? "Locating…" : "Use device location"}</button>
        <p className={styles.note} role="status">{locationStatus}</p>
        <details><summary>Enter coordinates manually</summary><form onSubmit={(event) => {
          event.preventDefault();
          const next: Site = { latitude: Number(coordinates.latitude), longitude: Number(coordinates.longitude), elevation: Number(coordinates.elevation), source: "manual", label: "Custom observing site" };
          if (!coordinates.latitude.trim() || !coordinates.longitude.trim() || !coordinates.elevation.trim() || !validSite(next)) {
            setLocationStatus("Latitude must be −90…90, longitude −180…180, elevation −500…10,000 m."); return;
          }
          locationChoice.current++;
          setLocating(false);
          setSite(next); setLocationStatus("Manual location selected. Times still use the timezone chosen below.");
        }}>
          <div className={styles.fields}>{(["latitude", "longitude", "elevation"] as const).map((field) => <label key={field}>
            {field === "latitude" ? "Latitude °N" : field === "longitude" ? "Longitude °E" : "Elevation (m)"}
            <input type="number" step="any" required value={coordinates[field]} onChange={(event) => setCoordinates({ ...coordinates, [field]: event.target.value })}
              min={field === "latitude" ? -90 : field === "longitude" ? -180 : -500} max={field === "latitude" ? 90 : field === "longitude" ? 180 : 10000} />
          </label>)}</div><p className={styles.note}>South and west are negative. Use 0 m if elevation is unknown.</p><button type="submit">Use coordinates</button>
        </form></details>
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
        <button type="button" onClick={() => { setTime(Date.now()); setLive(true); setDraftTime(null); setTimeError(""); }}>Now · live</button>
        <p className={styles.note}>This clock is independent of Explore. Device/manual coordinates stay in this tab. Approximate IP lookup uses GeoJS.</p>
      </section>

      <section className={styles.card} aria-label="Telescope pointing guide">
        <div className={styles.cardHeading}><h2>Point your telescope</h2><span className={styles.eyebrow}>TRUE NORTH</span></div>
        <label>Target<select value={body} onChange={(event) => setBody(event.target.value as Target)}>{TARGETS.map((target) => <option key={target}>{target}</option>)}</select></label>
        {!selected ? <p className={styles.empty}>Choose a location to calculate your sky.</p> : <>
          <p className={selected.suitable ? styles.good : styles.warning} role="status">{selected.altitude < 0 ? "Below your horizon"
            : selected.sunAltitude > -6 ? "Daylight / twilight — wait for a night-time window"
            : selected.geometricAltitude < 20 ? "Low in the sky — a higher view is preferable" : "Good geometry for observing"}</p>
          <div className={styles.readings}><div><span>AZIMUTH · {selected.direction}</span><strong>{selected.azimuth.toFixed(1)}°</strong></div>
            <div><span>ALTITUDE</span><strong>{selected.altitude.toFixed(1)}°</strong></div></div>
          <p className={styles.note}>Azimuth runs clockwise: north 0°, east 90°, south 180°, west 270°. Altitude is above a level horizon; 90° is overhead. Use true north, not an uncorrected magnetic compass.</p>
          <label>Mount type<select value={mount} onChange={(event) => setMount(event.target.value)}>
            <option value="altaz">Alt-azimuth</option><option value="equatorial">Equatorial / GoTo</option></select></label>
          {mount === "altaz" ? <ol className={styles.steps}><li>Level the mount and align its azimuth reference with true north.</li>
            <li>{selected.suitable ? "Turn toward " + selected.direction + " (" + selected.azimuth.toFixed(1) + "°), then raise to " + selected.altitude.toFixed(1) + "°." : "Choose an observing window below before aiming."}</li>
            <li>Start with a low-power eyepiece and center the target in the finder. Refine alignment before increasing magnification.</li></ol>
            : <><label>Coordinate epoch<select value={epoch} onChange={(event) => setEpoch(event.target.value)}><option value="date">Equator of date</option><option value="j2000">J2000</option></select></label>
              <div className={styles.equatorial}><span>RA <strong>{formatRA(epoch === "date" ? selected.ra : selected.j2000Ra)}</strong></span>
                <span>Dec <strong>{(epoch === "date" ? selected.dec : selected.j2000Dec).toFixed(4)}°</strong></span></div>
              <p className={styles.note}>Set location and time on the mount, polar-align if required, and complete its alignment procedure. Match the coordinate epoch. For GoTo mounts, prefer the built-in planet catalogue. These are observer-relative coordinates, not motor commands.</p></>}
          <p className={styles.warning}>Never aim a telescope or finder at the Sun. This guide is for night-time observing.</p>
          <p className={styles.note}>Estimates assume a clear, level horizon and standard refraction. Clouds, buildings, seeing, light pollution and mount alignment affect the view; Uranus and Neptune may require an optical finder/chart.</p>
        </>}
      </section>

      <EyepiecePreview body={body} site={site} time={time} timeLabel={formatTime(time)} altitude={selected?.altitude} sunAltitude={selected?.sunAltitude} active={active} />

      <section className={styles.card} aria-label="Observing windows">
        <h2>When can I see {body}?</h2><p className={styles.note}>Next windows with the target at least 20° high and the Sun at least 6° below the horizon. Highest altitude within each window is highlighted.</p>
        <div className={styles.fields}><label>Search ahead<select value={days} onChange={(event) => setDays(Number(event.target.value))}>
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={365}>1 year</option></select></label>
          <button type="button" disabled={!site || !!timeError || searching} onClick={() => {
            if (site) { setRequest({ body, site, start: time, days }); setResult(null); }
          }}>{searching ? "Searching…" : "Find observing times"}</button>
          {searching && <button type="button" onClick={() => { setRequest(null); setResult(null); }}>Cancel</button>}</div>
        <div aria-live="polite">
          {requestMatches && request && <p className={styles.note}>Search begins {formatTime(request.start)}. Change the time and search again for a different starting point.</p>}
          {displayedResult?.error && <p role="alert" className={styles.warning}>{displayedResult.error}</p>}
          {displayedResult?.windows?.length === 0 && <p>No qualifying window in this range. Try another date or a longer range; polar daylight and low target altitude can prevent a window.</p>}
          {displayedResult?.windows?.map((window) => <article className={styles.window} key={window.start}>
            <strong>{formatTime(window.best)}</strong><span>{window.altitude.toFixed(1)}° high · {directionName(window.azimuth)} {window.azimuth.toFixed(1)}°</span>
            <small>Window: {formatTime(window.start)} — {formatTime(window.end)}</small>
            <button type="button" onClick={() => chooseTime(window.best)}>Use this time</button></article>)}
        </div>
      </section>

      <section className={styles.card} aria-label="Sky directions">
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
    </div>
    <footer className={styles.note}>Calculated locally with <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Astronomy Engine</a>.
      Coordinates include observer location and light travel time. Location and planner settings last only for this tab.</footer>
  </main>;
}
