import { t } from "../../i18n/messages";
import { lazy, Suspense, useMemo, useState } from "react";
import { Body } from "astronomy-engine";
import { calculateOptics, discFraction, EQUIPMENT_FIELDS, EXAMPLE_EQUIPMENT, expectedFeatures,
  targetAppearance, type Equipment } from "./eyepiece";
import type { Site, Target } from "./observing";
import { equipmentForTelescope, researchTargetGuide, TELESCOPES, TELESCOPE_GROUPS } from "./telescopes";
import shared from "./Observe.module.css";
import styles from "./EyepiecePreview.module.css";
import type { NotebookStore } from "./useNotebook";

const EyepieceScene = lazy(() => import("./EyepieceScene"));

export default function EyepiecePreview({ body, site, time, timeLabel, altitude, sunAltitude, active, notebook }: {
  body: Target; site: Site | null; time: number; timeLabel: string; altitude?: number; sunAltitude?: number; active: boolean; notebook: NotebookStore;
}) {
  const [equipment, setEquipment] = useState<Equipment>({ ...EXAMPLE_EQUIPMENT });
  const [example, setExample] = useState(true);
  const [telescopeId, setTelescopeId] = useState("custom");
  const [inspect, setInspect] = useState(false);
  const [orientation, setOrientation] = useState("reference");
  const [reset, setReset] = useState(0);
  const [setupName, setSetupName] = useState(() => t("My telescope"));
  const telescope = TELESCOPES.find((item) => item.id === telescopeId);
  const research = !!telescope && telescope.kind !== "amateur";
  const researchGuide = telescope && research ? researchTargetGuide(telescope, body, t) : null;
  const enlarged = research || inspect;
  const optics = research ? null : calculateOptics(equipment);
  const appearance = useMemo(() => site ? targetAppearance(body, site, time) : null, [body, site, time]);
  const fraction = appearance && optics ? discFraction(appearance.diameterArcsec, optics.fieldDegrees) : 0;
  const extent = body === Body.Saturn ? 2.4 : 1;
  const planningOnly = altitude !== undefined && altitude < 0 || sunAltitude !== undefined && sunAltitude > -6;

  function equipmentField(field: typeof EQUIPMENT_FIELDS[number]) {
    return <label key={field.key}>{t(field.label)}<input type="number" min={field.min} max={field.max} step="any"
      value={equipment[field.key]} onChange={(event) => {
        setExample(false); setEquipment({ ...equipment, [field.key]: event.target.value });
        if (field.key === "focal" || field.key === "aperture") setTelescopeId("custom");
      }} />
    </label>;
  }

  return <section className={`${shared.card} ${styles.preview}`} aria-label={t("Eyepiece preview")}>
    <div className={styles.heading}><h2>{t("What will I see?")}</h2><span className={styles.badge}>{t("{value1} · 3D PREVIEW", { value1: t(body) })}</span></div>
    <p className={shared.note}>{t("{value1} · Changes with your target, location, time and equipment.", { value1: t(timeLabel) })}</p>
    <label>{t("Telescope model")}<select value={telescopeId} onChange={(event) => {
      const next = TELESCOPES.find((item) => item.id === event.target.value);
      setTelescopeId(event.target.value); setReset((value) => value + 1);
      if (next) {
        const preset = equipmentForTelescope(next);
        if (preset) { setEquipment(preset); setExample(false); }
      }
    }}>
      <option value="custom">{t("Custom telescope / current settings")}</option>
      {TELESCOPE_GROUPS.map((group) => <optgroup key={group.kind} label={t(group.label)}>
        {TELESCOPES.filter((item) => item.kind === group.kind).map((item) => <option key={item.id} value={item.id}>{t(item.name)}</option>)}
      </optgroup>)}
    </select></label>
    <div className={styles.layout}>
      <div>
        {telescope && <div className={styles.profile}>
          <span className={styles.badge}>{t(TELESCOPE_GROUPS.find((group) => group.kind === telescope.kind)!.label)}</span>
          <h3>{t(telescope.name)}</h3><p className={shared.note}>{t(telescope.owner)}</p>
          <dl className={styles.specifications}>
            <div><dt>{t("Type")}</dt><dd>{t(telescope.design)}</dd></div><div><dt>{t("Aperture")}</dt><dd>{t(telescope.aperture)}</dd></div>
            <div><dt>{t("Light / observing mode")}</dt><dd>{t(telescope.band)}</dd></div>
            {telescope.kind === "amateur" && <div><dt>{t("Native focal length")}</dt><dd>{t("{value1} mm", { value1: telescope.focalMm })}</dd></div>}
          </dl>
          <p>{t(telescope.capability)}</p>
          <a className={shared.note} href={telescope.source} target="_blank" rel="noreferrer">{t("Official specifications and instrument description ↗")}</a>
        </div>}
        {researchGuide && <div className={styles.expectation}>
          <h3>{t("What about {value1}?", { value1: t(body) })}</h3>{!researchGuide.unavailable && <p role="status">{t(researchGuide.text)}</p>}
          <a className={shared.note} href={researchGuide.source} target="_blank" rel="noreferrer">{t("Observing reference ↗")}</a>
          <p className={shared.note}>{t("Scientific imaging profile · no eyepiece magnification or camera exposure is simulated. The pointing directions and observing times elsewhere on this page still describe your ground location, not this observatory or spacecraft.")}</p>
        </div>}
        {!research && <>
        <p className={shared.note}>{telescope ? t("Native telescope specifications applied. Eyepiece focal length and 50° apparent field are editable examples; check your own accessories.") : example ? t("Example setup: replace these values with your telescope and eyepiece specifications.") : t("Your setup: check the aperture, apparent field and Barlow factor too.")}</p>
        <div className={shared.fields}>{EQUIPMENT_FIELDS.slice(0, 2).map(equipmentField)}</div>
        <details><summary>{t("My saved setups")}</summary><label>{t("Load equipment")}<select value="" onChange={event => {
          const saved = notebook.data.equipment.find(item => item.id === event.target.value);
          if (saved) { setEquipment({ ...saved.equipment }); setSetupName(saved.name); setTelescopeId("custom"); setExample(false); setReset(value => value + 1); }
        }}><option value="">{t("Choose a saved setup…")}</option>{notebook.data.equipment.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{t("Setup name")}<input value={setupName} maxLength={100} onChange={event => setSetupName(event.target.value)} /></label>
          <button type="button" disabled={!optics || !setupName.trim()} onClick={() => notebook.change({ ...notebook.data, equipment: [...notebook.data.equipment, { id: crypto.randomUUID(), name: setupName.trim(), equipment: { ...equipment } }] })}>{t("Save this setup on device")}</button>
          <p className={shared.note} role="status">{t(notebook.status)}</p>
        </details>
        <details><summary>{t("Aperture, field of view & Barlow")}</summary>
          <div className={shared.fields}>{EQUIPMENT_FIELDS.slice(2).map(equipmentField)}</div>
          <p className={shared.note}>{t("Aperture is the clear diameter, not the focal length. Use 1 for no Barlow/reducer, 2 for a 2× Barlow. Apparent field comes from the eyepiece specification.")}</p>
          <button type="button" onClick={() => { setEquipment({ ...EXAMPLE_EQUIPMENT }); setExample(true); setTelescopeId("custom"); }}>{t("Restore example setup")}</button>
        </details>
        {!optics ? <p className={shared.warning} role="status">{t("Enter valid equipment values: focal length 50–20,000 mm, eyepiece 1–100 mm, aperture 10–2,000 mm, apparent field 10–120°, factor 0.1–10.")}</p>
          : <>
            <dl className={styles.metrics}>
              <div><dt>{t("Magnification")}</dt><dd>{optics.magnification.toFixed(1)}×</dd></div>
              <div><dt>{t("Approx. true field")}</dt><dd>{optics.fieldDegrees.toFixed(optics.fieldDegrees < 0.01 ? 4 : 2)}°</dd></div>
              <div><dt>{t("Exit pupil")}</dt><dd>{t("{value1} mm", { value1: optics.exitPupilMm.toFixed(2) })}</dd></div>
              <div><dt>{t("{value1} disc diameter", { value1: t(body) })}</dt><dd>{appearance ? appearance.diameterArcsec >= 60 ? t("{value1}′", { value1: (appearance.diameterArcsec / 60).toFixed(1) }) : t("{value1}″", { value1: appearance.diameterArcsec.toFixed(1) }) : t("N/A")}</dd></div>
            </dl>
            {optics.exitPupilMm < 0.5 && <p className={shared.warning}>{t("Very high power for this aperture: expect a dimmer, softer view. More magnification alone will not reveal more detail.")}</p>}
            {optics.exitPupilMm > 7 && <p className={shared.warning}>{t("The exit pupil may be larger than your eye can use; some of the collected light may be lost.")}</p>}
            {appearance && appearance.diameterArcsec < optics.resolutionArcsec && <p className={shared.warning}>{t("This disc is smaller than the aperture’s theoretical resolution: it may look like a point, rather than a resolved disc.")}</p>}
          </>}
        {appearance && <div className={styles.expectation}><h3>{t("Look for on {value1}", { value1: t(body) })}</h3><p>{t(expectedFeatures(appearance))}</p>
          <p className={shared.note}>{t("{value1}% illuminated · apparent magnitude {value2}", { value1: (appearance.phaseFraction * 100).toFixed(0), value2: appearance.magnitude.toFixed(1) })}
            {body === Body.Saturn && t(" · ring opening {angle}°", { angle: Math.abs(appearance.ringTilt).toFixed(1) })}</p>
        </div>}
        </>}
      </div>
      <figure className={styles.figure}>
        {!research && <div className={styles.switch} role="group" aria-label={t("Preview scale")}>
          <button type="button" aria-pressed={!enlarged} onClick={() => setInspect(false)}>{t("In the eyepiece")}</button>
          <button type="button" aria-pressed={enlarged} onClick={() => setInspect(true)}>{t("Explore in 3D")}</button>
        </div>}
        {!research && planningOnly && <p className={`${shared.warning} ${styles.compactNote}`} role="status">{t("{value1} Planning preview only; choose a night-time observing window.", { value1: altitude !== undefined && altitude < 0 ? t("Below your horizon at this time.") : t("Daylight / twilight at this time.") })}</p>}
        {researchGuide?.unavailable ? <p className={`${shared.warning} ${shared.empty}`} role="status">{t("{value1} Choose another target or telescope.", { value1: t(researchGuide.text) })}</p>
          : !site ? <p className={shared.empty}>{t("Choose your location to preview {value1} at the selected time.", { value1: t(body) })}</p> : !research && !optics ? <p className={shared.empty}>{t("Complete the equipment settings to show the preview.")}</p> : appearance && <>
          <div className={styles.field} data-orientation={enlarged ? "reference" : orientation}>
            <Suspense fallback={<p className={shared.empty}>{t("Loading 3D preview…")}</p>}>
              <EyepieceScene key={body} appearance={appearance} fraction={fraction} enlarged={enlarged} active={active} reset={reset} />
            </Suspense>
            {!enlarged && <><span className={styles.north}>{t("N")}</span><span className={styles.east}>{t("E")}</span></>}
          </div>
          <figcaption>{research ? t("REFERENCE 3D MODEL · not an image prediction for {value1}", { value1: t(telescope!.name) }) : enlarged ? t("ENLARGED 3D MODEL · size and free angle are not your eyepiece view") : t("Disc occupies {value1}% of field diameter", { value1: (fraction * 100).toFixed(fraction < 0.001 ? 3 : 1) })}
            {!enlarged && fraction * extent > 1 && <><br />{t("The centered target extends outside this field; use lower power or a wider field.")}</>}
            {!enlarged && fraction * 280 < 1 && <><br />{t("Smaller than a diagram pixel at this scale. Use Explore in 3D to identify its shape.")}</>}
          </figcaption>
          {enlarged ? <><p className={shared.note}>{t("Drag with the mouse or one finger to rotate. Focus the model and use arrow keys for small steps. Reset restores the reference angle from your ground location.")}</p>
            <button type="button" onClick={() => setReset((value) => value + 1)}>{t("Reset to Earth view")}</button></> : <label>{t("Image orientation")}<select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
            <option value="reference">{t("Reference · north up, east left")}</option><option value="inverted">{t("Rotated 180°")}</option><option value="mirrored">{t("Mirror left–right")}</option>
          </select></label>}
        </>}
      </figure>
    </div>
    <p className={shared.note}>{t("The eyepiece view preserves approximate angular size. Static surface maps and lighting illustrate the 3D shape; they do not predict the detail, brightness or sharpness you will resolve. Eclipses and neighbouring stars/moons are not simulated. Real views depend on aperture, focus, atmospheric steadiness and your eyes. Your diagonal and mount can rotate or mirror the view.")}</p>
    <details><summary>{t("How this preview is calculated")}</summary><p className={shared.note}>{t("Magnification = telescope focal length × Barlow/reducer factor ÷ eyepiece focal length. True field ≈ apparent field ÷ magnification; field-stop measurements are more precise. Disc size uses the target’s observer-relative distance and mean physical radius. Illumination and pole direction are projected into the observer’s sky at the selected date. The rings have an approximate outer envelope of 2.4 planetary radii. Surface longitude alignment and weather remain illustrative.")}</p>
      <p className={shared.note}>{t("References: ")}<a href="https://celestron-site-support-files.s3.amazonaws.com/support_files/SkyPortal%20130-90-70%205%20language%20manual.pdf" target="_blank" rel="noreferrer">{t("Celestron telescope basics")}</a>, <a href="https://science.nasa.gov/skywatching/" target="_blank" rel="noreferrer">{t("NASA skywatching")}</a>.</p>
      <p className={shared.note}>{t("Surface maps: ")}<a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">{t("Solar System Scope / INOVE")}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{t("CC BY 4.0")}</a>.</p>
    </details>
  </section>;
}
