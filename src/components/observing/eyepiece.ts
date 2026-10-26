import { Body, Equator, Illumination, RotationAxis } from "astronomy-engine";
import { AU_KM, BODY_PRESETS } from "../solar-system/planets.ts";
import { MAX_TIME, MIN_TIME } from "../solar-system/astronomy.ts";
import { observerFor, TARGETS, type Site, type Target } from "./observing.ts";

export const EQUIPMENT_FIELDS = [
  { key: "focal", label: "Telescope focal length (mm)", min: 50, max: 20000 },
  { key: "eyepiece", label: "Eyepiece focal length (mm)", min: 1, max: 100 },
  { key: "aperture", label: "Aperture / objective diameter (mm)", min: 10, max: 2000 },
  { key: "afov", label: "Eyepiece apparent field (°)", min: 10, max: 120 },
  { key: "factor", label: "Barlow / reducer factor", min: 0.1, max: 10 },
] as const;
export type Equipment = Record<typeof EQUIPMENT_FIELDS[number]["key"], string>;
export const EXAMPLE_EQUIPMENT: Equipment = { focal: "1000", eyepiece: "10", aperture: "100", afov: "50", factor: "1" };

export function calculateOptics(input: Equipment) {
  if (EQUIPMENT_FIELDS.some(({ key, min, max }) => !input[key].trim()
    || !Number.isFinite(Number(input[key])) || Number(input[key]) < min || Number(input[key]) > max)) return null;
  const magnification = Number(input.focal) * Number(input.factor) / Number(input.eyepiece);
  return {
    magnification,
    // AFOV / magnification is an approximation; an eyepiece's field stop is more precise.
    fieldDegrees: Number(input.afov) / magnification,
    exitPupilMm: Number(input.aperture) / magnification,
    // Rayleigh criterion for a circular aperture at 550 nm, in arcseconds.
    resolutionArcsec: 1.22 * 0.00055 / Number(input.aperture) * 180 / Math.PI * 3600,
  };
}

export function discFraction(diameterArcsec: number, fieldDegrees: number) {
  return diameterArcsec / (fieldDegrees * 3600);
}

export function targetAppearance(body: Target, site: Site, time: number) {
  if (!TARGETS.includes(body) || !Number.isFinite(time) || time < MIN_TIME || time > MAX_TIME) throw new Error("Unsupported target or date.");
  const date = new Date(time);
  const observer = observerFor(site);
  const equator = Equator(body, date, observer, false, true);
  const sun = Equator(Body.Sun, date, observer, false, true);
  const illumination = Illumination(body, date);
  const radiusKm = BODY_PRESETS.find((item) => item.name === body)!.radiusKm;
  const radians = Math.PI / 180;
  const ra = equator.ra * 15 * radians;
  const dec = equator.dec * radians;
  const east = { x: -Math.sin(ra), y: Math.cos(ra), z: 0 };
  const north = { x: -Math.sin(dec) * Math.cos(ra), y: -Math.sin(dec) * Math.sin(ra), z: Math.cos(dec) };
  const towardObserver = { x: -equator.vec.x / equator.dist, y: -equator.vec.y / equator.dist, z: -equator.vec.z / equator.dist };
  const dot = (a: typeof east, b: typeof east) => a.x * b.x + a.y * b.y + a.z * b.z;
  // Right-handed view frame: west +X, celestial north +Y, toward observer +Z.
  const project = (vector: typeof east) => ({ x: -dot(vector, east), y: dot(vector, north), z: dot(vector, towardObserver) });
  const axis = RotationAxis(body, date);
  const pole = project(axis.north);
  const light = project({ x: sun.vec.x - equator.vec.x, y: sun.vec.y - equator.vec.y, z: sun.vec.z - equator.vec.z });
  const length = Math.hypot(light.x, light.y, light.z);
  const sunDirection = { x: light.x / length, y: light.y / length, z: light.z / length };
  return {
    body,
    diameterArcsec: 2 * Math.asin(radiusKm / (equator.dist * AU_KM)) / radians * 3600,
    phaseFraction: (1 + sunDirection.z) / 2,
    magnitude: illumination.mag,
    ringTilt: Math.asin(Math.max(-1, Math.min(1, pole.z))) / radians,
    pole, sunDirection, spin: (axis.spin % 360) * radians,
  };
}
export type Appearance = ReturnType<typeof targetAppearance>;

export function previewHalfSpan(fraction: number, enlarged: boolean, extent: number) {
  // Unit sphere, orthographic view. Field framing never floors or exaggerates its size.
  return enlarged ? extent / 0.75 : 1 / fraction;
}

export function expectedFeatures(appearance: Appearance) {
  switch (appearance.body) {
    case Body.Moon: return "Look for dark maria and bright highlands. Crater shadows stand out near the day–night boundary; near full Moon, that relief is less pronounced.";
    case Body.Mercury: return "A very small disc with a changing phase. Surface markings are not a realistic expectation in a typical visual telescope. Wait for a safe night-time window.";
    case Body.Venus: return "A bright crescent or gibbous disc, depending on the date. Its cloud cover hides the surface; do not expect the surface map shown in Explore.";
    case Body.Mars: return "A small orange disc. When Mars is close and the air is steady, larger dark markings or a polar cap may be visible. At small angular sizes, expect little detail.";
    case Body.Jupiter: return "The two broad cloud belts are useful features to look for. The Galilean moons can look like nearby points of light; their positions, transits and eclipses are not plotted here.";
    case Body.Saturn: return Math.abs(appearance.ringTilt) < 5
      ? "The rings are nearly edge-on at this date: expect a thin line, not a broad oval. Fine ring detail is especially difficult in this geometry."
      : "Look for the rings around a pale disc. Fine divisions in the rings need sufficient aperture, steady air and good focus; they are not guaranteed at a given magnification.";
    case Body.Uranus: return "A very small, pale blue-green disc, often nearly point-like at low power. Expect little or no surface detail in ordinary visual observing.";
    case Body.Neptune: return "A faint, tiny blue disc that can be hard to distinguish from a star at low power. A detailed finder chart is useful; do not expect visible cloud detail.";
  }
}
