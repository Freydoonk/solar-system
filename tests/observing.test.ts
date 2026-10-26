import test from "node:test";
import assert from "node:assert/strict";
import { Body, Equator, Horizon, Observer, SiderealTime } from "astronomy-engine";
import { angularSeparation, dateInputValue, directionName, formatRA, observerFor, parseObservationTime, searchOpportunities, skyPosition, validSite, type Site } from "../src/components/observing/observing.ts";

const london: Site = { latitude: 51.5, longitude: -0.12, elevation: 30, label: "London", source: "manual" };

test("pointing is topocentric, equator-of-date and measured clockwise from true north", () => {
  for (const site of [london, { ...london, latitude: -33.9, longitude: 151.2 }, { ...london, latitude: 0, longitude: 0 }]) {
    for (const date of ["2000-01-01T12:00Z", "2026-10-26T22:00Z", "2100-01-01T00:00Z"]) {
      for (const body of [Body.Moon, Body.Saturn, Body.Venus] as const) {
        const time = Date.parse(date);
        const position = skyPosition(body, site, time);
        const angle = (SiderealTime(new Date(time)) * 15 + site.longitude - position.ra * 15) * Math.PI / 180;
        const dec = position.dec * Math.PI / 180;
        const lat = site.latitude * Math.PI / 180;
        const altitude = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(angle)) * 180 / Math.PI;
        const azimuth = (Math.atan2(-Math.sin(angle), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(angle)) * 180 / Math.PI + 360) % 360;
        assert.ok(Math.abs(altitude - position.geometricAltitude) < 0.001);
        assert.ok(Math.abs(azimuth - position.azimuth) < 0.001);
        assert.ok(position.altitude >= position.geometricAltitude - 1e-8);
        const j2000 = Equator(body, new Date(time), observerFor(site), false, true);
        assert.equal(position.j2000Ra, j2000.ra);
        assert.equal(position.j2000Dec, j2000.dec);
      }
    }
  }
  assert.equal(directionName(0), "N");
  assert.equal(directionName(90), "E");
  assert.equal(directionName(270), "W");
  assert.equal(directionName(359), "N");
  assert.equal(formatRA(23.99999999), "0h 0m 0s");
});

test("direction lookup wraps north correctly and accounts for altitude", () => {
  assert.ok(Math.abs(angularSeparation({ azimuth: 359, altitude: 0 }, { azimuth: 1, altitude: 0 }) - 2) < 1e-8);
  assert.ok(angularSeparation({ azimuth: 0, altitude: 90 }, { azimuth: 180, altitude: 90 }) < 1e-8);
  assert.ok(Math.abs(angularSeparation({ azimuth: 90, altitude: 0 }, { azimuth: 90, altitude: 45 }) - 45) < 1e-8);
});

test("observing windows are ordered, dark, high enough and place best time within the window", () => {
  const start = Date.parse("2026-10-26T12:00Z");
  const windows = searchOpportunities({ body: Body.Saturn, site: london, start, days: 7 });
  assert.ok(windows.length > 0 && windows.length <= 5);
  let previous = start;
  for (const window of windows) {
    assert.ok(window.start >= previous && window.end > window.start && window.end <= start + 7 * 86400000);
    assert.ok(window.best >= window.start && window.best <= window.end);
    for (const time of [window.start + 1000, (window.start + window.end) / 2, window.best, window.end - 1000]) {
      const position = skyPosition(Body.Saturn, london, time);
      assert.ok(position.geometricAltitude >= 19.99);
      assert.ok(position.sunAltitude <= -5.99);
      assert.ok(position.sunSeparation > 20);
    }
    assert.ok(Math.abs(window.altitude - skyPosition(Body.Saturn, london, window.best).geometricAltitude) < 1e-8);
    previous = window.end;
  }
});

test("polar daylight has no invented observing window; southern observers work too", () => {
  assert.deepEqual(searchOpportunities({ body: Body.Saturn, site: { ...london, latitude: 89 }, start: Date.parse("2026-06-10T00:00Z"), days: 7 }), []);
  const south = { ...london, latitude: -33.9, longitude: 151.2 };
  const windows = searchOpportunities({ body: Body.Saturn, site: south, start: Date.parse("2026-10-26T00:00Z"), days: 7 });
  assert.ok(windows.length > 0);
  for (const window of windows) assert.equal(skyPosition(Body.Saturn, south, window.best).suitable, true);
});

test("coordinates and supported time ranges reject invalid input, including calendar rollovers", () => {
  assert.ok(validSite(london));
  for (const site of [{ ...london, latitude: 91 }, { ...london, longitude: NaN }, { ...london, elevation: Infinity }]) {
    assert.equal(validSite(site), false);
    assert.throws(() => observerFor(site));
  }
  assert.equal(parseObservationTime("2026-02-30T12:00", true), null);
  assert.equal(parseObservationTime("1899-12-31T23:59", true), null);
  assert.equal(parseObservationTime("2026-10-26T22:15", true), Date.parse("2026-10-26T22:15Z"));
  const time = Date.parse("2026-10-26T22:15Z");
  assert.equal(parseObservationTime(dateInputValue(time, false), false), time);
  assert.throws(() => searchOpportunities({ body: Body.Saturn, site: london, start: time, days: 0 }));
  assert.throws(() => skyPosition(Body.Sun as never, london, time));
  const moon = skyPosition(Body.Moon, london, time);
  const eq = Equator(Body.Sun, new Date(time), new Observer(london.latitude, london.longitude, london.elevation), true, true);
  assert.equal(moon.sunAltitude, Horizon(new Date(time), observerFor(london), eq.ra, eq.dec).altitude);
});

test("local date input handles skipped and repeated UK daylight-saving times explicitly", () => {
  const previousZone = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    assert.equal(parseObservationTime("2026-03-29T01:30", false), null);
    assert.equal(parseObservationTime("2026-10-25T01:30", false), Date.parse("2026-10-25T00:30Z"));
    assert.equal(parseObservationTime("2026-10-25T01:30", true), Date.parse("2026-10-25T01:30Z"));
    assert.equal(dateInputValue(Date.parse("2026-06-01T12:00Z"), false), "2026-06-01T13:00");
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});
