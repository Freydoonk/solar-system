import test from "node:test";
import assert from "node:assert/strict";
import { createLocationLoader, LOCATION_ENDPOINT, parseApproximateLocation } from "../src/components/solar-system/location.ts";

const sample = { latitude: "51.5074", longitude: "-0.1278", city: "London", country: "United Kingdom", ip: "192.0.2.1" };

test("location parsing retains only coarse coordinates and a safe display label", () => {
  assert.deepEqual(parseApproximateLocation(sample), { latitude: 51.5, longitude: -0.1, label: "London, United Kingdom" });
  assert.deepEqual(parseApproximateLocation({ latitude: 0, longitude: 0 }),
    { latitude: 0, longitude: 0, label: "Approximate region" });
  for (const value of [null, [], {}, { latitude: null, longitude: 0 }, { latitude: "", longitude: " " },
    { latitude: true, longitude: 0 }, { latitude: "NaN", longitude: 0 }, { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 }, { latitude: 0, longitude: Infinity }]) {
    assert.equal(parseApproximateLocation(value), null);
  }
});

test("one IP lookup is shared across concurrent mounts and later callers", async () => {
  let calls = 0;
  const load = createLocationLoader(async (url, options) => {
    calls++;
    assert.equal(url, LOCATION_ENDPOINT);
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.referrerPolicy, "no-referrer");
    return new Response(JSON.stringify(sample));
  });
  const first = load();
  assert.equal(first, load());
  assert.deepEqual(await first, parseApproximateLocation(sample));
  await load();
  assert.equal(calls, 1);
});

test("network, HTTP and malformed responses fall back without retry loops", async () => {
  const responses: typeof fetch[] = [
    async () => { throw new Error("offline"); },
    async () => new Response("unavailable", { status: 503 }),
    async () => new Response("not json"),
    async () => new Response(JSON.stringify({ latitude: "unknown", longitude: 0 })),
  ];
  for (const fetcher of responses) {
    const load = createLocationLoader(fetcher);
    assert.equal(await load(), null);
    assert.equal(await load(), null);
  }
});

test("a slow lookup is aborted and resolves to the normal Earth view", async () => {
  let aborted = false;
  const load = createLocationLoader((_url, options) => new Promise((_resolve, reject) => {
    options!.signal!.addEventListener("abort", () => { aborted = true; reject(new Error("timeout")); });
  }), 10);
  assert.equal(await load(), null);
  assert.equal(aborted, true);
});
