// Refresh bundled data explicitly; never runs during build or in the browser.
import { writeFile, mkdir } from "node:fs/promises";
const root = new URL("../src/components/observing/catalogue/", import.meta.url);
const publicRoot = new URL("../public/catalogue/", import.meta.url);
const base = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/";
async function read(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
function csv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ""; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const header = rows.shift();
  return rows.map(values => Object.fromEntries(header.map((key, index) => [key, values[index]])));
}
const [hyg, lines, dsos, license, names] = await Promise.all([
  read("https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv"),
  read(base + "data/constellations.lines.json"), read(base + "data/messier.json"), read(base + "LICENSE"), read(base + "data/constellations.json"),
]);
const stars = csv(hyg).filter(star => star.id !== "0" && Number(star.mag) <= 6 && star.mag !== "").map(star => ({
  id: "HIP" + (star.hip || "-HYG" + star.id), name: star.proper || star.bf?.trim() || "HIP " + star.hip,
  constellation: star.con, ra: +star.ra, dec: +star.dec, mag: +star.mag,
  x: +star.x, y: +star.y, z: +star.z, vx: +star.vx, vy: +star.vy, vz: +star.vz,
}));
const constellations = JSON.parse(lines).features.map(feature => ({ id: feature.id, name: JSON.parse(names).features.find(item => item.id === feature.id)?.properties.name || feature.id, lines: feature.geometry.coordinates }));
const deepSky = JSON.parse(dsos).features;
await mkdir(root, { recursive: true }); await mkdir(publicRoot, { recursive: true });
await writeFile(new URL("stars.json", root), JSON.stringify(stars));
await writeFile(new URL("constellations.json", root), JSON.stringify(constellations));
await writeFile(new URL("deep-sky.json", root), JSON.stringify(deepSky));
await writeFile(new URL("D3-LICENSE.txt", publicRoot), license);
console.log({ stars: stars.length, constellations: constellations.length, deepSky: deepSky.length, example: deepSky[0] });
