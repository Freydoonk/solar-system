import test from "node:test";
import assert from "node:assert/strict";
import { SiderealTime } from "astronomy-engine";
import stars from "../src/components/observing/catalogue/stars.json" with { type: "json" };
import messier from "../src/components/observing/catalogue/deep-sky.json" with { type: "json" };
import { atlasFrame, referenceStars, skyProject } from "../src/components/observing/skyAtlas.ts";
const site = { latitude: 51.5, longitude: 0, elevation: 0, label: "Test", source: "manual" as const };
test("catalogue identifiers and coordinates are valid, with recognizable reference positions", () => {
  assert.equal(new Set(stars.map(star => star.id)).size, stars.length);
  assert.equal(messier.length, 110);
  for (const star of stars) { assert.ok(star.ra >= 0 && star.ra <= 24 && Math.abs(star.dec) <= 90); assert.ok(star.mag <= 6); }
  const sirius = stars.find(star => star.name === "Sirius")!;
  assert.ok(Math.abs(sirius.ra - 6.7525) < 0.001 && Math.abs(sirius.dec + 16.716) < 0.001);
  const m4 = messier.find(object => object.id === "M4")!;
  assert.ok(Math.abs(((m4.geometry.coordinates[0] + 360) % 360) - 245.9) < 0.1);
});
test("atlas geometry matches spherical horizon formula at multiple dates and hemispheres", () => {
  for (const latitude of [51.5, -33.9, 89]) for (const year of [1900, 2026, 2100]) {
    const time = Date.parse(`${year}-06-01T22:00Z`);
    const frame = atlasFrame({ ...site, latitude }, time);
    for (const name of ["Sirius", "Polaris", "Vega"]) {
      const position = frame.star(stars.find(star => star.name === name)!);
      const r = Math.PI / 180;
      const angle = (SiderealTime(new Date(time)) * 15 - position.ra * 15) * r;
      const expected = Math.asin(Math.sin(latitude * r) * Math.sin(position.dec * r) + Math.cos(latitude * r) * Math.cos(position.dec * r) * Math.cos(angle)) / r;
      assert.ok(Math.abs(expected - position.altitude) < 1e-8);
    }
  }
  assert.deepEqual(skyProject(0, 90), { x: 250, y: 250 });
  assert.equal(skyProject(90, 0).x, 470);
  assert.equal(skyProject(0, 0).y, 30);
  const references = referenceStars({ id: "target", azimuth: 359, altitude: 30 }, [{ id: "near", mag: 2, azimuth: 1, altitude: 30 }, { id: "hidden", mag: 1, azimuth: 0, altitude: -1 }]);
  assert.equal(references.length, 1); assert.ok(references[0].separation < 2);
});
