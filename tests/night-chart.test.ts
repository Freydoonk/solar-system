import test from "node:test";
import assert from "node:assert/strict";
import { sampleNight } from "../src/components/observing/nightChart.ts";
import { skyPosition, TARGETS, type Site } from "../src/components/observing/observing.ts";
import { MAX_TIME } from "../src/components/solar-system/astronomy.ts";
const site: Site = { latitude: -33.9, longitude: 151.2, elevation: 0, label: "Test", source: "manual" };
test("chart samples match pointing geometry, include Moon and preserve a fixed time range", () => {
  const start = Date.parse("2026-10-26T12:00Z");
  const samples = sampleNight({ site, start });
  assert.equal(samples.length, 97);
  assert.equal(samples.at(-1)?.time, start + 86400000);
  for (const sample of [samples[0], samples[48], samples[96]]) for (const body of TARGETS) {
    const position = skyPosition(body, site, sample.time);
    assert.equal(sample.altitudes[body], position.geometricAltitude);
    assert.equal(sample.sun, position.sunAltitude);
  }
  assert.equal(sampleNight({ site, start: MAX_TIME - 1000 }).at(-1)?.time, MAX_TIME);
  assert.throws(() => sampleNight({ site, start: NaN }));
});
