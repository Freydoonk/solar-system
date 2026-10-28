export type ApproximateLocation = { latitude: number; longitude: number; label: string };

export const LOCATION_ENDPOINT = "https://get.geojs.io/v1/ip/geo.json";

function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? Math.round(number * 10) / 10 : null;
}

/** Retain only coarse coordinates and a display name, never the returned IP. */
export function parseApproximateLocation(value: unknown): ApproximateLocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const latitude = coordinate(data.latitude, 90);
  const longitude = coordinate(data.longitude, 180);
  if (latitude === null || longitude === null) return null;
  const label = [data.city, data.country]
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .map((part) => part.trim().slice(0, 80)).join(", ") || "Approximate region";
  return { latitude, longitude, label };
}

/** One bounded lookup per page load, also shared across React StrictMode mounts. */
export function createLocationLoader(fetcher: typeof fetch = fetch, timeoutMs = 4000) {
  let result: Promise<ApproximateLocation | null> | undefined;
  return () => result ??= (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(LOCATION_ENDPOINT, {
        signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
      });
      return response.ok ? parseApproximateLocation(await response.json()) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();
}

export const loadApproximateLocation = createLocationLoader();

export type InitialLocation = ApproximateLocation & {
  elevation: number;
  source: "device" | "approximate";
  accuracy?: number;
};

/** Device coordinates are used only in memory, never sent to the IP service. */
export function readDeviceLocation(geolocation: Pick<Geolocation, "getCurrentPosition">): Promise<InitialLocation> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(({ coords }) => {
      const elevation = coords.altitude ?? 0;
      if (!Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90
        || !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180
        || !Number.isFinite(elevation) || elevation < -500 || elevation > 10000
        || !Number.isFinite(coords.accuracy) || coords.accuracy < 0) {
        reject(new Error("Device returned invalid coordinates. Enter them manually."));
        return;
      }
      resolve({ latitude: coords.latitude, longitude: coords.longitude, elevation,
        accuracy: coords.accuracy, label: "Device location", source: "device" });
    }, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

type LocationEnvironment = {
  permissions?: Pick<Permissions, "query">;
  geolocation?: Pick<Geolocation, "getCurrentPosition">;
};

/** No permission prompt on startup. Browsers without permission queries use IP. */
export function createInitialLocationLoader(
  environment: () => LocationEnvironment = () => navigator,
  approximate = loadApproximateLocation,
  permissionTimeoutMs = 1000,
) {
  let result: Promise<InitialLocation | null> | undefined;
  return () => result ??= (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { permissions, geolocation } = environment();
      if (permissions && geolocation) {
        const permission = await Promise.race([
          permissions.query({ name: "geolocation" }),
          new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), permissionTimeoutMs); }),
        ]);
        if (permission?.state === "granted") return await readDeviceLocation(geolocation);
      }
    } catch {
      // Denial, unavailable sensors or unsupported queries all retain the IP fallback.
    } finally {
      clearTimeout(timer);
    }
    const location = await approximate();
    return location ? { ...location, elevation: 0, source: "approximate" as const } : null;
  })();
}

export const loadInitialLocation = createInitialLocationLoader();
