export type HorizonProfile = readonly number[];
export const FLAT_HORIZON: HorizonProfile = Object.freeze(Array(8).fill(0) as number[]);
export const HORIZON_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function validateHorizon(profile: HorizonProfile) {
  if (!Array.isArray(profile) || profile.length !== 8 || profile.some(height => !Number.isFinite(height) || height < 0 || height > 90)) throw new Error("Enter eight obstruction heights from 0° to 90°.");
}
/** Piecewise-linear altitude mask, measured clockwise from true north. */
export function horizonAltitude(profile: HorizonProfile, azimuth: number) {
  const index = ((azimuth % 360 + 360) % 360) / 45;
  const lower = Math.floor(index); const fraction = index - lower;
  return profile[lower] * (1 - fraction) + profile[(lower + 1) % 8] * fraction;
}
/** Sample clearance every <=30 s and refine sign-changing edges to 0.1 s.
 * Very short/grazing clearances are not guaranteed: this is a user-estimated mask. */
export function clearIntervals(start: number, end: number, clearance: (time: number) => number) {
  const intervals: { start: number; end: number }[] = [];
  let from = start; let inside = clearance(start) >= 0;
  const steps = Math.ceil((end - start) / 30000);
  let previous = start;
  for (let index = 1; index <= steps; index++) {
    const time = start + (end - start) * index / steps;
    const nextInside = clearance(time) >= 0;
    if (nextInside !== inside) {
      let low = previous; let high = time;
      while (high - low > 100) { const middle = (low + high) / 2; if ((clearance(middle) >= 0) === inside) low = middle; else high = middle; }
      const edge = (low + high) / 2;
      if (inside && edge - from >= 60000) intervals.push({ start: from, end: edge });
      from = edge; inside = nextInside;
    }
    previous = time;
  }
  if (inside && end - from >= 60000) intervals.push({ start: from, end });
  return intervals;
}
