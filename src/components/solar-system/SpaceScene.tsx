import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BODY_PRESETS, bodyRadiusPx, SUN_RADIUS_KM, type SizeMode } from "./planets";
import { DAY_MS, getBodyOrientation, type Vec3 } from "./astronomy";
import { createSceneLayout, moonOrbitRadius } from "./layout";
import { BODY_ENVELOPES, fitDistance, followOffset, getSpacePositions, projectToSpace, toWorld, type CameraRequest } from "./space";
import { createBodyVisual, TEXTURE_FILES, type BodyVisual } from "./bodyVisuals";
import styles from "./SolarSystem.module.css";

type Props = {
  time: number;
  positions: Record<string, Vec3>;
  guides: Record<string, Vec3[]>;
  bodyScale: number;
  sizeMode: SizeMode;
  showTrueSun: boolean;
  showNames: boolean;
  showOrbits: boolean;
  showMoons: boolean;
  request: CameraRequest;
  onFocus: (id: string) => void;
  onFallback: () => void;
};

const bodies = [{ id: "sun", name: "Sun", parentId: undefined, schematic: false, radiusKm: SUN_RADIUS_KM, periodDays: 25.4 }, ...BODY_PRESETS];
const vector = (point: Vec3) => new THREE.Vector3(point.x, point.y, point.z);

