import * as THREE from "three";

export const TEXTURE_FILES: Record<string, string> = {
  sun: "2k_sun.jpg", mercury: "2k_mercury.jpg", venus: "2k_venus_atmosphere.jpg",
  earth: "2k_earth_daymap.jpg", mars: "2k_mars.jpg", jupiter: "2k_jupiter.jpg",
  saturn: "2k_saturn.jpg", uranus: "2k_uranus.jpg", neptune: "2k_neptune.jpg", moon: "2k_moon.jpg",
};

const satelliteColors: Record<string, [string, string]> = {
  pluto: ["#c8b9a3", "#69534a"], phobos: ["#8e8175", "#433d39"], deimos: ["#b3a18c", "#655b50"],
  io: ["#dfc66b", "#786237"], europa: ["#d9ceba", "#95796a"], ganymede: ["#aaa297", "#605d57"],
  callisto: ["#817e78", "#3c3936"], titan: ["#d5a55a", "#a37637"],
  enceladus: ["#e0e6e8", "#9caeb8"], titania: ["#b0a9a2", "#69625e"], triton: ["#c7c4bf", "#8d7875"],
};

/** Artistic, deterministic terrain for bodies without a bundled observed map. */
function satelliteTexture(id: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  let seed = Array.from(id).reduce((value, char) => value * 31 + char.charCodeAt(0), 7) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const [base, dark] = satelliteColors[id] ?? ["#aaa6a0", "#67625e"];
  context.fillStyle = base;
  context.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 1600; i++) {
    const x = random() * 1024;
    const y = random() * 512;
    const radius = 1 + random() * (id === "titan" ? 90 : 22);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(1, base);
    context.globalAlpha = 0.1 + random() * 0.25;
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, radius * 1.8, radius, 0, 0, Math.PI * 2);
    context.fill();
    if (id !== "titan" && id !== "europa") {
      context.strokeStyle = "#ffffff";
      context.globalAlpha = 0.07;
      context.stroke();
    }
  }
  if (id === "europa" || id === "enceladus") {
    context.strokeStyle = dark;
    context.globalAlpha = 0.35;
    for (let i = 0; i < 110; i++) {
      const x = random() * 1024;
      const y = random() * 512;
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + 70, y - 70, x - 30, y + 90, x + 150, y + 120);
      context.lineWidth = 0.5 + random();
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type BodyVisual = { root: THREE.Group; axis: THREE.Group; surface: THREE.Mesh; clouds?: THREE.Mesh };

export function createBodyVisual(
  id: string,
  texture: (file: string, color?: boolean) => THREE.Texture,
  trackTexture: (texture: THREE.Texture) => void,
): BodyVisual {
  const root = new THREE.Group();
  const axis = new THREE.Group();
  root.add(axis);
  const map = TEXTURE_FILES[id] ? texture(TEXTURE_FILES[id]) : satelliteTexture(id);
  if (!TEXTURE_FILES[id]) trackTexture(map);
  const geometry = new THREE.SphereGeometry(1, 64, 40);
  // Small Martian moons are irregular rather than perfect spheres.
  if (id === "phobos" || id === "deimos") geometry.scale(1.22, 0.84, 0.98);
  const material = id === "sun"
    ? new THREE.MeshBasicMaterial({ map, color: "#fff5dc" })
    : new THREE.MeshStandardMaterial({ map, roughness: id === "earth" ? 0.78 : 0.96, metalness: 0 });
  if (material instanceof THREE.MeshStandardMaterial) {
    if (["moon", "mercury", "mars", ...Object.keys(satelliteColors)].includes(id) && id !== "titan") {
      material.bumpMap = map;
      material.bumpScale = id === "europa" ? 0.003 : 0.009;
    }
    if (id === "earth") {
      material.emissiveMap = texture("2k_earth_nightmap.jpg");
      material.emissive.set("#ffffff");
      material.emissiveIntensity = 0.35;
      // City lights fade smoothly on the sunlit hemisphere.
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = "varying vec3 vEarthWorld;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\nvEarthWorld = (modelMatrix * vec4(position, 1.0)).xyz;");
        shader.fragmentShader = "varying vec3 vEarthWorld;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\nvec3 sunView = normalize((viewMatrix * vec4(-vEarthWorld, 0.0)).xyz);\ntotalEmissiveRadiance *= 1.0 - smoothstep(-0.15, 0.2, dot(normal, sunView));");
      };
    }
  }
  const surface = new THREE.Mesh(geometry, material);
  surface.userData.bodyId = id;
  axis.add(surface);

  let clouds: THREE.Mesh | undefined;
  if (id === "earth") {
    clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 64, 40), new THREE.MeshStandardMaterial({
      color: "#ffffff", alphaMap: texture("2k_earth_clouds.jpg", false), transparent: true,
      opacity: 0.72, depthWrite: false, roughness: 1,
    }));
    axis.add(clouds);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.045, 48, 32), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: `#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 worldNormal; varying vec3 worldPosition;
        void main() { worldNormal = normalize(mat3(modelMatrix) * normal);
        worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 worldNormal; varying vec3 worldPosition;
        void main() { vec3 n = normalize(worldNormal);
        #include <logdepthbuf_fragment>
        float rim = pow(1.0 - abs(dot(n, normalize(cameraPosition - worldPosition))), 3.0);
        float daylight = max(0.0, dot(n, normalize(-worldPosition)));
        gl_FragColor = vec4(0.16, 0.48, 1.0, rim * (0.12 + 0.65 * daylight)); }`,
    }));
    axis.add(atmosphere);
  }

  if (id === "saturn" || id === "uranus") {
    const inner = id === "saturn" ? 1.22 : 1.72;
    const outer = id === "saturn" ? 2.4 : 2;
    const ringGeometry = new THREE.RingGeometry(inner, outer, 192, 8);
    const positions = ringGeometry.getAttribute("position");
    const uv = ringGeometry.getAttribute("uv");
    for (let i = 0; i < positions.count; i++) {
      uv.setXY(i, (Math.hypot(positions.getX(i), positions.getY(i)) - inner) / (outer - inner), 0.5);
    }
    const rings = new THREE.Mesh(ringGeometry, new THREE.MeshStandardMaterial({
      map: id === "saturn" ? texture("2k_saturn_ring_alpha.png") : null,
      color: id === "saturn" ? "#fff4dc" : "#777f81", side: THREE.DoubleSide,
      transparent: true, opacity: id === "saturn" ? 0.94 : 0.25, alphaTest: 0.02, roughness: 1,
    }));
    rings.rotation.x = -Math.PI / 2;
    axis.add(rings);
  }
  return { root, axis, surface, clouds };
}
