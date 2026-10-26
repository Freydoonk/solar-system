import { useMemo, useState } from "react";
import stars from "./catalogue/stars.json";
import patterns from "./catalogue/constellations.json";
import messier from "./catalogue/deep-sky.json";
import { atlasFrame, referenceStars, skyProject } from "./skyAtlas";
import { directionName, formatRA, skyPosition, TARGETS } from "./observing";
import type { PlannerProps } from "./TonightPlanner";
import styles from "./Observe.module.css";

const typeNames: Record<string, string> = { s: "Spiral galaxy", e: "Elliptical galaxy", i: "Irregular galaxy", g: "Galaxy", s0: "Lenticular galaxy", oc: "Open cluster", gc: "Globular cluster", sfr: "Star-forming nebula", pn: "Planetary nebula", snr: "Supernova remnant", rn: "Reflection nebula", en: "Emission nebula" };
export default function SkyAtlasPanel({ site, time, active, formatTime, choose }: PlannerProps) {
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
  const matches = query.trim() ? objects.filter(object => object.search.toLowerCase().replaceAll(" ", "").includes(query.toLowerCase().replaceAll(" ", ""))).slice(0, 20) : [];
  const references = selected && sky ? referenceStars(selected, sky.stars) : [];
  const patternMatches = query.trim() ? sky?.constellations.filter(pattern => `${pattern.id} ${pattern.name}`.toLowerCase().includes(query.toLowerCase())) : [];
  const size = 500 / zoom;
  const center = zoom > 1 && selected && selected.altitude >= 0 ? selected : { x: 250, y: 250 };
  return <section className={styles.card} aria-label="Star atlas"><h2>Find your way among the stars</h2>
    <p className={styles.note}>5,070 catalogue stars to magnitude 6, 88 constellations (Serpens in two parts), and 110 Messier objects. North up, east right on this compass projection; the center is overhead. Markers are symbols, not physical sizes.</p>
    {!site && <p>Set your location to open the atlas.</p>}
    <label>Find a star, Messier object or constellation<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Sirius, M31, Orion, HIP32349…" /></label>
    {query && <div className={styles.searchResults} aria-live="polite">{matches.map(object => <button key={object.id} onClick={() => setSelectedId(object.id)}>{object.name} · {object.altitude < 0 ? "below horizon" : object.altitude.toFixed(0) + "° high"}</button>)}
      {patternMatches?.map(pattern => <p key={pattern.id}>{pattern.name} ({pattern.id}) · matching pattern highlighted</p>)}
      {!matches.length && !patternMatches?.length && <p>No match at this magnitude limit. Raise it to 6 for fainter stars.</p>}</div>}
    <label>Star magnitude limit: {magnitude}<input type="range" min="1" max="6" step="0.5" value={magnitude} onChange={event => setMagnitude(Number(event.target.value))} /></label>
    <div className={styles.actions}><button aria-pressed={lines} onClick={() => setLines(!lines)}>Constellation lines</button><button aria-pressed={deep} onClick={() => setDeep(!deep)}>Messier objects</button></div>
    {sky && <><svg className={styles.atlas} viewBox={`${Math.max(0, Math.min(500 - size, center.x - size / 2))} ${Math.max(0, Math.min(500 - size, center.y - size / 2))} ${size} ${size}`} role="img" aria-label="Local sky atlas. Use search and the labelled target buttons for keyboard selection.">
      <defs><clipPath id="atlas-horizon"><circle cx="250" cy="250" r="220" /></clipPath></defs>
      <circle cx="250" cy="250" r="220" fill="#030914" stroke="#637a91" />
      {[73, 147].map(radius => <circle key={radius} cx="250" cy="250" r={radius} fill="none" stroke="#27384e" />)}
      <text x="250" y="18" textAnchor="middle">N</text><text x="485" y="254">E</text><text x="250" y="492" textAnchor="middle">S</text><text x="5" y="254">W</text>
      <g clipPath="url(#atlas-horizon)">{lines && sky.constellations.map(pattern => <g key={pattern.id}>{pattern.segments.flatMap((points, lineIndex) => points.slice(1).map((point, index) => point.altitude >= 0 && points[index].altitude >= 0 ? <line key={`${lineIndex}-${index}`} x1={points[index].x} y1={points[index].y} x2={point.x} y2={point.y} stroke={patternMatches?.includes(pattern) ? "#ffc458" : "#42617d"} strokeWidth={patternMatches?.includes(pattern) ? 2 : 0.7} /> : null))}</g>)}
        {sky.stars.filter(star => star.altitude >= 0).map(star => <circle key={star.id} cx={star.x} cy={star.y} r={Math.max(0.65, 2.4 - star.mag * 0.3)} fill="#e7eef5" onClick={() => setSelectedId(star.id)}><title>{star.name}</title></circle>)}
        {deep && sky.objects.filter(object => object.altitude >= 0).map(object => <g key={object.id} onClick={() => setSelectedId(object.id)}><circle cx={object.x} cy={object.y} r="4" fill="none" stroke="#83e5bc" /><title>{object.name}</title></g>)}
        {sky.planets.filter(planet => planet.geometricAltitude >= 0).map(planet => <g key={planet.body} onClick={() => choose(planet.body, minute)}><circle cx={planet.x} cy={planet.y} r="4" fill="#ffc458" /><text x={planet.x + 6} y={planet.y - 5}>{planet.body}</text></g>)}
        {selected && selected.altitude >= 0 && <><circle cx={selected.x} cy={selected.y} r="9" fill="none" stroke="#ffc458" strokeWidth="2" /><text x={selected.x + 10} y={selected.y - 10}>{selected.name}</text>
          {references.map(star => <g key={star.id}><line x1={selected.x} y1={selected.y} x2={star.x} y2={star.y} stroke="#ffc458" strokeDasharray="3 4" opacity="0.6" /><text x={star.x + 5} y={star.y - 5}>{star.name}</text></g>)}</>}
      </g></svg>
      <label>Zoom around selected object: {zoom}×<input type="range" min="1" max="4" step="0.5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <p className={styles.note}>Map time: {formatTime(minute)} · geometric altitude, true north. Adjust time in Where &amp; when or Night chart.</p>
      {selected && <article className={styles.atlasDetails}><h3>{selected.name}</h3><p>{selected.type} · catalogue magnitude {selected.mag < 100 ? selected.mag : "unknown"}<br />{selected.altitude.toFixed(1)}° high · {directionName(selected.azimuth)} {selected.azimuth.toFixed(1)}°{selected.altitude < 0 ? " · Below horizon" : ""}</p>
        <p className={styles.note}>Equator of date: RA {formatRA(selected.ra)}, Dec {selected.dec.toFixed(3)}°. Stellar aberration/parallax and refraction omitted.</p>
        <h4>Nearby bright reference stars</h4><p className={styles.note}>Identify these first, then compare the pattern and angular distances. Lines are direction aids, not an eyepiece field or a guaranteed star-hopping route.</p>
        {references.length ? <ul>{references.map(star => <li key={star.id}>{star.name} · {star.separation.toFixed(1)}° from target · {directionName(star.azimuth)}</li>)}</ul> : <p>No bright reference star is above the horizon.</p>}
      </article>}
    </>}
    <details><summary>Browse Messier targets</summary><div className={styles.searchResults}>{sky?.objects.map(object => <button key={object.id} onClick={() => setSelectedId(object.id)}>{object.name}</button>)}</div></details>
    <p className={styles.note}>A finding chart, not a prediction of visibility or texture detail. Constellation sticks are conventional patterns. HYG 4.1 / David Nash (CC BY-SA 4.0); D3-Celestial / Olaf Frohn (BSD). <a href={`${import.meta.env.BASE_URL}catalogue/ATTRIBUTION.md`} target="_blank" rel="noreferrer">Data sources, changes &amp; licences</a>.</p>
  </section>;
}
