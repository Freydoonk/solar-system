import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { getPositions, type Vec3 } from "../src/components/solar-system/astronomy.ts";
import { createFollowLock, fromParentView, pairedViewMinimumDistance, pairedViewOffset } from "../src/components/solar-system/following.ts";
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
  for (const [index, followMode] of (["from-parent", "parent"] as const).entries()) {
    const request = { ...mars, bodyId: "moon", serial: index + 3, followMode };
    assert.equal(lock.mode(request), followMode);
    lock.release(request);
    assert.equal(lock.mode(request), "free");
    assert.equal(lock.mode({ ...request, serial: request.serial + 10 }), followMode);
  }
});

function verifyView(id: string, positions: Record<string, Vec3>, radii: Record<string, number>, aspect: number, requestedDistance = 0, companionId = "sun") {
  const offset = pairedViewOffset(id, companionId, positions, radii, requestedDistance, aspect);
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
  for (const targetId of [id, companionId]) {
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
    const radius = target.radius * (BODY_ENVELOPES[targetId] ?? 1);
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
    assert.ok(offset.length() > pairedViewMinimumDistance("moon", radii, aspect) * 2);
    const next = pairedViewOffset("moon", "sun", positions, radii, offset.length(), aspect, 45, offset);
    assert.ok(offset.distanceTo(next) < 1e-10, "a clear stationary view does not jump or drift");
    verifyView("moon", positions, radii, aspect, offset.length() * 2);
  }
});

test("rear views frame each moon and its parent including rings on phones and desktops", () => {
  const { bodyRadii } = createPhysicalLayout({});
  for (const date of ["1900-01-01T00:00Z", "2026-10-20T12:00Z", "2100-12-31T00:00Z"]) {
    const positions = getSpacePositions(getPositions(new Date(date)));
    const original = structuredClone(positions);
    for (const moon of BODY_PRESETS.filter((body) => body.parentId)) {
      const parentId = moon.parentId!;
      const towardParent = new Vector3().copy(positions[parentId]).sub(new Vector3().copy(positions[moon.id]));
      for (const aspect of [0.4, 0.8, 1, 2.5]) {
        const offset = verifyView(moon.id, positions, bodyRadii, aspect, 0, parentId);
        assert.ok(offset.dot(towardParent) < 0, "camera is behind the moon, away from the parent");
        const next = pairedViewOffset(moon.id, parentId, positions, bodyRadii, offset.length(), aspect, 45, offset);
        assert.ok(offset.distanceTo(next) < 1e-9, "stationary view remains stable");
        verifyView(moon.id, positions, bodyRadii, aspect, offset.length() * 2, parentId);
      }
    }
    assert.deepEqual(positions, original);
  }
});

test("view from each parent starts outside the planet and rings, and zoom cannot enter either body", () => {
  const { bodyRadii } = createPhysicalLayout({});
  for (const date of ["1900-01-01T00:00Z", "2026-10-20T12:00Z", "2100-12-31T00:00Z"]) {
    const positions = getSpacePositions(getPositions(new Date(date)));
    const original = structuredClone(positions);
    for (const moon of BODY_PRESETS.filter((body) => body.parentId)) {
      const parentId = moon.parentId!;
      const center = new Vector3().copy(positions[moon.id]);
      const parent = new Vector3().copy(positions[parentId]);
      const towardParent = parent.clone().sub(center).normalize();
      const parentEnvelope = bodyRadii[parentId] * (BODY_ENVELOPES[parentId] ?? 1);
      for (const fraction of [-1, 0, 0.25, 0.5, 1, 2]) {
        const view = fromParentView(moon.id, parentId, positions, bodyRadii, fraction);
        assert.ok(view.offset.clone().normalize().dot(towardParent) > 1 - 1e-10);
        assert.ok(view.offset.length() > bodyRadii[moon.id]);
        const cameraPosition = center.clone().add(view.offset);
        const altitude = cameraPosition.distanceTo(parent);
        assert.ok(altitude > parentEnvelope, `outside ${parentId} and rings`);
        if (fraction >= 1) assert.ok(Math.abs(altitude - parentEnvelope * 1.05) < 1e-9);
        if (fraction > 0 && fraction < 1) assert.ok(Math.abs(view.offset.length() / view.maxDistance - fraction) < 1e-10);
        const camera = new PerspectiveCamera(45, 0.5, bodyRadii[moon.id] * 0.001, 100000);
        camera.position.copy(view.offset);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        const projectedMoon = new Vector3().project(camera);
        assert.ok(Math.abs(projectedMoon.x) < 1e-10 && Math.abs(projectedMoon.y) < 1e-10);
        assert.ok(projectedMoon.z > -1 && projectedMoon.z < 1);
      }
    }
    assert.deepEqual(positions, original);
  }
});
