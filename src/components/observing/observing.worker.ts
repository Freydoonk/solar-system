import { searchOpportunities, type SearchRequest } from "./observing";

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  try { self.postMessage({ windows: searchOpportunities(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "The search could not finish." }); }
};
