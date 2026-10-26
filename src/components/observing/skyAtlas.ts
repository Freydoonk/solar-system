import { EquatorFromVector, Horizon, MakeTime, RotateVector, Rotation_EQJ_EQD, Spherical, Vector, VectorFromSphere } from "astronomy-engine";
import { MAX_TIME, MIN_TIME } from "../solar-system/astronomy.ts";
import { angularSeparation, observerFor, type Site } from "./observing.ts";

export type Star = { id: string; name: string; constellation: string; ra: number; dec: number; mag: number; x: number; y: number; z: number; vx: number; vy: number; vz: number };
export function skyProject(azimuth: number, altitude: number) {
  const radius = (90 - altitude) / 90 * 220;
  return { x: 250 + radius * Math.sin(azimuth * Math.PI / 180), y: 250 - radius * Math.cos(azimuth * Math.PI / 180) };
}
export function atlasFrame(site: Site, time: number) {
  if (!Number.isFinite(time) || time < MIN_TIME || time > MAX_TIME) throw new Error("Choose a supported atlas time.");
  const date = new Date(time); const observer = observerFor(site); const rotation = Rotation_EQJ_EQD(date);
  const years = (time - Date.parse("2000-01-01T12:00Z")) / (365.25 * 86400000);
  function position(vector: Vector) {
    const equator = EquatorFromVector(RotateVector(rotation, vector));
    const horizontal = Horizon(date, observer, equator.ra, equator.dec);
    return { ra: equator.ra, dec: equator.dec, altitude: horizontal.altitude, azimuth: horizontal.azimuth, ...skyProject(horizontal.azimuth, horizontal.altitude) };
  }
  return {
    fixed: (raDegrees: number, dec: number) => position(VectorFromSphere(new Spherical(dec, raDegrees, 1), date)),
    star: (star: Star) => position(new Vector(star.x + star.vx * years, star.y + star.vy * years, star.z + star.vz * years, MakeTime(date))),
  };
}
export function referenceStars<T extends { id: string; altitude: number; azimuth: number; mag: number }>(target: { id: string; altitude: number; azimuth: number }, stars: T[]) {
  return stars.filter(star => star.id !== target.id && star.altitude >= 0 && star.mag <= 3.5)
    .map(star => ({ ...star, separation: angularSeparation(target, star) })).sort((a, b) => a.separation - b.separation).slice(0, 3);
}
