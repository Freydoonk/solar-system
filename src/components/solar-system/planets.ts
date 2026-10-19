import { Body } from "astronomy-engine";

export type BodyConfig = {
  id: string;
  name: string;
  radiusKm: number;
  /** Mean orbital period in Earth days; used for orbit guides and schematic moons. */
  periodDays: number;
  semiMajorKm: number;
  parentId?: string;
  astronomyBody?: Body;
  schematic?: boolean;
  retrograde?: boolean;
};

export const AU_KM = 149_597_870.7;
export const SUN_RADIUS_KM = 695_700;
export const EARTH_RADIUS_KM = 6_371.0084;
export const SUN_MARKER_RADIUS_PX = 5;

// Mean radii: https://ssd.jpl.nasa.gov/planets/phys_par.html
// Satellites: https://ssd.jpl.nasa.gov/sats/phys_par/
// Mean periods/distances: https://ssd.jpl.nasa.gov/sats/elem/sep.html
export const BODY_PRESETS: BodyConfig[] = [
  { id: "mercury", name: "Mercury", radiusKm: 2439.4, semiMajorKm: 0.3871 * AU_KM, periodDays: 87.969, astronomyBody: Body.Mercury },
  { id: "venus", name: "Venus", radiusKm: 6051.8, semiMajorKm: 0.7233 * AU_KM, periodDays: 224.701, astronomyBody: Body.Venus },
  { id: "earth", name: "Earth", radiusKm: EARTH_RADIUS_KM, semiMajorKm: AU_KM, periodDays: 365.256, astronomyBody: Body.Earth },
  { id: "mars", name: "Mars", radiusKm: 3389.5, semiMajorKm: 1.5237 * AU_KM, periodDays: 686.980, astronomyBody: Body.Mars },
  { id: "jupiter", name: "Jupiter", radiusKm: 69911, semiMajorKm: 5.2029 * AU_KM, periodDays: 4332.589, astronomyBody: Body.Jupiter },
  { id: "saturn", name: "Saturn", radiusKm: 58232, semiMajorKm: 9.5367 * AU_KM, periodDays: 10759.22, astronomyBody: Body.Saturn },
  { id: "uranus", name: "Uranus", radiusKm: 25362, semiMajorKm: 19.189 * AU_KM, periodDays: 30685.4, astronomyBody: Body.Uranus },
  { id: "neptune", name: "Neptune", radiusKm: 24622, semiMajorKm: 30.07 * AU_KM, periodDays: 60189, astronomyBody: Body.Neptune },
  { id: "pluto", name: "Pluto", radiusKm: 1188.3, semiMajorKm: 39.482 * AU_KM, periodDays: 90560, astronomyBody: Body.Pluto },
  { id: "moon", name: "Moon", radiusKm: 1737.4, semiMajorKm: 384400, periodDays: 27.321661, parentId: "earth" },
  { id: "phobos", name: "Phobos", radiusKm: 11.08, semiMajorKm: 9375, periodDays: 0.318911, parentId: "mars", schematic: true },
  { id: "deimos", name: "Deimos", radiusKm: 6.2, semiMajorKm: 23457, periodDays: 1.262441, parentId: "mars", schematic: true },
  { id: "io", name: "Io", radiusKm: 1821.49, semiMajorKm: 421800, periodDays: 1.769138, parentId: "jupiter" },
  { id: "europa", name: "Europa", radiusKm: 1560.8, semiMajorKm: 671100, periodDays: 3.551181, parentId: "jupiter" },
  { id: "ganymede", name: "Ganymede", radiusKm: 2631.2, semiMajorKm: 1070400, periodDays: 7.154553, parentId: "jupiter" },
  { id: "callisto", name: "Callisto", radiusKm: 2410.3, semiMajorKm: 1882700, periodDays: 16.689018, parentId: "jupiter" },
  { id: "titan", name: "Titan", radiusKm: 2574.76, semiMajorKm: 1221865, periodDays: 15.945448, parentId: "saturn", schematic: true },
  { id: "enceladus", name: "Enceladus", radiusKm: 252.1, semiMajorKm: 238400, periodDays: 1.370218, parentId: "saturn", schematic: true },
  { id: "titania", name: "Titania", radiusKm: 788.9, semiMajorKm: 436298, periodDays: 8.705869, parentId: "uranus", schematic: true },
  { id: "triton", name: "Triton", radiusKm: 1352.6, semiMajorKm: 354800, periodDays: 5.876994, parentId: "neptune", schematic: true, retrograde: true },
];

export type SizeMode = "true" | "readable";

export function bodyRadiusPx(radiusKm: number, scale: number, mode: SizeMode): number {
  // Anchor the common scale to Earth, so planets and moons remain visible.
  // The Sun uses this factor only when its true-size display is enabled.
  if (mode === "true") return (radiusKm / EARTH_RADIUS_KM) * 3 * scale;
  // Explicitly illustrative alternative for exploring bodies on a small screen.
  return 3 * Math.pow(radiusKm / EARTH_RADIUS_KM, 0.55) * scale;
}
