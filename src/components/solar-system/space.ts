import type { Vec3 } from "./astronomy.ts";
import { moonOrbitRadius, planetOrbitRadius, type SceneLayout } from "./layout.ts";
import { BODY_PRESETS } from "./planets.ts";

export type CameraView = "oblique" | "top" | "side" | "close";
export type CameraRequest = { bodyId: string | null; view: CameraView; serial: number };
export const BODY_ENVELOPES: Record<string, number> = { saturn: 2.4, uranus: 2 };

/** Ecliptic north is world +Y; the ecliptic plane is world XZ. */
export function toWorld(vector: Vec3): Vec3 {
  return { x: vector.x, y: vector.z, z: -vector.y };
}

export function projectToSpace(id: string, vector: Vec3, layout: SceneLayout, moon = false): Vec3 {
  const distance = Math.hypot(vector.x, vector.y, vector.z);
  if (!distance) return { x: 0, y: 0, z: 0 };
  const radius = moon ? moonOrbitRadius(id, distance, layout) : planetOrbitRadius(id, distance, layout);
  const world = toWorld(vector);
  return { x: world.x * radius / distance, y: world.y * radius / distance, z: world.z * radius / distance };
}

export function getSpacePositions(positions: Record<string, Vec3>, layout: SceneLayout): Record<string, Vec3> {
  const result: Record<string, Vec3> = { sun: { x: 0, y: 0, z: 0 } };
  for (const body of BODY_PRESETS) {
    const offset = projectToSpace(body.id, positions[body.id], layout, !!body.parentId);
    const parent = result[body.parentId ?? "sun"];
    result[body.id] = { x: parent.x + offset.x, y: parent.y + offset.y, z: parent.z + offset.z };
  }
  return result;
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
