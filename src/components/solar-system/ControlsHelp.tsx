import { Translated } from "../../i18n/Translated";
import { t } from "../../i18n/messages";
import { useRef } from "react";
import styles from "./SolarSystem.module.css";

export function ControlsHelp() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.helpButton} aria-haspopup="dialog"
      onClick={() => dialogRef.current?.showModal()}>{t("? Help")}</button>
    <dialog ref={dialogRef} className={styles.helpDialog} aria-labelledby="controls-help-title">
      <div className={styles.helpHeading}>
        <h2 id="controls-help-title">{t("Explore the solar system")}</h2>
        <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label={t("Close help")}>{t("Close")}</button>
      </div>
      <p><Translated message="The view opens on Earth. Use {part1} to approach another planet or moon, or {part2} to see the whole solar system. Real sizes and distances make most bodies tiny in the whole-system view." values={{ part1: <strong>{t("Follow body")}</strong>, part2: <strong>{t("Fit system")}</strong> }} /></p>
      <h3>{t("Move the camera")}</h3>
      <div className={styles.helpTableWrapper}>
        <table>
          <thead><tr><th>{t("Action")}</th><th>{t("3D explorer")}</th><th>{t("2D overview")}</th></tr></thead>
          <tbody>
            <tr><th>{t("Look around")}</th><td><Translated message="Left-drag in {part1} mode" values={{ part1: <strong>{t("Orbit")}</strong> }} /></td><td>{t("Fixed view from above")}</td></tr>
            <tr><th>{t("Move left / right / up / down")}</th>
              <td><Translated message="Hold {part1} and left-drag, right-drag, or select {part2} and left-drag" values={{ part1: <kbd>{t("Space")}</kbd>, part2: <strong>{t("Pan")}</strong> }} /></td>
              <td>{t("Left-drag")}</td></tr>
            <tr><th>{t("Zoom")}</th><td>{t("Mouse wheel / trackpad scroll")}</td><td>{t("Mouse wheel or Zoom slider")}</td></tr>
            <tr><th>{t("Keyboard movement")}</th><td colSpan={2}>{t("Focus the sky with a click or Tab, then use the arrow keys")}</td></tr>
            <tr><th>{t("Touch")}</th><td>{t("One finger to orbit or pan in the chosen mode; two fingers to move or pinch to zoom")}</td>
              <td>{t("Drag with one finger; use the Zoom slider")}</td></tr>
          </tbody>
        </table>
      </div>
      <p><Translated message="Hold Space {part1} starting the drag. Release it to return to the chosen mode for your next drag. The cursor changes to a move cursor when panning is ready. Space keeps its normal behaviour in fields and buttons." values={{ part1: <em>{t("before")}</em> }} /></p>
      <p><Translated message="The hand closes while dragging. Camera movement stops on release, without inertia. Enable {part1} for slower orbit, pan and zoom. The Left / Right / Up / Down buttons rotate in 2° steps, or 0.25° with Fine control." values={{ part1: <strong>{t("Fine control")}</strong> }} /></p>
      <h3>{t("Find your way back")}</h3>
      <p><Translated message="{part1} keeps the chosen body and the Sun in the frame as time moves. This views the body mainly from its night side. For a moon eclipsed by its parent, the camera pulls back until both sight lines are clear. Physical sizes and distances stay unchanged." values={{ part1: <strong>{t("Sun in view")}</strong> }} /></p>
      <p><Translated message="Moons have two more modes: {part1} starts just outside the parent planet and its rings, looking toward the moon. Zoom approaches the moon along that line;{part2} returns to the planet. This follows the moon-facing side of the planet, rather than a fixed geographic location. {part3}places the moon in front of its parent and pulls back enough to fit both, including rings. Both modes follow the changing planet–moon direction through time without changing physical scales." values={{ part1: <strong>{t("From [planet]")}</strong>, part2: <strong>{t(" Recenter")}</strong>, part3: <strong>{t("Behind moon · [planet] in view")}</strong> }} /></p>
      <p><Translated message="Earth also offers {part1}: your location points the camera at your region and follows Earth's rotation. This is the initial view. Mouse-wheel zoom keeps the selected angle lock. Dragging, touch gestures, arrow keys,{part2}, Top / Side or 2D releases it. Choose a follow mode again to re-enable the lock. {part3} follows the body through space while you control the viewing angle." values={{ part1: <strong>{t("My region")}</strong>, part2: <strong>{t(" Release angle lock")}</strong>, part3: <strong>{t("Free angle")}</strong> }} /></p>
      <p><Translated message="Device location is used automatically when permission was already granted. Otherwise, an approximate region comes from {part1}. VPNs and mobile networks may place it elsewhere. Startup never asks for new location permission. If neither source is available, the normal Earth view remains." values={{ part1: <a href="https://www.geojs.io/" target="_blank" rel="noreferrer">{t("GeoJS")}</a> }} /></p>
      <p><Translated message="{part1} restores a close view of the selected body.{part2} returns to the whole solar system.{part3} change the 3D viewing angle. A selected body follows the simulation clock; you can still pan away from its center." values={{ part1: <strong>{t("Recenter")}</strong>, part2: <strong>{t(" Fit system")}</strong>, part3: <strong>{t(" Top / Side")}</strong> }} /></p>
      <h3>{t("Travel through time")}</h3>
      <p><Translated message="Choose a Gregorian date and UTC time to pause at that moment.{part1} controls motion; {part2} changes its rate.{part3} selects the current time and {part4} returns to the last chosen moment." values={{ part1: <strong>{t(" Play / Pause")}</strong>, part2: <strong>{t("Time speed")}</strong>, part3: <strong>{t(" Now")}</strong>, part4: <strong>{t("Reset")}</strong> }} /></p>
      <p>{t("The Earth panel shows the Moon phase and seasons for the same moment. Hollow rings mark tiny objects without enlarging them. An asterisk marks a schematic moon orbit.")}</p>
      <p><Translated message="On a small screen, use {part1}, {part2}, and {part3}below the sky to open the controls. {part4} gives the sky almost the whole screen again. The controls scroll independently so the sky stays visible. Time starts at {part5}: one simulated second per second." values={{ part1: <strong>{t("Camera")}</strong>, part2: <strong>{t("Time")}</strong>, part3: <strong>{t("Moon & seasons")}</strong>, part4: <strong>{t("Hide")}</strong>, part5: <strong>{t("Real time")}</strong> }} /></p>
      <h3>{t("Observe with a telescope")}</h3>
      <p><Translated message="Open {part1} in the top navigation for the separate local-sky planner. Choose an approximate, device or manual location, then a target and time. It provides altitude/azimuth, equatorial coordinates, a direction lookup and future observing windows. Select your mount type; this app does not control telescope motors. The planner clock is independent of Explore." values={{ part1: <strong>{t("Observe")}</strong> }} /></p>
      <p><Translated message="{part1} explains how to add the app to your home screen. Once offline setup finishes, both views, the planner and textures work offline. IP location requires internet; device location depends on your device, and manual coordinates always work." values={{ part1: <strong>{t("Install app")}</strong> }} /></p>
      <p className={styles.helper}><Translated message="Press {part1} or Close to return to the sky." values={{ part1: <kbd>{t("Esc")}</kbd> }} /></p>
    </dialog>
  </>;
}
