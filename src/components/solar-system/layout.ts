import type { Vec2, Vec3 } from "./astronomy.ts";
import type { createPhysicalLayout } from "./space.ts";
import { BODY_ENVELOPES, relativeToOrigin } from "./space.ts";

type PhysicalLayout = ReturnType<typeof createPhysicalLayout>;
export type PlaneLayout = { scale: number; bodyRadii: Record<string, number>; locatorRadius: number };

/** Orthographic north-ecliptic view of the same physical scene used in 3D. */
export function createPlaneLayout(physical: PhysicalLayout, extent: number, zoom: number): PlaneLayout {
  const scale = Math.max(1, extent) / physical.outerRadius * zoom;
  return {
    scale,
    bodyRadii: Object.fromEntries(Object.entries(physical.bodyRadii).map(([id, radius]) => [id, radius * scale])),
    locatorRadius: 4, // Annotation only; never a minimum radius for a body.
  };
}

export function projectPlane(position: Vec3, layout: PlaneLayout, origin: Vec3 = { x: 0, y: 0, z: 0 }): Vec2 {
  const offset = relativeToOrigin(position, origin);
  return { x: offset.x * layout.scale, y: offset.z * layout.scale };
}

export function planeFocusZoom(id: string | null, physical: PhysicalLayout): number {
  return id ? physical.outerRadius * 0.55 / (physical.bodyRadii[id] * (BODY_ENVELOPES[id] ?? 1)) : 1;
}
