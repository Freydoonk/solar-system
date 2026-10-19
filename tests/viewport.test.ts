import test from "node:test";
import assert from "node:assert/strict";
import { getOrbitGuides, getPositions } from "../src/components/solar-system/astronomy.ts";
import { createSceneLayout, projectMoon, projectPlanet } from "../src/components/solar-system/layout.ts";
import { MAX_ZOOM, MIN_ZOOM, zoomWithWheel } from "../src/components/solar-system/viewport.ts";

const initial = { zoom: 1, pan: { x: 73, y: -41 } };
const pointer = { x: 140, y: -90 };

test("wheel direction and pixel/line/page deltas produce consistent zoom", () => {
  assert.ok(zoomWithWheel(initial, pointer, -96, 0, 600).zoom > initial.zoom);
  assert.ok(zoomWithWheel(initial, pointer, 96, 0, 600).zoom < initial.zoom);
  const pixels = zoomWithWheel(initial, pointer, -96, 0, 600);
  assert.deepEqual(zoomWithWheel(initial, pointer, -6, 1, 600), pixels);
  assert.deepEqual(zoomWithWheel(initial, pointer, -0.16, 2, 600), pixels);
  assert.equal(zoomWithWheel(initial, pointer, 0, 0, 600), initial);
});

test("wheel zoom stops at both limits without drifting the view", () => {
  for (const [delta, limit] of [[-1000, MAX_ZOOM], [1000, MIN_ZOOM]]) {
    let view = initial;
    for (let step = 0; step < 20; step++) {
      view = zoomWithWheel(view, pointer, delta, 0, 600);
      assert.ok(view.zoom >= MIN_ZOOM && view.zoom <= MAX_ZOOM);
    }
    assert.equal(view.zoom, limit);
    assert.equal(zoomWithWheel(view, pointer, delta, 0, 600), view);
  }
});

test("rendered planets and moons stay under the mouse when zooming an already panned scene", () => {
  const guides = getOrbitGuides(2026);
  const positions = getPositions(new Date("2026-10-19T12:00:00Z"));
  function point(id: string, parentId: string | null, zoom: number) {
    const layout = createSceneLayout(guides, 250, 1, "true", zoom);
    if (!parentId) return projectPlanet(id, positions[id], layout);
    const parent = projectPlanet(parentId, positions[parentId], layout);
    const moon = projectMoon(id, positions[id], layout);
    return { x: parent.x + moon.x, y: parent.y + moon.y };
  }
  for (const [id, parentId] of [["earth", null], ["jupiter", null], ["moon", "earth"], ["io", "jupiter"]] as const) {
    const before = point(id, parentId, initial.zoom);
    const anchor = { x: initial.pan.x + before.x, y: initial.pan.y + before.y };
    let view = initial;
    for (const delta of [-100, -100, 100, 100]) {
      view = zoomWithWheel(view, anchor, delta, 0, 600);
      const after = point(id, parentId, view.zoom);
      assert.ok(Math.abs(view.pan.x + after.x - anchor.x) < 1e-8, `${id} horizontal anchor`);
      assert.ok(Math.abs(view.pan.y + after.y - anchor.y) < 1e-8, `${id} vertical anchor`);
    }
    assert.ok(Math.abs(view.pan.x - initial.pan.x) < 1e-8);
    assert.ok(Math.abs(view.pan.y - initial.pan.y) < 1e-8);
  }
});
