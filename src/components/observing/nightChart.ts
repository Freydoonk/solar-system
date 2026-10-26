import { Body, Equator, Horizon } from "astronomy-engine";
import { MAX_TIME, MIN_TIME } from "../solar-system/astronomy.ts";
import { observerFor, TARGETS, type Site, type Target } from "./observing.ts";

export type NightSample = { time: number; sun: number; altitudes: Record<Target, number> };
export function sampleNight({ site, start }: { site: Site; start: number }): NightSample[] {
  if (!Number.isFinite(start) || start < MIN_TIME || start >= MAX_TIME) throw new Error("Choose a supported date.");
  const observer = observerFor(site);
  const end = Math.min(start + 86400000, MAX_TIME);
  return Array.from({ length: 97 }, (_, index) => {
    const time = start + (end - start) * index / 96;
    const date = new Date(time);
    const altitude = (body: Body) => {
      const eq = Equator(body, date, observer, true, true);
      return Horizon(date, observer, eq.ra, eq.dec).altitude;
    };
    return { time, sun: altitude(Body.Sun), altitudes: Object.fromEntries(TARGETS.map(body => [body, altitude(body)])) as Record<Target, number> };
  });
}
