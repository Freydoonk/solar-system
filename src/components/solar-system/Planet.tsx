import { getLocale, t } from "../../i18n/messages";
import styles from "./SolarSystem.module.css";
import type { Vec2 } from "./astronomy";
import type { BodyConfig } from "./planets";

type Props = { position: Vec2; config: BodyConfig; radiusPx: number; locatorRadius: number; showName: boolean };

export function Planet({ position, config, radiusPx, locatorRadius, showName }: Props) {
  const { name, id, radiusKm, periodDays, schematic } = config;
  const description = t("{body}{schematic} · radius {radius} km · orbit {period} days", { body: t(name),
    schematic: schematic ? t(" (schematic orbit)") : "", radius: radiusKm.toLocaleString(getLocale()), period: periodDays.toLocaleString(getLocale()) });
  return (
    <div className={styles.bodyAnchor} style={{ left: position.x, top: position.y }} data-body={id}>
      {radiusPx < locatorRadius && <span className={styles.locator} aria-hidden="true"
        style={{ width: 2 * locatorRadius, height: 2 * locatorRadius, left: -locatorRadius, top: -locatorRadius, borderWidth: Math.min(1, locatorRadius) }} />}
      <div
        className={`${styles.planet} ${styles[config.parentId ? "moon" : id]}`}
        style={{ width: radiusPx * 2, height: radiusPx * 2, left: -radiusPx, top: -radiusPx }}
        role="img" aria-label={t(description)} title={t(description)}
      />
      {showName && <span className={`${styles.planetLabel} ${config.parentId ? styles.moonLabel : ""}`}
        style={{ left: Math.max(radiusPx, 3) + 5 }} title={t(description)}>
        {t(name)}{schematic ? "*" : ""}
      </span>}
    </div>
  );
}
