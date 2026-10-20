import test from "node:test";
import assert from "node:assert/strict";
import { getOrbitGuides, getPositions } from "../src/components/solar-system/astronomy.ts";
import { createPlaneLayout, planeFocusZoom, planeFrameZoom, projectPlane } from "../src/components/solar-system/layout.ts";
import { BODY_PRESETS } from "../src/components/solar-system/planets.ts";
import { BODY_ENVELOPES, createPhysicalLayout, getMoonGuide, getSpacePositions, projectToSpace } from "../src/components/solar-system/space.ts";
import { MAX_ZOOM } from "../src/components/solar-system/viewport.ts";

const guides = getOrbitGuides(2026);
const physical = createPhysicalLayout(guides);
const positions = getPositions(new Date("2026-10-20T00:00:00Z"));
const space = getSpacePositions(positions);

test("2D sizes and projected separations always share the 3D physical scale", () => {
  for (const extent of [90, 250, 600]) for (const zoom of [0.5, 1, 1e3, 1e7, MAX_ZOOM]) {
    const plane = createPlaneLayout(physical, extent, zoom);
    for (const [id, position] of Object.entries(space)) {
      const point = projectPlane(position, plane);
      const ratio = Math.hypot(point.x, point.y) / plane.bodyRadii[id];
      const expected = Math.hypot(position.x, position.z) / physical.bodyRadii[id];
      assert.ok(Math.abs(ratio - expected) < Math.max(1, expected) * 1e-12, id);
      assert.ok(Math.abs(plane.bodyRadii[id] / plane.bodyRadii.sun - physical.bodyRadii[id] / physical.bodyRadii.sun) < 1e-12);
    }
  }
});

test("2D overview fits all sampled planetary orbits without remapping their geometry", () => {
  const plane = createPlaneLayout(physical, 250, 1);
  for (const points of Object.values(guides)) for (const point of points) {
    const world = projectToSpace(point);
    const projected = projectPlane(world, plane);
    assert.ok(Math.hypot(projected.x, projected.y) <= 250);
    assert.equal(projected.x, world.x * plane.scale);
    assert.equal(projected.y, world.z * plane.scale);
  }
});

test("every 2D body can be framed, including the Sun and smallest moons", () => {
  for (const id of Object.keys(space)) {
    const zoom = planeFocusZoom(id, physical);
    assert.ok(zoom <= MAX_ZOOM, id);
    const plane = createPlaneLayout(physical, 250, zoom);
    assert.deepEqual(projectPlane(space[id], plane, space[id]), { x: 0, y: 0 });
    assert.ok(Math.abs(plane.bodyRadii[id] * (BODY_ENVELOPES[id] ?? 1) - 137.5) < 1e-8, id);
  }
  assert.equal(planeFocusZoom(null, physical), 1);
  for (const [width, height] of [[360, 640], [640, 360], [1200, 900]]) {
    const extent = Math.min(width - 120, height - 180) / 2;
    const shortSide = Math.min(width, height);
    const zoom = planeFrameZoom("earth", physical, extent, shortSide, 0.15);
    const plane = createPlaneLayout(physical, extent, zoom);
    assert.ok(Math.abs(plane.bodyRadii.earth * 2 / shortSide - 0.15) < 1e-12);
  }
});

test("2D Moon-parent separation and guide radius are not enlarged for legibility", () => {
  const plane = createPlaneLayout(physical, 250, 1e5);
  for (const moon of BODY_PRESETS.filter((body) => body.parentId)) {
    const offset = projectToSpace(positions[moon.id]);
    const shown = projectPlane(space[moon.id], plane, space[moon.parentId!]);
    assert.ok(Math.abs(shown.x - offset.x * plane.scale) < 1e-6, moon.id);
    assert.ok(Math.abs(shown.y - offset.z * plane.scale) < 1e-6, moon.id);
    const guide = getMoonGuide(positions[moon.id]);
    assert.deepEqual(guide[0], offset);
    for (const point of guide) {
      assert.ok(Math.abs(Math.hypot(point.x, point.y, point.z) - Math.hypot(offset.x, offset.y, offset.z)) < 1e-10);
    }
  }
});
