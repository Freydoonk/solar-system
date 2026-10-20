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

export function sunViewMinimumDistance(id: string, radii: Record<string, number>, aspect: number, fov = 45) {
  return fitDistance(radii[id] * (BODY_ENVELOPES[id] ?? 1), aspect, fov, 0.3);
}

/** Camera offset framing the body and Sun without changing physical geometry. */
export function sunViewOffset(
  id: string, positions: Record<string, Vec3>, radii: Record<string, number>,
  requestedDistance: number, aspect: number, fov = 45, preferredOffset?: Vector3,
): Vector3 {
  const center = new Vector3().copy(positions[id]);
  const towardSun = new Vector3().copy(positions.sun).sub(center).normalize();
  if (towardSun.lengthSq() === 0) return new Vector3(0, 0, requestedDistance);
  const halfFov = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, Math.max(0.01, aspect)));
  const angle = halfFov * 0.65;
  const tangent = preferredOffset?.clone().addScaledVector(towardSun, -preferredOffset.dot(towardSun))
    ?? new Vector3().crossVectors(towardSun, new Vector3(0, 1, 0));
  if (tangent.lengthSq() < 1e-12) tangent.crossVectors(towardSun, new Vector3(0, 1, 0));
  if (tangent.lengthSq() < 1e-12) tangent.crossVectors(towardSun, new Vector3(1, 0, 0));
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
  let distance = Math.max(requestedDistance, sunViewMinimumDistance(id, radii, aspect, fov));
  let offset = new Vector3();
  // A moon's parent can eclipse the Sun. Try nearby viewing azimuths, then pull
  // the camera back until both sight lines clear the intervening physical body.
  for (let step = 0; step < 16; step++, distance *= 2) {
    for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const side = tangent.clone().applyAxisAngle(towardSun, turn * Math.PI / 4);
      offset = towardSun.clone().multiplyScalar(-Math.cos(angle)).addScaledVector(side, Math.sin(angle)).multiplyScalar(distance);
      if (!blocked(offset, id) && !blocked(offset, "sun")) return offset;
    }
  }
  return offset;
}
