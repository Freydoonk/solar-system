import { formatMessage, type Translate } from "../../i18n/format.ts";
import { Body } from "astronomy-engine";
import type { Equipment } from "./eyepiece.ts";
import type { Target } from "./observing.ts";

type Profile = {
  id: string; name: string; design: string; owner: string; aperture: string; band: string;
  capability: string; source: string;
};
export type Telescope = Profile & (
  | { kind: "amateur"; apertureMm: number; focalMm: number; exampleEyepieceMm: number }
  | { kind: "professional" | "space" }
);
export const TELESCOPE_GROUPS = [
  { kind: "amateur", label: "Amateur · commercial models" },
  { kind: "professional", label: "Professional · ground observatories" },
  { kind: "space", label: "Space · research telescopes" },
] as const;

// Specifications checked against the linked manufacturers/observatories, 2026-10-26.
// Accessory AFOV is an explicitly labelled example, not a claimed kit specification.
export const TELESCOPES: readonly Telescope[] = [
  { id: "powerseeker-70az", name: "Celestron PowerSeeker 70AZ", kind: "amateur",
    design: "Refractor · manual alt-azimuth", owner: "Celestron · commercial model", aperture: "70 mm", band: "Visible light · visual observing",
    apertureMm: 70, focalMm: 700, exampleEyepieceMm: 20,
    capability: "A small refractor for the Moon, bright planets and bright star clusters. Fine planetary detail is limited by its aperture and atmospheric steadiness.",
    source: "https://www.celestron.com/products/powerseeker-70az-telescope" },
  { id: "heritage-130", name: "Sky-Watcher Heritage 130", kind: "amateur",
    design: "Newtonian reflector · tabletop Dobsonian", owner: "Sky-Watcher · commercial model", aperture: "130 mm", band: "Visible light · visual observing",
    apertureMm: 130, focalMm: 650, exampleEyepieceMm: 25,
    capability: "A compact reflector for lunar and planetary observing, plus brighter nebulae and clusters. Mirror alignment and a stable support matter for a sharp view.",
    source: "https://www.skywatcherusa.com/products/heritage-130-tabletop-dobsonian" },
  { id: "nexstar-8se", name: "Celestron NexStar 8SE", kind: "amateur",
    design: "Schmidt-Cassegrain · computerized alt-azimuth", owner: "Celestron · commercial model", aperture: "203.2 mm", band: "Visible light · visual observing / camera use",
    apertureMm: 203.2, focalMm: 2032, exampleEyepieceMm: 25,
    capability: "A larger aperture and long focal length for lunar and planetary detail. Tracking helps keep a target centred; useful detail still depends on seeing, cooling and optical alignment.",
    source: "https://www.celestron.com/products/nexstar-8se-computerized-telescope" },
  { id: "hale", name: "Hale 200-inch Telescope", kind: "professional",
    design: "Reflector · research observatory", owner: "Palomar Observatory / Caltech · California, USA", aperture: "5.1 m", band: "Optical / infrared instruments",
    capability: "Scientific cameras and instruments support Solar System research, exoplanet searches and studies of stars and distant galaxies. Observations are recorded as data, rather than viewed through a consumer eyepiece.",
    source: "https://astro.caltech.edu/palomar/about/telescopes/hale.html" },
  { id: "vlt", name: "ESO Very Large Telescope · one UT", kind: "professional",
    design: "Ritchey–Chrétien reflector · research observatory", owner: "ESO Paranal Observatory · Chile", aperture: "8.2 m per Unit Telescope", band: "Optical / infrared instruments",
    capability: "Imaging, adaptive optics and spectroscopy study faint objects and fine structure. This profile describes one Unit Telescope; combining the VLT as an interferometer is a different observing mode.",
    source: "https://www.eso.org/public/teles-instr/paranal-observatory/vlt/" },
  { id: "keck", name: "W. M. Keck · one telescope", kind: "professional",
    design: "Segmented-mirror reflector · research observatory", owner: "W. M. Keck Observatory · Maunakea, Hawai‘i", aperture: "10 m per telescope", band: "Optical / infrared instruments",
    capability: "The two telescopes use scientific imagers and spectrographs. Adaptive optics can correct atmospheric blur for suitable observations; the detector and observing mode determine the recorded view.",
    source: "https://keckobservatory.org/telescopes-instrumentation/" },
  { id: "gtc", name: "Gran Telescopio Canarias", kind: "professional",
    design: "Segmented Ritchey–Chrétien reflector", owner: "GRANTECAN · Roque de los Muchachos, La Palma", aperture: "10.4 m equivalent diameter", band: "Optical / infrared · 0.365–25 μm",
    capability: "A large collecting area supports scientific imaging and spectroscopy. Instrument choice, wavelength and atmospheric conditions determine which structures can be measured.",
    source: "https://www.gtc.iac.es/observing/GTCoptics.php" },
  { id: "hubble", name: "Hubble Space Telescope", kind: "space",
    design: "Space observatory · reflecting telescope", owner: "NASA / ESA · low Earth orbit", aperture: "2.4 m", band: "Ultraviolet, visible, near-infrared · 0.115–2.5 μm",
    capability: "Cameras and spectrographs record planetary weather, stars, nebulae and galaxies without ground-level atmospheric blur. Filters and exposure choices define the resulting image; there is no visual eyepiece.",
    source: "https://science.nasa.gov/mission/hubble/overview/about-hubble/" },
  { id: "webb", name: "James Webb Space Telescope", kind: "space",
    design: "Space observatory · segmented infrared telescope", owner: "NASA / ESA / CSA · Sun–Earth L2 region", aperture: "About 6.6 m across · 25 m² collecting area", band: "Red to mid-infrared · 0.6–28.8 μm",
    capability: "Infrared cameras and spectrographs study planetary atmospheres, star formation and distant galaxies. Published colours map filters to visible colours; they are not a human-eye view.",
    source: "https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/" },
];

