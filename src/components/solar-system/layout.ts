import { AU_KM, BODY_PRESETS, bodyRadiusPx, type SizeMode } from "./planets.ts";
import type { Vec2 } from "./astronomy.ts";

type OrbitBand = {
  minDistance: number;
  maxDistance: number;
  innerRadius: number;
  outerRadius: number;
};

export type SceneLayout = {
  scale: number;
  centerClearance: number;
  bodyRadii: Record<string, number>;
  planetBands: Record<string, OrbitBand>;
  moonBands: Record<string, OrbitBand>;
  systemRadii: Record<string, number>;
  locatorRadius: number;
  outerRadius: number;
};

// Distances in this overview are illustrative. Each system occupies its own
// annulus, including the full radial excursion of every moon and body disc.
// The same transform is used for guides and live positions, at every zoom.
const CENTER_CLEARANCE = 10;
const LOCATOR_RADIUS = 4;

export function createSceneLayout(
  guides: Record<string, Vec2[]>,
  extent: number,
  bodyScale: number,
  sizeMode: SizeMode,
  zoom: number,
): SceneLayout {
  const radii = Object.fromEntries(BODY_PRESETS.map((body) => [
    body.id, bodyRadiusPx(body.radiusKm, bodyScale, sizeMode),
  ]));
  const planetBands: Record<string, OrbitBand> = {};
  const moonBands: Record<string, OrbitBand> = {};
  const systemRadii: Record<string, number> = {};
  const planets = BODY_PRESETS.filter((body) => !body.parentId);
  let previousOuterEdge = 0;
  let previousDistance = 0;

  for (const planet of planets) {
    let systemRadius = Math.max(radii[planet.id], LOCATOR_RADIUS);
    const moons = BODY_PRESETS.filter((body) => body.parentId === planet.id)
      .sort((a, b) => a.semiMajorKm - b.semiMajorKm);

    for (const moon of moons) {
      const envelope = Math.max(radii[moon.id], LOCATOR_RADIUS);
      const innerRadius = systemRadius + 4 + envelope;
      const band = {
        minDistance: moon.semiMajorKm / AU_KM * 0.7,
        maxDistance: moon.semiMajorKm / AU_KM * 1.3,
        innerRadius,
        outerRadius: innerRadius + 3,
      };
      moonBands[moon.id] = band;
      systemRadius = band.outerRadius + envelope;
    }
    systemRadii[planet.id] = systemRadius;

    const distances = guides[planet.id].map((point) => Math.hypot(point.x, point.y));
    // Extra margin allows small year-to-year perturbations. Clamping in the
    // projection keeps the reserved annulus safe even outside these samples.
    const minDistance = Math.min(...distances) * 0.98;
    const maxDistance = Math.max(...distances) * 1.02;
    const gap = 10 + (previousDistance ? 10 * Math.log(planet.semiMajorKm / previousDistance) : 0);
    const innerRadius = previousOuterEdge + gap + systemRadius;
    const outerRadius = innerRadius + 2 + 12 * Math.log(maxDistance / minDistance);
    planetBands[planet.id] = { minDistance, maxDistance, innerRadius, outerRadius };
    previousOuterEdge = outerRadius + systemRadius;
    previousDistance = planet.semiMajorKm;
  }

  // One common fit/zoom factor preserves body-size ratios and all clearances.
  // Reserve space for moons even when hidden, so toggling them does not move planets.
  const scale = Math.max(0, extent - CENTER_CLEARANCE) / previousOuterEdge * zoom;
  return {
    scale,
    centerClearance: CENTER_CLEARANCE * zoom,
    bodyRadii: Object.fromEntries(Object.entries(radii).map(([id, radius]) => [id, radius * scale])),
    planetBands,
    moonBands,
    systemRadii: Object.fromEntries(Object.entries(systemRadii).map(([id, radius]) => [id, radius * scale])),
    locatorRadius: LOCATOR_RADIUS * scale,
    outerRadius: CENTER_CLEARANCE * zoom + previousOuterEdge * scale,
  };
}

function bandRadius(distance: number, band: OrbitBand): number {
  const fraction = Math.max(0, Math.min(1,
    Math.log(Math.max(distance, band.minDistance) / band.minDistance) / Math.log(band.maxDistance / band.minDistance),
  ));
  return band.innerRadius + fraction * (band.outerRadius - band.innerRadius);
}

export function planetOrbitRadius(id: string, distanceAU: number, layout: SceneLayout): number {
  return layout.centerClearance + bandRadius(distanceAU, layout.planetBands[id]) * layout.scale;
}

export function moonOrbitRadius(id: string, distanceAU: number, layout: SceneLayout): number {
  return bandRadius(distanceAU, layout.moonBands[id]) * layout.scale;
}

export function projectPlanet(id: string, position: Vec2, layout: SceneLayout): Vec2 {
  const radius = Math.hypot(position.x, position.y);
  if (!radius) return { x: 0, y: 0 };
  const displayRadius = planetOrbitRadius(id, radius, layout);
  return { x: displayRadius * position.x / radius, y: -displayRadius * position.y / radius };
}

export function projectMoon(id: string, position: Vec2, layout: SceneLayout): Vec2 {
  const radius = Math.hypot(position.x, position.y);
  if (!radius) return { x: 0, y: 0 };
  const displayRadius = moonOrbitRadius(id, radius, layout);
  return { x: displayRadius * position.x / radius, y: -displayRadius * position.y / radius };
}
