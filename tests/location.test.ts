import test from "node:test";
import assert from "node:assert/strict";
import { createInitialLocationLoader, createLocationLoader, LOCATION_ENDPOINT, parseApproximateLocation, readDeviceLocation } from "../src/components/solar-system/location.ts";

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
    assert.equal(options?.cache, "no-store");
    return new Response(JSON.stringify(sample));
  });
  const first = load();
  assert.equal(first, load());
  assert.deepEqual(await first, parseApproximateLocation(sample));
  await load();
  assert.equal(calls, 1);
});

const precisePosition = { coords: { latitude: 51.50741234, longitude: -0.12781234, altitude: 30, accuracy: 4 } } as GeolocationPosition;
const environment = (state: PermissionState, getCurrentPosition: Geolocation["getCurrentPosition"]) => ({
  permissions: { query: async (descriptor: PermissionDescriptor) => {
    assert.equal(descriptor.name, "geolocation");
    return { state } as PermissionStatus;
  } },
  geolocation: { getCurrentPosition },
});

test("previously granted permission automatically requests precise location once without an IP lookup", async () => {
  let deviceCalls = 0, ipCalls = 0;
  const load = createInitialLocationLoader(() => environment("granted", (success, _failure, options) => {
    deviceCalls++;
    assert.equal(options?.enableHighAccuracy, true);
    assert.equal(options?.timeout, 15000);
    success(precisePosition);
  }), async () => { ipCalls++; return parseApproximateLocation(sample); });
  const pending = load();
  assert.equal(load(), pending);
  assert.deepEqual(await pending, { latitude: 51.50741234, longitude: -0.12781234, elevation: 30, accuracy: 4, source: "device", label: "Device location" });
  await load();
  assert.equal(deviceCalls, 1); assert.equal(ipCalls, 0);
});

test("prompt, denied and unsupported permissions never trigger a fresh startup geolocation prompt", async () => {
  const unexpected = () => assert.fail("must not request device location");
  const environments = [environment("prompt", unexpected), environment("denied", unexpected), {},
    { geolocation: { getCurrentPosition: unexpected } },
    { ...environment("granted", unexpected), permissions: { query: async () => { throw new Error("unsupported"); } } }];
  for (const value of environments) {
    let ipCalls = 0;
    const load = createInitialLocationLoader(() => value, async () => { ipCalls++; return parseApproximateLocation(sample); });
    assert.equal((await load())?.source, "approximate");
    await load(); assert.equal(ipCalls, 1);
  }
});

test("device failure, invalid coordinates and revoked permission fall back to coarse location", async () => {
  for (const get of [
    (_success: PositionCallback, failure?: PositionErrorCallback | null) => failure?.({ code: 1 } as GeolocationPositionError),
    (_success: PositionCallback, failure?: PositionErrorCallback | null) => failure?.({ code: 3 } as GeolocationPositionError),
    (success: PositionCallback) => success({ coords: { ...precisePosition.coords, latitude: NaN } } as GeolocationPosition),
  ]) {
    const load = createInitialLocationLoader(() => environment("granted", get), async () => parseApproximateLocation(sample));
    assert.equal((await load())?.source, "approximate");
  }
  const offline = createInitialLocationLoader(() => ({}), async () => null);
  assert.equal(await offline(), null);
});

test("a slow permission query falls back and a late granted result never requests GPS", async () => {
  let finish!: (value: PermissionStatus) => void;
  const load = createInitialLocationLoader(() => ({
    permissions: { query: () => new Promise(resolve => { finish = resolve; }) },
    geolocation: { getCurrentPosition: () => assert.fail("late permission must not request GPS") },
  }), async () => parseApproximateLocation(sample), 5);
  assert.equal((await load())?.source, "approximate");
  finish({ state: "granted" } as PermissionStatus);
  await Promise.resolve();
  assert.equal((await load())?.source, "approximate");
});

test("device location validates ranges and retains full coordinate precision", async () => {
  for (const invalid of [{ longitude: 181 }, { latitude: 91 }, { altitude: 10001 }, { accuracy: -1 }, { accuracy: Infinity }]) {
    await assert.rejects(readDeviceLocation({ getCurrentPosition: success => success({ coords: { ...precisePosition.coords, ...invalid } } as GeolocationPosition) }));
  }
  const location = await readDeviceLocation({ getCurrentPosition: success => success({ coords: { ...precisePosition.coords, altitude: null } } as GeolocationPosition) });
  assert.equal(location.elevation, 0); assert.equal(location.latitude, precisePosition.coords.latitude);
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
