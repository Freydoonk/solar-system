import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./SolarSystem.module.css";
import { Sun } from "./Sun";
import { Planet } from "./Planet";
import { ControlsHelp } from "./ControlsHelp";
import type { DragMode } from "./navigation";
import { loadApproximateLocation, type ApproximateLocation } from "./location";
import { BODY_PRESETS, SUN_RADIUS_KM } from "./planets";
import { createPlaneLayout, planeFocusZoom, planeFrameZoom, projectPlane } from "./layout";
import { MAX_ZOOM, MIN_ZOOM, zoomAtPoint, zoomWithWheel, type Viewport } from "./viewport";
import { createPhysicalLayout, getMoonGuide, getSpacePositions, INITIAL_CAMERA_REQUEST, KM_PER_WORLD_UNIT, projectToSpace, type CameraRequest, type CameraView } from "./space";
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

export function SolarSystem() {
  const [initialTime] = useState(() => Date.now());
  const [simulationTime, setSimulationTime] = useState(initialTime);
  const [resetTime, setResetTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(true);
  const [daysPerSecond, setDaysPerSecond] = useState(1 / 24);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [dragMode, setDragMode] = useState<DragMode>("orbit");
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>(INITIAL_CAMERA_REQUEST);
  const [approximateLocation, setApproximateLocation] = useState<ApproximateLocation | null>();
  const [locationViewReleased, setLocationViewReleased] = useState(false);
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
    void loadApproximateLocation().then((location) => { if (active) setApproximateLocation(location); });
    return () => { active = false; };
  }, []);

  useLayoutEffect(() => {
    const element = sceneRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
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
    if (!playing) return;
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
  }, [playing, daysPerSecond]);

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

  function moveCamera(bodyId: string | null, cameraView: CameraView = bodyId ? "close" : "oblique") {
    setLocationViewReleased(true);
    if (BODY_PRESETS.find((body) => body.id === bodyId)?.parentId) setShowMoons(true);
    setCameraRequest((current) => ({ bodyId, view: cameraView, serial: current.serial + 1 }));
    setView({ zoom: Math.min(MAX_ZOOM, planeFocusZoom(bodyId, physicalLayout)), pan: { x: 0, y: 0 } });
  }

  function openPlaneView() {
    setLocationViewReleased(true);
    if (viewMode !== "2d" && cameraRequest.bodyId && cameraRequest.screenFraction !== undefined) {
      setView({ zoom: planeFrameZoom(cameraRequest.bodyId, physicalLayout, extent,
        Math.min(size.w, size.h), cameraRequest.screenFraction), pan: { x: 0, y: 0 } });
    }
    setViewMode("2d");
  }

  const focusedBody = BODY_PRESETS.find((body) => body.id === cameraRequest.bodyId);

  return (
    <main className={styles.stage}>
      <div ref={sceneRef} className={styles.scene} role="region" tabIndex={0}
        aria-label={viewMode === "3d" ? "Interactive 3D solar system" : "Solar system viewed from the north ecliptic pole. Scroll to zoom. Drag or use arrow keys to pan."}
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
          <span className={styles.eyebrow}>AN ORBIT THROUGH TIME</span>
          <h1>Solar System <span className={styles.dimensionBadge}>{viewMode.toUpperCase()}</span></h1>
          <p>One clock. A whole moving sky.</p>
        </header>

        {viewMode === "3d" ? <Suspense fallback={<div className={styles.spaceLoading}>Opening the 3D sky…</div>}>
          <SpaceScene time={simulationTime} positions={positions} guides={guides}
            showNames={showNames} showOrbits={showOrbits} showMoons={showMoons}
            dragMode={dragMode}
            initialLocation={approximateLocation ?? null} locationViewEnabled={!locationViewReleased}
            onReleaseLocationView={() => setLocationViewReleased(true)}
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
          <span className={styles.eyebrow}>FOLLOWING</span>
          <strong>{focusedBody?.name ?? "Sun"}</strong>
          <span>{(focusedBody?.radiusKm ?? SUN_RADIUS_KM).toLocaleString()} km radius</span>
          {viewMode === "3d" && cameraRequest.bodyId === "earth" && !locationViewReleased && <>
            <span role="status">{approximateLocation === undefined ? "Finding approximate region…"
              : approximateLocation ? `Region lock · ${approximateLocation.label}` : "Location unavailable · Free camera"}</span>
            {approximateLocation && <span>Approximate IP location · Drag to release</span>}
            {approximateLocation !== null && <button type="button" onClick={() => setLocationViewReleased(true)}>Release region lock</button>}
          </>}
          {focusedBody && (focusedBody.id === "pluto" || (focusedBody.parentId && focusedBody.id !== "moon")) && <span>Illustrative surface</span>}
          <button type="button" onClick={() => moveCamera(null)}>Back to system</button>
        </div>}

        <div className={styles.legend}>
            <span className={styles.scaleBadge}>TRUE SIZES &amp; DISTANCES</span>
            <p>1 scene unit = {KM_PER_WORLD_UNIT.toLocaleString("en-US")} km</p>
            <p>Sun, planets, moons and distances share one linear scale.</p>
            <p>Hollow locators mark tiny bodies; select one to explore its surface.</p>
          {showMoons && <p>* Schematic moon positions; real mean orbital periods.</p>}
          {viewMode === "3d" && <p>Space + drag to pan · Scroll to approach · Click a body to explore</p>}
        </div>
      </div>
      <ControlsHelp />

      <aside className={styles.sidebar} aria-label="Simulation controls and Earth view">
        <section className={`${styles.panel} ${styles.controls}`} aria-label="Simulation controls">
          <div className={styles.panelHeading}>
            <h2>Time travel</h2>
            <span className={`${styles.liveBadge} ${playing ? styles.running : ""}`}>{playing ? "RUNNING" : "PAUSED"}</span>
          </div>
          <time className={styles.clock} dateTime={iso} data-testid="simulation-clock">
            {iso.slice(0, 10)} <span>{iso.slice(11, 19)} UTC</span>
          </time>
          <div className={styles.dateRow}>
            <label>Date <span className={styles.fieldHint}>(Gregorian)</span>
              <input type="date" aria-label="Simulation date" min={MIN_DATE} max={MAX_DATE}
                value={draftDate ?? iso.slice(0, 10)} onFocus={() => setIsPlaying(false)}
                onChange={(event) => changeDate(event.target.value, draftTime ?? iso.slice(11, 16))} />
            </label>
            <label>Time (UTC)
              <input type="time" aria-label="Simulation time UTC" step={60} value={draftTime ?? iso.slice(11, 16)}
                onFocus={() => setIsPlaying(false)}
                onChange={(event) => changeDate(draftDate ?? iso.slice(0, 10), event.target.value)} />
            </label>
          </div>
          {dateError && <p className={styles.error} role="alert">{dateError}</p>}
          {simulationTime >= MAX_TIME && <p className={styles.helper}>End of date range. Choose an earlier date to continue.</p>}
          <div className={styles.buttonRow}>
            <button type="button" className={styles.primaryButton} disabled={simulationTime >= MAX_TIME || !!dateError}
              onClick={() => setIsPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
            <button type="button" onClick={() => selectTime(Date.now())}>Now</button>
            <button type="button" onClick={() => selectTime(resetTime)}>Reset</button>
          </div>
          <label className={styles.speedLabel}>Time speed
            <select value={daysPerSecond} onChange={(event) => setDaysPerSecond(Number(event.target.value))}>
              {speedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <p className={styles.helper}>Selecting a date pauses the sky. Play continues from that moment.</p>

          <section className={styles.cameraControls} aria-label="View and camera controls">
            <div className={styles.modeSwitch} aria-label="View mode">
              <button type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>3D explorer</button>
              <button type="button" aria-pressed={viewMode === "2d"} onClick={openPlaneView}>2D overview</button>
            </div>
            {viewMode === "3d" && <div className={styles.dragControls} role="group" aria-label="Left mouse drag action">
              <span>Left-drag</span>
              <button type="button" aria-pressed={dragMode === "orbit"} onClick={() => setDragMode("orbit")}>Orbit</button>
              <button type="button" aria-pressed={dragMode === "pan"} onClick={() => setDragMode("pan")}>Pan</button>
            </div>}
            <>
              <label>Explore a body
                <select aria-label="Explore a body" value={cameraRequest.bodyId ?? ""}
                  onChange={(event) => moveCamera(event.target.value || null)}>
                  <option value="">Whole solar system</option>
                  <option value="sun">Sun</option>
                  <optgroup label="Planets and dwarf planets">
                    {BODY_PRESETS.filter((body) => !body.parentId).map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
                  </optgroup>
                  <optgroup label="Moons">
                    {BODY_PRESETS.filter((body) => body.parentId).map((body) => <option key={body.id} value={body.id}>{body.name}{body.schematic ? " *" : ""}</option>)}
                  </optgroup>
                </select>
              </label>
              <div className={styles.cameraButtons}>
                <button type="button" onClick={() => moveCamera(cameraRequest.bodyId)}>Recenter</button>
                {viewMode === "3d" && <button type="button" onClick={() => moveCamera(cameraRequest.bodyId, "top")}>Top</button>}
                {viewMode === "3d" && <button type="button" onClick={() => moveCamera(cameraRequest.bodyId, "side")}>Side</button>}
                <button type="button" onClick={() => moveCamera(null)}>Fit system</button>
              </div>
              <p className={styles.helper}>{viewMode === "3d"
                ? "Hold Space + left-drag to move the view. Or select Pan above. Scroll to zoom; right-drag also pans."
                : "Scroll to zoom. Drag or use arrow keys to pan."} Select a body to follow it through time.</p>
            </>
          </section>

          <details className={styles.displaySettings} open>
            <summary>Display settings</summary>
            <p className={styles.helper}>
              True scale is always on in both views, including the Sun. All radii and distances
              use the same conversion: 1 scene unit = {KM_PER_WORLD_UNIT.toLocaleString("en-US")} km. Planets are tiny in the whole-system view;
              choose a body above to approach it.
            </p>
            {viewMode === "2d" && <div className={styles.rangeRow}>
              <label>Zoom <output>{zoom < 100 ? zoom.toFixed(2) : zoom.toLocaleString("en-US", { maximumFractionDigits: 0 })}×</output>
                <input aria-label="2D zoom" aria-valuetext={`${zoom.toFixed(2)} times`}
                  type="range" min={Math.log10(MIN_ZOOM)} max={Math.log10(MAX_ZOOM)} step={0.01} value={Math.log10(zoom)}
                  onChange={(event) => {
                    const nextZoom = 10 ** Number(event.target.value);
                    setView((current) => zoomAtPoint(current, nextZoom, { x: 0, y: 0 }));
                  }} />
              </label>
            </div>}
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={showNames} onChange={(event) => setShowNames(event.target.checked)} />Names</label>
              <label><input type="checkbox" checked={showOrbits} onChange={(event) => setShowOrbits(event.target.checked)} />Orbits</label>
              <label><input type="checkbox" checked={showMoons} onChange={(event) => {
                setShowMoons(event.target.checked);
                if (!event.target.checked && focusedBody?.parentId) moveCamera(focusedBody.parentId);
              }} />Moons</label>
            </div>
          </details>
          <p className={styles.credits}>Surface maps: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.<br />Pluto and other moon surfaces are artistic approximations. Surface orientation and moon orbit guides are illustrative.</p>
        </section>

        <section className={`${styles.panel} ${styles.earthPanel}`} aria-label="Moon phase and seasons">
          <div className={styles.panelHeading}><h2>From Earth</h2><span className={styles.eyebrow}>SAME MOMENT</span></div>
          <div className={styles.moonView}>
            <svg className={styles.moonDisc} viewBox="0 0 100 100" role="img" aria-label={`${moon.name}, ${(moon.illumination * 100).toFixed(1)}% illuminated`}
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
            <div><h3 data-testid="moon-phase">{moon.name}</h3>
              <p className={styles.illumination}>{(moon.illumination * 100).toFixed(1)}% illuminated</p>
              <label className={styles.moonOrientation}>View
                <select aria-label="Moon viewing hemisphere" value={southernMoon ? "south" : "north"}
                  onChange={(event) => setSouthernMoon(event.target.value === "south")}>
                  <option value="north">Northern hemisphere</option><option value="south">Southern hemisphere</option>
                </select>
              </label>
            </div>
          </div>
          <div className={styles.seasons}>
            <div><span>Northern hemisphere</span><strong data-testid="north-season" className={styles[seasons.north.toLowerCase()]}>
              <span aria-hidden="true">{seasonSymbols[seasons.north]}</span> {seasons.north}</strong></div>
            <div><span>Southern hemisphere</span><strong data-testid="south-season" className={styles[seasons.south.toLowerCase()]}>
              <span aria-hidden="true">{seasonSymbols[seasons.south]}</span> {seasons.south}</strong></div>
          </div>
          <p className={styles.helper}>Astronomical seasons · Moon orientation is illustrative; local sky rotation varies.</p>
        </section>
      </aside>
    </main>
  );
}
