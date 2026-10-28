import { t } from "../../i18n/messages";
import { searchText } from "../../i18n/display";
import { useMemo, useState } from "react";
import stars from "./catalogue/stars.json" with { type: "json" };
import patterns from "./catalogue/constellations.json" with { type: "json" };
import messier from "./catalogue/deep-sky.json" with { type: "json" };
import { atlasFrame, referenceStars, skyProject } from "./skyAtlas";
import { directionName, formatRA, skyPosition, TARGETS } from "./observing";
import type { PlannerProps } from "./TonightPlanner";
import styles from "./Observe.module.css";
import { horizonAltitude } from "./horizon";

const typeNames: Record<string, string> = { s: "Spiral galaxy", e: "Elliptical galaxy", i: "Irregular galaxy", g: "Galaxy", s0: "Lenticular galaxy", oc: "Open cluster", gc: "Globular cluster", sfr: "Star-forming nebula", pn: "Planetary nebula", snr: "Supernova remnant", rn: "Reflection nebula", en: "Emission nebula" };
export default function SkyAtlasPanel({ site, time, active, horizon, formatTime, choose }: PlannerProps) {
  const [query, setQuery] = useState(""); const [selectedId, setSelectedId] = useState("M31");
  const [magnitude, setMagnitude] = useState(4.5); const [lines, setLines] = useState(true); const [deep, setDeep] = useState(true); const [zoom, setZoom] = useState(1);
  // Wide-field positions refresh by minute; hidden atlas does no projection work.
  const minute = Math.floor(time / 60000) * 60000;
  const sky = useMemo(() => {
    if (!site || !active) return null;
    const frame = atlasFrame(site, minute);
    const starPoints = stars.filter(star => star.mag <= magnitude || star.id === selectedId).map(star => ({ ...star, ...frame.star(star), type: "Star", search: `${star.name} ${star.id} ${star.constellation}` }));
    const objects = messier.map(object => ({ id: object.id, name: `${object.id}${object.properties.alt ? " · " + object.properties.alt : ""}`, mag: object.properties.mag,
      type: typeNames[object.properties.type] || object.properties.type, search: `${object.id} ${object.properties.alt} ${object.properties.desig}`,
      ...frame.fixed(object.geometry.coordinates[0], object.geometry.coordinates[1]) }));
    const constellations = patterns.map(pattern => ({ ...pattern, segments: pattern.lines.map(line => line.map(([ra, dec]) => frame.fixed(ra, dec))) }));
    const planets = TARGETS.map(body => { const position = skyPosition(body, site, minute); return { ...position, ...skyProject(position.azimuth, position.geometricAltitude) }; });
    return { stars: starPoints, objects, constellations, planets };
  }, [site, minute, active, magnitude, selectedId]);
  const objects = sky ? [...sky.stars, ...sky.objects] : [];
  const selected = objects.find(object => object.id === selectedId);
  const matches = query.trim() ? objects.filter(object => searchText(object.search + " " + t(object.name)).includes(searchText(query))).slice(0, 20) : [];
  const references = selected && sky ? referenceStars(selected, sky.stars) : [];
  const patternMatches = query.trim() ? sky?.constellations.filter(pattern => searchText(`${pattern.id} ${pattern.name} ${t(pattern.name)}`).includes(searchText(query))) : [];
  const size = 500 / zoom;
  const center = zoom > 1 && selected && selected.altitude >= 0 ? selected : { x: 250, y: 250 };
  const maskPath = Array.from({ length: 73 }, (_, index) => { const point = skyProject(index * 5, horizonAltitude(horizon, index * 5)); return `${index ? "L" : "M"}${point.x} ${point.y}`; }).join(" ") + "Z";
  return <section className={styles.card} aria-label={t("Star atlas")}><h2>{t("Find your way among the stars")}</h2>
    <p className={styles.note}>{t("5,070 catalogue stars to magnitude 6, 88 constellations (Serpens in two parts), and 110 Messier objects. North up, east right on this compass projection; the center is overhead. Markers are symbols, not physical sizes.")}</p>
    {!site && <p>{t("Set your location to open the atlas.")}</p>}
    <label>{t("Find a star, Messier object or constellation")}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Sirius, M31, Orion, HIP32349…")} /></label>
    {query && <div className={styles.searchResults} aria-live="polite">{matches.map(object => <button key={object.id} onClick={() => setSelectedId(object.id)}>{t(object.name)} · {object.altitude < 0 ? t("below horizon") : t("{value1}° high", { value1: object.altitude.toFixed(0) })}</button>)}
      {patternMatches?.map(pattern => <p key={pattern.id}>{t("{value1} ({value2}) · matching pattern highlighted", { value1: t(pattern.name), value2: t(pattern.id) })}</p>)}
      {!matches.length && !patternMatches?.length && <p>{t("No match at this magnitude limit. Raise it to 6 for fainter stars.")}</p>}</div>}
    <label>{t("Star magnitude limit: {value1}", { value1: magnitude })}<input type="range" min="1" max="6" step="0.5" value={magnitude} onChange={event => setMagnitude(Number(event.target.value))} /></label>
    <div className={styles.actions}><button aria-pressed={lines} onClick={() => setLines(!lines)}>{t("Constellation lines")}</button><button aria-pressed={deep} onClick={() => setDeep(!deep)}>{t("Messier objects")}</button></div>
    {sky && <><svg className={styles.atlas} viewBox={`${Math.max(0, Math.min(500 - size, center.x - size / 2))} ${Math.max(0, Math.min(500 - size, center.y - size / 2))} ${size} ${size}`} role="img" aria-label={t("Local sky atlas. Use search and the labelled target buttons for keyboard selection.")}>
      <defs><clipPath id="atlas-horizon"><circle cx="250" cy="250" r="220" /></clipPath></defs>
      <circle cx="250" cy="250" r="220" fill="#030914" stroke="#637a91" />
      {[73, 147].map(radius => <circle key={radius} cx="250" cy="250" r={radius} fill="none" stroke="#27384e" />)}
      <text x="250" y="18" textAnchor="middle">{t("N")}</text><text x="485" y="254">{t("E")}</text><text x="250" y="492" textAnchor="middle">{t("S")}</text><text x="5" y="254">{t("W")}</text>
      <g clipPath="url(#atlas-horizon)">{lines && sky.constellations.map(pattern => <g key={pattern.id}>{pattern.segments.flatMap((points, lineIndex) => points.slice(1).map((point, index) => point.altitude >= 0 && points[index].altitude >= 0 ? <line key={`${lineIndex}-${index}`} x1={points[index].x} y1={points[index].y} x2={point.x} y2={point.y} stroke={patternMatches?.includes(pattern) ? "#ffc458" : "#42617d"} strokeWidth={patternMatches?.includes(pattern) ? 2 : 0.7} /> : null))}</g>)}
        {sky.stars.filter(star => star.altitude >= 0).map(star => <circle key={star.id} cx={star.x} cy={star.y} r={Math.max(0.65, 2.4 - star.mag * 0.3)} fill="#e7eef5" onClick={() => setSelectedId(star.id)}><title>{t(star.name)}</title></circle>)}
        {deep && sky.objects.filter(object => object.altitude >= 0).map(object => <g key={object.id} onClick={() => setSelectedId(object.id)}><circle cx={object.x} cy={object.y} r="4" fill="none" stroke="#83e5bc" /><title>{t(object.name)}</title></g>)}
        {sky.planets.filter(planet => planet.geometricAltitude >= 0).map(planet => <g key={planet.body} onClick={() => choose(planet.body, minute)}><circle cx={planet.x} cy={planet.y} r="4" fill="#ffc458" /><text x={planet.x + 6} y={planet.y - 5}>{t(planet.body)}</text></g>)}
        <path d={`M30 250 A220 220 0 1 0 470 250 A220 220 0 1 0 30 250Z ${maskPath}`} fill="#a16c4f66" fillRule="evenodd" stroke="#b68460" strokeWidth="0.5" pointerEvents="none" />
        {selected && selected.altitude >= 0 && <><circle cx={selected.x} cy={selected.y} r="9" fill="none" stroke="#ffc458" strokeWidth="2" /><text x={selected.x + 10} y={selected.y - 10}>{t(selected.name)}</text>
          {references.map(star => <g key={star.id}><line x1={selected.x} y1={selected.y} x2={star.x} y2={star.y} stroke="#ffc458" strokeDasharray="3 4" opacity="0.6" /><text x={star.x + 5} y={star.y - 5}>{t(star.name)}</text></g>)}</>}
      </g></svg>
      <label>{t("Zoom around selected object: {value1}×", { value1: zoom })}<input type="range" min="1" max="4" step="0.5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <p className={styles.note}>{t("Map time: {value1} · geometric altitude, true north. Adjust time in Where & when or Night chart.", { value1: formatTime(minute) })}</p>
      {selected && <article className={styles.atlasDetails}><h3>{t(selected.name)}</h3><p>{t("{value1} · catalogue magnitude {value2}", { value1: t(selected.type), value2: selected.mag < 100 ? selected.mag : t("unknown") })}<br />{t("{value1}° high · {value2}", { value1: selected.altitude.toFixed(1), value2: t(directionName(selected.azimuth)) })} {selected.azimuth.toFixed(1)}°{selected.altitude < 0 ? t(" · Below horizon") : ""}</p>
        {selected.altitude < horizonAltitude(horizon, selected.azimuth) && <p className={styles.warning}>{t("Behind your personal horizon. Shaded map areas are obstructed.")}</p>}
        <p className={styles.note}>{t("Equator of date: RA {value1}, Dec {value2}°. Stellar aberration/parallax and refraction omitted.", { value1: formatRA(selected.ra), value2: selected.dec.toFixed(3) })}</p>
        <h4>{t("Nearby bright reference stars")}</h4><p className={styles.note}>{t("Identify these first, then compare the pattern and angular distances. Lines are direction aids, not an eyepiece field or a guaranteed star-hopping route.")}</p>
        {references.length ? <ul>{references.map(star => <li key={star.id}>{t("{value1} · {value2}° from target · {value3}", { value1: t(star.name), value2: star.separation.toFixed(1), value3: t(directionName(star.azimuth)) })}</li>)}</ul> : <p>{t("No bright reference star is above the horizon.")}</p>}
      </article>}
    </>}
    <details><summary>{t("Browse Messier targets")}</summary><div className={styles.searchResults}>{sky?.objects.map(object => <button key={object.id} onClick={() => setSelectedId(object.id)}>{t(object.name)}</button>)}</div></details>
    <p className={styles.note}>{t("A finding chart, not a prediction of visibility or texture detail. Constellation sticks are conventional patterns. HYG 4.1 / David Nash (CC BY-SA 4.0); D3-Celestial / Olaf Frohn (BSD). ")}<a href={`${import.meta.env.BASE_URL}catalogue/ATTRIBUTION.md`} target="_blank" rel="noreferrer">{t("Data sources, changes & licences")}</a>.</p>
  </section>;
}
