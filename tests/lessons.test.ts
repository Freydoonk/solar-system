import test from "node:test";
import assert from "node:assert/strict";
import { lessonGeometry, lessonTime, lessonTrack, LESSONS } from "../src/components/learning/lessons.ts";
test("Mars lesson shows perspective reversal without changing orbital direction", () => {
  assert.ok(lessonGeometry("retrograde", lessonTime("2024-11-10")).motion > 0);
  assert.ok(lessonGeometry("retrograde", lessonTime("2025-01-16")).motion < 0);
  assert.ok(lessonGeometry("retrograde", lessonTime("2025-03-20")).motion > 0);
  assert.equal(lessonTrack("retrograde").length, 101);
});
test("Venus grows nearer and more crescent-shaped, and eclipse alignment differs from ordinary full Moon", () => {
  const early = lessonGeometry("venus", lessonTime("2024-10-15"));
  const late = lessonGeometry("venus", lessonTime("2025-03-10"));
  assert.ok(early.illumination > late.illumination && early.distanceAU > late.distanceAU);
  const january = lessonGeometry("eclipses", lessonTime(LESSONS.eclipses.steps[0].date));
  const march = lessonGeometry("eclipses", lessonTime(LESSONS.eclipses.steps[2].date));
  assert.ok(january.illumination > 0.99 && march.illumination > 0.99);
  assert.ok(january.shadowOffset > 1 && march.shadowOffset < 0.5);
  assert.throws(() => lessonGeometry("venus", NaN));
});
