import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { getBodyOrientation, getOrbitGuides, getPositions, type Vec3 } from "../src/components/solar-system/astronomy.ts";
import { createSceneLayout, moonOrbitRadius, planetOrbitRadius } from "../src/components/solar-system/layout.ts";
import { BODY_PRESETS } from "../src/components/solar-system/planets.ts";
import { BODY_ENVELOPES, fitDistance, followOffset, getSpacePositions, projectToSpace, toWorld } from "../src/components/solar-system/space.ts";

const guides = getOrbitGuides(2026);
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const planets = BODY_PRESETS.filter((body) => !body.parentId);
const moons = BODY_PRESETS.filter((body) => body.parentId);
const layout = createSceneLayout(guides, 1000, 1, "true", 1, BODY_ENVELOPES, true);

test("3D projection preserves the entire orbit shape, eccentricity and inclination", () => {
  for (const body of planets) {
    const factors = guides[body.id].map((point) => {
      const actual = toWorld(point);
      const projected = projectToSpace(body.id, point, layout);
      const factor = length(projected) / length(actual);
      for (const axis of ["x", "y", "z"] as const) assert.ok(Math.abs(projected[axis] - actual[axis] * factor) < 1e-9);
      return factor;
    });
    // A single linear factor per orbit preserves a focus at the Sun, rather
    // than squeezing the perihelion/aphelion distances into a circular band.
    assert.ok(Math.max(...factors) - Math.min(...factors) < 1e-9, body.id);
  }
  const mercury = guides.mercury.map(length);
  assert.ok(Math.max(...mercury) / Math.min(...mercury) > 1.4);
  const pluto = guides.pluto.map((p) => Math.abs(p.z) / length(p));
  assert.ok(Math.max(...pluto) > 0.25, "Pluto's inclined orbit is not flattened");
});

test("elliptical planet bands reserve all moon systems AND Saturn/Uranus rings", () => {
  for (const size of [0.5, 1, 3]) for (const mode of ["true", "readable"] as const) {
    const scene = createSceneLayout(guides, 1000, size, mode, 1, BODY_ENVELOPES, true);
    let previousOuter = 2.5;
    for (const planet of planets) {
      const inner = planetOrbitRadius(planet.id, 0, scene) - scene.systemRadii[planet.id];
      const outer = planetOrbitRadius(planet.id, Number.MAX_VALUE, scene) + scene.systemRadii[planet.id];
      assert.ok(inner > previousOuter, planet.id);
      previousOuter = outer;
      let parentEdge = scene.bodyRadii[planet.id] * (BODY_ENVELOPES[planet.id] ?? 1);
      for (const moon of moons.filter((item) => item.parentId === planet.id).sort((a, b) => a.semiMajorKm - b.semiMajorKm)) {
        assert.ok(moonOrbitRadius(moon.id, 0, scene) - scene.bodyRadii[moon.id] > parentEdge, moon.id);
        parentEdge = moonOrbitRadius(moon.id, Number.MAX_VALUE, scene) + scene.bodyRadii[moon.id];
      }
    }
    assert.ok(previousOuter <= 1000 + 1e-9);
  }
});

test("date jumps preserve camera-relative framing for every body, including tiny moons", () => {
  const first = getSpacePositions(getPositions(new Date("2024-04-08T18:00:00Z")), layout);
  const next = getSpacePositions(getPositions(new Date("2100-12-31T00:00:00Z")), layout);
  for (const body of BODY_PRESETS) {
    const distance = fitDistance(layout.bodyRadii[body.id], 0.5);
    const camera = new Vector3(first[body.id].x + distance, first[body.id].y, first[body.id].z);
    const delta = followOffset(first[body.id], next[body.id]);
    camera.add(new Vector3(delta.x, delta.y, delta.z));
    assert.ok(Math.abs(camera.distanceTo(new Vector3(next[body.id].x, next[body.id].y, next[body.id].z)) - distance) < 1e-9, body.id);
    if (body.parentId) {
      const parent = next[body.parentId];
      const separation = length({ x: next[body.id].x - parent.x, y: next[body.id].y - parent.y, z: next[body.id].z - parent.z });
      assert.ok(separation + layout.bodyRadii[body.id] <= layout.systemRadii[body.parentId] + 1e-8);
    }
  }
});

test("camera fitting keeps the body inside portrait and landscape frustums", () => {
  for (const aspect of [0.4, 1, 2.5]) for (const radius of [0.001, 3, 1000]) {
    const distance = fitDistance(radius, aspect);
    const camera = new PerspectiveCamera(45, aspect, radius * 0.001, 100000);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    for (let i = 0; i <= 180; i++) {
      const angle = i * Math.PI / 90;
      for (const point of [new Vector3(radius * Math.cos(angle), 0, radius * Math.sin(angle)),
        new Vector3(0, radius * Math.cos(angle), radius * Math.sin(angle))]) {
        const projected = point.project(camera);
        assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1);
      }
    }
  }
});

test("body poles are unit vectors and Earth rotation advances with the shared date", () => {
  const start = new Date("2026-10-19T00:00:00Z");
  for (const body of ["sun", "moon", ...planets.map((item) => item.id)]) {
    const orientation = getBodyOrientation(body, start)!;
    assert.ok(Math.abs(length(orientation.north) - 1) < 1e-10, body);
    assert.ok(Number.isFinite(orientation.spin));
  }
  const first = getBodyOrientation("earth", start)!;
  const next = getBodyOrientation("earth", new Date(start.getTime() + 6 * 3600000))!;
  const angle = (next.spin - first.spin + 2 * Math.PI) % (2 * Math.PI);
  assert.ok(Math.abs(angle - Math.PI / 2) < 0.01);
});
