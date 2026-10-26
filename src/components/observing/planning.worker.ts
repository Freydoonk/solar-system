import { planTonight, type TonightRequest } from "./tonight";
import { sampleNight } from "./nightChart";
import type { Site } from "./observing";
import { findSkyEvents, type EventsRequest } from "./events";

export type PlanningRequest = { kind: "tonight"; input: TonightRequest } | { kind: "chart"; input: { site: Site; start: number } } | { kind: "events"; input: EventsRequest };
self.onmessage = (event: MessageEvent<PlanningRequest>) => {
  try {
    const request = event.data;
    const value = request.kind === "tonight" ? planTonight(request.input) : request.kind === "chart" ? sampleNight(request.input) : findSkyEvents(request.input);
    self.postMessage({ value });
  }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Calculation unavailable." }); }
};
