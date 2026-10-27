import stars from "./catalogue/stars.json" with { type: "json" };
import patterns from "./catalogue/constellations.json" with { type: "json" };
import messier from "./catalogue/deep-sky.json" with { type: "json" };
import { Body, Equator, Horizon } from "astronomy-engine";
import { atlasFrame } from "./skyAtlas.ts";
import { observerFor, skyPosition, TARGETS, type Site } from "./observing.ts";
import { horizonAltitude, type HorizonProfile } from "./horizon.ts";
import { horizontalVector, wrapBearing } from "./skyOrientation.ts";
import { Vector3 } from "three";

export type SkyMarker = { id: string; name: string; kind: "sun" | "star" | "planet" | "constellation" | "messier" | "compass"; azimuth: number; altitude: number; vector: Vector3 };
// A clear-sky display cue, not a photometric visibility or weather model.
export const skyNightVisibility = (sunAltitude: number) => Math.max(0, Math.min(1, -sunAltitude / 12));
export const isDaylightMarker = (marker: SkyMarker) => marker.kind === "sun" || marker.kind === "compass" || marker.id === "Moon";
export function buildSkyView(site: Site, time: number, horizon: HorizonProfile) {
  const frame = atlasFrame(site, time);
  const clear = (azimuth: number, altitude: number) => altitude >= horizonAltitude(horizon, azimuth);
  const markers: SkyMarker[] = [];
  // The Sun belongs to the sky display, independently of the night-time telescope targets.
  const date = new Date(time), observer = observerFor(site);
  const equator = Equator(Body.Sun, date, observer, true, true);
  const horizontal = Horizon(date, observer, equator.ra, equator.dec);
  const sun = { azimuth: horizontal.azimuth, altitude: horizontal.altitude, visible: clear(horizontal.azimuth, horizontal.altitude) };
  if (sun.visible) markers.push({ id: "Sun", name: "Sun", kind: "sun", azimuth: sun.azimuth, altitude: sun.altitude, vector: horizontalVector(sun.azimuth, sun.altitude) });
  const starBuckets: Vector3[][] = [[], [], []];
  for (const star of stars) {
    const point = frame.star(star);
    if (!clear(point.azimuth, point.altitude)) continue;
    const vector = horizontalVector(point.azimuth, point.altitude);
    starBuckets[star.mag <= 2 ? 0 : star.mag <= 4 ? 1 : 2].push(vector);
    if (star.mag <= 2.5) markers.push({ id: star.id, name: star.name, kind: "star", ...point, vector });
  }
  const planets = TARGETS.map(body => skyPosition(body, site, time, horizon));
  for (const planet of planets) if (clear(planet.azimuth, planet.geometricAltitude)) {
    markers.push({ id: planet.body, name: planet.body, kind: "planet", azimuth: planet.azimuth, altitude: planet.geometricAltitude,
      vector: horizontalVector(planet.azimuth, planet.geometricAltitude) });
  }
  for (const object of messier) {
    const point = frame.fixed(object.geometry.coordinates[0], object.geometry.coordinates[1]);
    if (clear(point.azimuth, point.altitude)) markers.push({ id: object.id, name: object.id, kind: "messier", ...point, vector: horizontalVector(point.azimuth, point.altitude) });
  }
  const lines: Vector3[] = [];
  for (const pattern of patterns) {
    const center = new Vector3(); let count = 0;
    for (const path of pattern.lines) {
      const points = path.map(([ra, dec]) => { const p = frame.fixed(ra, dec); return horizontalVector(p.azimuth, p.altitude); });
      for (const point of points) { center.add(point); count++; }
      for (let i = 1; i < points.length; i++) {
        const start = points[i - 1], end = points[i];
        const steps = Math.max(1, Math.ceil(start.angleTo(end) * 180 / Math.PI));
        let previous = start;
        for (let j = 1; j <= steps; j++) {
          const next = start.clone().lerp(end, j / steps).normalize();
          const visible = (p: Vector3) => clear(wrapBearing(Math.atan2(p.x, -p.z) * 180 / Math.PI), Math.asin(p.y) * 180 / Math.PI);
          if (visible(previous) && visible(next)) lines.push(previous, next);
          previous = next;
        }
      }
    }
    if (count && center.lengthSq() > 0) {
      center.normalize();
      const azimuth = wrapBearing(Math.atan2(center.x, -center.z) * 180 / Math.PI), altitude = Math.asin(center.y) * 180 / Math.PI;
      if (clear(azimuth, altitude)) markers.push({ id: pattern.id, name: pattern.name, kind: "constellation", azimuth, altitude, vector: center });
    }
  }
  for (const [i, name] of ["N", "E", "S", "W"].entries()) markers.push({ id: name, name, kind: "compass", azimuth: i * 90, altitude: 0, vector: horizontalVector(i * 90, 0) });
  return { starBuckets, markers, lines, sun, time };
}
export type SkyViewModel = ReturnType<typeof buildSkyView>;
