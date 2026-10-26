import { useState } from "react";
import { Body } from "astronomy-engine";
import type { PlannerProps } from "./TonightPlanner";
import type { PlanningRequest } from "./planning.worker";
import type { NightSample } from "./nightChart";
import { usePlanning } from "./usePlanning";
import { skyPosition, TARGETS, type Target } from "./observing";
import styles from "./Observe.module.css";

const colors = ["#f1efda", "#e9ad7d", "#f9d35d", "#f78888", "#e8adff", "#83e5bc", "#8dd8fa", "#9cafff"];
export default function NightChartPanel({ site, time, active, horizon, formatTime, choose, openPreview, body }: PlannerProps & { body: Target }) {
  const [request, setRequest] = useState<PlanningRequest | null>(null);
  const [visible, setVisible] = useState<Target[]>([Body.Moon, Body.Mars, Body.Jupiter, Body.Saturn]);
  const result = usePlanning<NightSample[]>(request, active);
  const matches = request?.kind === "chart" && request.input.site === site;
  const samples = matches ? result?.value : undefined;
  const start = samples?.[0].time ?? time;
  const end = samples?.at(-1)?.time ?? time + 86400000;
  const fraction = Math.max(0, Math.min(1, (time - start) / (end - start)));
  const y = (altitude: number) => 230 - (altitude + 30) / 120 * 210;
  const x = (value: number) => 45 + value * 600;
  function point(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const unitX = (event.clientX - bounds.left) / bounds.width * 680;
    choose(body, Math.round(start + Math.max(0, Math.min(1, (unitX - 45) / 600)) * (end - start)));
  }
  return <section className={styles.card} aria-label="Night altitude chart"><h2>Your sky through the night</h2>
    <p className={styles.note}>Compare geometric altitude over the next 24 hours. Tap or drag the plot, or use the time slider, to update the observing time and eyepiece.</p>
    <div className={styles.actions}><button disabled={!site || (matches && !result)} onClick={() => site && setRequest({ kind: "chart", input: { site, start: time } })}>Plot from selected time</button>
      {matches && !result && <button onClick={() => setRequest(null)}>Cancel chart</button>}</div>
    {!site && <p>Choose your location first.</p>}
    {matches && result?.error && <p role="alert">{result.error}</p>}
    {samples && <>
      <p className={styles.note}>{formatTime(start)} to {formatTime(end)}</p>
      <div className={styles.legend} aria-label="Compare targets">{TARGETS.map((target, index) => <button key={target} aria-pressed={visible.includes(target)} onClick={() => setVisible(current => current.includes(target) ? current.filter(item => item !== target) : [...current, target])}>
        <span style={{ color: colors[index] }}>●</span> {target}</button>)}</div>
      <svg className={styles.chart} viewBox="0 0 680 270" role="img" aria-label="Altitude versus time. Pale background is daylight or civil twilight; dark is night. Dashed Moon line. Use the slider below for keyboard access."
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); point(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) point(event); }}>
        <defs><clipPath id="night-plot-clip"><rect x="45" y="20" width="600" height="210" /></clipPath></defs>
        {samples.slice(0, -1).map((sample, index) => <rect key={sample.time} x={x(index / 96)} y="20" width={600 / 96 + 0.2} height="210" fill={sample.sun > -6 ? "#38475a" : sample.sun > -18 ? "#1b2940" : "#060d18"} />)}
        {[-30, 0, 20, 60, 90].map(value => <g key={value}><line x1="45" x2="645" y1={y(value)} y2={y(value)} stroke="#75869a" strokeDasharray={value === 20 ? "4 4" : undefined} opacity="0.5" /><text x="4" y={y(value) + 4}>{value}°</text></g>)}
        <g clipPath="url(#night-plot-clip)">{visible.map(target => <polyline key={target} fill="none" stroke={colors[TARGETS.indexOf(target)]} strokeWidth="2.5" strokeDasharray={target === Body.Moon ? "7 5" : undefined}
          points={samples.map((sample, index) => `${x(index / 96)},${y(sample.altitudes[target])}`).join(" ")} />)}</g>
        {[0, 6, 12, 18, 24].map(hour => <text key={hour} x={x(hour / 24)} y="253" textAnchor="middle">+{Math.round(hour / 24 * (end - start) / 3600000)}h</text>)}
        <line x1={x(fraction)} x2={x(fraction)} y1="20" y2="230" stroke="white" strokeWidth="2" />
      </svg>
      <p className={styles.note}>Light: Sun above −6° · blue: twilight · dark: Sun below −18°. Dashed horizontal line: 20° planning threshold. Curves sampled about every 15 minutes.</p>
      <label>Chart time<input type="range" min={start} max={end} step={60000} value={Math.max(start, Math.min(end, time))} aria-valuetext={formatTime(Math.max(start, Math.min(end, time)))} onChange={event => choose(body, Number(event.target.value))} /></label>
      <p>{formatTime(time)}{time < start || time > end ? " · outside this plot; rebuild or move the slider" : ""}</p>
      <div className={styles.targetList}>{site && visible.map(target => { const position = skyPosition(target, site, time, horizon); return <button key={target} aria-pressed={target === body} onClick={() => choose(target, time)}><span>{target}</span><small>{position.geometricAltitude.toFixed(1)}° high · {position.direction} {position.azimuth.toFixed(1)}°{position.obstructed ? " · obstructed" : ""}</small></button>; })}</div>
      {openPreview && <div className={styles.actions}><button onClick={() => openPreview(body, time)}>Open {body} in the eyepiece</button></div>}
    </>}
  </section>;
}
