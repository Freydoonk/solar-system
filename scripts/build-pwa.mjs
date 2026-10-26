import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServiceWorker } from "./service-worker.mjs";

const directory = fileURLToPath(new URL("../dist/", import.meta.url));
async function filesUnder(folder, prefix = "") {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(folder, entry.name), relative + "/"));
    else if (relative !== "sw.js") files.push(relative);
  }
  return files.sort();
}
const files = await filesUnder(directory);
const hash = createHash("sha256");
for (const file of files) { hash.update(file); hash.update(await readFile(path.join(directory, file))); }
const version = hash.digest("hex").slice(0, 16);
await writeFile(path.join(directory, "sw.js"), createServiceWorker(files, version));
console.log("PWA: precaching " + files.length + " local files; version " + version);
