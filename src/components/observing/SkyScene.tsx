import { t } from "../../i18n/messages";
import { useEffect, useRef, useState } from "react";
import { BackSide, BufferGeometry, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, PointsMaterial, RingGeometry, Scene, SphereGeometry, Vector3, WebGLRenderer, type Quaternion } from "three";
import { isDaylightMarker, skyNightVisibility, type SkyViewModel } from "./skyViewModel";
import { markerVisible, type SkyLayers } from "./skyDisplay";
import { horizontalVector } from "./skyOrientation";
import { horizonAltitude, type HorizonProfile } from "./horizon";
import styles from "./Sky.module.css";

type Props = { model: SkyViewModel; horizon: HorizonProfile; pose: Quaternion; fov: number; layers: SkyLayers; matchDaylight: boolean;
  onDrag: (dx: number, dy: number) => void; onZoom: (delta: number) => void; motion: boolean };

export default function SkyScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const paint = useRef<(() => void) | null>(null);
  const latest = useRef(props);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { latest.current = props; paint.current?.(); }, [props]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ antialias: true, alpha: false }); }
    catch {
      let mounted = true;
      queueMicrotask(() => { if (mounted) setError("3D is unavailable on this device. The direction readout still works; use Star atlas in Observe for a 2D chart."); });
      return () => { mounted = false; };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    element.prepend(renderer.domElement);
    const scene = new Scene();
    const sunAltitude = props.model.sun.altitude;
    const twilight = Math.max(0, Math.min(1, (sunAltitude + 18) / 18));
    const daylight = Math.max(0, Math.min(1, sunAltitude / 10));
    const darkSky = new Color("#030b18");
    const litSky = darkSky.clone().lerp(new Color("#344970"), twilight).lerp(new Color("#4589bd"), daylight);
    const camera = new PerspectiveCamera(60, 1, 0.1, 200);
    const geometries: BufferGeometry[] = [];
    const materials: (PointsMaterial | MeshBasicMaterial | LineBasicMaterial)[] = [];
    const geometry = (points: Vector3[], radius = 100) => { const g = new BufferGeometry().setFromPoints(points.map(p => p.clone().multiplyScalar(radius))); geometries.push(g); return g; };
    const addPoints = (points: Vector3[], size: number, color: string) => {
      const material = new PointsMaterial({ color, size, sizeAttenuation: false, transparent: true }); materials.push(material);
      const mesh = new Points(geometry(points), material); scene.add(mesh); return mesh;
    };
    const stars = props.model.starBuckets.map((bucket, index) => addPoints(bucket, [3.2, 2.1, 1.2][index], ["#f2f6ff", "#c9d9eb", "#7e92ae"][index]));
    const planets = addPoints(props.model.markers.filter(m => m.kind === "planet" && m.id !== "Moon").map(m => m.vector), 6, "#ffd18b");
    const moon = addPoints(props.model.markers.filter(m => m.id === "Moon").map(m => m.vector), 8, "#f2f6ff");
    const sunMeshes: Mesh[] = [];
    const sun = props.model.markers.find(marker => marker.kind === "sun");
    if (sun) {
      // A disc and halo identify the Sun at the same annotation scale as the other markers.
      const disc = new CircleGeometry(1.1, 48), halo = new RingGeometry(1.5, 1.8, 48);
      geometries.push(disc, halo);
      for (const [shape, opacity] of [[disc, 1], [halo, 0.4]] as const) {
        const material = new MeshBasicMaterial({ color: "#ffe08a", transparent: opacity < 1, opacity }); materials.push(material);
        const mesh = new Mesh(shape, material); mesh.position.copy(sun.vector).multiplyScalar(100); mesh.lookAt(0, 0, 0); scene.add(mesh);
        sunMeshes.push(mesh);
      }
    }
    const deep = addPoints(props.model.markers.filter(m => m.kind === "messier").map(m => m.vector), 3, "#83e5bc");
    const lineMaterial = new LineBasicMaterial({ color: "#41668c", transparent: true, opacity: 0.65 }); materials.push(lineMaterial);
    const lines = new LineSegments(geometry(props.model.lines), lineMaterial); scene.add(lines);
    const groundMaterial = new MeshBasicMaterial({ color: "#0d201e", side: BackSide }); materials.push(groundMaterial);
    const ground = new SphereGeometry(96, 72, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); geometries.push(ground);
    scene.add(new Mesh(ground, groundMaterial));
    const terrain: number[] = [], edge: Vector3[] = [];
    for (let az = 0; az <= 360; az += 2) {
      const top = horizontalVector(az, horizonAltitude(props.horizon, az)); edge.push(top);
      if (az === 360) break;
      const next = horizontalVector(az + 2, horizonAltitude(props.horizon, az + 2));
      const base = horizontalVector(az, 0), baseNext = horizontalVector(az + 2, 0);
      for (const p of [base, top, next, base, next, baseNext]) terrain.push(...p.clone().multiplyScalar(96).toArray());
    }
    const terrainGeometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(terrain, 3)); geometries.push(terrainGeometry);
    const terrainMaterial = new MeshBasicMaterial({ color: "#20352d", side: DoubleSide }); materials.push(terrainMaterial);
    scene.add(new Mesh(terrainGeometry, terrainMaterial));
    const horizonMaterial = new LineBasicMaterial({ color: "#628a78" }); materials.push(horizonMaterial);
    scene.add(new LineLoop(geometry(edge, 95), horizonMaterial));
    const overlays = props.model.markers.map(marker => {
      const label = document.createElement("span"); label.textContent = t(marker.name);
      label.className = `${styles.skyLabel} ${styles[marker.kind]}`; element.append(label); return { marker, label };
    }).sort((a, b) => ["sun", "compass", "planet", "constellation", "star", "messier"].indexOf(a.marker.kind) - ["sun", "compass", "planet", "constellation", "star", "messier"].indexOf(b.marker.kind));
    let width = 0, height = 0, frame = 0, disposed = false;
    const draw = () => {
      frame = 0; if (disposed || document.hidden || !width || !height) return;
      const state = latest.current;
      scene.background = state.matchDaylight ? litSky : darkSky;
      camera.quaternion.copy(state.pose); camera.fov = state.fov; camera.aspect = width / height;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      const nightVisibility = state.matchDaylight ? skyNightVisibility(state.model.sun.altitude) : 1;
      for (const [index, bucket] of stars.entries()) { bucket.visible = state.layers.stars && nightVisibility > 0; bucket.material.opacity = nightVisibility ** (index + 1); }
      planets.visible = state.layers.planets && nightVisibility > 0; planets.material.opacity = nightVisibility;
      moon.visible = state.layers.moon;
      for (const mesh of sunMeshes) mesh.visible = state.layers.sun;
      lines.visible = state.layers.constellations && nightVisibility > 0; lineMaterial.opacity = 0.65 * nightVisibility;
      deep.visible = state.layers.messier && nightVisibility > 0; deep.material.opacity = nightVisibility;
      renderer.render(scene, camera);
      const occupied: { x: number; y: number; width: number }[] = [];
      for (const { marker, label } of overlays) {
        label.textContent = t(marker.name);
        const p = marker.vector.clone().multiplyScalar(100).project(camera);
        const x = (p.x + 1) / 2 * width, y = (1 - p.y) / 2 * height, textWidth = label.offsetWidth || label.textContent.length * 7 + 12;
        const visible = p.z > -1 && p.z < 1 && x >= textWidth / 2 && x <= width - textWidth / 2 && y > 22 && y < height - 24
          && (state.layers.labels || marker.kind === "compass")
          && markerVisible(marker, state.layers, state.matchDaylight, state.model.sun.altitude)
          && !occupied.some(other => Math.abs(other.y - y) < 22 && Math.abs(other.x - x) < (other.width + textWidth) / 2);
        label.hidden = !visible;
        if (visible) { label.style.opacity = String(isDaylightMarker(marker) ? 1 : nightVisibility); label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`; occupied.push({ x, y, width: textWidth }); }
      }
    };
    const requestDraw = () => { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(draw); };
    paint.current = requestDraw;
    const resize = new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      if (box.width <= 0 || box.height <= 0) return;
      width = box.width; height = box.height; renderer.setSize(width, height); requestDraw();
    }); resize.observe(element);
    const contextLost = (event: Event) => { event.preventDefault(); setError("The 3D graphics context was lost. Reopen Sky to retry, or use the 2D Star atlas in Observe."); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      disposed = true; paint.current = null; cancelAnimationFrame(frame); resize.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      overlays.forEach(({ label }) => label.remove()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [props.model, props.horizon]);
  return <div ref={host} className={styles.scene} tabIndex={0} role="region" aria-label={t("Interactive 3D sky. Drag or use arrow keys to look around; plus and minus zoom.")}
    onKeyDown={event => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); props.onDrag(event.key === "ArrowLeft" ? -6 : event.key === "ArrowRight" ? 6 : 0, event.key === "ArrowUp" ? 6 : event.key === "ArrowDown" ? -6 : 0);
      } else if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); props.onZoom(event.key === "-" ? 5 : -5); }
    }} onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }} onPointerMove={event => {
      const previous = drag.current; if (!previous || previous.id !== event.pointerId) return;
      const scale = props.fov / Math.max(1, event.currentTarget.clientHeight);
      props.onDrag((previous.x - event.clientX) * scale, (event.clientY - previous.y) * scale);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onBlur={() => { drag.current = null; }}>
    <div className={styles.reticle} aria-hidden="true" />
    {error && <p className={styles.error} role="alert">{t(error)}</p>}
    <span className={styles.gestureHint}>{props.motion ? t("MOVE PHONE") : t("DRAG TO LOOK")}</span>
  </div>;
}
