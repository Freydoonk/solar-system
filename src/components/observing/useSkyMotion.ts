import { useEffect, useRef, useState } from "react";
import { deviceQuaternion, type OrientationSample } from "./skyOrientation";

type Reading = { sample: OrientationSample; screenAngle: number; session: number };
type OrientationPermission = { requestPermission?: (absolute?: boolean) => Promise<string> };

export function useSkyMotion(active: boolean) {
  const [session, setSession] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState("Enable motion, then hold the screen toward you and move your phone to look around.");
  const request = useRef(0);
  useEffect(() => () => {
    request.current++; setEnabled(false); setReading(null);
    setStatus("Enable phone motion to track the sky, or drag to look around.");
  }, [active]);

  useEffect(() => {
    if (!enabled || !active) return;
    let absoluteSeen = false;
    let latest: Reading | null = null;
    let frame = 0;
    let lastUpdate = 0;
    const angle = () => window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
    const timeout = window.setTimeout(() => {
      if (!latest) { setStatus("No orientation data received. Use drag controls, or check motion permission in your browser and try again."); setEnabled(false); }
    }, 6000);
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(now => {
        frame = 0;
        if (now - lastUpdate < 32) { schedule(); return; }
        lastUpdate = now;
        if (latest) setReading({ ...latest, screenAngle: angle() });
      });
    };
    const receive = (event: DeviceOrientationEvent) => {
      const sample: OrientationSample = { alpha: event.alpha, beta: event.beta, gamma: event.gamma, absolute: event.absolute === true };
      if (!deviceQuaternion(sample, angle()) || (absoluteSeen && !sample.absolute)) return;
      absoluteSeen ||= sample.absolute;
      latest = { sample, screenAngle: angle(), session };
      window.clearTimeout(timeout); schedule();
    };
    const receiveAbsolute = (event: Event) => receive(event as DeviceOrientationEvent);
    window.addEventListener("deviceorientation", receive);
    window.addEventListener("deviceorientationabsolute", receiveAbsolute);
    window.screen.orientation?.addEventListener("change", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      window.clearTimeout(timeout); cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientation", receive);
      window.removeEventListener("deviceorientationabsolute", receiveAbsolute);
      window.screen.orientation?.removeEventListener("change", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [enabled, active, session]);

  async function start() {
    const pending = ++request.current;
    if (!window.isSecureContext) { setStatus("Motion needs HTTPS or localhost. Drag the sky here, or open the HTTPS app on your phone."); return; }
    if (typeof DeviceOrientationEvent === "undefined") { setStatus("This browser has no orientation sensor API. Drag the sky or use the arrow keys."); return; }
    setStatus("Waiting for motion permission and sensor data…");
    try {
      const permission = (DeviceOrientationEvent as unknown as OrientationPermission).requestPermission;
      // Call inside the user's click, before any other asynchronous work.
      if (permission && await permission.call(DeviceOrientationEvent, true) !== "granted") {
        if (request.current === pending) setStatus("Motion permission denied. Drag the sky or use the arrow keys; you can retry after changing browser permission.");
        return;
      }
      if (request.current !== pending) return;
      setReading(null); setSession(value => value + 1); setEnabled(true);
      setStatus("Waiting for orientation data. Move the phone gently.");
    } catch {
      if (request.current === pending) setStatus("Motion permission could not be requested. Drag controls remain available; try again from a supported browser.");
    }
  }
  function stop() { request.current++; setEnabled(false); setReading(null); setStatus("Drag the sky or use the arrow keys to look around."); }
  return { reading: enabled && active && reading?.session === session ? reading : null, enabled, status, start, stop, session };
}
