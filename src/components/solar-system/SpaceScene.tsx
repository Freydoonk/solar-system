import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BODY_PRESETS, SUN_RADIUS_KM } from "./planets";
import { DAY_MS, getBodyOrientation, type Vec3 } from "./astronomy";
import { auToWorld, BODY_ENVELOPES, cameraNearPlane, createPhysicalLayout, fitDistance, followOffset, getSpacePositions, projectToSpace, relativeToOrigin, renderScaleForDistance, toWorld, type CameraRequest } from "./space";
import { applyBodyOrientation, createBodyVisual, TEXTURE_FILES, type BodyVisual } from "./bodyVisuals";
import styles from "./SolarSystem.module.css";
import { bindLocationRelease, bindSpacePan, type DragMode } from "./navigation";
import type { ApproximateLocation } from "./location";
import { geographicDirection } from "./locationView";
import { createFollowLock, sunViewMinimumDistance, sunViewOffset } from "./following";

type Props = {
  time: number;
  positions: Record<string, Vec3>;
  guides: Record<string, Vec3[]>;
  showNames: boolean;
  showOrbits: boolean;
  showMoons: boolean;
  dragMode: DragMode;
  initialLocation: ApproximateLocation | null;
  onReleaseFollow: (serial: number) => void;
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
  // One metric scale. Resizing and focusing only move the camera.
  const layout = useMemo(() => createPhysicalLayout(props.guides), [props.guides]);
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
    renderer.domElement.setAttribute("aria-label", "3D solar system. Hold Space and left-drag to pan. Use Orbit or Pan to choose the normal drag action. Scroll to zoom; arrow keys also pan when the sky is focused.");
    host.appendChild(renderer.domElement);
    const labelLayer = document.createElement("div");
    labelLayer.className = styles.spaceLabels;
    host.appendChild(labelLayer);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000);
    // Controls use double-precision heliocentric coordinates. Rendering uses a
    // nearby origin so even Deimos remains stable while orbiting distant Mars.
    const renderCamera = camera.clone();
    const renderOrigin = new THREE.Vector3();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    controls.enablePan = true;
    controls.maxDistance = 15000;
    controls.listenToKeyEvents(renderer.domElement);
    const navigation = bindSpacePan(renderer.domElement, controls, () => latest.current.dragMode);
    scene.add(new THREE.AmbientLight("#c2d4ff", 0.16));
    // Exposure remains illustrative so distant surfaces can still be examined.
    const sunlight = new THREE.PointLight("#fff5e7", 3.2, 0, 0);
    scene.add(sunlight);
    const sunPosition = { value: sunlight.position };

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
      const visual = createBodyVisual(body.id, texture, (map) => generatedTextures.push(map), sunPosition);
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interruptFlight = () => { transition = null; automaticView = false; };
    controls.addEventListener("start", interruptFlight);
    const followLock = createFollowLock((serial) => latest.current.onReleaseFollow(serial));
    const unbindLocationRelease = bindLocationRelease(renderer.domElement, () => followLock.release(latest.current.request));
    let previousFollowMode = latest.current.request.followMode;

    const raycaster = new THREE.Raycaster();
    let pointerDown: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      renderer.domElement.focus({ preventScroll: true });
      // A short pan gesture must not unexpectedly select and fly to a body.
      pointerDown = event.button === 0 && controls.mouseButtons.LEFT === THREE.MOUSE.ROTATE
        && !event.ctrlKey && !event.metaKey && !event.shiftKey
        ? { x: event.clientX, y: event.clientY } : null;
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerDown;
      pointerDown = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / width * 2 - 1,
        -(event.clientY - rect.top) / height * 2 + 1), renderCamera);
      const targets = [...visuals.values()].filter((item) => item.root.visible && item.surface.visible).map((item) => item.surface);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (hit) latest.current.onFocus(hit.object.userData.bodyId as string);
    };
    // Preserve browser Ctrl/Cmd wheel zoom; normal wheel input goes to OrbitControls.
    const onWheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) event.stopImmediatePropagation(); };
    const onKeyNavigation = (event: KeyboardEvent) => {
      if (event.key.startsWith("Arrow")) interruptFlight();
    };
    const cancelPick = () => { pointerDown = null; };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setError("The 3D graphics context was lost. Reload the page or continue in 2D.");
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", cancelPick);
    renderer.domElement.addEventListener("keydown", onKeyNavigation);
    renderer.domElement.addEventListener("wheel", onWheel, { capture: true });
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const tick = (now: number) => {
      const current = latest.current;
      const followMode = followLock.mode(current.request);
      if (followMode === "free" && previousFollowMode !== "free" && current.request.serial === lastRequest) interruptFlight();
      previousFollowMode = followMode;
      navigation.refresh();
      const space = getSpacePositions(current.positions);
      const radiusFor = (id: string) => current.layout.bodyRadii[id];
      controls.maxDistance = fitDistance(current.layout.outerRadius, camera.aspect) * 8;
      camera.far = Math.max(100000, controls.maxDistance * 4);
      const date = new Date(current.time);
      const layoutChanged = previousLayout !== current.layout;
      if (layoutChanged) {
        clearLines(planetOrbits);
        clearLines(moonOrbits);
        for (const [id, points] of Object.entries(current.guides)) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => vector(projectToSpace(p))));
          geometry.name = `${id} orbit`;
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
        line.scale.setScalar(auToWorld(Math.hypot(p.x, p.y, p.z)));
      }
      for (const body of bodies) {
        const visual = visuals.get(body.id)!;
        visual.root.scale.setScalar(radiusFor(body.id));
        visual.root.visible = !body.parentId || current.showMoons;
        const orientation = getBodyOrientation(body.id, date);
        if (orientation) {
          applyBodyOrientation(visual, orientation);
        } else {
          visual.surface.rotation.y = 2 * Math.PI * (current.time / DAY_MS % body.periodDays) / body.periodDays;
        }
      }

      const newRequest = current.request.serial !== lastRequest;
      if (newRequest || (automaticView && (refit || layoutChanged))) {
        followed = current.request.bodyId;
        const target = vector(space[followed ?? "sun"]);
        const extent = followed ? radiusFor(followed) * (BODY_ENVELOPES[followed] ?? 1)
          : current.layout.outerRadius;
        const distance = fitDistance(extent, camera.aspect, camera.fov, current.request.screenFraction);
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
        let offset = direction.normalize().multiplyScalar(distance);
        if (followMode === "sun" && followed && followed !== "sun") {
          offset = sunViewOffset(followed, space, current.layout.bodyRadii, distance, camera.aspect, camera.fov);
        } else if (followMode === "region" && followed === "earth" && current.initialLocation) {
          offset = geographicDirection(current.initialLocation, visuals.get("earth")!.axis.quaternion).multiplyScalar(distance);
        }
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
      controls.minDistance = followed ? followMode === "sun"
        ? sunViewMinimumDistance(followed, current.layout.bodyRadii, camera.aspect, camera.fov) : radiusFor(followed) * 1.08 : 1e-8;
      camera.near = cameraNearPlane(followed ? radiusFor(followed) : radiusFor("deimos"));
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
      if (!transition && followed && followMode === "sun" && followed !== "sun") {
        const offset = sunViewOffset(followed, space, current.layout.bodyRadii,
          camera.position.distanceTo(controls.target), camera.aspect, camera.fov,
          camera.position.clone().sub(controls.target));
        controls.target.copy(vector(space[followed]));
        camera.position.copy(controls.target).add(offset);
      } else if (!transition && followed === "earth" && followMode === "region" && current.initialLocation) {
        // Follow the Earth's terrestrial rotation as well as its orbit, while
        // retaining the current camera distance (including mouse-wheel zoom).
        const distance = camera.position.distanceTo(controls.target);
        const regionDirection = geographicDirection(current.initialLocation, visuals.get("earth")!.axis.quaternion);
        controls.target.copy(vector(space.earth));
        camera.position.copy(controls.target).addScaledVector(regionDirection, distance);
      }
      controls.update();
      renderOrigin.copy(controls.target);
      const renderScale = renderScaleForDistance(camera.position.distanceTo(controls.target));
      renderCamera.copy(camera);
      renderCamera.position.sub(renderOrigin).multiplyScalar(renderScale);
      renderCamera.near *= renderScale;
      renderCamera.far *= renderScale;
      renderCamera.updateProjectionMatrix();
      renderCamera.updateMatrixWorld();
      sunlight.position.copy(renderOrigin).multiplyScalar(-renderScale);
      planetOrbits.position.copy(sunlight.position);
      planetOrbits.scale.setScalar(renderScale);
      for (const body of bodies) {
        const visual = visuals.get(body.id)!;
        const renderRadius = radiusFor(body.id) * renderScale;
        visual.root.position.copy(vector(relativeToOrigin(space[body.id], renderOrigin)).multiplyScalar(renderScale));
        visual.root.scale.setScalar(renderRadius);
        if (visual.surface.material instanceof THREE.MeshStandardMaterial) {
          visual.surface.material.bumpScale = renderRadius * (body.id === "europa" ? 0.003 : 0.009);
        }
      }
      for (const line of moonOrbits.children) {
        line.position.copy(vector(relativeToOrigin(space[line.userData.parentId as string], renderOrigin)).multiplyScalar(renderScale));
        line.scale.multiplyScalar(renderScale);
      }
      stars.position.copy(renderCamera.position);
      stars.scale.setScalar(renderScale);
      renderer.render(scene, renderCamera);

      const occupied: { x: number; y: number; width: number }[] = [];
      const ordered = [...bodies].sort((a, b) => Number(b.id === followed) - Number(a.id === followed) || Number(!!a.parentId) - Number(!!b.parentId));
      for (const body of ordered) {
        const label = labels.get(body.id)!;
        const location = vector(relativeToOrigin(space[body.id], renderOrigin)).multiplyScalar(renderScale);
        const projected = location.clone().project(renderCamera);
        const distance = location.distanceTo(renderCamera.position);
        const pixelRadius = radiusFor(body.id) * renderScale / distance * height / (2 * Math.tan(camera.fov * Math.PI / 360));
        const x = (projected.x + 1) * width / 2;
        const y = (1 - projected.y) * height / 2;
        const labelWidth = body.name.length * 6.5 + 30;
        const sightLine = location.clone().sub(renderCamera.position).normalize();
        const obscured = bodies.some((other) => {
          if (other.id === body.id || (other.parentId && !current.showMoons)) return false;
          const toward = vector(relativeToOrigin(space[other.id], renderOrigin)).multiplyScalar(renderScale).sub(renderCamera.position);
          const along = toward.dot(sightLine);
          // Avoid subtracting two enormous squared distances for tiny moons.
          const perpendicular = toward.addScaledVector(sightLine, -along);
          return along > 0 && along < distance && perpendicular.lengthSq() < (radiusFor(other.id) * renderScale) ** 2;
        });
        const followLocator = followMode === "sun" && (body.id === "sun" || body.id === followed && pixelRadius < 3);
        const show = (current.showNames || followLocator) && (!body.parentId || current.showMoons)
          && !obscured && (body.id !== followed || followLocator)
          && projected.z > -1 && projected.z < 1 && x > 0 && x < width - labelWidth && y > 0 && y < height - 24
          && (body.id === followed || !occupied.some((item) => Math.abs(item.y - y) < 21 && x < item.x + item.width && x + labelWidth > item.x));
        label.hidden = !show;
        if (show) {
          label.style.transform = `translate(${x}px, ${y - 11}px)`;
          label.style.paddingLeft = `${pixelRadius < 3 ? 12 : Math.min(pixelRadius + 8, width / 3)}px`;
          label.dataset.marker = pixelRadius < 3 ? body.id === "sun" ? "sun" : "body" : "none";
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
      unbindLocationRelease();
      navigation.dispose();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", cancelPick);
      renderer.domElement.removeEventListener("keydown", onKeyNavigation);
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
