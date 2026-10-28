import { isDaylightMarker, skyNightVisibility, type SkyMarker } from "./skyViewModel.ts";

export const SKY_LAYERS = [
  { key: "stars", label: "Stars" }, { key: "planets", label: "Planets" },
  { key: "moon", label: "Moon" }, { key: "sun", label: "Sun" },
  { key: "constellations", label: "Constellations" }, { key: "messier", label: "Messier objects" },
  { key: "labels", label: "Labels" }, { key: "compass", label: "Compass directions" },
] as const;
export type SkyLayers = Record<typeof SKY_LAYERS[number]["key"], boolean>;
export const DEFAULT_SKY_LAYERS: SkyLayers = {
  stars: true, planets: true, moon: true, sun: true,
  constellations: true, messier: false, labels: true, compass: true,
};
export function markerEnabled(marker: Pick<SkyMarker, "id" | "kind">, layers: SkyLayers) {
  switch (marker.kind) {
    case "sun": return layers.sun;
    case "star": return layers.stars;
    case "planet": return marker.id === "Moon" ? layers.moon : layers.planets;
    case "messier": return layers.messier;
    case "constellation": return layers.constellations;
    case "compass": return layers.compass;
  }
}
export function markerVisible(marker: SkyMarker, layers: SkyLayers, matchDaylight: boolean, sunAltitude: number) {
  return markerEnabled(marker, layers) && (!matchDaylight || skyNightVisibility(sunAltitude) > 0 || isDaylightMarker(marker));
}
