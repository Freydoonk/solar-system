import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./SolarSystem.module.css";
import { Sun } from "./Sun";
import { Planet, type Vec2 } from "./Planet";
import { buildPlanets } from "./planets";

type Size = { w: number; h: number };

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

export function SolarSystem() {
    // Speed up time so the orbit is visible. (1 = real-time seconds)
    const timeScale = 12;

    const [size, setSize] = useState<Size>({ w: 0, h: 0 });
    const [distanceScale, setDistanceScale] = useState(5);   // affects orbit radii only
    const [bodyScale, setBodyScale] = useState(0.5);         // affects sun + planet sizes only
    const [speedScale, setSpeedScale] = useState(0.1);       // affects time flow (orbit speed)
    const [showNames, setShowNames] = useState(true);
    const [showOrbits, setShowOrbits] = useState(true);
    const [elapsedSec, setElapsedSec] = useState(0);         // Single "clock" state → all planets derive their position from this.

    const stageRef = useRef<HTMLDivElement | null>(null);
    const speedScaleRef = useRef(speedScale);

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

            // dt in seconds (clamped so tab-switch doesn't jump wildly)
            const dt = last ? clamp((t - last) / 1000, 0, 0.05) : 1 / 60;

            setElapsedSec((s) => s + dt * timeScale * speedScaleRef.current);

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    const cx = size.w / 2;
    const cy = size.h / 2;

    // Orbit radii based on stage size → responsive.
    const base = Math.min(size.w, size.h);

    // orbitScalePx controls how far Neptune is from the sun.
    // Orbit pixels per 1.0 "AU scaled unit", Smaller number => everything tighter.
    const orbitScalePx = base * 0.02 * distanceScale;

    const earthPosRef = useRef<Vec2>({ x: 0, y: 0 });
    const planets = buildPlanets(orbitScalePx).map((p) => ({
        ...p,
        radiusPx: p.radiusPx * bodyScale,
    }));

    // Moon orbit radius around Earth (px)
    const moonOrbitRadiusPx = base * 0.003 * distanceScale;

    const moonConfig = {
        ...(planets.find((p) => p.id === "moon"))!,
        orbitRadiusPx: moonOrbitRadiusPx
    };

    return (
        <div ref={stageRef} className={styles.stage}>
            <Sun x={cx} y={cy} radiusPx={30 * bodyScale} />

            {planets
                .filter((p) => p.id !== "moon")
                //.filter((p) => p.id === "earth")
                .map((p) => (
                    <Planet
                        key={p.id}
                        centerX={cx}
                        centerY={cy}
                        elapsedSec={elapsedSec}
                        config={p}
                        showName={showNames}
                        showOrbits={showOrbits}
                        onPosition={p.id === "earth" ? (pos) => (earthPosRef.current = pos) : undefined}
                    />
                ))}

            {/* Moon rendered after Earth so earthPosRef is up-to-date */}
            <Planet
                centerX={earthPosRef.current.x}
                centerY={earthPosRef.current.y}
                elapsedSec={elapsedSec}
                config={moonConfig}
                showName={showNames}
                showOrbits={showOrbits}
            />

            <div className={styles.hint}>
                SolarSystem
            </div>

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
                </div>
            </div>
        </div>
    );
}