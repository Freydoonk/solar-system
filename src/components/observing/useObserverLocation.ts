import { useEffect, useRef, useState } from "react";
import { loadApproximateLocation } from "../solar-system/location";
import { validSite, type Site } from "./observing";
import { FLAT_HORIZON, type HorizonProfile } from "./horizon";

/** Shared only by Observe and Sky, in tab memory. Requests respect later choices. */
export function useObserverLocation(enabled: boolean) {
  const [site, setSite] = useState<Site | null>(null);
  const [mask, setMask] = useState<{ site: Site | null; profile: HorizonProfile } | null>(null);
  const [status, setStatus] = useState("Finding approximate location…");
  const [locating, setLocating] = useState(false);
  const choice = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    void loadApproximateLocation().then(location => {
      if (!mounted || choice.current !== 0) return;
      if (location) setSite(current => current ?? { ...location, elevation: 0, source: "approximate" });
      setStatus(location ? "IP estimate. Check the location before pointing." : "Approximate location unavailable. Use device location or enter coordinates.");
    });
    return () => { mounted = false; };
  }, [enabled]);

  function deviceLocation() {
    const request = ++choice.current;
    if (!navigator.geolocation) { setStatus("Device location is unavailable. Enter coordinates below."); return; }
    setLocating(true); setStatus("Waiting for device location permission…");
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== choice.current) return;
      const next: Site = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        elevation: position.coords.altitude ?? 0, label: "Device location", source: "device", accuracy: position.coords.accuracy };
      if (!validSite(next)) setStatus("Device returned invalid coordinates. Enter them manually.");
      else { setSite(next); setStatus("Device location received. Coordinates stay in this tab."); }
      setLocating(false);
    }, error => {
      if (request !== choice.current) return;
      setLocating(false);
      setStatus(error.code === 1 ? "Location permission denied. Your current location choice is unchanged; manual entry is available."
        : "Device location could not be obtained. Try again or enter coordinates.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function manualLocation(latitude: string, longitude: string, elevation: string) {
    const next: Site = { latitude: Number(latitude), longitude: Number(longitude), elevation: Number(elevation), source: "manual", label: "Custom observing site" };
    if (!latitude.trim() || !longitude.trim() || !elevation.trim() || !validSite(next)) {
      setStatus("Latitude must be −90…90, longitude −180…180, elevation −500…10,000 m."); return;
    }
    choice.current++; setLocating(false); setSite(next);
    setStatus("Manual location selected. Shared with Observe and Sky for this tab only.");
  }
  return { site, status, locating, deviceLocation, manualLocation,
    horizon: mask?.site === site ? mask.profile : FLAT_HORIZON,
    setHorizon: (profile: HorizonProfile) => setMask({ site, profile }) };
}
export type ObserverLocation = ReturnType<typeof useObserverLocation>;
