import { Body, NextLunarEclipse, NextMoonQuarter, SearchLunarEclipse, SearchMaxElongation, SearchMoonQuarter, SearchRelativeLongitude } from "astronomy-engine";
import { DAY_MS, MAX_TIME, MIN_TIME } from "../solar-system/astronomy.ts";
import { skyPosition, type Site, type Target } from "./observing.ts";
import type { HorizonProfile } from "./horizon.ts";

export type EventKind = "phase" | "opposition" | "elongation" | "eclipse";
export type SkyEvent = { id: string; kind: EventKind; body: Target; time: number; title: string; description: string; begin?: number; end?: number; local?: { altitude: number; sunAltitude: number; suitable: boolean } };
export type EventsRequest = { start: number; days: number; site: Site | null; horizon?: HorizonProfile };
export function findSkyEvents({ start, days, site, horizon }: EventsRequest): SkyEvent[] {
  if (!Number.isFinite(start) || start < MIN_TIME || start >= MAX_TIME || ![30, 90, 365].includes(days)) throw new Error("Choose a supported date and event range.");
  const end = Math.min(MAX_TIME, start + days * DAY_MS);
  const events: SkyEvent[] = [];
  function add(event: Omit<SkyEvent, "id" | "local">) {
    if (event.time < start || event.time > end) return;
    const position = site ? skyPosition(event.body, site, event.time, horizon) : null;
    events.push({ ...event, id: `${event.kind}-${event.body}-${Math.round(event.time)}`, local: position ? { altitude: position.geometricAltitude, sunAltitude: position.sunAltitude, suitable: position.suitable } : undefined });
  }
  let phase = SearchMoonQuarter(new Date(start));
  while (phase.time.date.getTime() <= end) {
    add({ kind: "phase", body: Body.Moon, time: phase.time.date.getTime(), title: ["New Moon", "First quarter Moon", "Full Moon", "Last quarter Moon"][phase.quarter],
      description: phase.quarter === 0 ? "The Moon is near the Sun in our sky; this is a calendar marker, not a pointing opportunity." : "An exact geocentric phase instant. The Moon looks similar for hours around this time; check your local night-time view." });
    phase = NextMoonQuarter(phase);
  }
  for (const body of [Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune] as const) {
    let cursor = start;
    while (cursor < end) {
      const time = SearchRelativeLongitude(body, 0, new Date(cursor)).date.getTime();
      if (time > end) break;
      add({ kind: "opposition", body, time, title: `${body} at opposition`, description: "Earth and this outer planet share a heliocentric ecliptic longitude. The planet is roughly opposite the Sun in our sky; nearby nights are useful too." });
      cursor = time + DAY_MS;
    }
  }
  for (const body of [Body.Mercury, Body.Venus] as const) {
    let cursor = start;
    while (cursor < end) {
      const event = SearchMaxElongation(body, new Date(cursor));
      const time = event.time.date.getTime();
      if (time > end) break;
      add({ kind: "elongation", body, time, title: `${body}: greatest ${event.visibility} elongation`, description: `${event.elongation.toFixed(1)}° from the Sun. This describes orbital geometry; use the night-time planner to find a local observing window. Never point at the Sun.` });
      cursor = time + DAY_MS;
    }
  }
  let eclipse = SearchLunarEclipse(new Date(start));
  while (eclipse.peak.date.getTime() <= end) {
    const time = eclipse.peak.date.getTime();
    add({ kind: "eclipse", body: Body.Moon, time, begin: Math.max(MIN_TIME, time - eclipse.sd_penum * 60000), end: Math.min(MAX_TIME, time + eclipse.sd_penum * 60000),
      title: `${eclipse.kind[0].toUpperCase() + eclipse.kind.slice(1)} lunar eclipse · peak`, description: "Earth's shadow falls on the Moon. Local altitude below describes the peak only; other phases may rise or set. Penumbral shading can be subtle. The 3D preview does not render the eclipse." });
    eclipse = NextLunarEclipse(eclipse.peak);
  }
  return events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

const calendarDate = (value: number) => new Date(value).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
/** RFC 5545 folds at 75 UTF-8 octets without splitting a code point. No location is exported. */
export function eventsCalendar(events: SkyEvent[], created: number): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Solar System//Sky Events//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) lines.push("BEGIN:VEVENT", `UID:${event.id}@solar-system.local`, `DTSTAMP:${calendarDate(created)}`, `DTSTART:${calendarDate(event.time)}`, "DURATION:PT1M", `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(event.description + " Exact event instant; check local visibility in Solar System.")}`, "END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.map(line => {
    const folded: string[] = []; let part = ""; let bytes = 0;
    for (const character of line) {
      const length = new TextEncoder().encode(character).length;
      if (bytes + length > 75) { folded.push(part); part = " "; bytes = 1; }
      part += character; bytes += length;
    }
    return [...folded, part].join("\r\n");
  }).join("\r\n") + "\r\n";
}
