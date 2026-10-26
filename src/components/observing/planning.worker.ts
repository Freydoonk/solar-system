import { planTonight, type TonightRequest } from "./tonight";

export type PlanningRequest = { kind: "tonight"; input: TonightRequest };
self.onmessage = (event: MessageEvent<PlanningRequest>) => {
  try { self.postMessage({ value: planTonight(event.data.input) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Calculation unavailable." }); }
};
