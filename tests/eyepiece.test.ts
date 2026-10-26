import test from "node:test";
import assert from "node:assert/strict";
import { Body, Equator, Illumination, RotationAxis } from "astronomy-engine";
import { OrthographicCamera, Vector3 } from "three";
import { calculateOptics, discFraction, EQUIPMENT_FIELDS, EXAMPLE_EQUIPMENT, expectedFeatures, previewHalfSpan, targetAppearance } from "../src/components/observing/eyepiece.ts";
import { observerFor, TARGETS, type Site } from "../src/components/observing/observing.ts";
import { equipmentForTelescope, researchTargetGuide, TELESCOPES } from "../src/components/observing/telescopes.ts";

const site: Site = { latitude: 51.5, longitude: -0.12, elevation: 30, label: "London", source: "manual" };
const close = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("commercial presets apply manufacturer optics and give the expected example magnifications", () => {
  for (const [id, aperture, focal, power] of [
    ["powerseeker-70az", 70, 700, 35], ["heritage-130", 130, 650, 26], ["nexstar-8se", 203.2, 2032, 81.28],
  ] as const) {
    const telescope = TELESCOPES.find((item) => item.id === id)!;
    const equipment = equipmentForTelescope(telescope)!;
    assert.equal(Number(equipment.aperture), aperture); assert.equal(Number(equipment.focal), focal);
    close(calculateOptics(equipment)!.magnification, power);
  }
});

test("research telescopes never create fictitious consumer-eyepiece settings", () => {
  for (const telescope of TELESCOPES.filter((item) => item.kind !== "amateur")) {
    assert.equal(equipmentForTelescope(telescope), null);
    assert.ok(telescope.owner.length > 10 && telescope.source.startsWith("https://"));
    for (const body of TARGETS) assert.ok(researchTargetGuide(telescope, body).text.length > 40);
  }
  assert.equal(new Set(TELESCOPES.map((item) => item.id)).size, TELESCOPES.length);
});

test("space telescope target exclusions are not confused with local horizon visibility", () => {
  const webb = TELESCOPES.find((item) => item.id === "webb")!;
  const hubble = TELESCOPES.find((item) => item.id === "hubble")!;
  for (const body of [Body.Moon, Body.Mercury, Body.Venus] as const) assert.equal(researchTargetGuide(webb, body).unavailable, true);
  for (const body of [Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune] as const) assert.equal(researchTargetGuide(webb, body).unavailable, false);
  assert.equal(researchTargetGuide(hubble, Body.Mercury).unavailable, true);
  assert.match(researchTargetGuide(webb, Body.Saturn).text, /infrared/);
});

test("eyepiece and Barlow changes preserve magnification, angular field and pupil relationships", () => {
  const base = calculateOptics(EXAMPLE_EQUIPMENT)!;
  close(base.magnification, 100); close(base.fieldDegrees, 0.5); close(base.exitPupilMm, 1);
  const barlow = calculateOptics({ ...EXAMPLE_EQUIPMENT, factor: "2" })!;
  close(barlow.magnification, 200); close(barlow.fieldDegrees, 0.25); close(barlow.exitPupilMm, 0.5);
  close(discFraction(20, barlow.fieldDegrees), 2 * discFraction(20, base.fieldDegrees));
  const wider = calculateOptics({ ...EXAMPLE_EQUIPMENT, afov: "100" })!;
  close(wider.magnification, base.magnification);
  close(discFraction(20, wider.fieldDegrees), discFraction(20, base.fieldDegrees) / 2);
  const largerAperture = calculateOptics({ ...EXAMPLE_EQUIPMENT, aperture: "200" })!;
  close(largerAperture.fieldDegrees, base.fieldDegrees);
  close(largerAperture.resolutionArcsec, base.resolutionArcsec / 2);
});

test("blank, nonfinite and impossible equipment inputs never produce a misleading preview", () => {
  for (const field of EQUIPMENT_FIELDS) {
    for (const value of ["", " ", "NaN", "Infinity", "0", "-1", String(field.max + 1), String(field.min / 2)]) {
      assert.equal(calculateOptics({ ...EXAMPLE_EQUIPMENT, [field.key]: value }), null, field.key + ":" + value);
    }
  }
});

test("orthographic 3D projection keeps exact field fractions for subpixel, normal and clipped discs", () => {
  for (const fraction of [0.00001, 0.01, 0.5, 1, 5]) {
    const half = previewHalfSpan(fraction, false, 2.4);
    const camera = new OrthographicCamera(-half, half, half, -half, 0.01, 100);
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const left = new Vector3(-1, 0, 0).project(camera);
    const right = new Vector3(1, 0, 0).project(camera);
    close((right.x - left.x) / 2, fraction);
  }
  close(previewHalfSpan(0.001, true, 2.4), 3.2);
});

