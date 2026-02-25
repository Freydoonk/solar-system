import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./SolarSystem.module.css";
import { Sun } from "./Sun";
import { Planet } from "./Planet";
import { buildPlanets } from "./planets";

type Size = { w: number; h: number };

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

export function SolarSystem() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState<Size>({ w: 0, h: 0 });

    // Single "clock" state → all planets derive their position from this.
    const [elapsedSec, setElapsedSec] = useState(0);

    // Speed up time so the orbit is visible. (1 = real-time seconds)
    const timeScale = 12;

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

            setElapsedSec((s) => s + dt * timeScale);

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
    // Smaller number => everything tighter.
    const orbitScalePx = base * 0.02;

    const planets = buildPlanets(orbitScalePx);

    return (
        <div ref={stageRef} className={styles.stage}>
            <Sun x={cx} y={cy} radiusPx={34} />

            {planets.map((p) => (
                <Planet
                    key={p.id}
                    centerX={cx}
                    centerY={cy}
                    elapsedSec={elapsedSec}
                    config={p}
                />
            ))}

            <div className={styles.hint}>
                SolarSystem: Earth orbiting. Add planets by extending the array.
            </div>
        </div>
    );
}