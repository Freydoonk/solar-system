import type { Vec2 } from "./astronomy.ts";

export const MIN_ZOOM = 0.5;
// A true-scale overview must also reach kilometre-sized moons.
export const MAX_ZOOM = 10_000_000_000;
export type Viewport = { zoom: number; pan: Vec2 };

/** The anchor is measured from the centre of the scene, in screen pixels. */
export function zoomAtPoint(view: Viewport, requestedZoom: number, anchor: Vec2): Viewport {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedZoom));
  if (zoom === view.zoom) return view;
  const ratio = zoom / view.zoom;
  return {
    zoom,
    pan: {
      x: anchor.x - (anchor.x - view.pan.x) * ratio,
      y: anchor.y - (anchor.y - view.pan.y) * ratio,
    },
  };
}

export function zoomWithWheel(view: Viewport, anchor: Vec2, deltaY: number, deltaMode: number, pageHeight: number): Viewport {
  // Wheel events may report pixels, lines, or pages. Limit unusually large
  // deltas so one wheel notch cannot jump across the entire zoom range.
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1;
  const pixels = Math.max(-250, Math.min(250, deltaY * unit));
  return zoomAtPoint(view, view.zoom * Math.exp(-pixels * 0.002), anchor);
}
