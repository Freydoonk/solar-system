import { t } from "../../i18n/messages";
import styles from "./SolarSystem.module.css";

type Props = { x: number; y: number; radiusPx: number; locatorRadius: number; showName: boolean };

export function Sun({ x, y, radiusPx, locatorRadius, showName }: Props) {
  const description = "Sun at true size · mean radius 695,700 km";
  return <div className={styles.bodyAnchor} style={{ left: x, top: y }} data-body="sun">
    {radiusPx < locatorRadius && <span className={styles.locator} aria-hidden="true"
      style={{ width: locatorRadius * 2, height: locatorRadius * 2, left: -locatorRadius, top: -locatorRadius }} />}
    <div className={styles.sun} data-sun-mode="true-size" role="img" aria-label={t(description)} title={t(description)}
      style={{ width: radiusPx * 2, height: radiusPx * 2, left: -radiusPx, top: -radiusPx,
        boxShadow: `0 0 ${radiusPx * 0.2}px #f5ae3930` }} />
    {showName && <span className={styles.planetLabel} style={{ left: Math.max(radiusPx, locatorRadius) + 5 }}>{t("Sun")}</span>}
  </div>;
}
