import test from "node:test";
import assert from "node:assert/strict";
import { Body, Ecliptic, HelioVector, MoonPhase, SearchRelativeLongitude } from "astronomy-engine";
import { eventsCalendar, findSkyEvents } from "../src/components/observing/events.ts";
import { DAY_MS } from "../src/components/solar-system/astronomy.ts";

test("event calendar is bounded, ordered and identifies true outer-planet opposition", () => {
  const start = Date.parse("2025-01-01T00:00Z");
  const events = findSkyEvents({ start, days: 365, site: null });
  assert.equal(new Set(events.map(event => event.id)).size, events.length);
  assert.ok(events.some(event => event.kind === "eclipse"));
  let previous = start;
  for (const event of events) {
    assert.ok(event.time >= previous && event.time <= start + 365 * DAY_MS);
    previous = event.time;
    if (event.kind === "phase") {
      const phase = MoonPhase(new Date(event.time));
      assert.ok(Math.abs(phase / 90 - Math.round(phase / 90)) < 0.001);
    }
    if (event.kind === "opposition") {
      const earth = Ecliptic(HelioVector(Body.Earth, new Date(event.time)));
      const planet = Ecliptic(HelioVector(event.body, new Date(event.time)));
      const difference = ((earth.elon - planet.elon + 540) % 360) - 180;
      assert.ok(Math.abs(difference) < 0.01);
      assert.ok(Math.abs(event.time - SearchRelativeLongitude(event.body, 0, new Date(start)).date.getTime()) < DAY_MS);
    }
  }
  assert.throws(() => findSkyEvents({ start: NaN, days: 30, site: null }));
});
test("calendar export has UTC dates, escaped content, folded UTF-8 and no site", () => {
  const events = findSkyEvents({ start: Date.parse("2025-03-01Z"), days: 30, site: { latitude: 51.5, longitude: -0.12, elevation: 0, label: "Private", source: "manual" } });
  const event = { ...events[0], title: "Moon, stars; test\nline", description: "ماه".repeat(80) };
  const calendar = eventsCalendar([event], Date.parse("2025-01-01Z"));
  assert.match(calendar, /DTSTAMP:20250101T000000Z/);
  assert.match(calendar, /Moon\\, stars\\; test\\nline/);
  for (const line of calendar.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(!calendar.includes("Private") && !calendar.includes("51.5") && !calendar.includes("local" + ":"));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
});
