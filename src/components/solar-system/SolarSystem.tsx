import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./SolarSystem.module.css";
import { Sun } from "./Sun";
import { Planet, type PlanetConfig, type PlanetOrbiting, type Vec2 } from "./Planet";
import { buildBodies } from "./planets";

type Size = { w: number; h: number };

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

// Moons scale from their parent body size (NOT from distanceScale)
function getMoonOrbitRadiusPx(moon: PlanetConfig, parent: PlanetConfig, distanceScale: number) {
    // orbitMoonScaled means "how many parent radii"
    const orbitMoonScaled = (moon as any).orbitMoonScaled ?? 8; // default if missing
    return orbitMoonScaled / 4 * parent.radiusPx * distanceScale;
}

export function SolarSystem() {
    // base speed-up so it looks alive; user slider multiplies this
    const timeScale = 12;

    const [isPlaying, setIsPlaying] = useState(true);
    const [size, setSize] = useState<Size>({ w: 0, h: 0 });
    const [distanceScale, setDistanceScale] = useState(5);   // affects orbit radii only
    const [bodyScale, setBodyScale] = useState(0.6);         // affects sun + planet sizes only
    const [speedScale, setSpeedScale] = useState(0.01);       // affects time flow (orbit speed)
    const [showNames, setShowNames] = useState(true);
    const [showOrbits, setShowOrbits] = useState(true);
    const [showMoons, setShowMoons] = useState(true);
    const [elapsedSec, setElapsedSec] = useState(0);

    const positionsRef = useRef<Record<string, Vec2>>({});   // Track live positions for any body (earth, jupiter, moons, etc.)
    const stageRef = useRef<HTMLDivElement | null>(null);
    const speedScaleRef = useRef(speedScale);
    const isPlayingRef = useRef(isPlaying);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        speedScaleRef.current = speedScale;
    }, [speedScale]);

    useLayoutEffect(() => {
        const el = stageRef.current;
        if (!el) return;

        const ro = new ResizeObserver(() => {
            const rect = el.getBoundingClientRect();
            setSize({ w: rect.width, h: rect.height });
        });

        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        let rafId: number | null = null;
        let lastT: number | null = null;

        const tick = (t: number) => {
            const last = lastT;
            lastT = t;

            const dt = last ? clamp((t - last) / 1000, 0, 0.05) : 1 / 60;

            if (isPlayingRef.current) {
                setElapsedSec((s) => s + dt * timeScale * speedScaleRef.current);
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    const cx = size.w / 2;
    const cy = size.h / 2;
    const base = Math.min(size.w, size.h);

    // Planet orbit scale (sun-centered)
    const orbitScalePx = base * 0.02 * distanceScale;

    // Build both planets + moons. Moons should have `orbiting: { type:"planet", planetId:"earth" }`
    // and an extra numeric field `orbitMoonScaled` (how many parent radii away).
    const bodies: PlanetConfig[] = useMemo(() => {
        return buildBodies({
            orbitScalePx,
            bodyScale,
            styles
        });
    }, [orbitScalePx, bodyScale]);

    const bodiesById = useMemo(() => {
        const map: Record<string, PlanetConfig> = {};
        for (const b of bodies)
            map[b.id] = b;
        return map;
    }, [bodies]);

    return (
        <div ref={stageRef} className={styles.stage}>
            <Sun x={cx} y={cy} radiusPx={30 * bodyScale} />

            {/* PASS 1: planets orbiting the Sun */}
            {bodies
                .filter((b) => b.orbiting === "sun" || b.orbiting == null)
                .map((planet) => (
                    <Planet
                        key={planet.id}
                        centerX={cx}
                        centerY={cy}
                        elapsedSec={elapsedSec}
                        config={planet}
                        showName={showNames}
                        showOrbits={showOrbits}
                        onPosition={(pos) => {
                            positionsRef.current[planet.id] = pos;
                        }}
                    />
                ))}

            {/* PASS 2: moons orbiting planets */}
            {bodies
                .filter((b) => (b as any).orbiting && (b as any).orbiting !== "sun")
                .map((moon) => {
                    const orbiting = moon.orbiting as PlanetOrbiting;

                    const parent = bodiesById[orbiting.planetId];
                    if (!parent)
                        return null;

                    const parentPos = positionsRef.current[parent.id] ?? { x: cx, y: cy };
                    const moonOrbitRadiusPx = getMoonOrbitRadiusPx(moon, parent, distanceScale);

                    const moonResolved: PlanetConfig = {
                        ...moon,
                        orbitRadiusPx: moonOrbitRadiusPx,
                    };

                    return (
                        <Planet
                            key={moon.id}
                            centerX={parentPos.x}
                            centerY={parentPos.y}
                            elapsedSec={elapsedSec}
                            config={moonResolved}
                            showName={showNames}
                            showOrbits={showOrbits}
                            showBody={showMoons}
                            onPosition={(pos) => {
                                positionsRef.current[moon.id] = pos;
                            }}
                        />
                    );
                })}

            <div className={styles.hint}>SolarSystem</div>

            <div className={styles.controls}>
                <label>
                    Distance: {distanceScale.toFixed(2)}x
                    <input
                        type="range"
                        min={0.2}
                        max={10.0}
                        step={0.05}
                        value={distanceScale}
                        onChange={(e) => setDistanceScale(Number(e.target.value))}
                    />
                </label>

                <label>
                    Bodies: {bodyScale.toFixed(2)}x
                    <input
                        type="range"
                        min={0.2}
                        max={5.0}
                        step={0.05}
                        value={bodyScale}
                        onChange={(e) => setBodyScale(Number(e.target.value))}
                    />
                </label>

                <label>
                    Speed: {speedScale.toFixed(2)}x
                    <input
                        type="range"
                        min={0.01}
                        max={2}
                        step={0.01}
                        value={speedScale}
                        onChange={(e) => setSpeedScale(Number(e.target.value))}
                    />
                </label>

                <div className={styles.toggleRow}>
                    <label className={styles.toggle}>
                        <span className={styles.toggleText}>Names</span>
                        <input
                            className={styles.toggleInput}
                            type="checkbox"
                            checked={showNames}
                            onChange={(e) => setShowNames(e.target.checked)}
                        />
                        <span className={styles.toggleTrack} aria-hidden="true" />
                    </label>

                    <label className={styles.toggle}>
                        <span className={styles.toggleText}>Orbits</span>
                        <input
                            className={styles.toggleInput}
                            type="checkbox"
                            checked={showOrbits}
                            onChange={(e) => setShowOrbits(e.target.checked)}
                        />
                        <span className={styles.toggleTrack} aria-hidden="true" />
                    </label>

                    <label className={styles.toggle}>
                        <span className={styles.toggleText}>Moons</span>
                        <input
                            className={styles.toggleInput}
                            type="checkbox"
                            checked={showMoons}
                            onChange={(e) => setShowMoons(e.target.checked)}
                        />
                        <span className={styles.toggleTrack} aria-hidden="true" />
                    </label>
                </div>

                <div className={styles.buttonRow}>
                    <button
                        type="button"
                        className={styles.playButton}
                        onClick={() => setIsPlaying((p) => !p)}
                    >
                        {isPlaying ? "Pause" : "Play"}
                    </button>

                    <button
                        type="button"
                        className={styles.playButton}
                        onClick={() => setElapsedSec(0)}
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}