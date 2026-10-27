import { useEffect, useRef, useState } from "react";
import { BackSide, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, PointsMaterial, Scene, SphereGeometry, Vector3, WebGLRenderer, type Quaternion } from "three";
import type { SkyViewModel } from "./skyViewModel";
import { horizontalVector } from "./skyOrientation";
import { horizonAltitude, type HorizonProfile } from "./horizon";
import styles from "./Sky.module.css";

type Props = { model: SkyViewModel; horizon: HorizonProfile; pose: Quaternion; fov: number; lines: boolean; deep: boolean; labels: boolean;
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
    const scene = new Scene(); scene.background = new Color("#030b18");
    const camera = new PerspectiveCamera(60, 1, 0.1, 200);
    const geometries: BufferGeometry[] = [];
    const materials: (PointsMaterial | MeshBasicMaterial | LineBasicMaterial)[] = [];
    const geometry = (points: Vector3[], radius = 100) => { const g = new BufferGeometry().setFromPoints(points.map(p => p.clone().multiplyScalar(radius))); geometries.push(g); return g; };
    const addPoints = (points: Vector3[], size: number, color: string) => {
      const material = new PointsMaterial({ color, size, sizeAttenuation: false }); materials.push(material);
      const mesh = new Points(geometry(points), material); scene.add(mesh); return mesh;
    };
    props.model.starBuckets.forEach((bucket, index) => addPoints(bucket, [3.2, 2.1, 1.2][index], ["#f2f6ff", "#c9d9eb", "#7e92ae"][index]));
    addPoints(props.model.markers.filter(m => m.kind === "planet").map(m => m.vector), 6, "#ffd18b");
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
      const label = document.createElement("span"); label.textContent = marker.name;
      label.className = `${styles.skyLabel} ${styles[marker.kind]}`; element.append(label); return { marker, label };
    }).sort((a, b) => ["compass", "planet", "constellation", "star", "messier"].indexOf(a.marker.kind) - ["compass", "planet", "constellation", "star", "messier"].indexOf(b.marker.kind));
    let width = 0, height = 0, frame = 0, disposed = false;
    const draw = () => {
      frame = 0; if (disposed || document.hidden || !width || !height) return;
      const state = latest.current;
      camera.quaternion.copy(state.pose); camera.fov = state.fov; camera.aspect = width / height;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      lines.visible = state.lines; deep.visible = state.deep;
      renderer.render(scene, camera);
      const occupied: { x: number; y: number; width: number }[] = [];
      for (const { marker, label } of overlays) {
        const p = marker.vector.clone().multiplyScalar(100).project(camera);
        const x = (p.x + 1) / 2 * width, y = (1 - p.y) / 2 * height, textWidth = marker.name.length * 7 + 12;
        const visible = p.z > -1 && p.z < 1 && x >= textWidth / 2 && x <= width - textWidth / 2 && y > 22 && y < height - 24
          && (state.labels || marker.kind === "compass") && (state.lines || marker.kind !== "constellation") && (state.deep || marker.kind !== "messier")
          && !occupied.some(other => Math.abs(other.y - y) < 22 && Math.abs(other.x - x) < (other.width + textWidth) / 2);
        label.hidden = !visible;
        if (visible) { label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`; occupied.push({ x, y, width: textWidth }); }
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
  return <div ref={host} className={styles.scene} tabIndex={0} role="region" aria-label="Interactive 3D sky. Drag or use arrow keys to look around; plus and minus zoom."
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
    {error && <p className={styles.error} role="alert">{error}</p>}
    <span className={styles.gestureHint}>{props.motion ? "MOVE PHONE" : "DRAG TO LOOK"}</span>
  </div>;
}
