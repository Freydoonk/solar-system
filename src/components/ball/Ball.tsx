import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./Ball.module.css";

type Vec2 = { x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Ball radius in px
  const R = 30;

  // Only for rendering
  const [pos, setPos] = useState<Vec2>({ x: 120, y: 120 });
  const posRef = useRef<Vec2>(pos);

  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  // Physics refs (don’t put these in state; you’ll get stutter)
  const velRef = useRef<Vec2>({ x: 0, y: 0 });
  const animatingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);

  // Drag refs
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Vec2>({ x: 0, y: 0 });

  // Track drag velocity (based on recent movement)
  const lastDragSampleRef = useRef<{ t: number; p: Vec2 } | null>(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setStageSize({ w: rect.width, h: rect.height });

      // keep ball inside after resize
      const p = posRef.current;
      const clamped = {
        x: clamp(p.x, R, rect.width - R),
        y: clamp(p.y, R, rect.height - R),
      };
      posRef.current = clamped;
      setPos(clamped);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start/stop RAF loop
  function startPhysics() {
    if (animatingRef.current) return;
    animatingRef.current = true;
    lastTRef.current = null;

    const tick = (t: number) => {
      if (!animatingRef.current) return;

      const last = lastTRef.current;
      lastTRef.current = t;

      // dt in seconds, clamp to avoid huge jumps if tab was inactive
      const dt = last ? clamp((t - last) / 1000, 0, 0.033) : 1 / 60;

      step(dt);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  function stopPhysics() {
    animatingRef.current = false;
    lastTRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  // Physics constants (tweakable)
  const GRAVITY = 2200; // px/s^2
  const RESTITUTION = 0.55; // bounce energy on vertical impacts
  const WALL_RESTITUTION = 0.6;
  const AIR_DAMPING = 0.998; // per step-ish
  const FLOOR_FRICTION = 0.86; // horizontal damping on floor contacts
  const STOP_EPS = 12; // px/s threshold to consider stopped

  function step(dt: number) {
    // If user is dragging, physics must not run
    if (draggingRef.current) return;

    let p = posRef.current;
    let v = velRef.current;

    // gravity
    v = { x: v.x, y: v.y + GRAVITY * dt };

    // integrate
    p = { x: p.x + v.x * dt, y: p.y + v.y * dt };

    const minX = R;
    const maxX = stageSize.w - R;
    const minY = R;
    const maxY = stageSize.h - R;

    // collide left/right
    if (p.x < minX) {
      p.x = minX;
      v.x = -v.x * WALL_RESTITUTION;
    } else if (p.x > maxX) {
      p.x = maxX;
      v.x = -v.x * WALL_RESTITUTION;
    }

    // collide top/bottom
    let onFloor = false;
    if (p.y < minY) {
      p.y = minY;
      v.y = -v.y * RESTITUTION;
    } else if (p.y > maxY) {
      p.y = maxY;
      v.y = -v.y * RESTITUTION;
      onFloor = true;
    }

    // damping
    v.x *= AIR_DAMPING;
    v.y *= AIR_DAMPING;

    // extra friction when touching floor (so it settles)
    if (onFloor) {
      v.x *= FLOOR_FRICTION;

      // if vertical velocity is tiny near floor, kill it (prevents infinite micro-bounces)
      if (Math.abs(v.y) < STOP_EPS) v.y = 0;
      if (Math.abs(v.x) < STOP_EPS) v.x = 0;
    }

    // commit
    posRef.current = p;
    velRef.current = v;
    setPos(p);

    // stop condition: ball resting on floor and basically not moving
    const restingOnFloor = Math.abs(p.y - maxY) < 0.001;
    const stopped = restingOnFloor && Math.abs(v.x) < STOP_EPS && Math.abs(v.y) < STOP_EPS;

    if (stopped) {
      velRef.current = { x: 0, y: 0 };
      stopPhysics();
    }
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onPointerMove(e: PointerEvent) {
      if (!stage) return;
      if (!draggingRef.current) return;
      if (pointerIdRef.current !== e.pointerId) return;

      const rect = stage.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const nextX = clamp(px - dragOffsetRef.current.x, R, stageSize.w - R);
      const nextY = clamp(py - dragOffsetRef.current.y, R, stageSize.h - R);

      const now = performance.now();

      // compute drag velocity sample
      const last = lastDragSampleRef.current;
      if (last) {
        const dt = (now - last.t) / 1000;
        if (dt > 0) {
          const vx = (nextX - last.p.x) / dt;
          const vy = (nextY - last.p.y) / dt;
          // low-pass filter so release feels stable
          velRef.current = {
            x: velRef.current.x * 0.6 + vx * 0.4,
            y: velRef.current.y * 0.6 + vy * 0.4,
          };
        }
      }
      lastDragSampleRef.current = { t: now, p: { x: nextX, y: nextY } };

      posRef.current = { x: nextX, y: nextY };
      setPos({ x: nextX, y: nextY });
    }

    function onPointerUp(e: PointerEvent) {
      if (pointerIdRef.current !== e.pointerId) return;

      draggingRef.current = false;
      pointerIdRef.current = null;
      lastDragSampleRef.current = null;

      // start physics after release (unless already basically stopped)
      const v = velRef.current;
      const speed = Math.hypot(v.x, v.y);
      if (speed > 1) startPhysics();
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [R, stageSize.w, stageSize.h]);

  function onBallPointerDown(e: React.PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;

    // stop physics while dragging
    stopPhysics();

    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = stage.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    dragOffsetRef.current = { x: px - posRef.current.x, y: py - posRef.current.y };

    // reset velocity samples
    velRef.current = { x: 0, y: 0 };
    lastDragSampleRef.current = { t: performance.now(), p: posRef.current };
  }

  return (
    <div ref={stageRef} className="stage">
      <div
        className="ball"
        onPointerDown={onBallPointerDown}
        style={{
          width: R * 2,
          height: R * 2,
          transform: `translate(${pos.x - R}px, ${pos.y - R}px)`,
        }}
      />
      {/* <div className="hint">
        Drag → release → gravity + bounce + damping (stops completely)
      </div> */}
    </div>
  );
}