test("observer-relative angular sizes distinguish tiny planets from the Moon and change with date", () => {
  const time = Date.parse("2026-10-26T22:00Z");
  const moon = targetAppearance(Body.Moon, site, time);
  const saturn = targetAppearance(Body.Saturn, site, time);
  const neptune = targetAppearance(Body.Neptune, site, time);
  assert.ok(moon.diameterArcsec > 1700 && moon.diameterArcsec < 2100);
  assert.ok(saturn.diameterArcsec > 14 && saturn.diameterArcsec < 22);
  assert.ok(neptune.diameterArcsec > 2 && neptune.diameterArcsec < 3);
  const perigee = targetAppearance(Body.Moon, site, Date.parse("2024-04-08T18:21Z"));
  const apogee = targetAppearance(Body.Moon, site, Date.parse("2024-04-20T00:00Z"));
  assert.ok(perigee.diameterArcsec > apogee.diameterArcsec * 1.05);
  const otherSite = targetAppearance(Body.Moon, { ...site, longitude: 170, latitude: -40 }, time);
  assert.ok(Math.abs(moon.diameterArcsec - otherSite.diameterArcsec) > 1, "lunar distance includes parallax");
});

test("3D illumination follows full, new and quarter Moon geometry", () => {
  for (const [date, low, high] of [
    ["2024-04-08T18:21Z", 0, 0.002], ["2024-03-25T07:00Z", 0.998, 1], ["2024-04-15T19:13Z", 0.47, 0.53],
  ] as const) {
    const appearance = targetAppearance(Body.Moon, site, Date.parse(date));
    assert.ok(appearance.phaseFraction >= low && appearance.phaseFraction <= high);
    const light = new Vector3(appearance.sunDirection.x, appearance.sunDirection.y, appearance.sunDirection.z);
    close(light.length(), 1);
    close((1 + light.dot(new Vector3(0, 0, 1))) / 2, appearance.phaseFraction);
  }
});

test("3D pole projections preserve ring opening and celestial north/east orientation", () => {
  for (const date of ["2025-03-23T12:00Z", "2026-10-26T22:00Z", "2032-06-01T00:00Z"]) {
    const time = Date.parse(date);
    const view = targetAppearance(Body.Saturn, site, time);
    const equator = Equator(Body.Saturn, new Date(time), observerFor(site), false, true);
    const pole = RotationAxis(Body.Saturn, new Date(time)).north;
    const ra = equator.ra * Math.PI / 12;
    const dec = equator.dec * Math.PI / 180;
    const eastProjection = -Math.sin(ra) * pole.x + Math.cos(ra) * pole.y;
    const northProjection = -Math.sin(dec) * (Math.cos(ra) * pole.x + Math.sin(ra) * pole.y) + Math.cos(dec) * pole.z;
    close(view.pole.x, -eastProjection); close(view.pole.y, northProjection);
    close(Math.hypot(view.pole.x, view.pole.y, view.pole.z), 1);
    const opening = Math.abs(Illumination(Body.Saturn, new Date(time)).ring_tilt!);
    assert.ok(Math.abs(Math.abs(view.ringTilt) - opening) < 0.2, "topocentric ring opening agrees with independent geocentric formula");
  }
  const edgeOn = targetAppearance(Body.Saturn, site, Date.parse("2025-03-23T12:00Z"));
  assert.ok(Math.abs(edgeOn.ringTilt) < 1);
  assert.match(expectedFeatures(edgeOn), /edge-on/);
});

test("all supported targets and date boundaries produce finite 3D geometry and guidance", () => {
  for (const body of TARGETS) for (const date of ["1900-01-01T00:00Z", "2026-10-26T22:00Z", "2100-12-31T23:59Z"]) {
    const view = targetAppearance(body, site, Date.parse(date));
    assert.ok(view.diameterArcsec > 0 && Number.isFinite(view.diameterArcsec));
    assert.ok(view.phaseFraction >= 0 && view.phaseFraction <= 1);
    assert.ok(expectedFeatures(view).length > 30);
    assert.ok(Object.values(view.sunDirection).every(Number.isFinite));
  }
  assert.throws(() => targetAppearance(Body.Moon, site, NaN));
  assert.throws(() => targetAppearance(Body.Moon, { ...site, latitude: 100 }, Date.now()));
});
