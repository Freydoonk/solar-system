import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createBodyVisual } from "../solar-system/bodyVisuals";
import { previewHalfSpan, type Appearance } from "./eyepiece";
import styles from "./EyepiecePreview.module.css";

type Props = { appearance: Appearance; fraction: number; enlarged: boolean; active: boolean; reset: number };

export default function EyepieceScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const update = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  const [textureError, setTextureError] = useState(false);
  const body = props.appearance.body;
  useLayoutEffect(() => { latest.current = props; update.current?.(); }, [props]);

  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch {
      const frame = requestAnimationFrame(() => setError("3D preview needs WebGL. The calculated sizes and observing guide are still available."));
      return () => cancelAnimationFrame(frame);
    }
    let disposed = false;
    let pending = 0;
    let hasSize = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor("#020407");
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    host.appendChild(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
    camera.position.set(0, 0, 10);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.35;
    const sunlight = new THREE.DirectionalLight("#fff8ed", 3);
    const ambient = new THREE.AmbientLight("#c2d4ff", 0.025);
    scene.add(sunlight, ambient);

    // Render only on updates, interaction, texture load or resize, never in a perpetual loop.
    const render = () => {
      pending = 0;
      if (!disposed && latest.current.active && hasSize) renderer.render(scene, camera);
    };
    const invalidate = () => { if (!disposed && !pending) pending = requestAnimationFrame(render); };
    const textures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    const texture = (file: string, color = true) => {
      const loaded = loader.load(import.meta.env.BASE_URL + "textures/" + file, invalidate, undefined, () => {
        if (disposed) return;
        setTextureError(true);
        visual?.root.traverse((object) => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.map === loaded) {
            object.material.map = null; object.material.bumpMap = null; object.material.needsUpdate = true;
          }
        });
        invalidate();
      });
      loaded.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      loaded.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      textures.push(loaded);
      return loaded;
    };
    const visual = createBodyVisual(body.toLowerCase(), texture, (map) => textures.push(map), { value: sunlight.position });
    // Uranus's faint rings are not an ordinary visual-telescope feature.
    if (body === "Uranus") visual.axis.children.filter((child) => child !== visual!.surface).forEach((child) => { child.visible = false; });
    if (visual.surface.material instanceof THREE.MeshStandardMaterial) visual.surface.material.bumpScale = 0;
    scene.add(visual.root);
    let previousEnlarged: boolean | undefined;
    let previousReset = -1;
    let dragging = false;
    const apply = () => {
      const current = latest.current;
      const halfSpan = previewHalfSpan(current.fraction, current.enlarged, body === "Saturn" ? 2.4 : 1);
      camera.left = -halfSpan; camera.right = halfSpan; camera.top = halfSpan; camera.bottom = -halfSpan;
      camera.updateProjectionMatrix();
      if (current.enlarged !== previousEnlarged || current.reset !== previousReset) {
        camera.position.set(0, 0, 10); camera.up.set(0, 1, 0); controls.target.set(0, 0, 0);
        controls.update();
        previousEnlarged = current.enlarged; previousReset = current.reset;
      }
      controls.enabled = current.enlarged && current.active;
      canvas.style.touchAction = current.enlarged ? "none" : "pan-y";
      canvas.style.cursor = current.enlarged ? dragging ? "grabbing" : "grab" : "default";
      canvas.setAttribute("aria-label", current.enlarged
        ? body + " enlarged 3D model. Drag or use arrow keys to rotate. This is not the eyepiece scale."
        : body + " 3D eyepiece preview, fixed to the observer's viewing direction and calculated angular scale.");
      const { pole, sunDirection, spin } = current.appearance;
      visual!.axis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(pole.x, pole.y, pole.z).normalize());
      visual!.surface.rotation.y = spin;
      sunlight.position.set(sunDirection.x, sunDirection.y, sunDirection.z).multiplyScalar(10);
      ambient.intensity = current.enlarged ? 0.08 : 0.025;
      invalidate();
    };
    update.current = apply;
    apply();
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
      hasSize = true;
      renderer.setSize(entry.contentRect.width, entry.contentRect.height);
      invalidate();
    });
    observer.observe(host);
    const start = () => { dragging = true; canvas.style.cursor = "grabbing"; };
    const end = () => { dragging = false; canvas.style.cursor = latest.current.enlarged ? "grab" : "default"; };
    const key = (event: KeyboardEvent) => {
      if (!controls.enabled || event.ctrlKey || event.metaKey || event.altKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      const step = 2 * Math.PI / 180;
      if (event.key === "ArrowLeft") spherical.theta -= step;
      if (event.key === "ArrowRight") spherical.theta += step;
      if (event.key === "ArrowUp") spherical.phi -= step;
      if (event.key === "ArrowDown") spherical.phi += step;
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical); controls.update(); invalidate();
    };
    const lost = (event: Event) => { event.preventDefault(); setError("3D graphics were interrupted. Reload to restore the preview."); };
    controls.addEventListener("change", invalidate);
    controls.addEventListener("start", start);
    controls.addEventListener("end", end);
    canvas.addEventListener("keydown", key);
    canvas.addEventListener("blur", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    window.addEventListener("blur", end);
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true; update.current = null; cancelAnimationFrame(pending);
      observer.disconnect(); controls.dispose();
      canvas.removeEventListener("keydown", key); canvas.removeEventListener("blur", end); canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("pointercancel", end); canvas.removeEventListener("lostpointercapture", end); window.removeEventListener("blur", end);
      visual!.root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      textures.forEach((map) => map.dispose()); renderer.dispose(); canvas.remove();
    };
  }, [body]);

  return <>
    <div ref={hostRef} className={styles.scene} />
    {error && <p role="status" className={styles.sceneError}>{error}</p>}
    {textureError && !error && <p className={styles.sceneError}>Surface map unavailable. Showing an untextured 3D model.</p>}
  </>;
}
