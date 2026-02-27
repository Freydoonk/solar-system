import styles from "./SolarSystem.module.css";

export type Vec2 = { x: number; y: number };

export type PlanetConfig = {
    id: string;
    name: string;
    radiusPx: number;

    // Orbit
    orbitRadiusPx: number;     // semi-major axis (scaled)
    orbitPeriodSec: number;    // seconds per full orbit (scaled)
    eccentricity?: number;     // 0 = circle, small value = ellipse-ish
    phaseRad?: number;         // starting angle

    className?: string;        // planet-specific styling
    showOrbit?: boolean;
};

type Props = {
    centerX: number;
    centerY: number;
    elapsedSec: number;
    config: PlanetConfig;
    showName?: boolean;
    showOrbits?: boolean;

    onPosition?: (pos: Vec2) => void;
};

export function Planet({ centerX, centerY, elapsedSec, config, showName, showOrbits: showOrbitVisual, onPosition }: Props) {
    const {
        name,
        radiusPx,
        orbitRadiusPx: a,
        orbitPeriodSec,
        eccentricity = 0,
        phaseRad = 0,
        className,
        showOrbit,
    } = config;

    // Uniform angular speed (good enough for now).
    const omega = (Math.PI * 2) / orbitPeriodSec;
    const theta = elapsedSec * omega + phaseRad;

    // Simple ellipse-ish via polar equation:
    // r(θ) = a(1 - e^2) / (1 + e cos θ)
    // (Looks more “solar system” than a perfect circle.)
    const r =
        eccentricity === 0
            ? a
            : (a * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(theta));

    const x = centerX + r * Math.cos(theta);
    const y = centerY + r * Math.sin(theta);

    onPosition?.({ x, y });

    const d = radiusPx * 2;

    return (
        <>
            {showOrbit && (
                <div
                    className={`${styles.orbit} ${showOrbitVisual ? styles.isVisible : styles.isHidden}`}
                    style={{
                        width: a * 2,
                        height: a * 2,
                        transform: `translate(${centerX - a}px, ${centerY - a}px)`,
                    }}
                    aria-hidden="true"
                />
            )}

            <div
                className={`${styles.planet} ${className ?? ""}`}
                style={{
                    width: d,
                    height: d,
                    transform: `translate(${x - radiusPx}px, ${y - radiusPx}px)`,
                }}
                aria-label={name}
                title={name}
            />

            <div
                className={`${styles.planetLabel} ${showName ? styles.isVisible : styles.isHidden}`}
                style={{ transform: `translate(${x + radiusPx + 6}px, ${y - 10}px)` }}
                aria-hidden="true">
                {name}
            </div>
        </>
    );
}