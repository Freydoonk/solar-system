import { useState } from "react";
import type { ObserverLocation } from "./useObserverLocation";
import styles from "./Observe.module.css";

export default function LocationControls({ location }: { location: ObserverLocation }) {
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "", elevation: "0" });
  const { site } = location;
  return <>
    {site && <p><strong>{site.label}</strong><br /><span className={styles.muted}>{site.latitude.toFixed(4)}°, {site.longitude.toFixed(4)}° · {Math.round(site.elevation)} m
      {site.source === "approximate" ? " · approximate IP location" : site.accuracy !== undefined ? " · accuracy about " + Math.round(site.accuracy) + " m" : " · manual coordinates"}</span></p>}
    <button type="button" onClick={location.deviceLocation} disabled={location.locating}>{location.locating ? "Locating…" : "Use device location"}</button>
    <p className={styles.note} role="status">{location.status}</p>
    <details><summary>Enter coordinates manually</summary><form onSubmit={event => {
      event.preventDefault(); location.manualLocation(coordinates.latitude, coordinates.longitude, coordinates.elevation);
    }}>
      <div className={styles.fields}>{(["latitude", "longitude", "elevation"] as const).map(field => <label key={field}>
        {field === "latitude" ? "Latitude °N" : field === "longitude" ? "Longitude °E" : "Elevation (m)"}
        <input type="number" step="any" required value={coordinates[field]} onChange={event => setCoordinates({ ...coordinates, [field]: event.target.value })}
          min={field === "latitude" ? -90 : field === "longitude" ? -180 : -500} max={field === "latitude" ? 90 : field === "longitude" ? 180 : 10000} />
      </label>)}</div><p className={styles.note}>South and west are negative. Use 0 m if elevation is unknown.</p><button type="submit">Use coordinates</button>
    </form></details>
  </>;
}
