import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { getBodyOrientation, getOrbitGuides, getPositions, type Vec3 } from "../src/components/solar-system/astronomy.ts";
import { AU_KM, BODY_PRESETS, SUN_RADIUS_KM } from "../src/components/solar-system/planets.ts";
import { auToWorld, cameraNearPlane, createPhysicalLayout, fitDistance, followOffset, getSpacePositions, INITIAL_CAMERA_REQUEST, KM_PER_WORLD_UNIT, kmToWorld, projectToSpace, relativeToOrigin, renderScaleForDistance, toWorld } from "../src/components/solar-system/space.ts";

const guides = getOrbitGuides(2026);
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const planets = BODY_PRESETS.filter((body) => !body.parentId);
const moons = BODY_PRESETS.filter((body) => body.parentId);
const layout = createPhysicalLayout(guides);

function near(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
}

test("Sun, all body radii and every distance share one physical unit conversion", () => {
  near(layout.bodyRadii.sun, SUN_RADIUS_KM / KM_PER_WORLD_UNIT);
  for (const body of BODY_PRESETS) {
    near(layout.bodyRadii[body.id] / layout.bodyRadii.sun, body.radiusKm / SUN_RADIUS_KM);
    for (const point of guides[body.id] ?? [{ x: body.semiMajorKm / AU_KM, y: 0, z: 0 }]) {
      near(length(projectToSpace(point)) / layout.bodyRadii[body.id],
        length(point) * AU_KM / body.radiusKm, 1e-6);
    }
  }
  near(kmToWorld(384400) / layout.bodyRadii.earth, 384400 / 6371.0084);
  near(auToWorld(1) / layout.bodyRadii.sun, AU_KM / SUN_RADIUS_KM);
  near(layout.bodyRadii.deimos, 6.2 / KM_PER_WORLD_UNIT, 1e-15);
});

test("3D projection preserves the entire orbit shape, eccentricity and inclination", () => {
  for (const body of planets) {
    const factors = guides[body.id].map((point) => {
      const actual = toWorld(point);
      const projected = projectToSpace(point);
      const factor = length(projected) / length(actual);
      near(factor, auToWorld(1));
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

test("full physical Sun stays clear of every planet and its entire moon system", () => {
  for (const year of [1900, 1950, 2000, 2026, 2050, 2100]) {
    const orbits = getOrbitGuides(year);
    const scene = createPhysicalLayout(orbits);
    for (const planet of planets) {
      for (const point of orbits[planet.id]) {
        const distance = length(projectToSpace(point));
        assert.ok(distance - scene.systemRadii[planet.id] > scene.bodyRadii.sun, `${planet.id} in ${year}`);
        assert.ok(distance + scene.systemRadii[planet.id] <= scene.outerRadius + 1e-8);
      }
    }
  }
});

test("moon offsets use their true parent-relative distances, without inflated bands", () => {
  for (const date of ["1900-01-01", "2000-01-01", "2020-12-21", "2026-10-20", "2100-12-31"]) {
    const positions = getPositions(new Date(`${date}T12:00:00Z`));
    const displayed = getSpacePositions(positions);
    for (const moon of moons) {
      const offset = relativeToOrigin(displayed[moon.id], displayed[moon.parentId!]);
      near(length(offset), length(positions[moon.id]) * AU_KM / KM_PER_WORLD_UNIT);
      assert.ok(length(offset) > layout.bodyRadii[moon.parentId!] + layout.bodyRadii[moon.id]);
    }
    for (const body of BODY_PRESETS) assert.ok(length(displayed[body.id]) > layout.bodyRadii.sun + layout.bodyRadii[body.id]);
  }
});

test("date jumps preserve camera-relative framing for every body, including tiny moons", () => {
  const first = getSpacePositions(getPositions(new Date("2024-04-08T18:00:00Z")));
  const next = getSpacePositions(getPositions(new Date("2100-12-31T00:00:00Z")));
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
  for (const aspect of [0.4, 1, 2.5]) for (const radius of [layout.bodyRadii.deimos, layout.bodyRadii.sun, layout.outerRadius]) {
    const distance = fitDistance(radius, aspect);
    const camera = new PerspectiveCamera(45, aspect, cameraNearPlane(radius), distance * 4);
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

test("initial Earth framing projects to 15% of the shorter viewport side", () => {
  const request = INITIAL_CAMERA_REQUEST;
  assert.equal(request.bodyId, "earth");
  const radius = layout.bodyRadii[request.bodyId!];
  for (const [width, height] of [[360, 640], [640, 360], [800, 800], [1600, 900]]) {
    const aspect = width / height;
    const distance = fitDistance(radius, aspect, 45, request.screenFraction);
    const camera = new PerspectiveCamera(45, aspect, cameraNearPlane(radius), distance * 4);
    camera.position.z = distance;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    let halfWidth = 0;
    let halfHeight = 0;
    for (let i = 0; i < 2048; i++) {
      const angle = i * 2 * Math.PI / 2048;
      const xz = new Vector3(radius * Math.cos(angle), 0, radius * Math.sin(angle)).project(camera);
      const yz = new Vector3(0, radius * Math.cos(angle), radius * Math.sin(angle)).project(camera);
      halfWidth = Math.max(halfWidth, Math.abs(xz.x));
      halfHeight = Math.max(halfHeight, Math.abs(yz.y));
    }
    near(halfWidth * width / Math.min(width, height), 0.15, 1e-6);
    near(halfHeight * height / Math.min(width, height), 0.15, 1e-6);
  }
});

test("render rebasing and a common unit change preserve framing at tiny-moon scale", () => {
  const positions = getSpacePositions(getPositions(new Date("2026-10-20T00:00:00Z")));
  for (const id of ["sun", "earth", "deimos", "triton", "pluto"]) {
    const radius = layout.bodyRadii[id];
    const distance = fitDistance(radius, 1);
    const factor = renderScaleForDistance(distance);
    const origin = positions[id];
    const center = relativeToOrigin(origin, origin);
    assert.deepEqual(center, { x: 0, y: 0, z: 0 });
    const nearPlane = cameraNearPlane(radius) * factor;
    assert.ok(nearPlane < (distance - radius) * factor);
    // Log depth and float32 vertex transforms retain detail in a close view.
    const frontDepth = Math.fround(1 + (distance - radius) * factor);
    const backDepth = Math.fround(1 + (distance + radius) * factor);
    assert.ok(backDepth - frontDepth > 0.1);
    near((radius * factor) / (distance * factor), radius / distance);
    for (const other of ["sun", "earth", "deimos", "pluto"]) {
      const offset = relativeToOrigin(positions[other], origin);
      near(length(offset) * factor / (layout.bodyRadii[other] * factor),
        length(offset) / layout.bodyRadii[other], 0.01);
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
