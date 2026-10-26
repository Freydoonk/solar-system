import test from "node:test";
import assert from "node:assert/strict";
import { Body } from "astronomy-engine";
import { planTonight } from "../src/components/observing/tonight.ts";
import { skyPosition, type Site } from "../src/components/observing/observing.ts";

const site: Site = { latitude: 51.5, longitude: 0, elevation: 0, label: "Test", source: "manual" };
const start = Date.parse("2026-10-26T12:00Z");
test("night schedule stays within budget and every entire visit is dark and high", () => {
  for (const minutes of [30, 120]) {
    const plan = planTonight({ site, start, minutes, equipment: "eyes" });
    assert.ok(plan.stops.length > 0);
    assert.ok(plan.end - plan.start <= minutes * 60000);
    assert.ok(plan.start >= start && plan.end <= start + 86400000);
    assert.equal(new Set(plan.stops.map(stop => stop.body)).size, plan.stops.length);
    let previous = plan.start;
    for (const stop of plan.stops) {
      assert.ok(stop.start >= previous && stop.end <= plan.end);
      assert.ok(stop.body !== Body.Uranus && stop.body !== Body.Neptune);
      for (const time of [stop.start, (stop.start + stop.end) / 2, stop.end]) assert.ok(skyPosition(stop.body, site, time).suitable);
      previous = stop.end;
    }
  }
});
test("polar daytime and invalid inputs do not invent a schedule", () => {
  assert.equal(planTonight({ site: { ...site, latitude: 89 }, start: Date.parse("2026-06-10T12:00Z"), minutes: 30, equipment: "optics" }).stops.length, 0);
  assert.throws(() => planTonight({ site, start, minutes: NaN, equipment: "eyes" }));
});
