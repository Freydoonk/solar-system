import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { getPositions, type Vec3 } from "../src/components/solar-system/astronomy.ts";
import { createFollowLock, sunViewMinimumDistance, sunViewOffset } from "../src/components/solar-system/following.ts";
import { BODY_PRESETS } from "../src/components/solar-system/planets.ts";
import { BODY_ENVELOPES, createPhysicalLayout, getSpacePositions, INITIAL_CAMERA_REQUEST } from "../src/components/solar-system/space.ts";

test("manual movement releases an angle lock until an explicit new selection, including late location responses", () => {
  const released: number[] = [];
  const lock = createFollowLock((serial) => released.push(serial));
  assert.equal(lock.mode(INITIAL_CAMERA_REQUEST), "region");
  lock.release(INITIAL_CAMERA_REQUEST);
  lock.release(INITIAL_CAMERA_REQUEST);
  assert.deepEqual(released, [0]);
  assert.equal(lock.mode(INITIAL_CAMERA_REQUEST), "free", "late region data cannot re-arm the same request");
  const mars = { ...INITIAL_CAMERA_REQUEST, bodyId: "mars", serial: 1, followMode: "sun" as const };
  assert.equal(lock.mode(mars), "sun");
  lock.release(mars);
  assert.equal(lock.mode(mars), "free");
  assert.equal(lock.mode({ ...mars, serial: 2 }), "sun");
  const remount = createFollowLock(() => assert.fail("free angle should not release again"));
  const free = { ...mars, followMode: "free" as const };
  assert.equal(remount.mode(free), "free", "parent preserves release through view remounts");
  remount.release(free);
});

function verifyView(id: string, positions: Record<string, Vec3>, radii: Record<string, number>, aspect: number, requestedDistance = 0) {
  const offset = sunViewOffset(id, positions, radii, requestedDistance, aspect);
  assert.ok(Number.isFinite(offset.length()) && offset.length() > radii[id]);
  const origin = new Vector3().copy(positions[id]);
  const camera = new PerspectiveCamera(45, aspect, radii[id] * 0.001, 1e6);
  camera.position.copy(offset);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const relative = Object.entries(positions).map(([bodyId, point]) => ({
    id: bodyId, center: new Vector3().copy(point).sub(origin), radius: radii[bodyId],
  }));
  for (const body of relative) {
    assert.ok(body.center.distanceTo(offset) > body.radius, `camera outside ${body.id} when following ${id}`);
  }
  for (const targetId of [id, "sun"]) {
    const target = relative.find((body) => body.id === targetId)!;
    const ray = target.center.clone().sub(offset).normalize();
    const distance = target.center.distanceTo(offset);
    for (const blocker of relative.filter((body) => body.id !== targetId)) {
      const toBlocker = blocker.center.clone().sub(offset);
      const along = toBlocker.dot(ray);
      if (along > 0 && along < distance) {
        assert.ok(toBlocker.addScaledVector(ray, -along).length() > blocker.radius,
          `${blocker.id} must not hide ${targetId} while following ${id}`);
      }
    }
    // Sample the actual spherical boundary, including the selected planet's ring envelope.
    const radius = target.radius * (targetId === id ? BODY_ENVELOPES[id] ?? 1 : 1);
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16;
      for (const point of [new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0),
        new Vector3(0, radius * Math.cos(angle), radius * Math.sin(angle))]) {
        point.add(target.center).project(camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z > -1 && point.z < 1,
          `${targetId} fits viewport ${aspect} while following ${id}`);
      }
    }
  }
  return offset;
}

test("every selectable planet and moon frames the Sun at true scale in phone and desktop views", () => {
  const { bodyRadii } = createPhysicalLayout({});
  for (const date of ["1900-01-01T00:00Z", "2026-10-20T12:00Z", "2100-12-31T00:00Z"]) {
    const positions = getSpacePositions(getPositions(new Date(date)));
    const original = structuredClone(positions);
    for (const body of BODY_PRESETS) for (const aspect of [0.4, 0.8, 1, 2.5]) {
      verifyView(body.id, positions, bodyRadii, aspect);
    }
    assert.deepEqual(positions, original, "camera framing never alters physical positions");
  }
});

test("a tiny moon eclipsed by its parent pulls back to clear both sight lines", () => {
  const positions = { sun: { x: 0, y: 0, z: 0 }, moon: { x: 150, y: 0, z: 0 }, parent: { x: 149.98, y: 0, z: 0 } };
  const radii = { sun: 0.696, moon: 0.0000062, parent: 0.007 };
  for (const aspect of [0.4, 1, 2.5]) {
    const offset = verifyView("moon", positions, radii, aspect);
    assert.ok(offset.length() > sunViewMinimumDistance("moon", radii, aspect) * 2);
    const next = sunViewOffset("moon", positions, radii, offset.length(), aspect, 45, offset);
    assert.ok(offset.distanceTo(next) < 1e-10, "a clear stationary view does not jump or drift");
    verifyView("moon", positions, radii, aspect, offset.length() * 2);
  }
});
