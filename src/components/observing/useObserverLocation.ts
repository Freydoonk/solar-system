import { useEffect, useRef, useState } from "react";
import { loadInitialLocation, readDeviceLocation } from "../solar-system/location";
import { validSite, type Site } from "./observing";
import { FLAT_HORIZON, type HorizonProfile } from "./horizon";

/** Shared only by Observe and Sky, in tab memory. Requests respect later choices. */
export function useObserverLocation(enabled: boolean) {
  const [site, setSite] = useState<Site | null>(null);
  const [mask, setMask] = useState<{ site: Site | null; profile: HorizonProfile } | null>(null);
  const [status, setStatus] = useState("Finding your location…");
  const [locating, setLocating] = useState(false);
  const choice = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    void loadInitialLocation().then(location => {
      if (!mounted || choice.current !== 0) return;
      if (location) setSite(current => current ?? location);
      setStatus(location?.source === "device" ? "Device location received. Coordinates stay in this tab."
        : location ? "IP estimate. Check the location before pointing." : "Approximate location unavailable. Use device location or enter coordinates.");
    });
    return () => { mounted = false; };
  }, [enabled]);

  function deviceLocation() {
    const request = ++choice.current;
    if (!navigator.geolocation) { setStatus("Device location is unavailable. Enter coordinates below."); return; }
    setLocating(true); setStatus("Waiting for device location permission…");
    void readDeviceLocation(navigator.geolocation).then(next => {
      if (!mounted.current || request !== choice.current) return;
      setSite(next); setStatus("Device location received. Coordinates stay in this tab.");
      setLocating(false);
    }, error => {
      if (!mounted.current || request !== choice.current) return;
      setLocating(false);
      setStatus(error.code === 1 ? "Location permission denied. Your current location choice is unchanged; manual entry is available."
        : error instanceof Error ? error.message : "Device location could not be obtained. Try again or enter coordinates.");
    });
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
