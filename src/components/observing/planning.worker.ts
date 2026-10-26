import { planTonight, type TonightRequest } from "./tonight";
import { sampleNight } from "./nightChart";
import type { Site } from "./observing";

export type PlanningRequest = { kind: "tonight"; input: TonightRequest } | { kind: "chart"; input: { site: Site; start: number } };
self.onmessage = (event: MessageEvent<PlanningRequest>) => {
  try { self.postMessage({ value: event.data.kind === "tonight" ? planTonight(event.data.input) : sampleNight(event.data.input) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Calculation unavailable." }); }
};
