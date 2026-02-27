import { type PlanetConfig } from "./Planet";
import styles from "./SolarSystem.module.css";

/**
 * Display scaling notes:
 * - orbitRadiusPx: you will compute a base scale in SolarSystem.tsx (based on viewport)
 *   and multiply each planet's "orbitAUScaled" by that base.
 * - orbitPeriodSec: shorter than real-life, so it's visually meaningful.
 */

type PlanetPreset = Omit<PlanetConfig, "orbitRadiusPx"> & {
  orbitAUScaled: number; // relative distance units for display (not actual AU)
};

export const PLANET_PRESETS: PlanetPreset[] = [
  {
    id: "mercury",
    name: "Mercury",
    radiusPx: 6,
    orbitAUScaled: 0.39,
    orbitPeriodSec: 3.0,
    eccentricity: 0.2056,
    phaseRad: 0.2,
    className: "mercury",
    showOrbit: true,
  },
  {
    id: "venus",
    name: "Venus",
    radiusPx: 9,
    orbitAUScaled: 0.72,
    orbitPeriodSec: 4.8,
    eccentricity: 0.0068,
    phaseRad: 1.1,
    className: "venus",
    showOrbit: true,
  },
  {
    id: "earth",
    name: "Earth",
    radiusPx: 10,
    orbitAUScaled: 1.0,
    orbitPeriodSec: 6.5,
    eccentricity: 0.0167,
    phaseRad: 2.4,
    className: "earth",
    showOrbit: true
  },

  // Moon will orbit EARTH, not Sun. We'll build it separately in SolarSystem.tsx.
  // This is just a convenient preset for size and speed.
  // We'll use a small orbit radius in px around Earth.
  // (Real eccentricity is ~0.055; good enough.)
  {
    id: "moon",
    name: "Moon",
    radiusPx: 4,
    orbitAUScaled: 0,
    orbitPeriodSec: 2.2,
    eccentricity: 0.055,
    phaseRad: 0.0,
    className: "moon",
    showOrbit: true
  },

  {
    id: "mars",
    name: "Mars",
    radiusPx: 8,
    orbitAUScaled: 1.52,
    orbitPeriodSec: 8.5,
    eccentricity: 0.0934,
    phaseRad: 0.7,
    className: "mars",
    showOrbit: true,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    radiusPx: 18,
    orbitAUScaled: 5.20,
    orbitPeriodSec: 18.0,
    eccentricity: 0.0489,
    phaseRad: 2.9,
    className: "jupiter",
    showOrbit: false,
  },
  {
    id: "saturn",
    name: "Saturn",
    radiusPx: 16,
    orbitAUScaled: 9.58,
    orbitPeriodSec: 25.0,
    eccentricity: 0.0565,
    phaseRad: 1.8,
    className: "saturn",
    showOrbit: false,
  },
  {
    id: "uranus",
    name: "Uranus",
    radiusPx: 14,
    orbitAUScaled: 19.2,
    orbitPeriodSec: 35.0,
    eccentricity: 0.0472,
    phaseRad: 0.4,
    className: "uranus",
    showOrbit: false,
  },
  {
    id: "neptune",
    name: "Neptune",
    radiusPx: 14,
    orbitAUScaled: 30.05,
    orbitPeriodSec: 45.0,
    eccentricity: 0.0086,
    phaseRad: 2.1,
    className: "neptune",
    showOrbit: false
  },

  // Pluto (dwarf planet) — included per your request
  {
    id: "pluto",
    name: "Pluto",
    radiusPx: 5,
    orbitAUScaled: 39.48,
    orbitPeriodSec: 55.0,
    eccentricity: 0.2488,
    phaseRad: 1.6,
    className: "pluto",
    showOrbit: false
  },
];


// It maps planet ids/names -> CSS module class names.
function planetClassName(
  styles: Record<string, string>,
  planetId: string
): string | undefined {
  // Normalize common variants
  const key = planetId.trim().toLowerCase();

  // Map ids to CSS-module keys (the keys must exist in SolarSystem.module.css)
  const map: Record<string, string> = {
    mercury: "mercury",
    venus: "venus",
    earth: "earth",
    mars: "mars",
    jupiter: "jupiter",
    saturn: "saturn",
    uranus: "uranus",
    neptune: "neptune",
    moon: "moon",
    pluto: "pluto",
  };

  const cssKey = map[key];
  return cssKey ? styles[cssKey] : undefined;
}

/**
 * Convert presets to actual PlanetConfig[] using a viewport-dependent scale.
 * orbitScalePx is "pixels per 1.0 AU scaled unit".
 */
export function buildPlanets(orbitScalePx: number): PlanetConfig[] {
  // exclude moon here; we’ll render it around Earth in SolarSystem.tsx
  return PLANET_PRESETS
    .map((p) => ({
      id: p.id,
      name: p.name,
      radiusPx: p.radiusPx,
      orbitRadiusPx: p.orbitAUScaled * orbitScalePx,
      orbitPeriodSec: p.orbitPeriodSec,
      eccentricity: p.eccentricity,
      phaseRad: p.phaseRad,
      className: planetClassName(styles, p.id) || p.className,
      showOrbit: p.showOrbit,
    }));
}