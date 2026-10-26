import { AngleBetween, Body, Ecliptic, Elongation, GeoVector, HelioVector, Illumination, MoonPhase } from "astronomy-engine";
import { DAY_MS } from "../solar-system/astronomy.ts";
export type LessonId = "retrograde" | "venus" | "eclipses";
export const LESSONS = {
  retrograde: { title: "Why does Mars move backwards?", start: "2024-11-01", end: "2025-03-31", steps: [
    { date: "2024-11-10", title: "Both planets travel forwards", text: "Earth and Mars both orbit the Sun in the same direction. The line from Earth to Mars determines where Mars appears against distant stars." },
    { date: "2024-12-20", title: "Earth is overtaking Mars", text: "Watch the changing line of sight in the space view. Its apparent direction against the stars now moves westward: retrograde motion." },
    { date: "2025-01-16", title: "Near opposition", text: "Earth passes between the Sun and Mars. Mars is roughly opposite the Sun in our sky. Its orbit has not reversed." },
    { date: "2025-03-20", title: "Normal apparent motion returns", text: "Once Earth has passed, the line of sight swings eastward again. The sky track records perspective, not a backwards orbit." },
  ] },
  venus: { title: "Why does Venus have phases?", start: "2024-10-01", end: "2025-05-15", steps: [
    { date: "2024-10-15", title: "A sunlit hemisphere", text: "Half of Venus is illuminated by the Sun. From Earth we see only part of that illuminated hemisphere, depending on the angle between all three bodies." },
    { date: "2025-01-10", title: "Around greatest elongation", text: "Venus is well to one side of the Sun in our sky. Its visible disc is close to half illuminated; the exact phase follows the actual geometry." },
    { date: "2025-03-10", title: "Nearer and more crescent-shaped", text: "As Venus approaches the near side of its orbit, its angular diameter grows while its illuminated fraction shrinks. The phase drawing is normalized in size so you can compare the shape." },
    { date: "2025-04-20", title: "Into the morning sky", text: "After passing the Sun's direction, Venus appears on its other side. The phase grows again. These diagrams are educational; use Observe's night-time guidance before aiming equipment." },
  ] },
  eclipses: { title: "Why isn't every full Moon eclipsed?", start: "2025-01-01", end: "2025-04-01", steps: [
    { date: "2025-01-13T22:27", title: "Full Moon can miss the shadow", text: "Full Moon is an alignment in ecliptic longitude. The Moon can still be above or below Earth's orbital plane, so it misses the shadow." },
    { date: "2025-02-12T13:53", title: "The orbital plane is tilted", text: "The lunar orbit is inclined by about five degrees to the ecliptic. This small angle is enough to carry the Moon well clear of Earth's shadow at many full Moons." },
    { date: "2025-03-14T06:59", title: "Full Moon near a node", text: "In March 2025 the full Moon passes close to the ecliptic plane and through Earth's shadow. Nodes are where the lunar orbit crosses that plane." },
    { date: "2025-03-21", title: "Both conditions are needed", text: "Crossing near the ecliptic alone is not enough. A lunar eclipse requires a full Moon and sufficiently close alignment with Earth's shadow. The normalized phase drawing does not simulate shadow darkening." },
  ] },
} satisfies Record<LessonId, { title: string; start: string; end: string; steps: { date: string; title: string; text: string }[] }>;
export const lessonTime = (date: string) => Date.parse(date.includes("T") ? date + ":00Z" : date + "T12:00:00Z");
export const angleDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;
export function lessonGeometry(id: LessonId, time: number) {
  const lesson = LESSONS[id];
  if (!Number.isFinite(time) || time < lessonTime(lesson.start) || time > lessonTime(lesson.end)) throw new Error("Time is outside this lesson.");
  const date = new Date(time);
  const target = id === "retrograde" ? Body.Mars : id === "venus" ? Body.Venus : Body.Moon;
  const earth = Ecliptic(HelioVector(Body.Earth, date)).vec;
  const planet = Ecliptic(HelioVector(target, date)).vec;
  const geo = Ecliptic(GeoVector(target, date, true));
  const sun = GeoVector(Body.Sun, date, true);
  const moon = GeoVector(Body.Moon, date, true);
  const sunEcliptic = Ecliptic(sun);
  const moonEcliptic = Ecliptic(moon);
  const phase = Illumination(target, date);
  const before = Ecliptic(GeoVector(target, new Date(time - DAY_MS / 2), true)).elon;
  const after = Ecliptic(GeoVector(target, new Date(time + DAY_MS / 2), true)).elon;
  const direction = Elongation(target, date);
  return { target, earth, planet, longitude: geo.elon, latitude: geo.elat, illumination: phase.phase_fraction,
    motion: angleDifference(after, before), distanceAU: phase.geo_dist, visibility: direction.visibility,
    phaseAngle: id === "eclipses" ? MoonPhase(date) : direction.visibility === "evening" ? 270 : 90,
    shadowOffset: 180 - AngleBetween(moon, sun),
    moonX: -(moonEcliptic.vec.x * Math.cos(sunEcliptic.elon * Math.PI / 180) + moonEcliptic.vec.y * Math.sin(sunEcliptic.elon * Math.PI / 180)) * 149597870.7,
    moonZ: moonEcliptic.vec.z * 149597870.7,
    sunDistance: sun.Length() * 149597870.7 };
}
export function lessonTrack(id: LessonId) {
  const lesson = LESSONS[id]; const start = lessonTime(lesson.start); const end = lessonTime(lesson.end);
  return Array.from({ length: 101 }, (_, index) => {
    const time = start + (end - start) * index / 100;
    const target = id === "retrograde" ? Body.Mars : id === "venus" ? Body.Venus : Body.Moon;
    const geo = Ecliptic(GeoVector(target, new Date(time), true));
    return { time, longitude: geo.elon, latitude: geo.elat };
  });
}
export function orbitGuide(body: Body, time: number, periodDays: number) {
  return Array.from({ length: 97 }, (_, index) => Ecliptic(HelioVector(body, new Date(time + periodDays * DAY_MS * index / 96))).vec);
}
