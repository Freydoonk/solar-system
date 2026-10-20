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
        signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer",
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
