import { useRef } from "react";
import styles from "./SolarSystem.module.css";

export function ControlsHelp() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.helpButton} aria-haspopup="dialog"
      onClick={() => dialogRef.current?.showModal()}>? Help</button>
    <dialog ref={dialogRef} className={styles.helpDialog} aria-labelledby="controls-help-title">
      <div className={styles.helpHeading}>
        <h2 id="controls-help-title">Explore the solar system</h2>
        <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label="Close help">Close</button>
      </div>
      <p>The view opens on Earth. Use <strong>Follow body</strong> to approach another planet or moon,
        or <strong>Fit system</strong> to see the whole solar system.
        Real sizes and distances make most bodies tiny in the whole-system view.</p>
      <h3>Move the camera</h3>
      <div className={styles.helpTableWrapper}>
        <table>
          <thead><tr><th>Action</th><th>3D explorer</th><th>2D overview</th></tr></thead>
          <tbody>
            <tr><th>Look around</th><td>Left-drag in <strong>Orbit</strong> mode</td><td>Fixed view from above</td></tr>
            <tr><th>Move left / right / up / down</th>
              <td>Hold <kbd>Space</kbd> and left-drag, right-drag, or select <strong>Pan</strong> and left-drag</td>
              <td>Left-drag</td></tr>
            <tr><th>Zoom</th><td>Mouse wheel / trackpad scroll</td><td>Mouse wheel or Zoom slider</td></tr>
            <tr><th>Keyboard movement</th><td colSpan={2}>Focus the sky with a click or Tab, then use the arrow keys</td></tr>
            <tr><th>Touch</th><td>One finger to orbit or pan in the chosen mode; two fingers to move or pinch to zoom</td>
              <td>Drag with one finger; use the Zoom slider</td></tr>
          </tbody>
        </table>
      </div>
      <p>Hold Space <em>before</em> starting the drag. Release it to return to the chosen mode for your next drag.
        The cursor changes to a move cursor when panning is ready. Space keeps its normal behaviour in fields and buttons.</p>
      <h3>Find your way back</h3>
      <p><strong>Sun in view</strong> keeps the chosen body and the Sun in the frame as time moves.
        This views the body mainly from its night side. For a moon eclipsed by its parent, the camera
        pulls back until both sight lines are clear. Physical sizes and distances stay unchanged.</p>
      <p>Moons have two more modes: <strong>From [planet]</strong> starts just outside the parent planet
        and its rings, looking toward the moon. Zoom approaches the moon along that line;
        <strong> Recenter</strong> returns to the planet. This follows the moon-facing side of the planet,
        rather than a fixed geographic location. <strong>Behind moon · [planet] in view</strong>
        places the moon in front of its parent and pulls back enough to fit both, including rings.
        Both modes follow the changing planet–moon direction through time without changing physical scales.</p>
      <p>Earth also offers <strong>My region</strong>: an approximate IP location points the camera
        at your region and follows Earth's rotation. This is the initial view.
        Mouse-wheel zoom keeps the selected angle lock. Dragging, touch gestures, arrow keys,
        <strong> Release angle lock</strong>, Top / Side or 2D releases it.
        Choose a follow mode again to re-enable the lock. <strong>Free angle</strong> follows
        the body through space while you control the viewing angle.</p>
      <p>Approximate location comes from <a href="https://www.geojs.io/" target="_blank" rel="noreferrer">GeoJS</a>.
        VPNs and mobile networks may point to a different region. No GPS permission is requested.
        If the lookup is unavailable, the normal Earth view stays available.</p>
      <p><strong>Recenter</strong> restores a close view of the selected body.
        <strong> Fit system</strong> returns to the whole solar system.
        <strong> Top / Side</strong> change the 3D viewing angle.
        A selected body follows the simulation clock; you can still pan away from its center.</p>
      <h3>Travel through time</h3>
      <p>Choose a Gregorian date and UTC time to pause at that moment.
        <strong> Play / Pause</strong> controls motion; <strong>Time speed</strong> changes its rate.
        <strong> Now</strong> selects the current time and <strong>Reset</strong> returns to the last chosen moment.</p>
      <p>The Earth panel shows the Moon phase and seasons for the same moment.
        Hollow rings mark tiny objects without enlarging them. An asterisk marks a schematic moon orbit.</p>
      <p>On a small screen, use <strong>Camera</strong>, <strong>Time</strong>, and <strong>Moon &amp; seasons</strong>
        below the sky. The controls scroll independently so the sky stays visible.
        Time starts at <strong>Real time</strong>: one simulated second per second.</p>
      <p className={styles.helper}>Press <kbd>Esc</kbd> or Close to return to the sky.</p>
    </dialog>
  </>;
}
