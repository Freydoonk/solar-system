import { t } from "../../i18n/messages";
import { useState } from "react";
import { eventsCalendar, type EventKind, type SkyEvent } from "./events";
import { downloadText } from "./download";
import type { PlannerProps } from "./TonightPlanner";
import type { PlanningRequest } from "./planning.worker";
import { usePlanning } from "./usePlanning";
import styles from "./Observe.module.css";

export default function EventCalendar({ site, time, active, horizon, formatTime, choose, openPreview }: PlannerProps) {
  const [days, setDays] = useState(90);
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const [request, setRequest] = useState<PlanningRequest | null>(null);
  const result = usePlanning<SkyEvent[]>(request, active);
  const matches = request?.kind === "events" && request.input.site === site && request.input.days === days && request.input.horizon === horizon;
  const events = matches ? result?.value?.filter(event => filter === "all" || event.kind === filter) : undefined;
  return <section className={styles.card} aria-label={t("Astronomical event calendar")}><h2>{t("Dates to look forward to")}</h2>
    <p className={styles.note}>{t("Exact event times, calculated offline. Observing can be better before or after the exact instant. All dates use your selected timezone.")}</p>
    <div className={styles.fields}><label>{t("Event range")}<select value={days} onChange={event => setDays(Number(event.target.value))}>{[30, 90, 365].map(value => <option key={value} value={value}>{t("{value1} days", { value1: value })}</option>)}</select></label>
      <label>{t("Event type")}<select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">{t("All events")}</option><option value="phase">{t("Moon phases")}</option><option value="opposition">{t("Oppositions")}</option><option value="elongation">{t("Greatest elongations")}</option><option value="eclipse">{t("Lunar eclipses")}</option></select></label></div>
    <div className={styles.actions}><button disabled={matches && !result} onClick={() => setRequest({ kind: "events", input: { start: time, days, site, horizon } })}>{t("Find events")}</button>
      {matches && !result && <button onClick={() => setRequest(null)}>{t("Cancel events")}</button>}
      {!!events?.length && <button onClick={() => downloadText(eventsCalendar(events, Date.now(), t), "solar-system-events.ics", "text/calendar;charset=utf-8")}>{t("Export listed events (.ics)")}</button>}</div>
    <div aria-live="polite">{matches && request && <p className={styles.note}>{t("From {value1}. Recalculate after changing time or location.", { value1: formatTime(request.input.start) })}</p>}
      {matches && result?.error && <p role="alert">{t(result.error)}</p>}{events?.length === 0 && <p>{t("No events of this type in the selected range.")}</p>}
      {events && <ul className={styles.planList}>{events.map(event => <li key={event.id}><strong>{t(event.title)}</strong><span>{formatTime(event.time)}</span><p>{t(event.descriptionKey ?? event.description, event.descriptionValues)}</p>
        {event.begin !== undefined && event.end !== undefined && <small>{t("Penumbral phase: {value1} to {value2}", { value1: formatTime(event.begin), value2: formatTime(event.end) })}</small>}
        <small>{event.local ? t("At the exact instant: {value1}° altitude; Sun {value2}°. {value3}", { value1: event.local.altitude.toFixed(1), value2: event.local.sunAltitude.toFixed(1), value3: event.local.suitable ? t("Meets night-time geometry thresholds.") : event.local.altitude < 0 ? t("Target is below your horizon.") : t("Does not meet night-time planning thresholds.") }) : t("Set a location and recalculate for local altitude.")}</small>
        <div className={styles.actions}><button onClick={() => (openPreview ?? choose)(event.body, event.time)}>{t("Open target preview")}</button><button onClick={() => downloadText(eventsCalendar([event], Date.now(), t), "sky-event.ics", "text/calendar;charset=utf-8")}>{t("Save event")}</button></div>
      </li>)}</ul>}
    </div><p className={styles.note}>{t("Calendar files contain event times and descriptions, with no coordinates. Import them into your calendar app to set reminders. ")}<a href="https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#topic-index" target="_blank" rel="noreferrer">{t("Calculation reference")}</a>.</p>
  </section>;
}
