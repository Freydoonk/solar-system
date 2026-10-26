import { Body, Equator, Horizon, Observer, SearchAltitude, SearchHourAngle } from "astronomy-engine";
import { DAY_MS, MAX_TIME, MIN_TIME } from "../solar-system/astronomy.ts";
import { clearIntervals, FLAT_HORIZON, horizonAltitude, validateHorizon, type HorizonProfile } from "./horizon.ts";

export const TARGETS = [Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune] as const;
export type Target = typeof TARGETS[number];
export type Site = { latitude: number; longitude: number; elevation: number; label: string; source: "approximate" | "device" | "manual"; accuracy?: number };
export type Window = { start: number; end: number; best: number; altitude: number; azimuth: number };
export type SearchRequest = { body: Target; site: Site; start: number; days: number; horizon?: HorizonProfile };

export function validSite(site: Pick<Site, "latitude" | "longitude" | "elevation">) {
  return Number.isFinite(site.latitude) && Math.abs(site.latitude) <= 90
    && Number.isFinite(site.longitude) && Math.abs(site.longitude) <= 180
    && Number.isFinite(site.elevation) && site.elevation >= -500 && site.elevation <= 10000;
}

export function observerFor(site: Site) {
  if (!validSite(site)) throw new Error("Enter valid latitude, longitude and elevation.");
  return new Observer(site.latitude, site.longitude, site.elevation);
}

function horizontal(body: Body, date: Date, observer: Observer, refract = false) {
  const equator = Equator(body, date, observer, true, true);
  return Horizon(date, observer, equator.ra, equator.dec, refract ? "normal" : undefined);
}

export function directionName(azimuth: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((azimuth % 360 + 360) % 360) / 45) % 8];
}

export function angularSeparation(a: { azimuth: number; altitude: number }, b: { azimuth: number; altitude: number }) {
  const r = Math.PI / 180;
  const cosine = Math.sin(a.altitude * r) * Math.sin(b.altitude * r)
    + Math.cos(a.altitude * r) * Math.cos(b.altitude * r) * Math.cos((a.azimuth - b.azimuth) * r);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / r;
}

export function skyPosition(body: Target, site: Site, time: number, horizon: HorizonProfile = FLAT_HORIZON) {
  if (!TARGETS.includes(body) || !Number.isFinite(time) || time < MIN_TIME || time > MAX_TIME) throw new Error("Unsupported target or date.");
  const observer = observerFor(site);
  const date = new Date(time);
  const equator = Equator(body, date, observer, true, true);
  const j2000 = Equator(body, date, observer, false, true);
  const apparent = Horizon(date, observer, equator.ra, equator.dec, "normal");
  const geometric = Horizon(date, observer, equator.ra, equator.dec);
  const sun = horizontal(Body.Sun, date, observer);
  const obstruction = horizonAltitude(horizon, geometric.azimuth);
  return { body, azimuth: apparent.azimuth, altitude: apparent.altitude,
    geometricAltitude: geometric.altitude, direction: directionName(apparent.azimuth),
    ra: equator.ra, dec: equator.dec, j2000Ra: j2000.ra, j2000Dec: j2000.dec,
    sunAltitude: sun.altitude, sunSeparation: angularSeparation(geometric, sun),
    obstruction, obstructed: geometric.altitude < obstruction,
    suitable: geometric.altitude >= Math.max(20, obstruction) && sun.altitude <= -6 };
}

// Event boundaries use geometric center altitudes, as required by SearchAltitude.
// This handles polar day/night and circumpolar targets without inventing rise/set times.
function altitudeIntervals(body: Body, observer: Observer, start: number, end: number, altitude: number, above: boolean) {
  const intervals: { start: number; end: number }[] = [];
  let inside = (horizontal(body, new Date(start), observer).altitude >= altitude) === above;
  let cursor = start;
  let began = start;
  while (cursor < end) {
    const direction = inside === above ? -1 : 1;
    const event = SearchAltitude(body, observer, direction, new Date(cursor), (end - cursor) / DAY_MS, altitude);
    const boundary = event ? Math.min(end, event.date.getTime()) : end;
    if (inside && boundary > began) intervals.push({ start: began, end: boundary });
    if (!event || boundary >= end) break;
    cursor = Math.max(cursor + 1000, boundary + 1000);
    inside = !inside;
    began = boundary;
  }
  return intervals;
}

export function searchOpportunities({ body, site, start, days, horizon = FLAT_HORIZON }: SearchRequest): Window[] {
  if (!TARGETS.includes(body) || !Number.isFinite(start) || start < MIN_TIME || start >= MAX_TIME
    || !Number.isInteger(days) || days < 1 || days > 365) throw new Error("Choose a valid date and a search range of 1–365 days.");
  const observer = observerFor(site);
  validateHorizon(horizon);
  const end = Math.min(MAX_TIME, start + days * DAY_MS);
  const high = altitudeIntervals(body, observer, start, end, 20, true);
  const dark = altitudeIntervals(Body.Sun, observer, start, end, -6, false);
  const windows: Window[] = [];
  for (const planet of high) for (const night of dark) {
    const intersectionStart = Math.max(planet.start, night.start);
    const intersectionEnd = Math.min(planet.end, night.end);
    if (intersectionEnd - intersectionStart < 60000) continue;
    const clear = horizon.some(height => height > 20) ? clearIntervals(intersectionStart, intersectionEnd, time => {
      const position = horizontal(body, new Date(time), observer);
      return position.altitude - horizonAltitude(horizon, position.azimuth);
    }) : [{ start: intersectionStart, end: intersectionEnd }];
    for (const interval of clear) {
      const from = interval.start;
      const to = interval.end;
      if (to - from < 60000) continue;
      let best = from + 1000;
      let position = horizontal(body, new Date(best), observer);
      const candidates = [to - 1000];
      let transit = SearchHourAngle(body, observer, 0, new Date(from)).time.date.getTime();
      while (transit < to) {
        candidates.push(transit);
        transit = SearchHourAngle(body, observer, 0, new Date(transit + 60000)).time.date.getTime();
      }
      for (const time of candidates) {
        const next = horizontal(body, new Date(time), observer);
        if (next.altitude > position.altitude) { best = time; position = next; }
      }
      windows.push({ start: from, end: to, best, altitude: position.altitude, azimuth: position.azimuth });
      if (windows.length === 5) return windows;
    }
  }
  return windows;
}

export function formatRA(hours: number) {
  const seconds = Math.round(hours * 3600) % 86400;
  return Math.floor(seconds / 3600) + "h " + Math.floor(seconds % 3600 / 60) + "m " + seconds % 60 + "s";
}

export function dateInputValue(time: number, utc: boolean) {
  const date = new Date(time);
  return new Date(time - (utc ? 0 : date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
}

export function parseObservationTime(value: string, utc: boolean): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = new Date(value + (utc ? ":00Z" : ":00")).getTime();
  return Number.isFinite(time) && time >= MIN_TIME && time <= MAX_TIME && dateInputValue(time, utc) === value ? time : null;
}
