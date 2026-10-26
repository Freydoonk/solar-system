import test from "node:test";
import assert from "node:assert/strict";
import { emptyNotebook, mergeNotebooks, parseNotebook, validateNotebook } from "../src/components/observing/notebook.ts";
import { EXAMPLE_EQUIPMENT } from "../src/components/observing/eyepiece.ts";
const entry = { id: "one", target: "M31", time: Date.parse("2026-10-26Z"), notes: "A faint glow. ماه", outcome: "seen" as const, rating: 4, equipmentName: "Binoculars" };
test("notebook round trips notes and optics while whitelisting out location metadata", () => {
  const value = { ...emptyNotebook(), entries: [{ ...entry, site: { latitude: 51.5 } }], equipment: [{ id: "scope", name: "Test", equipment: EXAMPLE_EQUIPMENT }], targets: ["M31"], site: { longitude: 0 } };
  const clean = validateNotebook(value);
  assert.equal(clean.entries[0].notes, entry.notes);
  assert.ok(!JSON.stringify(clean).includes("latitude") && !JSON.stringify(clean).includes("site"));
  assert.deepEqual(parseNotebook(JSON.stringify(clean)), clean);
  assert.deepEqual(mergeNotebooks(clean, clean), clean);
  assert.equal(mergeNotebooks(clean, { ...emptyNotebook(), entries: [{ ...entry, id: "two" }] }).entries.length, 2);
});
test("invalid imports cannot inject invalid optics, dates, duplicates or unbounded content", () => {
  for (const value of [null, { version: 2 }, { ...emptyNotebook(), entries: [{ ...entry, time: NaN }] }, { ...emptyNotebook(), entries: [entry, entry] },
    { ...emptyNotebook(), entries: [{ ...entry, notes: "x".repeat(5001) }] }, { ...emptyNotebook(), equipment: [{ id: "x", name: "x", equipment: { ...EXAMPLE_EQUIPMENT, focal: "Infinity" } }] }]) assert.throws(() => validateNotebook(value));
  assert.throws(() => parseNotebook("not json"));
  assert.throws(() => parseNotebook(" ".repeat(2_000_001)));
});
