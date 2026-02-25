import styles from "./SolarSystem.module.css";

type Props = {
    x: number;
    y: number;
    radiusPx: number;
};

export function Sun({ x, y, radiusPx }: Props) {
    const d = radiusPx * 2;

    return (
        <div
            className={styles.sun}
            style={{
                width: d,
                height: d,
                transform: `translate(${x - radiusPx}px, ${y - radiusPx}px)`,
            }}
            aria-label="Sun"
        />
    );
}