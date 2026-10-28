import { t } from "../../i18n/messages";
import { useState } from "react";
import { downloadText } from "./download";
import { mergeNotebooks, parseNotebook, validateNotebook, type ObservationEntry } from "./notebook";
import type { NotebookStore } from "./useNotebook";
import { TARGETS, type Target } from "./observing";
import type { PlannerProps } from "./TonightPlanner";
import styles from "./Observe.module.css";

export default function NotebookPanel({ body, time, formatTime, choose, notebook }: PlannerProps & { body: Target; notebook: NotebookStore }) {
  const [target, setTarget] = useState<string>(body); const [notes, setNotes] = useState(""); const [rating, setRating] = useState(3);
  const [outcome, setOutcome] = useState<ObservationEntry["outcome"]>("seen"); const [equipmentName, setEquipmentName] = useState("");
  const [entryTime, setEntryTime] = useState(time); const [editing, setEditing] = useState<string | null>(null); const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  function useCurrent() { setTarget(body); setEntryTime(time); setEditing(null); setNotes(""); }
  return <section className={styles.card} aria-label={t("Observing notebook")}><h2>{t("Your observing notebook")}</h2>
    <p className={styles.note}>{t("Notes, target lists and saved equipment stay in this browser. Location is never added automatically. Export backups; clearing browser data removes saved records.")}</p>
    <p className={styles.note} role="status">{t(notebook.status)}</p>
    <div className={styles.actions}><button onClick={() => downloadText(JSON.stringify(validateNotebook(notebook.data), null, 2), "solar-system-notebook.json", "application/json")}>{t("Export notebook")}</button>
      <button disabled={!notebook.canUndo} onClick={notebook.undo}>{t("Undo last change")}</button></div>
    <label>{t("Import & merge notebook (.json)")}<input type="file" accept=".json,application/json" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      try { if (file.size > 2_000_000) throw new Error("Choose a notebook smaller than 2 MB.");
        const imported = parseNotebook(await file.text());
        if (notebook.change(mergeNotebooks(notebook.data, imported))) setMessage("Imported and merged. Existing IDs were kept; Undo reverses the merge.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import this file."); }
    }} /></label>
    {message && <p role="status">{t(message)}</p>}
    <form onSubmit={event => {
      event.preventDefault();
      const entry: ObservationEntry = { id: editing ?? crypto.randomUUID(), target: target.trim(), time: entryTime, notes, rating, outcome, equipmentName };
      const entries = editing ? notebook.data.entries.map(item => item.id === editing ? entry : item) : [...notebook.data.entries, entry];
      if (notebook.change({ ...notebook.data, entries })) { setEditing(null); setNotes(""); setMessage("Entry saved. Device-storage status is shown above."); }
    }}>
      <h3>{editing ? t("Edit observation") : t("Record an observation")}</h3>
      <button type="button" onClick={useCurrent}>{t("Use current target & time")}</button><p className={styles.note}>{t("Entry time: {value1}. Change the planner clock, then use the button above to copy it.", { value1: formatTime(entryTime) })}</p>
      <label>{t("Observed target")}<input value={target} required maxLength={100} onChange={event => setTarget(event.target.value)} placeholder={t("Saturn, M31, Sirius…")} /></label>
      <div className={styles.fields}><label>{t("Outcome")}<select value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}><option value="seen">{t("Seen")}</option><option value="not-seen">{t("Not seen")}</option><option value="planned">{t("Planned")}</option></select></label>
        <label>{t("Experience rating")}<select value={rating} onChange={event => setRating(Number(event.target.value))}>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <label>{t("Equipment used")}<select value={equipmentName} onChange={event => setEquipmentName(event.target.value)}><option value="">{t("Unaided / not recorded")}</option>{equipmentName && !notebook.data.equipment.some(item => item.name === equipmentName) && <option>{equipmentName}</option>}{notebook.data.equipment.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
      <label>{t("What did you see?")}<textarea rows={4} maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} placeholder={t("Detail, sky conditions, what to try next time…")} /></label>
      <div className={styles.actions}><button type="submit">{editing ? t("Save edited entry") : t("Save entry on this device")}</button><button type="button" disabled={!target.trim()} onClick={() => notebook.change({ ...notebook.data, targets: [...new Set([...notebook.data.targets, target.trim()])] })}>{t("Add to target list")}</button>{editing && <button type="button" onClick={useCurrent}>{t("Cancel edit")}</button>}</div>
    </form>
    <details><summary>{t("My target list ({value1})", { value1: notebook.data.targets.length })}</summary><ul className={styles.planList}>{notebook.data.targets.map(name => <li key={name}><strong>{name}</strong><div className={styles.actions}><button onClick={() => { setTarget(name); setEntryTime(time); setEditing(null); setNotes(""); }}>{t("Log target")}</button>{TARGETS.includes(name as Target) && <button onClick={() => choose(name as Target, time)}>{t("Select in Observe")}</button>}<button onClick={() => notebook.change({ ...notebook.data, targets: notebook.data.targets.filter(item => item !== name) })}>{t("Remove target")}</button></div></li>)}</ul></details>
    <details><summary>{t("My equipment ({value1})", { value1: notebook.data.equipment.length })}</summary><p className={styles.note}>{t("Save and load setups under What will I see? Saved setups include your eyepiece and Barlow settings.")}</p><ul className={styles.planList}>{notebook.data.equipment.map(item => <li key={item.id}><strong>{item.name}</strong><small>{t("{value1} mm aperture · {value2} mm focal length · {value3} mm eyepiece", { value1: t(item.equipment.aperture), value2: t(item.equipment.focal), value3: t(item.equipment.eyepiece) })}</small><button onClick={() => notebook.change({ ...notebook.data, equipment: notebook.data.equipment.filter(value => value.id !== item.id) })}>{t("Remove equipment")}</button></li>)}</ul></details>
    <h3>{t("Past entries ({value1})", { value1: notebook.data.entries.length })}</h3><label>{t("Filter entries")}<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
    <ul className={styles.planList}>{[...notebook.data.entries].filter(entry => `${entry.target} ${entry.notes}`.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => b.time - a.time).map(entry => <li key={entry.id}><strong>{entry.target} · {t(entry.outcome)} · {entry.rating}/5</strong><span>{formatTime(entry.time)}{entry.equipmentName ? t(" · {value1}", { value1: entry.equipmentName }) : ""}</span><p className={styles.entryNotes}>{entry.notes}</p><div className={styles.actions}>
      <button onClick={() => { setEditing(entry.id); setTarget(entry.target); setEntryTime(entry.time); setNotes(entry.notes); setRating(entry.rating); setOutcome(entry.outcome); setEquipmentName(entry.equipmentName); }}>{t("Edit entry")}</button><button onClick={() => notebook.change({ ...notebook.data, entries: notebook.data.entries.filter(item => item.id !== entry.id) })}>{t("Remove entry")}</button></div></li>)}</ul>
  </section>;
}