export default function SpaceScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [textureError, setTextureError] = useState(false);
  // Fixed world units: resizing changes the camera, never the planetary layout.
  const layout = useMemo(() => createSceneLayout(props.guides, 1000, props.bodyScale, props.sizeMode, 1,
    BODY_ENVELOPES, true), [props.guides, props.bodyScale, props.sizeMode]);
  const latest = useRef({ ...props, layout });
  useLayoutEffect(() => { latest.current = { ...props, layout }; }, [props, layout]);

  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    } catch {
      const notification = requestAnimationFrame(() => setError("3D needs WebGL. You can continue exploring in the 2D view."));
      return () => cancelAnimationFrame(notification);
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.className = styles.spaceCanvas;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "3D solar system. Drag to orbit, scroll to zoom, right-drag or arrow keys to pan. Select a body to explore it.");
    host.appendChild(renderer.domElement);
    const labelLayer = document.createElement("div");
    labelLayer.className = styles.spaceLabels;
    host.appendChild(labelLayer);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.zoomToCursor = true;
    controls.maxDistance = 15000;
    controls.listenToKeyEvents(renderer.domElement);
    scene.add(new THREE.AmbientLight("#c2d4ff", 0.16));
    // Constant intensity is intentional in this compressed educational layout.
    scene.add(new THREE.PointLight("#fff5e7", 3.2, 0, 0));

    const textures = new Map<string, THREE.Texture>();
    const generatedTextures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    const texture = (file: string, color = true) => {
      const key = `${file}:${color}`;
      const cached = textures.get(key);
      if (cached) return cached;
      const loaded = loader.load(`${import.meta.env.BASE_URL}textures/${file}`, undefined, undefined, () => {
        if (!disposed) setTextureError(true);
      });
      loaded.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      loaded.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      textures.set(key, loaded);
      return loaded;
    };
    const visuals = new Map<string, BodyVisual>();
    const labels = new Map<string, HTMLButtonElement>();
    for (const body of bodies) {
      const visual = createBodyVisual(body.id, texture, (map) => generatedTextures.push(map));
      visuals.set(body.id, visual);
      scene.add(visual.root);
      const label = document.createElement("button");
      label.type = "button";
      label.className = styles.spaceLabel;
      label.textContent = body.name + (body.schematic ? " *" : "");
      label.title = `Explore ${body.name} · radius ${body.radiusKm.toLocaleString()} km`;
      label.setAttribute("aria-label", `Explore ${body.name}`);
      label.addEventListener("click", () => latest.current.onFocus(body.id));
      labelLayer.appendChild(label);
      labels.set(body.id, label);
    }

    const starPositions: number[] = [];
    let seed = 27;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1800; i++) {
      const longitude = random() * Math.PI * 2;
      const height = random() * 2 - 1;
      const radius = Math.sqrt(1 - height * height);
      starPositions.push(30000 * radius * Math.cos(longitude), 30000 * height, 30000 * radius * Math.sin(longitude));
    }
    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position",
      new THREE.Float32BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({
      color: "#c6d4e5", size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false,
    }));
    scene.add(stars);

    const planetOrbits = new THREE.Group();
    const moonOrbits = new THREE.Group();
    scene.add(planetOrbits, moonOrbits);
    const planetLineMaterial = new THREE.LineBasicMaterial({ color: "#8bafcc", transparent: true, opacity: 0.28 });
    const moonLineMaterial = new THREE.LineBasicMaterial({ color: "#8bafcc", transparent: true, opacity: 0.16 });
    let previousLayout: typeof layout | null = null;
    const clearLines = (group: THREE.Group) => {
      for (const child of [...group.children]) {
        (child as THREE.Line).geometry.dispose();
        group.remove(child);
      }
    };
    let width = 1;
    let height = 1;
    let refit = true;
    const observer = new ResizeObserver(([entry]) => {
      width = Math.max(1, entry.contentRect.width);
      height = Math.max(1, entry.contentRect.height);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      refit = true;
    });
    observer.observe(host);

    let lastRequest = -1;
    let followed: string | null = null;
    let lastFollowPosition: Vec3 | null = null;
    let transition: { fromCamera: THREE.Vector3; fromTarget: THREE.Vector3; toOffset: THREE.Vector3; start: number } | null = null;
    let automaticView = true;
    let previousSunMode = latest.current.showTrueSun;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interruptFlight = () => { transition = null; automaticView = false; };
    controls.addEventListener("start", interruptFlight);

    const raycaster = new THREE.Raycaster();
    let pointerDown: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      renderer.domElement.focus({ preventScroll: true });
      if (event.button === 0) pointerDown = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerDown;
      pointerDown = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / width * 2 - 1,
        -(event.clientY - rect.top) / height * 2 + 1), camera);
      const targets = [...visuals.values()].filter((item) => item.root.visible && item.surface.visible).map((item) => item.surface);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (hit) latest.current.onFocus(hit.object.userData.bodyId as string);
    };
    // Preserve browser Ctrl/Cmd wheel zoom; normal wheel input goes to OrbitControls.
    const onWheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) event.stopImmediatePropagation(); };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setError("The 3D graphics context was lost. Reload the page or continue in 2D.");
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { capture: true });
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const tick = (now: number) => {
      const current = latest.current;
      const space = getSpacePositions(current.positions, current.layout);
      const sunRadius = current.showTrueSun ? bodyRadiusPx(SUN_RADIUS_KM, current.bodyScale, "true") * current.layout.scale : 2.5;
      const radiusFor = (id: string) => id === "sun" ? sunRadius : current.layout.bodyRadii[id];
      const date = new Date(current.time);
      const layoutChanged = previousLayout !== current.layout;
      if (layoutChanged) {
        clearLines(planetOrbits);
        clearLines(moonOrbits);
        for (const [id, points] of Object.entries(current.guides)) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => vector(projectToSpace(id, p, current.layout))));
          planetOrbits.add(new THREE.LineLoop(geometry, planetLineMaterial));
        }
        for (const body of BODY_PRESETS.filter((item) => item.parentId)) {
          const geometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => {
            const angle = i / 128 * 2 * Math.PI;
            return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
          }));
          const line = new THREE.LineLoop(geometry, moonLineMaterial);
          line.userData.bodyId = body.id;
          line.userData.parentId = body.parentId;
          moonOrbits.add(line);
        }
        previousLayout = current.layout;
      }
      planetOrbits.visible = current.showOrbits;
      moonOrbits.visible = current.showOrbits && current.showMoons;
      for (const line of moonOrbits.children) {
        const id = line.userData.bodyId as string;
        const p = current.positions[id];
        // A schematic circle through the current satellite, tilted to include
        // its actual latitude. Planet guides are full sampled trajectories.
        const direction = vector(toWorld(p)).normalize();
        const tangent = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        const normal = new THREE.Vector3().crossVectors(direction, tangent).normalize();
        line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        line.position.copy(vector(space[line.userData.parentId as string]));
        line.scale.setScalar(moonOrbitRadius(id, Math.hypot(p.x, p.y, p.z), current.layout));
      }
      for (const body of bodies) {
        const visual = visuals.get(body.id)!;
        visual.root.position.copy(vector(space[body.id]));
        visual.root.scale.setScalar(radiusFor(body.id));
        visual.root.visible = !body.parentId || current.showMoons;
        visual.surface.visible = body.id !== "sun" || current.showTrueSun;
        const orientation = getBodyOrientation(body.id, date);
        if (orientation) {
          visual.axis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector(toWorld(orientation.north)).normalize());
          visual.surface.rotation.y = orientation.spin;
          if (visual.clouds) visual.clouds.rotation.y = orientation.spin;
        } else {
          visual.surface.rotation.y = 2 * Math.PI * (current.time / DAY_MS % body.periodDays) / body.periodDays;
        }
      }

      const newRequest = current.request.serial !== lastRequest;
      const sunModeChanged = current.showTrueSun !== previousSunMode;
      previousSunMode = current.showTrueSun;
      if (newRequest || (automaticView && (refit || layoutChanged || (sunModeChanged && followed === "sun")))) {
        followed = current.request.bodyId;
        const target = vector(space[followed ?? "sun"]);
        const extent = followed ? radiusFor(followed) * (BODY_ENVELOPES[followed] ?? 1)
          : Math.max(current.layout.outerRadius, sunRadius);
        const distance = fitDistance(extent, camera.aspect, camera.fov);
        const direction = new THREE.Vector3(0.7, 0.85, 1);
        if (current.request.view === "top") direction.set(0, 1, 0.0001);
        else if (current.request.view === "side") direction.set(0, 0.07, 1);
        else if (followed) {
          // Start on the illuminated side, at an angle that still shows the limb.
          direction.copy(target).negate().normalize();
          if (direction.lengthSq() === 0) direction.set(0, 0.3, 1);
          direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.45);
          direction.y += 0.28;
        }
        const offset = direction.normalize().multiplyScalar(distance);
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        if (lastRequest === -1 || reducedMotion || !newRequest) {
          camera.position.copy(target).add(offset);
          controls.target.copy(target);
          transition = null;
        } else transition = { fromCamera: camera.position.clone(), fromTarget: controls.target.clone(), toOffset: offset, start: now };
        lastFollowPosition = space[followed ?? "sun"];
        automaticView = true;
        lastRequest = current.request.serial;
      }
      refit = false;
      controls.zoomToCursor = !followed;
      controls.minDistance = followed ? radiusFor(followed) * 1.08 : 0.01;
      camera.near = followed ? Math.max(0.000001, radiusFor(followed) * 0.001) : 0.001;
      camera.updateProjectionMatrix();
      if (transition) {
        const fraction = Math.min(1, (now - transition.start) / 700);
        const ease = fraction * fraction * (3 - 2 * fraction);
        const target = vector(space[followed ?? "sun"]);
        controls.target.lerpVectors(transition.fromTarget, target, ease);
        camera.position.lerpVectors(transition.fromCamera, target.clone().add(transition.toOffset), ease);
        if (fraction === 1) transition = null;
      } else if (followed && lastFollowPosition) {
        const movement = vector(followOffset(lastFollowPosition, space[followed]));
        camera.position.add(movement);
        controls.target.add(movement);
      }
      lastFollowPosition = space[followed ?? "sun"];
      controls.update();
      stars.position.copy(camera.position);
      renderer.render(scene, camera);

      const occupied: { x: number; y: number; width: number }[] = [];
      const ordered = [...bodies].sort((a, b) => Number(b.id === followed) - Number(a.id === followed) || Number(!!a.parentId) - Number(!!b.parentId));
      for (const body of ordered) {
        const label = labels.get(body.id)!;
        const location = vector(space[body.id]);
        const projected = location.clone().project(camera);
        const distance = location.distanceTo(camera.position);
        const pixelRadius = radiusFor(body.id) / distance * height / (2 * Math.tan(camera.fov * Math.PI / 360));
        const marker = body.id === "sun" && !current.showTrueSun;
        const x = (projected.x + 1) * width / 2;
        const y = (1 - projected.y) * height / 2;
        const labelWidth = body.name.length * 6.5 + 30;
        const sightLine = location.clone().sub(camera.position).normalize();
        const obscured = bodies.some((other) => {
          if (other.id === body.id || (other.parentId && !current.showMoons) || (other.id === "sun" && !current.showTrueSun)) return false;
          const toward = vector(space[other.id]).sub(camera.position);
          const along = toward.dot(sightLine);
          return along > 0 && along < distance && toward.lengthSq() - along * along < radiusFor(other.id) ** 2;
        });
        const show = (current.showNames || marker) && (!body.parentId || current.showMoons)
          && !obscured && (body.id !== followed || marker)
          && projected.z > -1 && projected.z < 1 && x > 0 && x < width - labelWidth && y > 0 && y < height - 24
          && (body.id === followed || !occupied.some((item) => Math.abs(item.y - y) < 21 && x < item.x + item.width && x + labelWidth > item.x));
        label.hidden = !show;
        if (show) {
          label.style.transform = `translate(${x}px, ${y - 11}px)`;
          label.style.paddingLeft = `${marker || pixelRadius < 3 ? 12 : Math.min(pixelRadius + 8, width / 3)}px`;
          label.dataset.marker = marker ? "sun" : pixelRadius < 3 ? "body" : "none";
          label.dataset.selected = String(body.id === followed);
          label.dataset.appearance = TEXTURE_FILES[body.id] ? "mapped" : "illustrative";
          occupied.push({ x, y, width: labelWidth });
        }
      }
    };
    renderer.setAnimationLoop(tick);
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.removeEventListener("start", interruptFlight);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel, { capture: true });
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      planetLineMaterial.dispose();
      moonLineMaterial.dispose();
      textures.forEach((map) => map.dispose());
      generatedTextures.forEach((map) => map.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    };
  }, []);

  return <div ref={hostRef} className={styles.spaceHost}>
    {error && <div className={styles.spaceError} role="alert"><p>{error}</p>
      <button type="button" onClick={props.onFallback}>Open 2D view</button></div>}
    {textureError && !error && <p className={styles.textureWarning} role="status">Some surface maps could not load. Reload to retry.</p>}
  </div>;
}
