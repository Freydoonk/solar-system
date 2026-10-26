import { useState } from "react";
import { eventsCalendar, type EventKind, type SkyEvent } from "./events";
import { downloadText } from "./download";
import type { PlannerProps } from "./TonightPlanner";
import type { PlanningRequest } from "./planning.worker";
import { usePlanning } from "./usePlanning";
import styles from "./Observe.module.css";

export default function EventCalendar({ site, time, active, formatTime, choose }: PlannerProps) {
  const [days, setDays] = useState(90);
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const [request, setRequest] = useState<PlanningRequest | null>(null);
  const result = usePlanning<SkyEvent[]>(request, active);
  const matches = request?.kind === "events" && request.input.site === site && request.input.days === days;
  const events = matches ? result?.value?.filter(event => filter === "all" || event.kind === filter) : undefined;
  return <section className={styles.card} aria-label="Astronomical event calendar"><h2>Dates to look forward to</h2>
    <p className={styles.note}>Exact event times, calculated offline. Observing can be better before or after the exact instant. All dates use your selected timezone.</p>
    <div className={styles.fields}><label>Event range<select value={days} onChange={event => setDays(Number(event.target.value))}>{[30, 90, 365].map(value => <option key={value} value={value}>{value} days</option>)}</select></label>
      <label>Event type<select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">All events</option><option value="phase">Moon phases</option><option value="opposition">Oppositions</option><option value="elongation">Greatest elongations</option><option value="eclipse">Lunar eclipses</option></select></label></div>
    <div className={styles.actions}><button disabled={matches && !result} onClick={() => setRequest({ kind: "events", input: { start: time, days, site } })}>Find events</button>
      {matches && !result && <button onClick={() => setRequest(null)}>Cancel events</button>}
      {!!events?.length && <button onClick={() => downloadText(eventsCalendar(events, Date.now()), "solar-system-events.ics", "text/calendar;charset=utf-8")}>Export listed events (.ics)</button>}</div>
    <div aria-live="polite">{matches && request && <p className={styles.note}>From {formatTime(request.input.start)}. Recalculate after changing time or location.</p>}
      {matches && result?.error && <p role="alert">{result.error}</p>}{events?.length === 0 && <p>No events of this type in the selected range.</p>}
      {events && <ul className={styles.planList}>{events.map(event => <li key={event.id}><strong>{event.title}</strong><span>{formatTime(event.time)}</span><p>{event.description}</p>
        {event.begin !== undefined && event.end !== undefined && <small>Penumbral phase: {formatTime(event.begin)} — {formatTime(event.end)}</small>}
        <small>{event.local ? `At the exact instant: ${event.local.altitude.toFixed(1)}° altitude; Sun ${event.local.sunAltitude.toFixed(1)}°. ${event.local.suitable ? "Meets night-time geometry thresholds." : event.local.altitude < 0 ? "Target is below your horizon." : "Does not meet night-time planning thresholds."}` : "Set a location and recalculate for local altitude."}</small>
        <div className={styles.actions}><button onClick={() => choose(event.body, event.time)}>Load target &amp; time</button><button onClick={() => downloadText(eventsCalendar([event], Date.now()), "sky-event.ics", "text/calendar;charset=utf-8")}>Save event</button></div>
      </li>)}</ul>}
    </div><p className={styles.note}>Calendar files contain event times and descriptions, with no coordinates. Import them into your calendar app to set reminders. <a href="https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#topic-index" target="_blank" rel="noreferrer">Calculation reference</a>.</p>
  </section>;
}
