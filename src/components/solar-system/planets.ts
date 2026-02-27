import { type Orbiting, type PlanetConfig } from "./Planet";

export type BodyConfig = PlanetConfig & {
  orbiting: Orbiting;

  /**
   * Only used for moons:
   * orbitMoonScaled = how many parent radii away from the parent center
   * Example: 8 means orbit radius = 8 * parent.radiusPx
   */
  orbitMoonScaled?: number;
};

type BasePreset = Omit<
  BodyConfig,
  "orbitRadiusPx" | "className" | "radiusPx"
> & {
  radiusPx: number;

  // For planets only (distance from sun)
  orbitAUScaled?: number;

  // For moons only (distance from parent planet in "parent radii")
  orbitMoonScaled?: number;

  // Key for CSS module lookup
  classKey: string;
};

const SIM_SEC_PER_DAY = 0.0806;
const simPeriod = (days: number) => days * SIM_SEC_PER_DAY;

export const BODY_PRESETS: BasePreset[] = [
  // --- Planets (orbiting sun) ---
  {
    id: "mercury",
    name: "Mercury",
    radiusPx: 6,
    orbitAUScaled: 0.39,
    orbitPeriodSec: 3.0,
    eccentricity: 0.2056,
    phaseRad: 0.2,
    showOrbit: true,
    orbiting: "sun",
    classKey: "mercury",
  },
  {
    id: "venus",
    name: "Venus",
    radiusPx: 9,
    orbitAUScaled: 0.72,
    orbitPeriodSec: 4.8,
    eccentricity: 0.0068,
    phaseRad: 1.1,
    showOrbit: true,
    orbiting: "sun",
    classKey: "venus",
  },
  {
    id: "earth",
    name: "Earth",
    radiusPx: 10,
    orbitAUScaled: 1.0,
    orbitPeriodSec: 6.5,
    eccentricity: 0.0167,
    phaseRad: 2.4,
    showOrbit: true,
    orbiting: "sun",
    classKey: "earth",
  },
  {
    id: "mars",
    name: "Mars",
    radiusPx: 8,
    orbitAUScaled: 1.52,
    orbitPeriodSec: 8.5,
    eccentricity: 0.0934,
    phaseRad: 0.7,
    showOrbit: true,
    orbiting: "sun",
    classKey: "mars",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    radiusPx: 18,
    orbitAUScaled: 5.2,
    orbitPeriodSec: 18.0,
    eccentricity: 0.0489,
    phaseRad: 2.9,
    showOrbit: false,
    orbiting: "sun",
    classKey: "jupiter",
  },
  {
    id: "saturn",
    name: "Saturn",
    radiusPx: 16,
    orbitAUScaled: 9.58,
    orbitPeriodSec: 25.0,
    eccentricity: 0.0565,
    phaseRad: 1.8,
    showOrbit: false,
    orbiting: "sun",
    classKey: "saturn",
  },
  {
    id: "uranus",
    name: "Uranus",
    radiusPx: 14,
    orbitAUScaled: 19.2,
    orbitPeriodSec: 35.0,
    eccentricity: 0.0472,
    phaseRad: 0.4,
    showOrbit: false,
    orbiting: "sun",
    classKey: "uranus",
  },
  {
    id: "neptune",
    name: "Neptune",
    radiusPx: 14,
    orbitAUScaled: 30.05,
    orbitPeriodSec: 45.0,
    eccentricity: 0.0086,
    phaseRad: 2.1,
    showOrbit: false,
    orbiting: "sun",
    classKey: "neptune",
  },
  {
    id: "pluto",
    name: "Pluto",
    radiusPx: 5,
    orbitAUScaled: 39.48,
    orbitPeriodSec: 55.0,
    eccentricity: 0.2488,
    phaseRad: 1.6,
    showOrbit: false,
    orbiting: "sun",
    classKey: "pluto",
  },

  // --- Moons (orbiting planets) ---
  { id: "moon", name: "Moon", radiusPx: 4, orbitMoonScaled: 8, orbitPeriodSec: 2.2, eccentricity: 0.055, phaseRad: 0.0, showOrbit: true, orbiting: { type: "planet", planetId: "earth" }, classKey: "moon" },

  // Mars
  { id: "phobos", name: "Phobos", radiusPx: 3, orbitMoonScaled: 2.8, orbitPeriodSec: simPeriod(0.319), eccentricity: 0.02, phaseRad: 0.4, showOrbit: false, orbiting: { type: "planet", planetId: "mars" }, classKey: "moon" },
  { id: "deimos", name: "Deimos", radiusPx: 3, orbitMoonScaled: 6.9, orbitPeriodSec: simPeriod(1.263), eccentricity: 0.00, phaseRad: 1.2, showOrbit: false, orbiting: { type: "planet", planetId: "mars" }, classKey: "moon" },

  // Jupiter (Galilean)
  { id: "io", name: "Io", radiusPx: 4, orbitMoonScaled: 5.9, orbitPeriodSec: simPeriod(1.769), eccentricity: 0.00, phaseRad: 0.2, showOrbit: false, orbiting: { type: "planet", planetId: "jupiter" }, classKey: "moon" },
  { id: "europa", name: "Europa", radiusPx: 4, orbitMoonScaled: 9.4, orbitPeriodSec: simPeriod(3.551), eccentricity: 0.01, phaseRad: 1.0, showOrbit: false, orbiting: { type: "planet", planetId: "jupiter" }, classKey: "moon" },
  { id: "ganymede", name: "Ganymede", radiusPx: 5, orbitMoonScaled: 15.0, orbitPeriodSec: simPeriod(7.155), eccentricity: 0.00, phaseRad: 2.0, showOrbit: false, orbiting: { type: "planet", planetId: "jupiter" }, classKey: "moon" },
  { id: "callisto", name: "Callisto", radiusPx: 5, orbitMoonScaled: 26.3, orbitPeriodSec: simPeriod(16.689), eccentricity: 0.01, phaseRad: 2.7, showOrbit: false, orbiting: { type: "planet", planetId: "jupiter" }, classKey: "moon" },

  // Saturn (starter set)
  { id: "titan", name: "Titan", radiusPx: 5, orbitMoonScaled: 20.3, orbitPeriodSec: simPeriod(15.945), eccentricity: 0.03, phaseRad: 0.5, showOrbit: false, orbiting: { type: "planet", planetId: "saturn" }, classKey: "moon" },
  { id: "enceladus", name: "Enceladus", radiusPx: 3, orbitMoonScaled: 4.0, orbitPeriodSec: simPeriod(1.370), eccentricity: 0.00, phaseRad: 1.8, showOrbit: false, orbiting: { type: "planet", planetId: "saturn" }, classKey: "moon" },

  // Uranus
  { id: "titania", name: "Titania", radiusPx: 4, orbitMoonScaled: 17.1, orbitPeriodSec: simPeriod(8.706), eccentricity: 0.00, phaseRad: 0.9, showOrbit: false, orbiting: { type: "planet", planetId: "uranus" }, classKey: "moon" },

  // Neptune
  { id: "triton", name: "Triton", radiusPx: 4, orbitMoonScaled: 14.3, orbitPeriodSec: simPeriod(5.877), eccentricity: 0.00, phaseRad: 2.2, showOrbit: false, orbiting: { type: "planet", planetId: "neptune" }, classKey: "moon" },
];

export function buildBodies(params: {
  orbitScalePx: number; // for planets
  bodyScale: number; // for body sizes
  styles: Record<string, string>;
}): BodyConfig[] {
  const { orbitScalePx, bodyScale, styles } = params;

  return BODY_PRESETS.map((b) => {
    const isSunOrbit = b.orbiting === "sun";

    // Planets get actual orbitRadiusPx from AU scaling.
    // Moons will have orbitRadiusPx resolved later in SolarSystem.tsx from parent radius.
    const orbitRadiusPx = isSunOrbit ? (b.orbitAUScaled ?? 0) * orbitScalePx : 0;

    return {
      id: b.id,
      name: b.name,
      radiusPx: b.radiusPx * bodyScale,
      orbitRadiusPx,
      orbitPeriodSec: b.orbitPeriodSec,
      eccentricity: b.eccentricity,
      phaseRad: b.phaseRad,
      showOrbit: b.showOrbit,
      orbiting: b.orbiting,
      orbitMoonScaled: b.orbitMoonScaled,
      className: styles[b.classKey],
    };
  });
}