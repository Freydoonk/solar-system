import { useEffect, useMemo, useState } from "react";
import { Body } from "astronomy-engine";
import { DAY_MS, moonPhasePath } from "../solar-system/astronomy";
import { angleDifference, lessonGeometry, LESSONS, lessonTime, lessonTrack, orbitGuide, type LessonId } from "./lessons";
import styles from "./Learn.module.css";

export default function Learn({ active }: { active: boolean }) {
  const [id, setId] = useState<LessonId>("retrograde"); const [step, setStep] = useState(0);
  const [time, setTime] = useState(lessonTime(LESSONS.retrograde.steps[0].date)); const [playing, setPlaying] = useState(false);
  const lesson = LESSONS[id]; const start = lessonTime(lesson.start); const end = lessonTime(lesson.end);
  const running = playing && time < end;
  const geometry = useMemo(() => lessonGeometry(id, time), [id, time]);
  const track = useMemo(() => lessonTrack(id), [id]);
  const orbits = useMemo(() => [orbitGuide(Body.Earth, start, 365.25), orbitGuide(id === "retrograde" ? Body.Mars : Body.Venus, start, id === "retrograde" ? 687 : 224.7)], [id, start]);
  useEffect(() => {
    if (!active || !running) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const manage = () => {
      clearInterval(timer);
      if (!document.hidden) timer = setInterval(() => setTime(value => Math.min(end, value + DAY_MS / 4)), 100);
    };
    manage(); document.addEventListener("visibilitychange", manage);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", manage); };
  }, [active, running, end]);
  const scale = id === "retrograde" ? 105 : 170;
  const x = (value: number) => 240 + value * scale; const y = (value: number) => 240 - value * scale;
  const firstLongitude = track[0].longitude;
  const plotX = (longitude: number) => 240 + angleDifference(longitude, firstLongitude) * 8;
  const plotY = (latitude: number) => 240 - latitude * 38;
  function changeStep(index: number) { setStep(index); setTime(lessonTime(lesson.steps[index].date)); setPlaying(false); }
  return <main className={styles.learn}>
    <header><span className={styles.eyebrow}>ONE MOMENT · TWO PERSPECTIVES</span><h1>See why the sky changes</h1><p>Follow the geometry in space and its appearance from Earth. This lesson clock is independent of Explore and Observe.</p></header>
    <nav className={styles.actions} aria-label="Astronomy lessons">{(Object.keys(LESSONS) as LessonId[]).map(key => <button key={key} aria-pressed={id === key} onClick={() => { setId(key); setStep(0); setTime(lessonTime(LESSONS[key].steps[0].date)); setPlaying(false); }}>{key === "retrograde" ? "Mars: retrograde motion" : key === "venus" ? "Venus: phases" : "Moon: eclipses"}</button>)}</nav>
    <section className={styles.lesson}><h2>{lesson.title}</h2><div className={styles.stepButtons}>{lesson.steps.map((item, index) => <button key={item.title} aria-pressed={step === index} onClick={() => changeStep(index)}>{index + 1}. {item.title}</button>)}</div>
      <article aria-live="polite"><h3>{lesson.steps[step].title}</h3><p>{lesson.steps[step].text}</p></article>
      <div className={styles.controls}><button disabled={step === 0} onClick={() => changeStep(step - 1)}>Previous step</button><button disabled={step === lesson.steps.length - 1} onClick={() => changeStep(step + 1)}>Next step</button><button onClick={() => { if (time >= end) setTime(start); setPlaying(!playing || time >= end); }}>{playing && time < end ? "Pause animation" : "Play timeline"}</button></div>
      <label>Shared lesson time · {new Date(time).toISOString().slice(0, 16).replace("T", " ")} UTC<input type="range" min={start} max={end} step={3600000} value={time} onChange={event => { setTime(Number(event.target.value)); setPlaying(false); }} /></label>
      <p className={styles.note}>The selected explanation is a guided checkpoint; moving the timeline lets you explore around it. Playback stops advancing at the end and while the page is hidden.</p>
      <div className={styles.views}>
        <figure><figcaption>{id === "eclipses" ? "In space · side projection of the Moon" : "In space · viewed from ecliptic north"}</figcaption>
          <svg viewBox="0 0 480 480" role="img" aria-label={id === "eclipses" ? "Moon height above Earth's orbital plane, relative to the shadow direction" : "True-distance orbital positions with an Earth-to-planet sight line"}>
            {id !== "eclipses" ? <>
              {orbits.map((orbit, index) => <polyline key={index} fill="none" stroke={index === 0 ? "#426b9b" : "#647b6e"} points={orbit.map(point => `${x(point.x)},${y(point.y)}`).join(" ")} />)}
              <line x1={x(geometry.earth.x)} y1={y(geometry.earth.y)} x2={x(geometry.planet.x)} y2={y(geometry.planet.y)} stroke="#f6ca83" strokeDasharray="5 5" />
              <line x1="240" y1="240" x2={x(geometry.planet.x)} y2={y(geometry.planet.y)} stroke="#ffc458" opacity="0.5" />
              <circle cx="240" cy="240" r="5" fill="#ffc458" /><text x="248" y="232">Sun</text>
              <circle cx={x(geometry.earth.x)} cy={y(geometry.earth.y)} r="5" fill="#83bfff" /><text x={x(geometry.earth.x) + 8} y={y(geometry.earth.y) - 9}>Earth</text>
              <circle cx={x(geometry.planet.x)} cy={y(geometry.planet.y)} r="5" fill="#83e5bc" /><text x={x(geometry.planet.x) + 8} y={y(geometry.planet.y) - 9}>{geometry.target}</text>
              <line x1="25" x2={25 + scale} y1="440" y2="440" stroke="white" /><text x="25" y="460">1 AU</text>
            </> : <>
              <line x1="20" x2="460" y1="240" y2="240" stroke="#66788d" strokeDasharray="4 5" />
              <polygon points={`240,${240 - 6371 / 2200} 445,${240 - (6371 - 451000 * (695700 - 6371) / geometry.sunDistance) / 2200} 445,${240 + (6371 - 451000 * (695700 - 6371) / geometry.sunDistance) / 2200} 240,${240 + 6371 / 2200}`} fill="#66788d" />
              <circle cx="240" cy="240" r={6371 / 2200} fill="#83bfff" /><text x="235" y="265">Earth</text>
              <circle cx={240 + geometry.moonX / 2200} cy={240 - geometry.moonZ / 2200} r="6" fill="none" stroke="#f6ca83" /><text x={Math.min(405, Math.max(10, 240 + geometry.moonX / 2200))} y={215 - geometry.moonZ / 2200}>Moon locator</text>
              <text x="20" y="280">← Sun (off chart)</text><text x="330" y="280">Shadow →</text><text x="25" y="430">Above/below ecliptic: {Math.round(geometry.moonZ).toLocaleString()} km</text>
              <line x1="25" x2={25 + 100000 / 2200} y1="445" y2="445" stroke="white" /><text x="25" y="466">100,000 km</text>
            </>}
          </svg><p className={styles.note}>{id === "eclipses" ? "Uniform kilometre scale. Side projection omits lateral displacement within the ecliptic; it alone cannot establish an eclipse. Moon ring is a locator. Shadow is an approximate geometric umbra." : "One distance scale in AU. Dots are enlarged position markers, not planet discs. Orbits are sampled ephemerides; the dashed line is our sight line."}</p></figure>
        <figure><figcaption>{id === "retrograde" ? "From Earth · Mars against the distant sky" : "From Earth · illuminated fraction of the disc"}</figcaption>
          <svg viewBox="0 0 480 480" role="img" aria-label={id === "retrograde" ? "Geocentric apparent Mars path in ecliptic longitude and latitude" : "Normalized illuminated phase, not an eyepiece scale or eclipse simulation"}>
            {id === "retrograde" ? <>
              {[-20, -10, 0, 10, 20].map(value => <g key={value}><line x1={240 + value * 8} x2={240 + value * 8} y1="30" y2="410" stroke="#27384d" /><text x={240 + value * 8} y="440" textAnchor="middle">{value}°</text></g>)}
              {[-4, -2, 0, 2, 4].map(value => <g key={value}><line x1="35" x2="450" y1={plotY(value)} y2={plotY(value)} stroke="#27384d" /><text x="5" y={plotY(value)}>{value}°</text></g>)}
              <polyline fill="none" stroke="#83e5bc" strokeWidth="2" points={track.map(point => `${plotX(point.longitude)},${plotY(point.latitude)}`).join(" ")} />
              <circle cx={plotX(geometry.longitude)} cy={plotY(geometry.latitude)} r="6" fill="#ffc458" />
              <text x="240" y="465" textAnchor="middle">Ecliptic longitude relative to lesson start → east</text>
            </> : <g transform="translate(90 70) scale(3)"><circle cx="50" cy="50" r="44" fill="#17283b" stroke="#61778d" strokeWidth="0.5" /><path d={moonPhasePath(geometry.phaseAngle, geometry.illumination)} fill="#e6dec4" /></g>}
          </svg><p>{id === "retrograde" ? `${geometry.motion < 0 ? "Retrograde · westward" : "Direct · eastward"}: ${Math.abs(geometry.motion).toFixed(3)}° per day` : `${(geometry.illumination * 100).toFixed(1)}% illuminated · ${geometry.distanceAU.toFixed(4)} AU from Earth`}</p>
          <p className={styles.note}>{id === "retrograde" ? "Geocentric ecliptic coordinates, including light travel time. Vertical axis is ecliptic latitude. Axes use different angular scales to reveal the loop; this is a coordinate plot." : id === "eclipses" ? `Moon's separation from the anti-Sun direction: ${geometry.shadowOffset.toFixed(2)}°. Disc is normalized; Earth's shadow darkening is not rendered.` : `${geometry.visibility === "evening" ? "Evening" : "Morning"} side of the Sun. Disc is normalized and orientation schematic; local sky orientation and angular size differ. Never aim equipment near the Sun using this diagram.`}</p>
        </figure>
      </div>
    </section>
    <p className={styles.note}>Positions and illumination: <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">Astronomy Engine</a>. Diagrams are educational projections. Explore retains its physical-scale 3D scene.</p>
  </main>;
}
