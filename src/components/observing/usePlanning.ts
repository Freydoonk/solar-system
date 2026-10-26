import { useEffect, useState } from "react";
import type { PlanningRequest } from "./planning.worker";

/** Identity binds a reply to its inputs; cleanup cancels stale and hidden work. */
export function usePlanning<T>(request: PlanningRequest | null, active: boolean) {
  const [result, setResult] = useState<{ request: PlanningRequest; value?: T; error?: string } | null>(null);
  useEffect(() => {
    if (!request || !active) return;
    let disposed = false;
    const worker = new Worker(new URL("./planning.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ value?: T; error?: string }>) => {
      if (!disposed) setResult({ request, ...event.data });
      worker.terminate();
    };
    worker.onerror = () => {
      if (!disposed) setResult({ request, error: "Calculation unavailable. Try again." });
      worker.terminate();
    };
    worker.postMessage(request);
    return () => { disposed = true; worker.terminate(); };
  }, [request, active]);
  return result?.request === request ? result : null;
}
