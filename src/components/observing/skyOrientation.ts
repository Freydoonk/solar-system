import { Euler, Quaternion, Vector3 } from "three";

const rad = Math.PI / 180;
export const wrapBearing = (angle: number) => (angle % 360 + 360) % 360;
export type OrientationSample = { alpha: number | null; beta: number | null; gamma: number | null; absolute: boolean };

/** Local world axes: east +X, up +Y, north -Z. Camera looks out the phone's back. */
export function horizontalVector(azimuth: number, altitude: number) {
  return new Vector3(Math.sin(azimuth * rad) * Math.cos(altitude * rad), Math.sin(altitude * rad), -Math.cos(azimuth * rad) * Math.cos(altitude * rad));
}

/** W3C intrinsic Z-X'-Y'' rotation in ENU, followed by screen compensation.
 * https://www.w3.org/TR/orientation-event/#deviceorientation
 * Relative alpha has no north reference and must be explicitly aligned. */
export function deviceQuaternion(sample: OrientationSample, screenAngle: number, headingOffset = 0): Quaternion | null {
  const { alpha, beta, gamma } = sample;
  if (alpha === null || beta === null || gamma === null || ![alpha, beta, gamma, screenAngle, headingOffset].every(Number.isFinite)
    || alpha < 0 || alpha > 360 || Math.abs(beta) > 180 || Math.abs(gamma) > 90) return null;
  return new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -headingOffset * rad)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2))
    .multiply(new Quaternion().setFromEuler(new Euler(beta * rad, gamma * rad, alpha * rad, "ZXY")))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -screenAngle * rad));
}

export function viewDirection(quaternion: Quaternion) {
  const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion);
  return { azimuth: wrapBearing(Math.atan2(forward.x, -forward.z) / rad), altitude: Math.asin(Math.max(-1, Math.min(1, forward.y))) / rad };
}

export function manualQuaternion(azimuth: number, altitude: number) {
  return new Quaternion().setFromEuler(new Euler(altitude * rad, -azimuth * rad, 0, "YXZ"));
}

/** Near the zenith/nadir the bearing is undefined, so alignment must wait. */
export function alignmentOffset(sample: OrientationSample, screenAngle: number, trueBearing: number) {
  const pose = deviceQuaternion(sample, screenAngle);
  if (!pose || !Number.isFinite(trueBearing)) return null;
  const direction = viewDirection(pose);
  return Math.abs(direction.altitude) > 80 ? null : wrapBearing(trueBearing - direction.azimuth);
}
