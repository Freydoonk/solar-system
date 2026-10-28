import { locationLabel } from "../../i18n/display";
import { t } from "../../i18n/messages";
import { useState } from "react";
import type { ObserverLocation } from "./useObserverLocation";
import styles from "./Observe.module.css";

export default function LocationControls({ location }: { location: ObserverLocation }) {
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "", elevation: "0" });
  const { site } = location;
  return <>
    {site && <p><strong>{locationLabel(site)}</strong><br /><span className={styles.muted}>{t("{value1}°, {value2}° · {value3} m{value4}", { value1: site.latitude.toFixed(4), value2: site.longitude.toFixed(4), value3: Math.round(site.elevation), value4: site.source === "approximate" ? t(" · approximate IP location") : site.accuracy !== undefined ? t(" · accuracy about {value1} m", { value1: Math.round(site.accuracy) }) : t(" · manual coordinates") })}</span></p>}
    <button type="button" onClick={location.deviceLocation} disabled={location.locating}>{location.locating ? t("Locating…") : t("Use device location")}</button>
    <p className={styles.note} role="status">{t(location.status)}</p>
    <details><summary>{t("Enter coordinates manually")}</summary><form onSubmit={event => {
      event.preventDefault(); location.manualLocation(coordinates.latitude, coordinates.longitude, coordinates.elevation);
    }}>
      <div className={styles.fields}>{(["latitude", "longitude", "elevation"] as const).map(field => <label key={field}>
        {field === "latitude" ? t("Latitude °N") : field === "longitude" ? t("Longitude °E") : t("Elevation (m)")}
        <input type="number" step="any" required value={coordinates[field]} onChange={event => setCoordinates({ ...coordinates, [field]: event.target.value })}
          min={field === "latitude" ? -90 : field === "longitude" ? -180 : -500} max={field === "latitude" ? 90 : field === "longitude" ? 180 : 10000} />
      </label>)}</div><p className={styles.note}>{t("South and west are negative. Use 0 m if elevation is unknown.")}</p><button type="submit">{t("Use coordinates")}</button>
    </form></details>
  </>;
}
