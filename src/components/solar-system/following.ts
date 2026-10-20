import { Vector3 } from "three";
import type { Vec3 } from "./astronomy.ts";
import { BODY_ENVELOPES, fitDistance, type CameraRequest, type FollowMode } from "./space.ts";

/** Manual movement releases this request; only an explicit new request re-arms it. */
export function createFollowLock(onRelease: (serial: number) => void) {
  let releasedSerial: number | null = null;
  return {
    release(request: CameraRequest) {
      if (releasedSerial !== request.serial && request.followMode && request.followMode !== "free") {
        releasedSerial = request.serial;
        onRelease(request.serial);
      }
    },
    mode(request: CameraRequest): FollowMode {
      return releasedSerial === request.serial ? "free" : request.followMode ?? "free";
    },
  };
}

export function pairedViewMinimumDistance(id: string, radii: Record<string, number>, aspect: number, fov = 45) {
  return fitDistance(radii[id] * (BODY_ENVELOPES[id] ?? 1), aspect, fov, 0.3);
}

/** Look at a moon from just outside its parent (and rings), or approach along that line. */
export function fromParentView(
  id: string, parentId: string, positions: Record<string, Vec3>, radii: Record<string, number>, fraction = 1,
) {
  const towardParent = new Vector3().copy(positions[parentId]).sub(new Vector3().copy(positions[id]));
  const minDistance = radii[id] * 1.08;
  const maxDistance = Math.max(minDistance, towardParent.length() - radii[parentId] * (BODY_ENVELOPES[parentId] ?? 1) * 1.05);
  const distance = Math.max(minDistance, Math.min(maxDistance, fraction * maxDistance));
  return { offset: towardParent.normalize().multiplyScalar(distance), minDistance, maxDistance };
}

/** Camera offset framing the body with the Sun or its parent, at physical scale. */
export function pairedViewOffset(
  id: string, companionId: string, positions: Record<string, Vec3>, radii: Record<string, number>,
  requestedDistance: number, aspect: number, fov = 45, preferredOffset?: Vector3,
): Vector3 {
  const center = new Vector3().copy(positions[id]);
  const companion = new Vector3().copy(positions[companionId]).sub(center);
  const towardCompanion = companion.clone().normalize();
  if (towardCompanion.lengthSq() === 0) return new Vector3(0, 0, requestedDistance);
  const halfFov = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, Math.max(0.01, aspect)));
  const angle = halfFov * 0.65;
  const tangent = preferredOffset?.clone().addScaledVector(towardCompanion, -preferredOffset.dot(towardCompanion))
    ?? new Vector3().crossVectors(towardCompanion, new Vector3(0, 1, 0));
  if (tangent.lengthSq() < 1e-12) tangent.crossVectors(towardCompanion, new Vector3(0, 1, 0));
  if (tangent.lengthSq() < 1e-12) tangent.crossVectors(towardCompanion, new Vector3(1, 0, 0));
  tangent.normalize();
  const relative = Object.entries(positions).map(([bodyId, position]) =>
    ({ id: bodyId, position: new Vector3().copy(position).sub(center), radius: radii[bodyId] }));
  const blocked = (camera: Vector3, targetId: string) => {
    const target = relative.find((body) => body.id === targetId)!;
    const ray = target.position.clone().sub(camera);
    const distance = ray.length();
    ray.divideScalar(distance);
    return relative.some((body) => {
      if (body.id === targetId) return false;
      const toward = body.position.clone().sub(camera);
      if (toward.length() <= body.radius * 1.05) return true;
      const along = toward.dot(ray);
      return along > 0 && along < distance
        && toward.addScaledVector(ray, -along).length() < body.radius * 1.05;
    });
  };
  const companionRadius = radii[companionId] * (BODY_ENVELOPES[companionId] ?? 1);
  const companionFits = (offset: Vector3) => {
    const sightLine = companion.clone().sub(offset);
    const distance = sightLine.length();
    if (distance <= companionRadius) return false;
    const separation = sightLine.angleTo(offset.clone().negate());
    // Fit the entire disc/ring envelope, not just the center, in either orientation.
    return separation + Math.asin(companionRadius / distance) < halfFov * 0.95;
  };
  let distance = Math.max(requestedDistance, pairedViewMinimumDistance(id, radii, aspect, fov));
  let offset = new Vector3();
  // Try nearby azimuths, then retreat to fit the companion and clear both sight lines.
  for (let step = 0; step < 16; step++, distance *= 2) {
    for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const side = tangent.clone().applyAxisAngle(towardCompanion, turn * Math.PI / 4);
      offset = towardCompanion.clone().multiplyScalar(-Math.cos(angle)).addScaledVector(side, Math.sin(angle)).multiplyScalar(distance);
      if (companionFits(offset) && !blocked(offset, id) && !blocked(offset, companionId)) return offset;
    }
  }
  return offset;
}
