import { Body } from "astronomy-engine";
import { MAX_TIME } from "../solar-system/astronomy.ts";
import { searchOpportunities, skyPosition, TARGETS, type Site, type Target, type Window } from "./observing.ts";
import type { HorizonProfile } from "./horizon.ts";

export type TonightRequest = { site: Site; start: number; minutes: number; equipment: "eyes" | "optics"; horizon?: HorizonProfile };
export type PlanStop = { body: Target; start: number; end: number; altitude: number; azimuth: number; window: Window };
export type TonightPlan = { start: number; end: number; stops: PlanStop[] };
const MINUTE = 60_000;

/** Search a rolling 24 hours, then fit distinct ten-minute visits inside one session. */
export function planTonight(request: TonightRequest): TonightPlan {
  const { site, start, minutes, equipment } = request;
  if (![30, 60, 120, 240].includes(minutes) || !["eyes", "optics"].includes(equipment)) throw new Error("Choose a session length and equipment.");
  const windows = TARGETS.filter(body => equipment === "optics" || (body !== Body.Uranus && body !== Body.Neptune))
    .flatMap(body => searchOpportunities({ body, site, start, days: 1, horizon: request.horizon }).map(window => ({ body, window })));
  const limit = Math.min(MAX_TIME, start + 86_400_000);
  const duration = minutes * MINUTE;
  const candidates = new Set(windows.flatMap(({ window }) => [window.start + 1000, Math.max(start, window.best - duration / 2)]));
  let best: TonightPlan = { start, end: Math.min(limit, start + duration), stops: [] };
  let bestScore = -1;
  for (const begins of [...candidates].sort((a, b) => a - b)) {
    const end = Math.min(limit, begins + duration);
    let cursor = begins;
    const stops: PlanStop[] = [];
    const used = new Set<Target>();
    for (const { body, window } of [...windows].sort((a, b) => a.window.end - b.window.end)) {
      const visit = Math.max(cursor, window.start + 1000);
      if (used.has(body) || visit + 10 * MINUTE > Math.min(end, window.end - 1000)) continue;
      const position = skyPosition(body, site, visit + 5 * MINUTE);
      stops.push({ body, start: visit, end: visit + 10 * MINUTE, altitude: position.geometricAltitude, azimuth: position.azimuth, window });
      used.add(body);
      cursor = visit + 10 * MINUTE;
    }
    // Prefer number of targets, then altitude; deterministic earlier start breaks ties.
    const score = stops.length * 100 + stops.reduce((sum, stop) => sum + stop.altitude / 90, 0);
    if (score > bestScore) { bestScore = score; best = { start: begins, end, stops }; }
  }
  return best;
}
