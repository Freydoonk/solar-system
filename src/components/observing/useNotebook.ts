import { useState } from "react";
import { emptyNotebook, NOTEBOOK_KEY, parseNotebook, validateNotebook, type Notebook } from "./notebook";
function load() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    return { data: raw ? parseNotebook(raw) : emptyNotebook(), status: raw ? "Loaded this device's notebook." : "Saved only when you choose Save. No coordinates are collected." };
  } catch { return { data: emptyNotebook(), status: "Saved notebook could not be read. Your stored copy has not been changed. Export new notes before clearing browser storage." }; }
}
export function useNotebook() {
  const [state, setState] = useState(load);
  const [previous, setPrevious] = useState<Notebook | null>(null);
  function change(next: Notebook) {
    try {
      const data = validateNotebook(next);
      setPrevious(state.data);
      try { localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(data)); setState({ data, status: "Saved on this device. Export a backup to keep your records safe." }); }
      catch { setState({ data, status: "Device storage is unavailable or full. Changes are in this tab only; export a backup now." }); }
      return true;
    } catch (error) { setState({ ...state, status: error instanceof Error ? error.message : "Could not save notebook." }); return false; }
  }
  return { ...state, change, canUndo: !!previous, undo: () => { if (previous) { const copy = previous; if (change(copy)) setPrevious(null); } } };
}
export type NotebookStore = ReturnType<typeof useNotebook>;
