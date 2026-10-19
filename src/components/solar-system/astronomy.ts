import {
  Body, GeoMoon, HelioVector, Illumination, JupiterMoons, MoonPhase,
  RotateVector, Rotation_EQJ_ECL, Seasons, Vector,
} from "astronomy-engine";
import { AU_KM, BODY_PRESETS, type BodyConfig } from "./planets.ts";

export type Vec2 = { x: number; y: number };
export const DAY_MS = 86_400_000;
export const MIN_DATE = "1900-01-01";
export const MAX_DATE = "2100-12-31";
export const MIN_TIME = Date.parse(`${MIN_DATE}T00:00:00Z`);
export const MAX_TIME = Date.parse(`${MAX_DATE}T23:59:59.999Z`);
const J2000 = Date.parse("2000-01-01T12:00:00Z");
const eclipticRotation = Rotation_EQJ_ECL();

function ecliptic(vector: Vector): Vec2 {
  const rotated = RotateVector(eclipticRotation, vector);
  return { x: rotated.x, y: rotated.y };
}

export function planetPosition(body: BodyConfig, date: Date): Vec2 {
  if (!body.astronomyBody) throw new Error(`No planetary ephemeris for ${body.id}`);
  return ecliptic(HelioVector(body.astronomyBody, date));
}

/** AU in the J2000 ecliptic plane. Satellite vectors are relative to their parent. */
export function getPositions(date: Date): Record<string, Vec2> {
  const result: Record<string, Vec2> = {};
  const jovian = JupiterMoons(date);
  for (const body of BODY_PRESETS) {
    if (body.astronomyBody) result[body.id] = planetPosition(body, date);
    else if (body.id === "moon") result[body.id] = ecliptic(GeoMoon(date));
    else if (body.id === "io" || body.id === "europa" || body.id === "ganymede" || body.id === "callisto") {
      const state = jovian[body.id];
      result[body.id] = ecliptic(new Vector(state.x, state.y, state.z, state.t));
    } else {
      // Retained minor moons illustrate the real mean period only. Their phase
      // and orientation are schematic, explicitly identified in the interface.
      const days = (date.getTime() - J2000) / DAY_MS;
      const angle = (body.retrograde ? -1 : 1) * 2 * Math.PI * (days % body.periodDays) / body.periodDays;
      const radius = body.semiMajorKm / AU_KM;
      result[body.id] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    }
  }
  return result;
}

/** Guides use the same ephemeris and projection as the live planets. */
export function getOrbitGuides(year: number): Record<string, Vec2[]> {
  const start = Date.UTC(year, 0, 1);
  return Object.fromEntries(BODY_PRESETS.filter((body) => !body.parentId).map((body) => [
    body.id,
    Array.from({ length: 181 }, (_, step) => planetPosition(body, new Date(start + body.periodDays * DAY_MS * step / 180))),
  ]));
}

export type SeasonName = "Spring" | "Summer" | "Autumn" | "Winter";
export type SeasonEvent = { time: number; north: SeasonName; south: SeasonName };

export function getSeasonEvents(year: number): SeasonEvent[] {
  const seasons = Seasons(year);
  return [
    { time: seasons.mar_equinox.date.getTime(), north: "Spring", south: "Autumn" },
    { time: seasons.jun_solstice.date.getTime(), north: "Summer", south: "Winter" },
    { time: seasons.sep_equinox.date.getTime(), north: "Autumn", south: "Spring" },
    { time: seasons.dec_solstice.date.getTime(), north: "Winter", south: "Summer" },
  ];
}

export function getSeasons(time: number, events: SeasonEvent[]) {
  const current = events.filter((event) => event.time <= time).at(-1);
  return current ?? { north: "Winter" as const, south: "Summer" as const };
}

export function getMoonAppearance(date: Date) {
  const phase = MoonPhase(date);
  const illumination = Illumination(Body.Moon, date).phase_fraction;
  const name = phase < 1 || phase > 359 ? "New moon"
    : Math.abs(phase - 90) < 1 ? "First quarter"
    : Math.abs(phase - 180) < 1 ? "Full moon"
    : Math.abs(phase - 270) < 1 ? "Last quarter"
    : phase < 90 ? "Waxing crescent"
    : phase < 180 ? "Waxing gibbous"
    : phase < 270 ? "Waning gibbous" : "Waning crescent";
  return { phase, illumination, name };
}

/** An illuminated sphere's limb and elliptical terminator, north-up convention. */
export function moonPhasePath(phase: number, illumination: number): string {
  const radius = 44;
  const side = phase < 180 ? 1 : -1;
  const terminator = 1 - 2 * illumination;
  const points: string[] = [];
  for (let step = 0; step <= 64; step++) {
    const angle = Math.PI * step / 64;
    points.push(`${50 + side * radius * Math.sin(angle)},${50 - radius * Math.cos(angle)}`);
  }
  for (let step = 64; step >= 0; step--) {
    const angle = Math.PI * step / 64;
    points.push(`${50 + side * radius * terminator * Math.sin(angle)},${50 - radius * Math.cos(angle)}`);
  }
  return `M${points.join(" L")} Z`;
}

export function parseSimulationDate(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(value) || value < MIN_TIME || value > MAX_TIME) return null;
  if (new Date(value).toISOString().slice(0, 16) !== `${date}T${time}`) return null;
  return value;
}

export function advanceTime(time: number, seconds: number, daysPerSecond: number): number {
  return Math.max(MIN_TIME, Math.min(MAX_TIME, time + seconds * daysPerSecond * DAY_MS));
}
