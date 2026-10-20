import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import { Mesh, Texture, Vector3 } from "three";
import { getBodyOrientation, getPositions } from "../src/components/solar-system/astronomy.ts";
import { applyBodyOrientation, createBodyVisual } from "../src/components/solar-system/bodyVisuals.ts";
import { toWorld } from "../src/components/solar-system/space.ts";

function earthVisual(t: TestContext) {
  const maps: Texture[] = [];
  const earth = createBodyVisual("earth", () => {
    const map = new Texture();
    maps.push(map);
    return map;
  }, () => {}, { value: new Vector3() });
  t.after(() => {
    maps.forEach((map) => map.dispose());
    earth.root.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  });
  return earth;
}

// Find the actual mesh normal at the closest map vertex. The bundled maps run
// west-to-east (-180..180), north-to-south; Greenwich lies at texture u = 0.5.
function mapLocation(earth: ReturnType<typeof earthVisual>, latitude: number, longitude: number) {
  const uv = earth.surface.geometry.getAttribute("uv");
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < uv.count; i++) {
    const distance = (uv.getX(i) - (longitude + 180) / 360) ** 2
      + (uv.getY(i) - (latitude + 90) / 180) ** 2;
    if (distance < best) { best = distance; nearest = i; }
  }
  return {
    observer: new Observer(uv.getY(nearest) * 180 - 90, uv.getX(nearest) * 360 - 180, 0),
    normal: new Vector3().fromBufferAttribute(earth.surface.geometry.getAttribute("normal"), nearest)
      .transformDirection(earth.surface.matrixWorld),
  };
}

function solarAltitude(earth: ReturnType<typeof earthVisual>, date: Date, latitude: number, longitude: number) {
  applyBodyOrientation(earth, getBodyOrientation("earth", date)!);
  earth.root.updateMatrixWorld(true);
  const { observer, normal } = mapLocation(earth, latitude, longitude);
  const p = toWorld(getPositions(date).earth);
  const sun = new Vector3(p.x, p.y, p.z).negate().normalize();
  const rendered = Math.asin(normal.dot(sun)) * 180 / Math.PI;
  // Independent observer/horizon API, not the mesh's orientation calculation.
  const equator = Equator(Body.Sun, date, observer, true, true);
  const expected = Horizon(date, observer, equator.ra, equator.dec).altitude;
  return { rendered, expected };
}

test("Britain is sunlit on 20 October 2026 at 10:15 UTC and dark at midnight", (t) => {
  const earth = earthVisual(t);
  const day = solarAltitude(earth, new Date("2026-10-20T10:15:00Z"), 54, 0);
  assert.ok(day.rendered > 20, `Britain should be in daylight, got solar altitude ${day.rendered}`);
  assert.ok(Math.abs(day.rendered - day.expected) < 0.03);
  const night = solarAltitude(earth, new Date("2026-10-20T00:15:00Z"), 54, 0);
  assert.ok(night.rendered < -40);
  assert.ok(Math.abs(night.rendered - night.expected) < 0.03);
});

test("mapped day/night matches the local solar horizon across dates and longitudes", (t) => {
  const earth = earthVisual(t);
  const dates = [
    "1900-01-01", "2000-03-20", "2026-03-29", "2026-06-21",
    "2026-09-23", "2026-10-25", "2026-12-21", "2100-12-31",
  ];
  const locations = [[51.48, 0], [40.7, -74], [35.7, 139.7], [-33.9, 151.2], [0, 0], [0, 180], [78, 16], [-78, 16]];
  for (const day of dates) for (const hour of ["00", "06", "12", "18"]) {
    const date = new Date(`${day}T${hour}:00:00Z`);
    for (const [latitude, longitude] of locations) {
      const { rendered, expected } = solarAltitude(earth, date, latitude, longitude);
      assert.ok(Math.abs(rendered - expected) < 0.03,
        `${date.toISOString()} (${latitude}, ${longitude}): rendered ${rendered}, expected ${expected}`);
    }
    // Cloud and day/night maps stay registered to the same terrestrial frame.
    assert.ok(earth.surface.quaternion.equals(earth.clouds!.quaternion));
  }
});
