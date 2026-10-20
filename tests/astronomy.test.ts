import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceTime, DAY_MS, getMoonAppearance, getPositions, getSeasonEvents,
  getSeasons, MAX_TIME, MIN_TIME, moonPhasePath, parseSimulationDate,
} from "../src/components/solar-system/astronomy.ts";
import { BODY_PRESETS, EARTH_RADIUS_KM, SUN_RADIUS_KM } from "../src/components/solar-system/planets.ts";
import { kmToWorld } from "../src/components/solar-system/space.ts";

function near(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

test("physical size ratios include the Sun and tiny moons without a minimum body size", () => {
  const earth = kmToWorld(EARTH_RADIUS_KM);
  near(kmToWorld(SUN_RADIUS_KM) / earth, 109.2, 0.01);
  near(kmToWorld(1737.4) / earth, 0.2727, 0.0001);
  near(kmToWorld(69911) / earth, 10.973, 0.001);
  assert.ok(kmToWorld(6.2) < earth / 1000);
});

test("UTC date input validates leap days, year limits and empty/partial edits", () => {
  assert.equal(parseSimulationDate("2024-02-29", "23:45"), Date.parse("2024-02-29T23:45:00Z"));
  assert.equal(parseSimulationDate("1900-01-01", "00:00"), MIN_TIME);
  assert.equal(parseSimulationDate("2100-12-31", "23:59"), MAX_TIME - 59999);
  for (const date of ["", "2024-02", "2023-02-29", "1900-02-29", "2024-04-31", "1899-12-31", "2101-01-01"]) {
    assert.equal(parseSimulationDate(date, "12:00"), null, date);
  }
  for (const time of ["", "12:", "24:00", "12:99"]) assert.equal(parseSimulationDate("2024-04-08", time), null);
});

test("one clock advances independently of frame rate and stops at supported boundaries", () => {
  const start = Date.parse("2024-02-28T12:00:00Z");
  near(advanceTime(start, 1, 1 / 86400) - start, 1000, 0.001);
  assert.equal(advanceTime(start, 2, 1), Date.parse("2024-03-01T12:00:00Z"));
  let at30fps = start;
  let at60fps = start;
  for (let i = 0; i < 30; i++) at30fps = advanceTime(at30fps, 1 / 30, 5);
  for (let i = 0; i < 60; i++) at60fps = advanceTime(at60fps, 1 / 60, 5);
  near(at30fps, at60fps, 0.1);
  assert.equal(advanceTime(MAX_TIME - 1000, 2, 5), MAX_TIME);
  assert.equal(advanceTime(MIN_TIME, -1, 5), MIN_TIME);
});

test("date-based positions are deterministic, with Earth near its J2000 reference vector", () => {
  const date = new Date("2000-01-01T12:00:00Z");
  const first = getPositions(date);
  getPositions(new Date("2090-04-01T00:00:00Z"));
  assert.deepEqual(getPositions(date), first);
  // J2000 heliocentric ecliptic coordinates, in AU (JPL approximate elements).
  near(first.earth.x, -0.1772, 0.001);
  near(first.earth.y, 0.9672, 0.001);
  near(Math.hypot(first.moon.x, first.moon.y), 0.00257, 0.0003);
  for (const time of [MIN_TIME, MAX_TIME]) {
    const positions = getPositions(new Date(time));
    for (const body of BODY_PRESETS) {
      assert.ok(Number.isFinite(positions[body.id].x), body.id);
      assert.ok(Number.isFinite(positions[body.id].y), body.id);
    }
  }
});

test("orbital rates are physical: one Earth day is not the same angle for each planet", () => {
  const start = new Date("2024-01-01T00:00:00Z");
  const before = getPositions(start);
  const after = getPositions(new Date(start.getTime() + DAY_MS));
  function angleChange(id: string) {
    const difference = Math.atan2(after[id].y, after[id].x) - Math.atan2(before[id].y, before[id].x);
    return Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) * 180 / Math.PI;
  }
  near(angleChange("earth"), 0.986, 0.05);
  near(angleChange("jupiter"), 0.083, 0.012);
  near(angleChange("moon"), 13.2, 2);
  assert.ok(angleChange("mercury") > angleChange("earth") * 2);
  assert.ok(angleChange("neptune") < angleChange("earth") / 100);
});

test("the April 2024 eclipse is a new Moon; March full Moon and first quarter agree", () => {
  const eclipse = getMoonAppearance(new Date("2024-04-08T18:21:00Z"));
  assert.equal(eclipse.name, "New moon");
  assert.ok(eclipse.illumination < 0.001);
  const full = getMoonAppearance(new Date("2024-03-25T07:00:00Z"));
  assert.equal(full.name, "Full moon");
  assert.ok(full.illumination > 0.999);
  const quarter = getMoonAppearance(new Date("2024-03-17T04:11:00Z"));
  assert.equal(quarter.name, "First quarter");
  near(quarter.illumination, 0.5, 0.003);
});

test("the Moon graphic fills the correct half for waxing and waning quarters", () => {
  const xValues = (path: string) => [...path.matchAll(/(?:M|L)([\d.e+-]+),/g)].map((match) => Number(match[1]));
  const waxing = xValues(moonPhasePath(90, 0.5));
  const waning = xValues(moonPhasePath(270, 0.5));
  near(Math.min(...waxing), 50, 1e-8);
  near(Math.max(...waxing), 94, 1e-8);
  near(Math.min(...waning), 6, 1e-8);
  near(Math.max(...waning), 50, 1e-8);
});

test("seasons switch at astronomical events, including opposite southern seasons", () => {
  const events = getSeasonEvents(2024);
  // Published UTC equinox/solstice times rounded to the minute:
  // https://aa.usno.navy.mil/data/Earth_Seasons
  const expected = ["2024-03-20T03:06Z", "2024-06-20T20:51Z", "2024-09-22T12:44Z", "2024-12-21T09:20Z"];
  expected.forEach((time, index) => near(events[index].time, Date.parse(time), 90_000));
  const preceding = ["Winter", "Spring", "Summer", "Autumn"];
  for (const [index, event] of events.entries()) {
    assert.equal(getSeasons(event.time - 1, events).north, preceding[index]);
    assert.equal(getSeasons(event.time, events).north, event.north);
    assert.equal(getSeasons(event.time + 1, events).south, event.south);
    assert.notEqual(event.north, event.south);
  }
  assert.equal(getSeasons(Date.parse("2025-01-01T00:00:00Z"), getSeasonEvents(2025)).north, "Winter");
});
