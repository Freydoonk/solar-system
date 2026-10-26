import { calculateOptics, EQUIPMENT_FIELDS, type Equipment } from "./eyepiece.ts";
import { MAX_TIME, MIN_TIME } from "../solar-system/astronomy.ts";
export const NOTEBOOK_KEY = "solar-system:notebook:v1";
export type SavedEquipment = { id: string; name: string; equipment: Equipment };
export type ObservationEntry = { id: string; target: string; time: number; notes: string; rating: number; outcome: "planned" | "seen" | "not-seen"; equipmentName: string };
export type Notebook = { version: 1; entries: ObservationEntry[]; equipment: SavedEquipment[]; targets: string[] };
export const emptyNotebook = (): Notebook => ({ version: 1, entries: [], equipment: [], targets: [] });
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid notebook object.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, empty = false) {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) throw new Error("Invalid or oversized notebook text.");
  return value;
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("Notebook is missing a list or exceeds its size limit.");
  return value;
}
function unique<T extends { id: string }>(values: T[]) {
  if (new Set(values.map(value => value.id)).size !== values.length) throw new Error("Duplicate notebook identifiers.");
  return values;
}
/** Whitelist every field; automatic location/unknown metadata never survives import or export. */
export function validateNotebook(value: unknown): Notebook {
  const root = record(value);
  if (root.version !== 1) throw new Error("Unsupported notebook version.");
  const equipment = unique(array(root.equipment, 100).map(value => {
    const item = record(value); const raw = record(item.equipment);
    const equipment = Object.fromEntries(EQUIPMENT_FIELDS.map(({ key }) => [key, text(raw[key], 30)])) as Equipment;
    if (!calculateOptics(equipment)) throw new Error("Invalid saved equipment specifications.");
    return { id: text(item.id, 100), name: text(item.name, 100), equipment };
  }));
  const entries = unique(array(root.entries, 1000).map(value => {
    const item = record(value);
    if (typeof item.time !== "number" || !Number.isFinite(item.time) || item.time < MIN_TIME || item.time > MAX_TIME) throw new Error("Invalid observation time.");
    if (typeof item.rating !== "number" || !Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5) throw new Error("Rating must be 1–5.");
    if (!["planned", "seen", "not-seen"].includes(String(item.outcome))) throw new Error("Invalid observation outcome.");
    return { id: text(item.id, 100), target: text(item.target, 100), time: item.time, rating: item.rating, outcome: item.outcome as ObservationEntry["outcome"], notes: text(item.notes, 5000, true), equipmentName: text(item.equipmentName, 100, true) };
  }));
  const targets = [...new Set(array(root.targets, 100).map(value => text(value, 100)))];
  return { version: 1, entries, equipment, targets };
}
export function parseNotebook(json: string): Notebook {
  if (json.length > 2_000_000) throw new Error("Notebook file exceeds 2 MB.");
  return validateNotebook(JSON.parse(json));
}
export function mergeNotebooks(current: Notebook, imported: Notebook): Notebook {
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [...a, ...b.filter(item => !a.some(existing => existing.id === item.id))];
  return validateNotebook({ version: 1, entries: merge(current.entries, imported.entries), equipment: merge(current.equipment, imported.equipment), targets: [...new Set([...current.targets, ...imported.targets])] });
}
