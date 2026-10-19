import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./SolarSystem.module.css";
import { Sun } from "./Sun";
import { Planet } from "./Planet";
import { AU_KM, BODY_PRESETS, bodyRadiusPx, SUN_MARKER_RADIUS_PX, SUN_RADIUS_KM, type SizeMode } from "./planets";
import { createSceneLayout, moonOrbitRadius, projectMoon, projectPlanet } from "./layout";
import {
  advanceTime, getMoonAppearance, getOrbitGuides, getPositions, getSeasonEvents,
  getSeasons, MAX_DATE, MAX_TIME, MIN_DATE, moonPhasePath, parseSimulationDate, type Vec2,
} from "./astronomy";

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
  const [daysPerSecond, setDaysPerSecond] = useState(5);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; pan: Vec2 } | null>(null);
  const [bodyScale, setBodyScale] = useState(1);
  const [sizeMode, setSizeMode] = useState<SizeMode>("true");
  const [showTrueSun, setShowTrueSun] = useState(false);
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
  const layout = useMemo(() => createSceneLayout(guides, extent, bodyScale, sizeMode, zoom),
    [guides, extent, bodyScale, sizeMode, zoom]);

  // Resolve parents and moons together, avoiding render-time ref writes and a
  // one-frame lag when jumping to another date or resizing while paused.
  const screenPositions: Record<string, Vec2> = {};
  for (const body of BODY_PRESETS) {
    const offset = body.parentId
      ? projectMoon(body.id, positions[body.id], layout)
      : projectPlanet(body.id, positions[body.id], layout);
    const center = body.parentId ? screenPositions[body.parentId] : { x: cx, y: cy };
    screenPositions[body.id] = { x: center.x + offset.x, y: center.y + offset.y };
  }

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

  return (
    <main className={styles.stage}>
      <div ref={sceneRef} className={styles.scene} role="region" tabIndex={0}
        aria-label="Solar system viewed from the north ecliptic pole. Drag or use arrow keys to pan."
        onKeyDown={(event) => {
          const direction: Record<string, Vec2> = {
            ArrowLeft: { x: -30, y: 0 }, ArrowRight: { x: 30, y: 0 },
            ArrowUp: { x: 0, y: -30 }, ArrowDown: { x: 0, y: 30 },
          };
          const delta = direction[event.key];
          if (!delta) return;
          event.preventDefault();
          setPan((current) => ({ x: current.x + delta.x, y: current.y + delta.y }));
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag?.pointerId !== event.pointerId) return;
          setPan({ x: drag.pan.x + event.clientX - drag.x, y: drag.pan.y + event.clientY - drag.y });
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
          <h1>Solar System</h1>
          <p>One clock. A whole moving sky.</p>
        </header>

        {showOrbits && <svg className={styles.orbits} width={size.w} height={size.h} aria-hidden="true">
          {Object.entries(guides).map(([id, points]) => <path key={id} d={points.map((point, index) => {
            const p = projectPlanet(id, point, layout);
            return `${index ? "L" : "M"}${cx + p.x},${cy + p.y}`;
          }).join(" ") + " Z"} />)}
          {showMoons && BODY_PRESETS.filter((body) => body.parentId).map((body) => {
            const parent = screenPositions[body.parentId!];
            return <circle key={body.id} className={styles.moonOrbit} cx={parent.x} cy={parent.y}
              r={moonOrbitRadius(body.id, body.semiMajorKm / AU_KM, layout)} />;
          })}
        </svg>}

        <Sun x={cx} y={cy} marker={!showTrueSun}
          radiusPx={showTrueSun ? bodyRadiusPx(SUN_RADIUS_KM, bodyScale, "true") * layout.scale : SUN_MARKER_RADIUS_PX} />
        {BODY_PRESETS.filter((body) => showMoons || !body.parentId).map((body) => <Planet
          key={body.id} config={body} position={screenPositions[body.id]}
          radiusPx={layout.bodyRadii[body.id]} locatorRadius={layout.locatorRadius} showName={showNames}
        />)}

        <div className={styles.legend}>
          <span className={styles.scaleBadge}>{sizeMode === "true"
            ? showTrueSun ? "TRUE SIZE RATIOS" : "TRUE PLANET & MOON SIZE RATIOS"
            : "ILLUSTRATIVE SIZES"}</span>
          <p>{showTrueSun ? "Sun shown at the same size scale as the planets" : "Sun shown as a position marker, not to scale"}</p>
          <p>Orbital spacing is illustrative · Each planet and its moons has a separate band</p>
          {sizeMode === "true" && <p>Small rings locate tiny bodies; rings are not their size.</p>}
          {showMoons && <p>* Schematic moon positions; real mean orbital periods.</p>}
        </div>
      </div>

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

          <details className={styles.displaySettings} open>
            <summary>Display settings</summary>
            <label>Body sizes
              <select value={sizeMode} onChange={(event) => {
                const mode = event.target.value as SizeMode;
                setSizeMode(mode);
                if (mode === "readable") setShowTrueSun(false);
              }}>
                <option value="true">True proportions</option>
                <option value="readable">Enlarged small bodies (illustrative)</option>
              </select>
            </label>
            <label className={styles.sunToggle}>
              <input type="checkbox" checked={showTrueSun} onChange={(event) => {
                setShowTrueSun(event.target.checked);
                if (event.target.checked) setSizeMode("true");
              }} />
              Show Sun at true size
            </label>
            <p className={styles.helper}>{showTrueSun
              ? "All bodies use true proportions. The large Sun can cover compressed orbits."
              : "A small Sun marker leaves room for larger planets and moons."}</p>
            <div className={styles.rangeRow}>
              <label>Zoom <output>{zoom.toFixed(1)}×</output>
                <input type="range" min={0.5} max={4} step={0.1} value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))} />
              </label>
              <label>Size <output>{bodyScale.toFixed(1)}×</output>
                <input type="range" min={0.5} max={3} step={0.1} value={bodyScale}
                  onChange={(event) => setBodyScale(Number(event.target.value))} />
              </label>
            </div>
            <div className={styles.viewControls}>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit system</button>
              <span>Drag or use arrow keys to pan.</span>
            </div>
            <div className={styles.toggleRow}>
              <label><input type="checkbox" checked={showNames} onChange={(event) => setShowNames(event.target.checked)} />Names</label>
              <label><input type="checkbox" checked={showOrbits} onChange={(event) => setShowOrbits(event.target.checked)} />Orbits</label>
              <label><input type="checkbox" checked={showMoons} onChange={(event) => setShowMoons(event.target.checked)} />Moons</label>
            </div>
          </details>
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
