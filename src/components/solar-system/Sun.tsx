import styles from "./SolarSystem.module.css";

type Props = {
    x: number;
    y: number;
    radiusPx: number;
    marker: boolean;
};

export function Sun({ x, y, radiusPx, marker }: Props) {
    const d = radiusPx * 2;
    const description = marker
        ? "Sun position marker (not to scale)"
        : "Sun at true size · mean radius 695,700 km";

    return (
        <div
            className={`${styles.sun} ${marker ? styles.sunMarker : ""}`}
            data-sun-mode={marker ? "marker" : "true-size"}
            style={{
                width: d,
                height: d,
                transform: `translate(${x - radiusPx}px, ${y - radiusPx}px)`,
            }}
            role="img"
            aria-label={description}
            title={description}
        />
    );
}
