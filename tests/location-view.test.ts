import test from "node:test";
import assert from "node:assert/strict";
import { Group, Mesh, PerspectiveCamera, Quaternion, SphereGeometry, Vector3 } from "three";
import { getBodyOrientation, getPositions } from "../src/components/solar-system/astronomy.ts";
import { applyBodyOrientation } from "../src/components/solar-system/bodyVisuals.ts";
import { createInitialLocationLock, geographicDirection } from "../src/components/solar-system/locationView.ts";
import { fitDistance, getSpacePositions, INITIAL_CAMERA_REQUEST, kmToWorld } from "../src/components/solar-system/space.ts";

test("the selected map region stays in front and centered across rotation, date jumps and zoom", () => {
  const surface = new Mesh(new SphereGeometry(1, 64, 40));
  const visual = { root: new Group(), axis: new Group(), surface };
  const radius = kmToWorld(6371.0084);
  try {
    for (const dateText of ["2026-10-20T00:00Z", "2026-10-20T06:00Z", "2026-10-20T12:00Z", "2026-12-21T18:00Z", "2100-01-01T00:00Z"]) {
      const date = new Date(dateText);
      applyBodyOrientation(visual, getBodyOrientation("earth", date)!);
      const position = getSpacePositions(getPositions(date)).earth;
      const center = new Vector3(position.x, position.y, position.z);
      for (const [latitude, longitude] of [[54, 0], [-36, 151.875], [0, 180], [90, 0], [-90, 0]]) {
        const direction = geographicDirection({ latitude, longitude, label: "Test region" }, visual.axis.quaternion);
        // Read the actual texture vertex (these locations lie on the mesh grid).
        const row = Math.round((90 - latitude) / 180 * 40);
        const column = Math.round((longitude + 180) / 360 * 64);
        const normal = new Vector3().fromBufferAttribute(surface.geometry.getAttribute("position"), row * 65 + column)
          .normalize().applyQuaternion(visual.axis.quaternion);
        assert.ok(normal.dot(direction) > 1 - 1e-10, "region faces the camera, including the poles");
        for (const zoom of [0.5, 1, 2]) {
          const distance = fitDistance(radius, 1.5, 45, 0.15) * zoom;
          const camera = new PerspectiveCamera(45, 1.5, radius * 0.001, 100000);
          camera.position.copy(center).addScaledVector(direction, distance);
          camera.lookAt(center);
          camera.updateMatrixWorld();
          const point = center.clone().addScaledVector(normal, radius).project(camera);
          assert.ok(Math.abs(point.x) < 1e-7 && Math.abs(point.y) < 1e-7);
          assert.ok(point.z > -1 && point.z < 1);
        }
      }
    }
  } finally {
    surface.geometry.dispose();
    surface.material.dispose();
  }
});

test("initial location lock never re-engages after release, even with a late response", () => {
  let releases = 0;
  const lock = createInitialLocationLock(() => releases++);
  const location = { latitude: 54, longitude: 0, label: "Britain" };
  const orientation = new Quaternion();
  assert.equal(lock.direction(null, orientation, INITIAL_CAMERA_REQUEST, true), null);
  lock.release();
  lock.release();
  assert.equal(releases, 1);
  assert.equal(lock.direction(location, orientation, INITIAL_CAMERA_REQUEST, true), null);
  const fresh = createInitialLocationLock(() => {});
  assert.ok(fresh.direction(location, orientation, INITIAL_CAMERA_REQUEST, true));
  assert.equal(fresh.direction(location, orientation, INITIAL_CAMERA_REQUEST, false), null, "parent preserves release through 2D/3D remount");
  assert.equal(fresh.direction(location, orientation, { ...INITIAL_CAMERA_REQUEST, serial: 1 }, true), null);
  assert.equal(fresh.direction(location, orientation, { ...INITIAL_CAMERA_REQUEST, bodyId: "mars" }, true), null);
});
