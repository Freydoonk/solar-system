import { Quaternion, Vector3 } from "three";
import type { ApproximateLocation } from "./location.ts";
import type { CameraRequest } from "./space.ts";

/** Match the longitude/latitude convention of the Earth's actual surface map. */
export function geographicDirection(location: ApproximateLocation, earthOrientation: Quaternion): Vector3 {
  const latitude = location.latitude * Math.PI / 180;
  const longitude = location.longitude * Math.PI / 180;
  return new Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  ).applyQuaternion(earthOrientation).normalize();
}

/** A released initial view can never be re-armed by a late location response. */
export function createInitialLocationLock(onRelease: () => void) {
  let released = false;
  return {
    release() {
      if (!released) { released = true; onRelease(); }
    },
    direction(location: ApproximateLocation | null, orientation: Quaternion, request: CameraRequest, enabled: boolean) {
      return !released && enabled && location && request.serial === 0 && request.bodyId === "earth"
        ? geographicDirection(location, orientation) : null;
    },
  };
}
