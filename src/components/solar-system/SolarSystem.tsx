import { getLocale, t } from "../../i18n/messages";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./SolarSystem.module.css";
import { Sun } from "./Sun";
import { Planet } from "./Planet";
import { ControlsHelp } from "./ControlsHelp";
import type { DragMode } from "./navigation";
import { loadInitialLocation, type InitialLocation } from "./location";
import { BODY_PRESETS, SUN_RADIUS_KM } from "./planets";
import { createPlaneLayout, planeFocusZoom, planeFrameZoom, projectPlane } from "./layout";
import { MAX_ZOOM, MIN_ZOOM, zoomAtPoint, zoomWithWheel, type Viewport } from "./viewport";
import { createPhysicalLayout, getMoonGuide, getSpacePositions, INITIAL_CAMERA_REQUEST, KM_PER_WORLD_UNIT, projectToSpace, type CameraRequest, type CameraView, type FollowMode } from "./space";
import {
  advanceTime, getMoonAppearance, getOrbitGuides, getPositions, getSeasonEvents,
  getSeasons, MAX_DATE, MAX_TIME, MIN_DATE, moonPhasePath, parseSimulationDate, type Vec2,
} from "./astronomy";

const SpaceScene = lazy(() => import("./SpaceScene"));

const seasonSymbols = { Spring: "✿", Summer: "☀", Autumn: "❧", Winter: "❄" };
const speedOptions = [
  { value: 1 / 86400, label: "Real time" },
  { value: 1 / 24, label: "1 hour / second" },
  { value: 1, label: "1 day / second" },
  { value: 5, label: "5 days / second" },
  { value: 30, label: "30 days / second" },
  { value: 365.25, label: "1 year / second" },
];

