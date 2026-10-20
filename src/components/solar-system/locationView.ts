import { Quaternion, Vector3 } from "three";
import type { ApproximateLocation } from "./location.ts";

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
