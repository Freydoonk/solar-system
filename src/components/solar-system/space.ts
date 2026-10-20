import type { Vec3 } from "./astronomy.ts";
import { AU_KM, BODY_PRESETS, SUN_RADIUS_KM } from "./planets.ts";

export type CameraView = "oblique" | "top" | "side" | "close";
export type CameraRequest = { bodyId: string | null; view: CameraView; serial: number };
export const BODY_ENVELOPES: Record<string, number> = { saturn: 2.4, uranus: 2 };
/** All radii AND separations use this same linear conversion, without floors. */
export const KM_PER_WORLD_UNIT = 1_000_000;
export const kmToWorld = (km: number) => km / KM_PER_WORLD_UNIT;
export const auToWorld = (au: number) => kmToWorld(au * AU_KM);

/** Ecliptic north is world +Y; the ecliptic plane is world XZ. */
export function toWorld(vector: Vec3): Vec3 {
  return { x: vector.x, y: vector.z, z: -vector.y };
}

export function projectToSpace(vector: Vec3): Vec3 {
  const world = toWorld(vector);
  return { x: auToWorld(world.x), y: auToWorld(world.y), z: auToWorld(world.z) };
}

export function getSpacePositions(positions: Record<string, Vec3>): Record<string, Vec3> {
  const result: Record<string, Vec3> = { sun: { x: 0, y: 0, z: 0 } };
  for (const body of BODY_PRESETS) {
    const offset = projectToSpace(positions[body.id]);
    const parent = result[body.parentId ?? "sun"];
    result[body.id] = { x: parent.x + offset.x, y: parent.y + offset.y, z: parent.z + offset.z };
  }
  return result;
}

/** Illustrative circle through the satellite's current position, in world units. */
export function getMoonGuide(position: Vec3, samples = 64): Vec3[] {
  const offset = projectToSpace(position);
  const radius = Math.hypot(offset.x, offset.y, offset.z);
  const horizontal = Math.hypot(offset.x, offset.z);
  const tangent = horizontal ? { x: -offset.z / horizontal, y: 0, z: offset.x / horizontal }
    : { x: 1, y: 0, z: 0 };
  return Array.from({ length: samples }, (_, i) => {
    const angle = i / samples * Math.PI * 2;
    return {
      x: offset.x * Math.cos(angle) + tangent.x * radius * Math.sin(angle),
      y: offset.y * Math.cos(angle),
      z: offset.z * Math.cos(angle) + tangent.z * radius * Math.sin(angle),
    };
  });
}

export function createPhysicalLayout(guides: Record<string, Vec3[]>) {
  const bodyRadii: Record<string, number> = { sun: kmToWorld(SUN_RADIUS_KM) };
  const systemRadii: Record<string, number> = {};
  for (const body of BODY_PRESETS) bodyRadii[body.id] = kmToWorld(body.radiusKm);
  for (const planet of BODY_PRESETS.filter((body) => !body.parentId)) {
    systemRadii[planet.id] = Math.max(
      bodyRadii[planet.id] * (BODY_ENVELOPES[planet.id] ?? 1),
      ...BODY_PRESETS.filter((body) => body.parentId === planet.id)
        .map((moon) => kmToWorld(moon.semiMajorKm * 1.3 + moon.radiusKm)),
    );
  }
  // This bound only frames the camera. It never remaps an orbit or body.
  const outerRadius = Math.max(bodyRadii.sun, ...Object.entries(guides).flatMap(([id, points]) =>
    points.map((p) => auToWorld(Math.hypot(p.x, p.y, p.z)) + systemRadii[id])));
  return { bodyRadii, systemRadii, outerRadius };
}

/** Subtract in JS double precision before sending a transform to the GPU. */
export function relativeToOrigin(position: Vec3, origin: Vec3): Vec3 {
  return { x: position.x - origin.x, y: position.y - origin.y, z: position.z - origin.z };
}

/** Near clipping must also work for kilometre-sized moons in a vast scene. */
export function cameraNearPlane(radius: number): number {
  return Math.max(1e-12, radius * 0.001);
}

/** A uniform render-only unit change avoids log-depth quantization up close. */
export function renderScaleForDistance(distance: number): number {
  return 1 / Math.max(distance, 1e-9);
}

/** Distance that fits a sphere in both axes, with room for its label. */
export function fitDistance(radius: number, aspect: number, verticalFov = 45): number {
  const halfVertical = verticalFov * Math.PI / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * Math.max(aspect, 0.01));
  return radius * 1.3 / Math.sin(Math.min(halfVertical, halfHorizontal));
}

/** Translate camera and target together when a followed body moves or dates jump. */
export function followOffset(previous: Vec3, next: Vec3): Vec3 {
  return { x: next.x - previous.x, y: next.y - previous.y, z: next.z - previous.z };
}