export function SolarSystem({ active = true }: { active?: boolean }) {
  const [initialTime] = useState(() => Date.now());
  const [simulationTime, setSimulationTime] = useState(initialTime);
  const [resetTime, setResetTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(true);
  const [daysPerSecond, setDaysPerSecond] = useState(1 / 86400);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [dragMode, setDragMode] = useState<DragMode>("orbit");
  const [precision, setPrecision] = useState(false);
  const [cameraNudge, setCameraNudge] = useState({ azimuth: 0, polar: 0, serial: 0 });
  const [controlsOpen, setControlsOpen] = useState(() => !window.matchMedia(
    "(max-width: 850px), (pointer: coarse) and (max-width: 1100px), (orientation: landscape) and (max-height: 600px) and (max-width: 1100px)",
  ).matches);
  const [timeOpen, setTimeOpen] = useState(true);
  const [earthOpen, setEarthOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"camera" | "time" | "earth">("camera");
  const mobileContentRef = useRef<HTMLDivElement>(null);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>(INITIAL_CAMERA_REQUEST);
  const initialApproachRef = useRef(true);
  const [initialLocation, setInitialLocation] = useState<InitialLocation | null>();
  const [view, setView] = useState<Viewport>({ zoom: 1, pan: { x: 0, y: 0 } });
  const { zoom, pan } = view;
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [showNames, setShowNames] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showMoons, setShowMoons] = useState(true);
  const [southernMoon, setSouthernMoon] = useState(false);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const [dateError, setDateError] = useState("");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sceneRef = useRef<HTMLDivElement>(null);
  const playing = isPlaying && simulationTime < MAX_TIME;

  useEffect(() => {
    let active = true;
    void loadInitialLocation().then((location) => {
      if (!active) return;
      setInitialLocation(location);
      if (!location) setCameraRequest((current) => current.followMode === "region"
        ? { ...current, followMode: "free" } : current);
    });
    return () => { active = false; };
  }, []);

  useLayoutEffect(() => {
    const element = sceneRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry.contentRect.width || !entry.contentRect.height) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (viewMode !== "2d") return;
    const element = sceneRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      // Leave browser zoom shortcuts and horizontal-only scrolling alone.
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      setView((current) => zoomWithWheel(current, anchor, event.deltaY, event.deltaMode, rect.height));
    };
    // A non-passive listener prevents page scrolling over the sky only.
    // The separate controls panel keeps its normal scrolling behaviour.
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [viewMode]);

  useEffect(() => {
    if (!playing || !active) return;
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      // Ignore background time; one timestamp drives every body and both panels.
      if (last !== null && !document.hidden) {
        const seconds = Math.min((now - last) / 1000, 0.1);
        setSimulationTime((time) => advanceTime(time, seconds, daysPerSecond));
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, daysPerSecond, active]);

  const date = useMemo(() => new Date(simulationTime), [simulationTime]);
  const iso = date.toISOString();
  const year = date.getUTCFullYear();
  const positions = useMemo(() => getPositions(date), [date]);
  const guides = useMemo(() => getOrbitGuides(year), [year]);
  const seasonEvents = useMemo(() => getSeasonEvents(year), [year]);
  const seasons = getSeasons(simulationTime, seasonEvents);
  const moon = useMemo(() => getMoonAppearance(date), [date]);
  const cx = size.w / 2 + pan.x;
  const cy = size.h / 2 + pan.y;
  const extent = Math.max(0, Math.min(size.w - 120, size.h - 180) / 2);
  const physicalLayout = useMemo(() => createPhysicalLayout(guides), [guides]);
  const layout = useMemo(() => createPlaneLayout(physicalLayout, extent, zoom), [physicalLayout, extent, zoom]);
  const space = useMemo(() => getSpacePositions(positions), [positions]);
  const origin = space[cameraRequest.bodyId ?? "sun"];

  // Resolve parents and moons together, avoiding render-time ref writes and a
  // one-frame lag when jumping to another date or resizing while paused.
  const screenPositions: Record<string, Vec2> = {};
  for (const [id, point] of Object.entries(space)) {
    const offset = projectPlane(point, layout, origin);
    screenPositions[id] = { x: cx + offset.x, y: cy + offset.y };
  }
  const visibleInPlane = (id: string) => {
    const point = screenPositions[id];
    const radius = Math.max(layout.bodyRadii[id], layout.locatorRadius);
    return point.x + radius >= -100 && point.x - radius <= size.w + 100
      && point.y + radius >= -30 && point.y - radius <= size.h + 30;
  };

  function selectTime(time: number) {
    setSimulationTime(time);
    setResetTime(time);
    setIsPlaying(false);
    setDraftDate(null);
    setDraftTime(null);
    setDateError("");
  }

  function changeDate(nextDate: string, nextTime: string) {
    setDraftDate(nextDate);
    setDraftTime(nextTime);
    setIsPlaying(false);
    const time = parseSimulationDate(nextDate, nextTime);
    if (time === null) setDateError("Choose a valid date from 1900 to 2100 and a time.");
    else selectTime(time);
  }

  function moveCamera(bodyId: string | null, cameraView: CameraView = bodyId ? "close" : "oblique", mode?: FollowMode) {
    const followMode = mode ?? (viewMode === "2d" || cameraView !== "close" || !bodyId || bodyId === "sun" ? "free"
      : bodyId === "earth" && initialLocation !== null ? "region" : "sun");
    if (BODY_PRESETS.find((body) => body.id === bodyId)?.parentId) setShowMoons(true);
    setCameraRequest((current) => ({ bodyId, view: cameraView, serial: current.serial + 1, followMode,
      screenFraction: followMode === "sun" || followMode === "parent" ? 0.3 : followMode === "region" ? 0.15 : undefined }));
    setView({ zoom: Math.min(MAX_ZOOM, planeFocusZoom(bodyId, physicalLayout)), pan: { x: 0, y: 0 } });
  }

  function releaseFollow(serial: number) {
    setCameraRequest((current) => current.serial === serial ? { ...current, followMode: "free" } : current);
  }

  function openPlaneView() {
    initialApproachRef.current = false;
    releaseFollow(cameraRequest.serial);
    if (viewMode !== "2d" && cameraRequest.bodyId && cameraRequest.screenFraction !== undefined) {
      setView({ zoom: planeFrameZoom(cameraRequest.bodyId, physicalLayout, extent,
        Math.min(size.w, size.h), cameraRequest.screenFraction), pan: { x: 0, y: 0 } });
    }
    setViewMode("2d");
  }

  const focusedBody = BODY_PRESETS.find((body) => body.id === cameraRequest.bodyId);
  const focusedParent = BODY_PRESETS.find((body) => body.id === focusedBody?.parentId);

  return (
    <main className={styles.stage} data-controls={controlsOpen ? "open" : "closed"}>
      <div ref={sceneRef} className={styles.scene} role="region" tabIndex={0}
        aria-label={viewMode === "3d" ? t("Interactive 3D solar system") : t("Solar system viewed from the north ecliptic pole. Scroll to zoom. Drag or use arrow keys to pan.")}
        onKeyDown={(event) => {
          if (viewMode !== "2d") return;
          if (event.target !== event.currentTarget) return;
          const direction: Record<string, Vec2> = {
            ArrowLeft: { x: -30, y: 0 }, ArrowRight: { x: 30, y: 0 },
            ArrowUp: { x: 0, y: -30 }, ArrowDown: { x: 0, y: 30 },
          };
          const delta = direction[event.key];
          if (!delta) return;
          event.preventDefault();
          setView((current) => ({ ...current, pan: { x: current.pan.x + delta.x, y: current.pan.y + delta.y } }));
        }}
        onPointerDown={(event) => {
          if (viewMode !== "2d") return;
          if ((event.target as HTMLElement).closest("button, a, input, select, textarea, summary")) return;
          if (event.button !== 0) return;
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (viewMode !== "2d") return;
          const drag = dragRef.current;
          if (drag?.pointerId !== event.pointerId) return;
          const delta = { x: event.clientX - drag.x, y: event.clientY - drag.y };
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          setView((current) => ({ ...current, pan: { x: current.pan.x + delta.x, y: current.pan.y + delta.y } }));
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragRef.current = null; }}
        onLostPointerCapture={() => { dragRef.current = null; }}>
        <header className={styles.heading}>
          <span className={styles.eyebrow}>{t("AN ORBIT THROUGH TIME")}</span>
          <h1>{t("Solar System ")}<span className={styles.dimensionBadge}>{t(viewMode.toUpperCase())}</span></h1>
          <p>{t("One clock. A whole moving sky.")}</p>
        </header>

        {viewMode === "3d" ? <Suspense fallback={<div className={styles.spaceLoading}>{t("Opening the 3D sky…")}</div>}>
          <SpaceScene time={simulationTime} positions={positions} guides={guides}
            showNames={showNames} showOrbits={showOrbits} showMoons={showMoons}
            dragMode={dragMode} precision={precision} nudge={cameraNudge} active={active}
            initialLocation={initialLocation} initialApproachRef={initialApproachRef} onReleaseFollow={releaseFollow}
            request={cameraRequest} onFocus={(id) => moveCamera(id)} onFallback={openPlaneView} />
        </Suspense> : <>
        {showOrbits && <svg className={styles.orbits} width={size.w} height={size.h} aria-hidden="true">
          {Object.entries(guides).map(([id, points]) => <path key={id} d={points.map((point, index) => {
            const p = projectPlane(projectToSpace(point), layout, origin);
            return `${index ? "L" : "M"}${cx + p.x},${cy + p.y}`;
          }).join(" ") + " Z"} />)}
          {showMoons && BODY_PRESETS.filter((body) => body.parentId).map((body) => {
            const parent = screenPositions[body.parentId!];
            return <path key={body.id} className={styles.moonOrbit} d={getMoonGuide(positions[body.id]).map((point, index) => {
              const p = projectPlane(point, layout);
              return `${index ? "L" : "M"}${parent.x + p.x},${parent.y + p.y}`;
            }).join(" ") + " Z"} />;
          })}
        </svg>}

        {visibleInPlane("sun") && <Sun x={screenPositions.sun.x} y={screenPositions.sun.y}
          radiusPx={layout.bodyRadii.sun} locatorRadius={layout.locatorRadius} showName={showNames} />}
        {BODY_PRESETS.filter((body) => (showMoons || !body.parentId) && visibleInPlane(body.id))
          .sort((a, b) => space[a.id].y - space[b.id].y).map((body) => <Planet
          key={body.id} config={body} position={screenPositions[body.id]}
          radiusPx={layout.bodyRadii[body.id]} locatorRadius={layout.locatorRadius} showName={showNames}
        />)}
        </>}

        {cameraRequest.bodyId && <div className={styles.focusCard}>
          <span className={styles.eyebrow}>{t("FOLLOWING")}</span>
          <strong>{t(focusedBody?.name ?? "Sun")}</strong>
          <span>{t("{value1} km radius", { value1: (focusedBody?.radiusKm ?? SUN_RADIUS_KM).toLocaleString(getLocale()) })}</span>
          {viewMode === "3d" && cameraRequest.followMode === "region" && <>
            <span role="status">{initialLocation === undefined ? t("Finding your region…") : initialLocation ? t("Region lock · {value1}", { value1: initialLocation.source === "device" ? t("Device location") : initialLocation.label }) : t("Location unavailable · Free camera")}</span>
            {initialLocation && <span>{initialLocation.source === "device" ? t("Device location · Drag to release") : t("Approximate IP location · Drag to release")}</span>}
          </>}
          {viewMode === "3d" && cameraRequest.followMode === "sun" && <span>{t("Sun in view · Drag to release")}</span>}
          {viewMode === "3d" && focusedParent && cameraRequest.followMode === "from-parent" && <span>{t("From {value1} · Drag to release", { value1: t(focusedParent.name) })}</span>}
          {viewMode === "3d" && focusedParent && cameraRequest.followMode === "parent" && <span>{t("{value1} in view · Drag to release", { value1: t(focusedParent.name) })}</span>}
          {viewMode === "3d" && cameraRequest.followMode !== "free" && <button type="button"
            onClick={() => releaseFollow(cameraRequest.serial)}>{t("Release angle lock")}</button>}
          {focusedBody && (focusedBody.id === "pluto" || (focusedBody.parentId && focusedBody.id !== "moon")) && <span>{t("Illustrative surface")}</span>}
          <button type="button" onClick={() => moveCamera(null)}>{t("Back to system")}</button>
        </div>}

        <div className={styles.legend}>
            <span className={styles.scaleBadge}>{t("TRUE SIZES & DISTANCES")}</span>
            <p>{t("1 scene unit = {value1} km", { value1: KM_PER_WORLD_UNIT.toLocaleString(getLocale()) })}</p>
            <p>{t("Sun, planets, moons and distances share one linear scale.")}</p>
            <p>{t("Hollow locators mark tiny bodies; select one to explore its surface.")}</p>
          {showMoons && <p>{t("* Schematic moon positions; real mean orbital periods.")}</p>}
          {viewMode === "3d" && <p>{t("Space + drag to pan · Scroll to approach · Click a body to explore")}</p>}
        </div>
      </div>
      <ControlsHelp />

      <aside className={styles.sidebar} data-panel={mobilePanel} aria-label={t("Simulation controls and Earth view")}>
        <nav className={styles.mobilePanels} aria-label={t("Control sections")}>
          {(["camera", "time", "earth"] as const).map((panel) => <button key={panel} type="button"
            aria-pressed={mobilePanel === panel} onClick={() => {
              setMobilePanel(panel);
              setControlsOpen(true);
              if (mobileContentRef.current) mobileContentRef.current.scrollTop = 0;
            }}>{panel === "camera" ? t("Camera") : panel === "time" ? t("Time") : t("Moon & seasons")}</button>)}
          <button type="button" aria-expanded={controlsOpen} aria-controls="explore-controls"
            aria-label={controlsOpen ? t("Hide controls") : t("Show controls")}
            onClick={() => setControlsOpen(!controlsOpen)}>{controlsOpen ? t("Hide") : t("Expand")}</button>
        </nav>
        <div ref={mobileContentRef} id="explore-controls" className={styles.sidebarContent}>
        <section className={`${styles.panel} ${styles.controls}`} aria-label={t("Simulation controls")}>
          <div className={styles.timeControls} data-expanded={timeOpen}>
          <div className={styles.panelHeading}>
            <h2>{t("Time travel")}</h2>
            <span className={`${styles.liveBadge} ${playing ? styles.running : ""}`}>{playing ? t("RUNNING") : t("PAUSED")}</span>
            <button type="button" className={styles.panelToggle} aria-expanded={timeOpen} aria-controls="explore-time"
              aria-label={timeOpen ? t("Hide time controls") : t("Show time controls")}
              onClick={() => setTimeOpen(!timeOpen)}>{timeOpen ? t("Hide") : t("Expand")}</button>
          </div>
          <div id="explore-time" className={styles.panelBody}>
          <time className={styles.clock} dateTime={iso} data-testid="simulation-clock">
            {iso.slice(0, 10)} <span>{t("{value1} UTC", { value1: iso.slice(11, 19) })}</span>
          </time>
          <div className={styles.dateRow}>
            <label>{t("Date ")}<span className={styles.fieldHint}>{t("(Gregorian)")}</span>
              <input type="date" aria-label={t("Simulation date")} min={MIN_DATE} max={MAX_DATE}
                value={draftDate ?? iso.slice(0, 10)} onFocus={() => setIsPlaying(false)}
                onChange={(event) => changeDate(event.target.value, draftTime ?? iso.slice(11, 16))} />
            </label>
            <label>{t("Time (UTC)")}<input type="time" aria-label={t("Simulation time UTC")} step={60} value={draftTime ?? iso.slice(11, 16)}
                onFocus={() => setIsPlaying(false)}
                onChange={(event) => changeDate(draftDate ?? iso.slice(0, 10), event.target.value)} />
            </label>
          </div>
          {dateError && <p className={styles.error} role="alert">{t(dateError)}</p>}
          {simulationTime >= MAX_TIME && <p className={styles.helper}>{t("End of date range. Choose an earlier date to continue.")}</p>}
          <div className={styles.buttonRow}>
            <button type="button" className={styles.primaryButton} disabled={simulationTime >= MAX_TIME || !!dateError}
              onClick={() => setIsPlaying(!playing)}>{playing ? t("Pause") : t("Play")}</button>
            <button type="button" onClick={() => selectTime(Date.now())}>{t("Now")}</button>
            <button type="button" onClick={() => selectTime(resetTime)}>{t("Reset")}</button>
          </div>
          <label className={styles.speedLabel}>{t("Time speed")}<select value={daysPerSecond} onChange={(event) => setDaysPerSecond(Number(event.target.value))}>
              {speedOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
          </label>
          <p className={styles.helper}>{t("Selecting a date pauses the sky. Play continues from that moment.")}</p>
          </div>
          </div>

          <section className={styles.cameraControls} aria-label={t("View and camera controls")}>
            <div className={styles.modeSwitch} aria-label={t("View mode")}>
              <button type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>{t("3D explorer")}</button>
              <button type="button" aria-pressed={viewMode === "2d"} onClick={openPlaneView}>{t("2D overview")}</button>
            </div>
            {viewMode === "3d" && <div className={styles.dragControls} role="group" aria-label={t("Drag action")}>
              <span>{t("Drag action")}</span>
              <button type="button" aria-pressed={dragMode === "orbit"} onClick={() => setDragMode("orbit")}>{t("Orbit")}</button>
              <button type="button" aria-pressed={dragMode === "pan"} onClick={() => setDragMode("pan")}>{t("Pan")}</button>
            </div>}
            {viewMode === "3d" && <div className={styles.precisionControls}>
              <label><input type="checkbox" checked={precision} onChange={(event) => setPrecision(event.target.checked)} />{t("Fine control")}</label>
              <div className={styles.cameraButtons} role="group" aria-label={t("Adjust viewing angle")}>
                {[
                  { label: "Left", azimuth: 1, polar: 0 }, { label: "Right", azimuth: -1, polar: 0 },
                  { label: "Up", azimuth: 0, polar: -1 }, { label: "Down", azimuth: 0, polar: 1 },
                ].map((direction) => <button key={direction.label} type="button"
                  aria-label={t("Rotate view {value1} {value2} degrees", { value1: t(direction.label), value2: t((precision ? "0.25" : "2")) })}
                  onClick={() => setCameraNudge((current) => ({ azimuth: direction.azimuth * (precision ? 0.25 : 2),
                    polar: direction.polar * (precision ? 0.25 : 2), serial: current.serial + 1 }))}>{t(direction.label)}</button>)}
              </div>
              <p className={styles.helper}>{t("Small steps: {value1}. Dragging stops when you release.", { value1: precision ? "0.25°" : "2°" })}</p>
            </div>}
            <>
              <label>{t("Follow body")}<select aria-label={t("Follow body")} value={cameraRequest.bodyId ?? ""}
                  onChange={(event) => moveCamera(event.target.value || null)}>
                  <option value="">{t("Whole solar system")}</option>
                  <option value="sun">{t("Sun")}</option>
                  <optgroup label={t("Planets and dwarf planets")}>
                    {BODY_PRESETS.filter((body) => !body.parentId).map((body) => <option key={body.id} value={body.id}>{t(body.name)}</option>)}
                  </optgroup>
                  <optgroup label={t("Moons")}>
                    {BODY_PRESETS.filter((body) => body.parentId).map((body) => <option key={body.id} value={body.id}>{t(body.name)}{body.schematic ? " *" : ""}</option>)}
                  </optgroup>
                </select>
              </label>
              {viewMode === "3d" && cameraRequest.bodyId && <label className={styles.followMode}>{t("Follow mode")}<select aria-label={t("Follow mode")} value={cameraRequest.followMode ?? "free"}
                  onChange={(event) => moveCamera(cameraRequest.bodyId, "close", event.target.value as FollowMode)}>
                  {cameraRequest.bodyId !== "sun" && <option value="sun">{t("Sun in view")}</option>}
                  {focusedParent && <>
                    <option value="from-parent">{t("From {value1}", { value1: t(focusedParent.name) })}</option>
                    <option value="parent">{t("Behind moon · {value1} in view", { value1: t(focusedParent.name) })}</option>
                  </>}
                  {cameraRequest.bodyId === "earth" && <option value="region" disabled={initialLocation === null}>{t("My region{value1}", { value1: initialLocation === null ? t(" (unavailable)") : initialLocation === undefined ? t(" (locating…)") : "" })}
                  </option>}
                  <option value="free">{t("Free angle")}</option>
                </select>
              </label>}
              {viewMode === "3d" && focusedParent && cameraRequest.followMode === "from-parent" && <p className={styles.helper}>{t("Looking toward {value1} from near {value2}. Zoom to approach the moon; Recenter returns to the planet.", { value1: t(focusedBody?.name), value2: t(focusedParent.name) })}</p>}
              {viewMode === "3d" && focusedParent && cameraRequest.followMode === "parent" && <p className={styles.helper}>
                {t("{value1} in front, {value2} behind. The camera pulls back to fit both at true scale.", { value1: t(focusedBody?.name), value2: t(focusedParent.name) })}</p>}
              <div className={styles.cameraButtons}>
                <button type="button" onClick={() => moveCamera(cameraRequest.bodyId, "close", cameraRequest.followMode)}>{t("Recenter")}</button>
                {viewMode === "3d" && <button type="button" onClick={() => moveCamera(cameraRequest.bodyId, "top")}>{t("Top")}</button>}
                {viewMode === "3d" && <button type="button" onClick={() => moveCamera(cameraRequest.bodyId, "side")}>{t("Side")}</button>}
                <button type="button" onClick={() => moveCamera(null)}>{t("Fit system")}</button>
              </div>
              <p className={`${styles.helper} ${styles.mouseHint}`}>{t("{value1} Select a body to follow it through time.", { value1: viewMode === "3d" ? t("Hold Space + left-drag to move the view. Or select Pan above. Scroll to zoom; right-drag also pans.") : t("Scroll to zoom. Drag or use arrow keys to pan.") })}</p>
              <p className={`${styles.helper} ${styles.touchHint}`}>{viewMode === "3d" ? t("One finger to orbit or pan. Pinch to zoom; two fingers to move. Moving the view releases the angle lock.") : t("Drag to move. Use the Zoom slider in Display settings to approach a body.")}</p>
            </>
          </section>

          <details className={styles.displaySettings} open>
            <summary>{t("Display settings")}</summary>
            <p className={styles.helper}>{t("True scale is always on in both views, including the Sun. All radii and distances use the same conversion: 1 scene unit = {value1} km. Planets are tiny in the whole-system view; choose a body above to approach it.", { value1: KM_PER_WORLD_UNIT.toLocaleString(getLocale()) })}</p>
            {viewMode === "2d" && <div className={styles.rangeRow}>
              <label>{t("Zoom ")}<output>{zoom < 100 ? zoom.toFixed(2) : zoom.toLocaleString(getLocale(), { maximumFractionDigits: 0 })}×</output>
                <input aria-label={t("2D zoom")} aria-valuetext={t("{value1} times", { value1: zoom.toFixed(2) })}
                  type="range" min={Math.log10(MIN_ZOOM)} max={Math.log10(MAX_ZOOM)} step={0.01} value={Math.log10(zoom)}
                  onChange={(event) => {
                    const nextZoom = 10 ** Number(event.target.value);
                    setView((current) => zoomAtPoint(current, nextZoom, { x: 0, y: 0 }));
                  }} />
              </label>
            </div>}
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={showNames} onChange={(event) => setShowNames(event.target.checked)} />{t("Names")}</label>
              <label><input type="checkbox" checked={showOrbits} onChange={(event) => setShowOrbits(event.target.checked)} />{t("Orbits")}</label>
              <label><input type="checkbox" checked={showMoons} onChange={(event) => {
                setShowMoons(event.target.checked);
                if (!event.target.checked && focusedBody?.parentId) moveCamera(focusedBody.parentId);
              }} />{t("Moons")}</label>
            </div>
          </details>
          <p className={styles.credits}>{t("Surface maps: ")}<a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">{t("Solar System Scope")}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{t("CC BY 4.0")}</a>.<br />{t("Pluto and other moon surfaces are artistic approximations. Surface orientation and moon orbit guides are illustrative.")}</p>
        </section>

        <section className={`${styles.panel} ${styles.earthPanel}`} data-expanded={earthOpen} aria-label={t("Moon phase and seasons")}>
          <div className={styles.panelHeading}><h2>{t("From Earth")}</h2><span className={styles.eyebrow}>{t("SAME MOMENT")}</span>
            <button type="button" className={styles.panelToggle} aria-expanded={earthOpen} aria-controls="explore-earth"
              aria-label={earthOpen ? t("Hide Earth view") : t("Show Earth view")}
              onClick={() => setEarthOpen(!earthOpen)}>{earthOpen ? t("Hide") : t("Expand")}</button>
          </div>
          <div id="explore-earth" className={styles.panelBody}>
          <div className={styles.moonView}>
            <svg className={styles.moonDisc} viewBox="0 0 100 100" role="img" aria-label={t("{value1}, {value2}% illuminated", { value1: t(moon.name), value2: (moon.illumination * 100).toFixed(1) })}
              style={{ transform: southernMoon ? "rotate(180deg)" : undefined }}>
              <circle cx="50" cy="50" r="44" fill="#172230" />
              <path d={moonPhasePath(moon.phase, moon.illumination)} fill="#e3e9e8" />
              <g fill="#7e8f9b" opacity="0.17">
                <circle cx="33" cy="30" r="11" /><circle cx="60" cy="25" r="8" />
                <circle cx="66" cy="51" r="14" /><circle cx="40" cy="67" r="9" />
                <circle cx="28" cy="50" r="5" /><circle cx="60" cy="77" r="5" />
              </g>
              <circle cx="50" cy="50" r="44" fill="none" stroke="#8b9cab" strokeOpacity="0.2" />
            </svg>
            <div><h3 data-testid="moon-phase">{t(moon.name)}</h3>
              <p className={styles.illumination}>{t("{value1}% illuminated", { value1: (moon.illumination * 100).toFixed(1) })}</p>
              <label className={styles.moonOrientation}>{t("View")}<select aria-label={t("Moon viewing hemisphere")} value={southernMoon ? "south" : "north"}
                  onChange={(event) => setSouthernMoon(event.target.value === "south")}>
                  <option value="north">{t("Northern hemisphere")}</option><option value="south">{t("Southern hemisphere")}</option>
                </select>
              </label>
            </div>
          </div>
          <div className={styles.seasons}>
            <div><span>{t("Northern hemisphere")}</span><strong data-testid="north-season" className={styles[seasons.north.toLowerCase()]}>
              <span aria-hidden="true">{t(seasonSymbols[seasons.north])}</span> {t(seasons.north)}</strong></div>
            <div><span>{t("Southern hemisphere")}</span><strong data-testid="south-season" className={styles[seasons.south.toLowerCase()]}>
              <span aria-hidden="true">{t(seasonSymbols[seasons.south])}</span> {t(seasons.south)}</strong></div>
          </div>
          <p className={styles.helper}>{t("Astronomical seasons · Moon orientation is illustrative; local sky rotation varies.")}</p>
          </div>
        </section>
        </div>
      </aside>
    </main>
  );
}
