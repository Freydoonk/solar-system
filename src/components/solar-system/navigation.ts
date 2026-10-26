import { MOUSE, TOUCH } from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type DragMode = "orbit" | "pan";

/** Release the viewing-angle lock on a real drag, not a click or wheel zoom. */
export function bindLocationRelease(canvas: HTMLCanvasElement, release: () => void) {
  const document = canvas.ownerDocument;
  const pointers = new Map<number, { x: number; y: number }>();
  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button === 0 || event.button === 2) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
  };
  const move = (event: PointerEvent) => {
    const start = pointers.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 2) {
      pointers.clear();
      release();
    }
  };
  const up = (event: PointerEvent) => { pointers.delete(event.pointerId); };
  const clear = () => pointers.clear();
  const key = (event: KeyboardEvent) => { if (event.key.startsWith("Arrow")) release(); };
  const capture = { capture: true };
  canvas.addEventListener("pointerdown", down, capture);
  document.addEventListener("pointermove", move, capture);
  document.addEventListener("pointerup", up, capture);
  document.addEventListener("pointercancel", up, capture);
  canvas.addEventListener("keydown", key, capture);
  document.defaultView?.addEventListener("blur", clear);
  return () => {
    canvas.removeEventListener("pointerdown", down, capture);
    document.removeEventListener("pointermove", move, capture);
    document.removeEventListener("pointerup", up, capture);
    document.removeEventListener("pointercancel", up, capture);
    canvas.removeEventListener("keydown", key, capture);
    document.defaultView?.removeEventListener("blur", clear);
    pointers.clear();
  };
}

/** Temporary Space-pan is scoped to the sky, never to form/button shortcuts. */
export function bindSpacePan(
  canvas: HTMLCanvasElement,
  controls: Pick<OrbitControls, "mouseButtons" | "touches">,
  getMode: () => DragMode,
) {
  const document = canvas.ownerDocument;
  const window = document.defaultView!;
  const originalLeft = controls.mouseButtons.LEFT;
  const originalTouch = controls.touches.ONE;
  const originalCursor = canvas.style.cursor;
  let hovered = false;
  let spaceHeld = false;
  let displayedMode: DragMode | null = null;
  const dragging = new Set<number>();

  const refresh = () => {
    const pan = spaceHeld || getMode() === "pan";
    controls.mouseButtons.LEFT = pan ? MOUSE.PAN : MOUSE.ROTATE;
    controls.touches.ONE = pan ? TOUCH.PAN : TOUCH.ROTATE;
    const mode = pan ? "pan" : "orbit";
    if (displayedMode !== mode) {
      canvas.dataset.navigation = mode;
      displayedMode = mode;
    }
    canvas.style.cursor = dragging.size ? "grabbing" : pan ? "move" : "grab";
  };
  const reset = () => { spaceHeld = false; refresh(); };
  const cancelDrag = () => { dragging.clear(); reset(); };
  const onPointerDown = (event: PointerEvent) => { dragging.add(event.pointerId); refresh(); };
  const onPointerUp = (event: PointerEvent) => { dragging.delete(event.pointerId); refresh(); };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== "Space" || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const focused = document.activeElement;
    const skyActive = focused === canvas || (hovered && (!focused || focused === document.body || focused === document.documentElement));
    if (!skyActive || (event.repeat && !spaceHeld)) return;
    event.preventDefault();
    spaceHeld = true;
    refresh();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space") return;
    if (spaceHeld) event.preventDefault();
    reset();
  };
  const onEnter = () => { hovered = true; };
  const onLeave = () => {
    hovered = false;
    if (document.activeElement !== canvas) reset();
  };
  const onVisibilityChange = () => { if (document.hidden) cancelDrag(); };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", cancelDrag);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("pointerenter", onEnter);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("blur", cancelDrag);
  canvas.addEventListener("pointercancel", cancelDrag);
  canvas.addEventListener("lostpointercapture", onPointerUp);
  canvas.addEventListener("pointerdown", onPointerDown, { capture: true });
  document.addEventListener("pointerup", onPointerUp, { capture: true });
  document.addEventListener("pointercancel", onPointerUp, { capture: true });
  refresh();

  return {
    refresh,
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", cancelDrag);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("blur", cancelDrag);
      canvas.removeEventListener("pointercancel", cancelDrag);
      canvas.removeEventListener("lostpointercapture", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      document.removeEventListener("pointercancel", onPointerUp, { capture: true });
      controls.mouseButtons.LEFT = originalLeft;
      controls.touches.ONE = originalTouch;
      canvas.style.cursor = originalCursor;
      delete canvas.dataset.navigation;
    },
  };
}
