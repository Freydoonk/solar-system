import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createServiceWorker } from "../scripts/service-worker.mjs";

test("install manifest and PNG icons use relative paths and correct sizes", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    const data = await readFile(new URL("../public/" + icon.src, import.meta.url));
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    const [width, height] = icon.sizes.split("x").map(Number);
    assert.equal(data.readUInt32BE(16), width);
    assert.equal(data.readUInt32BE(20), height);
  }
});

test("service worker installs offline chunks and handles Pages navigation without caching location requests", async () => {
  const scope = "https://example.test/solar-system/";
  const listeners: Record<string, (event: Record<string, unknown>) => void> = {};
  const cached = new Map<string, string>();
  const deleted: string[] = [];
  let claimed = false;
  let skipped = false;
  const files = ["index.html", "assets/main.js", "assets/planner.js", "assets/worker.js", "textures/earth.jpg"];
  const cache = {
    async addAll(urls: string[]) { for (const url of urls) cached.set(url, "cached:" + url); },
    async match(url: string) { return cached.get(url); },
  };
  vm.runInNewContext(createServiceWorker(files, "testversion"), {
    URL,
    self: { registration: { scope }, clients: { async claim() { claimed = true; } },
      skipWaiting() { skipped = true; }, addEventListener(name: string, callback: typeof listeners[string]) { listeners[name] = callback; } },
    caches: { async open() { return cache; }, async keys() { return ["solar-system:/solar-system/:old", "another-app", "solar-system:/other/:old"]; },
      async delete(key: string) { deleted.push(key); } },
    fetch() { throw new Error("Offline network must not be needed for precached resources"); },
  });
  let pending: Promise<unknown> | undefined;
  listeners.install({ waitUntil(value: Promise<unknown>) { pending = value; } });
  await pending;
  assert.equal(cached.size, files.length);
  listeners.activate({ waitUntil(value: Promise<unknown>) { pending = value; } });
  await pending;
  assert.deepEqual(deleted, ["solar-system:/solar-system/:old"]);
  assert.equal(claimed, true);
  for (const [url, mode, expected] of [
    [scope, "navigate", scope + "index.html"],
    [scope + "?from=homescreen", "navigate", scope + "index.html"],
    [scope + "assets/worker.js", "cors", scope + "assets/worker.js"],
    [scope + "textures/earth.jpg", "cors", scope + "textures/earth.jpg"],
  ]) {
    let response: Promise<string> | undefined;
    listeners.fetch({ request: { url, mode, method: "GET" }, respondWith(value: Promise<string>) { response = value; } });
    assert.equal(await response, "cached:" + expected);
  }
  for (const url of ["https://get.geojs.io/v1/ip/geo.json", "https://example.test/other/index.html"]) {
    listeners.fetch({ request: { url, mode: "cors", method: "GET" }, respondWith() { assert.fail("Unrelated or location requests must not be cached"); } });
  }
  assert.equal(skipped, false, "updates wait for a reload or explicit action");
  listeners.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(skipped, true);
});
