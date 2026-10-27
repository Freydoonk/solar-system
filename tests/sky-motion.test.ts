import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { Body, Equator, Horizon, Observer } from "astronomy-engine";
import { alignmentOffset, deviceQuaternion, horizontalVector, manualQuaternion, viewDirection, type OrientationSample } from "../src/components/observing/skyOrientation.ts";
import { buildSkyView, isDaylightMarker, skyNightVisibility } from "../src/components/observing/skyViewModel.ts";
import { skyPosition, TARGETS } from "../src/components/observing/observing.ts";
import { FLAT_HORIZON, horizonAltitude } from "../src/components/observing/horizon.ts";

const sample = (alpha: number, beta = 90, gamma = 0, absolute = true): OrientationSample => ({ alpha, beta, gamma, absolute });
const close = (a: number, b: number, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const bearing = (a: number, b: number) => close(Math.sin((a - b) * Math.PI / 360), 0);

test("upright rear-facing phone follows true cardinal directions and upward pitch", () => {
  for (const [alpha, azimuth] of [[0, 0], [270, 90], [180, 180], [90, 270]]) {
    for (const [beta, altitude] of [[90, 0], [120, 30], [45, -45]]) {
      const direction = viewDirection(deviceQuaternion(sample(alpha, beta), 0)!);
      bearing(direction.azimuth, azimuth); close(direction.altitude, altitude);
    }
  }
  close(viewDirection(deviceQuaternion(sample(0, 0), 0)!).altitude, -90);
  close(viewDirection(deviceQuaternion(sample(0, 180), 0)!).altitude, 90);
});

test("screen rotation preserves pointing and compensates roll in both landscapes", () => {
  // W3C's north-facing device with the top pointing right.
  const right = deviceQuaternion(sample(270, 0, 90), 270)!;
  const left = deviceQuaternion(sample(90, 0, -90), 90)!;
  for (const pose of [right, left, deviceQuaternion(sample(0), 0)!]) {
    const direction = viewDirection(pose); bearing(direction.azimuth, 0); close(direction.altitude, 0);
    const up = new Vector3(0, 1, 0).applyQuaternion(pose);
    close(up.x, 0); close(up.y, 1); close(up.z, 0);
  }
  for (const angle of [0, 90, 180, 270, -90]) {
    const direction = viewDirection(deviceQuaternion(sample(37, 123, -23), angle)!);
    const reference = viewDirection(deviceQuaternion(sample(37, 123, -23), 0)!);
    bearing(direction.azimuth, reference.azimuth); close(direction.altitude, reference.altitude);
  }
});

test("relative sensors require a known bearing and keep subsequent motion and north wrap", () => {
  const initial = sample(73, 100, 0, false);
  const offset = alignmentOffset(initial, 0, 359)!;
  const aligned = viewDirection(deviceQuaternion(initial, 0, offset)!);
  bearing(aligned.azimuth, 359); close(aligned.altitude, 10);
  bearing(viewDirection(deviceQuaternion(sample(71, 100, 0, false), 0, offset)!).azimuth, 1);
  assert.equal(alignmentOffset(sample(0, 180), 0, 0), null);
  assert.equal(alignmentOffset(sample(0, 0), 0, 0), null);
});

test("missing or nonfinite sensor fields never become an apparent north heading", () => {
  for (const value of [null, NaN, Infinity]) for (const key of ["alpha", "beta", "gamma"]) {
    assert.equal(deviceQuaternion({ ...sample(0), [key]: value }, 0), null);
  }
  assert.equal(deviceQuaternion(sample(361), 0), null);
  assert.equal(deviceQuaternion(sample(0, 181), 0), null);
  assert.equal(deviceQuaternion(sample(0, 90, 91), 0), null);
  assert.equal(deviceQuaternion(sample(0), NaN), null);
});

test("manual view and real horizontal positions use the same camera frame", () => {
  for (const azimuth of [0, 90, 180, 270, 359]) for (const altitude of [-89, -30, 0, 45, 89]) {
    const camera = new PerspectiveCamera(65, 1, 0.1, 200);
    camera.quaternion.copy(manualQuaternion(azimuth, altitude)); camera.updateMatrixWorld();
    const center = horizontalVector(azimuth, altitude).multiplyScalar(100).project(camera);
    close(center.x, 0); close(center.y, 0); assert.ok(center.z > -1 && center.z < 1);
    const direction = viewDirection(camera.quaternion); bearing(direction.azimuth, azimuth); close(direction.altitude, altitude);
  }
});

test("live 3D sky matches the planet pointing model by location/date", () => {
  for (const latitude of [51.5, -33.9]) for (const time of [Date.parse("2026-10-27T22:00Z"), Date.parse("2026-10-28T04:00Z")]) {
    const site = { latitude, longitude: 0, elevation: 0, source: "manual" as const, label: "Test" };
    const model = buildSkyView(site, time, FLAT_HORIZON);
    assert.ok(model.starBuckets.flat().length > 1000);
    assert.ok(model.lines.length > 100);
    assert.ok(model.markers.some(m => m.kind === "constellation"));
    for (const target of TARGETS) {
      const expected = skyPosition(target, site, time), marker = model.markers.find(m => m.id === target);
      if (expected.geometricAltitude < 0) assert.equal(marker, undefined);
      else { assert.ok(marker); bearing(marker.azimuth, expected.azimuth); close(marker.altitude, expected.geometricAltitude); }
    }
    for (const point of [...model.starBuckets.flat(), ...model.lines]) { close(point.length(), 1); assert.ok(point.y >= -1e-12); }
  }
});

test("live sky shows the Sun above the horizon at its geometric topocentric position", () => {
  for (const [latitude, longitude] of [[51.5, 0], [-33.9, 151.2], [80, 30]]) {
    const site = { latitude, longitude, elevation: 0, source: "manual" as const, label: "Test" };
    for (const instant of ["2026-10-27T12:00Z", "2026-10-27T00:00Z", "2026-06-21T12:00Z", "2026-12-21T12:00Z"]) {
      const time = Date.parse(instant), date = new Date(time), observer = new Observer(latitude, longitude, 0);
      const equator = Equator(Body.Sun, date, observer, true, true);
      const expected = Horizon(date, observer, equator.ra, equator.dec);
      const model = buildSkyView(site, time, FLAT_HORIZON), marker = model.markers.find(m => m.id === "Sun");
      bearing(model.sun.azimuth, expected.azimuth); close(model.sun.altitude, expected.altitude);
      close(model.sun.altitude, skyPosition(Body.Moon, site, time).sunAltitude);
      assert.equal(model.sun.visible, expected.altitude >= 0);
      if (expected.altitude < 0) assert.equal(marker, undefined);
      else {
        assert.ok(marker); assert.equal(marker.kind, "sun");
        bearing(marker.azimuth, expected.azimuth); close(marker.altitude, expected.altitude);
        for (const pose of [manualQuaternion(model.sun.azimuth, model.sun.altitude), deviceQuaternion(sample(360 - model.sun.azimuth, 90 + model.sun.altitude), 0)!]) {
          const camera = new PerspectiveCamera(65, 1, 0.1, 200);
          camera.quaternion.copy(pose); camera.updateMatrixWorld();
          const projected = marker.vector.clone().multiplyScalar(100).project(camera);
          close(projected.x, 0); close(projected.y, 0); assert.ok(projected.z > -1 && projected.z < 1);
        }
      }
    }
  }
});

test("daylight hides night guides while retaining Sun, Moon and compass markers", () => {
  assert.equal(skyNightVisibility(35), 0);
  assert.equal(skyNightVisibility(0), 0);
  assert.equal(skyNightVisibility(-18), 1);
  const twilight = [-12, -9, -6, -3, 0].map(skyNightVisibility);
  assert.ok(twilight.every((value, index) => value >= 0 && value <= 1 && (index === 0 || value < twilight[index - 1])));
  const site = { latitude: 51.5, longitude: 0, elevation: 0, source: "manual" as const, label: "Test" };
  for (const hour of [0, 6, 12, 18]) {
    const model = buildSkyView(site, Date.UTC(2026, 9, 27, hour), FLAT_HORIZON);
    for (const marker of model.markers) assert.equal(isDaylightMarker(marker), ["Sun", "Moon", "N", "E", "S", "W"].includes(marker.id));
  }
});

test("My horizon hides the Sun without removing its position or adding a telescope target", () => {
  const site = { latitude: 51.5, longitude: 0, elevation: 0, source: "manual" as const, label: "Test" };
  const time = Date.parse("2026-10-27T12:00Z");
  const clear = buildSkyView(site, time, FLAT_HORIZON);
  assert.ok(clear.sun.visible);
  for (const offset of [-0.01, 0, 0.01]) {
    const model = buildSkyView(site, time, Array(8).fill(clear.sun.altitude + offset));
    close(model.sun.altitude, clear.sun.altitude); bearing(model.sun.azimuth, clear.sun.azimuth);
    assert.equal(model.sun.visible, offset <= 0);
    assert.equal(model.markers.some(m => m.id === "Sun"), offset <= 0);
  }
  assert.ok(!TARGETS.some(body => String(body) === "Sun"));
  assert.throws(() => skyPosition(Body.Sun as never, site, time), /Unsupported target/);
});

test("personal horizon clips stars, target markers and constellation lines", () => {
  const horizon = [30, 20, 60, 10, 0, 50, 70, 40];
  const site = { latitude: 51.5, longitude: 0, elevation: 0, source: "manual" as const, label: "Test" };
  const model = buildSkyView(site, Date.parse("2026-10-27T22:00Z"), horizon);
  for (const point of [...model.starBuckets.flat(), ...model.lines]) {
    const azimuth = Math.atan2(point.x, -point.z) * 180 / Math.PI, altitude = Math.asin(point.y) * 180 / Math.PI;
    assert.ok(altitude + 1e-8 >= horizonAltitude(horizon, azimuth));
  }
  for (const marker of model.markers.filter(m => m.kind !== "compass")) assert.ok(marker.altitude >= horizonAltitude(horizon, marker.azimuth));
});