export function equipmentForTelescope(telescope: Telescope): Equipment | null {
  if (telescope.kind !== "amateur") return null;
  return { focal: String(telescope.focalMm), aperture: String(telescope.apertureMm),
    eyepiece: String(telescope.exampleEyepieceMm), afov: "50", factor: "1" };
}

export function researchTargetGuide(telescope: Telescope, body: Target, translate: Translate = formatMessage) {
  if (telescope.id === "webb") {
    const source = "https://jwst-docs.stsci.edu/methods-and-roadmaps/jwst-moving-target-observations/jwst-moving-target-supporting-technical-information/moving-target-field-of-regard";
    if (body === Body.Moon || body === Body.Mercury || body === Body.Venus) return {
      unavailable: true, text: translate("Webb cannot observe {body}: its sunshield and permitted pointing directions exclude this target. The 3D model is an illustration only.", { body: translate(body) }), source,
    };
    if (body === Body.Saturn) return { unavailable: false,
      text: "Webb’s infrared observations can show bright icy rings against a much darker Saturn at methane-absorbing wavelengths. The visible-colour 3D model here is not a Webb exposure.",
      source: "https://science.nasa.gov/asset/webb/saturn-nircam/" };
    return { unavailable: false, text: translate("Webb can study {body} with infrared images or spectra. Brightness limits, filters and spacecraft visibility windows must be planned with its own tools; this page does not calculate them.", { body: translate(body) }),
      source: "https://science.nasa.gov/mission/webb/faqs-full/" };
  }
  if (telescope.id === "hubble") {
    const source = "https://esahubble.org/wordbank/planet/";
    if (body === Body.Mercury) return { unavailable: true, text: "Hubble cannot observe Mercury because it is too close to the Sun in the sky. The model is an illustration, not an available observation.", source };
    if (body === Body.Moon || body === Body.Venus) return { unavailable: false,
      text: translate("{body} requires special pointing/tracking constraints. This catalogue does not establish whether a present-day Hubble observation is allowed or feasible.", { body: translate(body) }), source: telescope.source };
    return { unavailable: false, text: translate("Hubble’s filtered images can resolve structure on {body} and track changes over time. What is recorded depends on wavelength, exposure and instrument; the model does not predict that image.", { body: translate(body) }), source };
  }
  return { unavailable: false, text: translate("For {body}, a research camera or spectrograph records images or spectra. Detail depends on the instrument, wavelength, atmospheric correction and exposure. This profile does not calculate observatory scheduling or detector performance.", { body: translate(body) }), source: telescope.source };
}
