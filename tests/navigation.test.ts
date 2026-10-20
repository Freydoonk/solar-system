import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { bindSpacePan, type DragMode } from "../src/components/solar-system/navigation.ts";

// Exercise the actual Three.js input controller without needing a WebGL context.
class TestDocument extends EventTarget {
  defaultView = new EventTarget();
  body = {};
  documentElement = {};
  activeElement: object | null = this.body;
  hidden = false;
}

class TestCanvas extends EventTarget {
  ownerDocument = new TestDocument();
  style = { touchAction: "", cursor: "crosshair" };
  dataset: Record<string, string> = {};
  clientWidth = 800;
  clientHeight = 600;
  getRootNode() { return this.ownerDocument; }
  setPointerCapture() { return; }
  releasePointerCapture() { return; }
  focus() { this.ownerDocument.activeElement = this; }
}

function dispatch(target: EventTarget, type: string, fields: Record<string, unknown> = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event;
}

function setup(t: TestContext) {
  const canvas = new TestCanvas();
  const document = canvas.ownerDocument;
  const window = document.defaultView;
  const camera = new PerspectiveCamera(45, 4 / 3, 0.01, 1000);
  camera.position.set(4, 6, 10);
  const controls = new OrbitControls(camera, canvas as unknown as HTMLCanvasElement);
  controls.screenSpacePanning = true;
  controls.listenToKeyEvents(canvas as unknown as HTMLElement);
  camera.updateMatrixWorld();
  canvas.focus();
  canvas.style.cursor = "crosshair";
  let mode: DragMode = "orbit";
  const navigation = bindSpacePan(canvas as unknown as HTMLCanvasElement, controls, () => mode);
  t.after(() => { navigation.dispose(); controls.dispose(); });
  const space = (type: "keydown" | "keyup", fields: Record<string, unknown> = {}) =>
    dispatch(window, type, { key: " ", code: "Space", ...fields });
  const drag = (dx: number, dy: number, button = 0) => {
    const fields = { button, pointerId: 1, pointerType: "mouse", clientX: 100, clientY: 100 };
    dispatch(canvas, "pointerdown", fields);
    dispatch(document, "pointermove", { ...fields, clientX: 100 + dx, clientY: 100 + dy });
    dispatch(document, "pointerup", { ...fields, clientX: 100 + dx, clientY: 100 + dy });
    camera.updateMatrixWorld();
  };
  return { canvas, document, window, camera, controls, navigation, space, drag,
    setMode(value: DragMode) { mode = value; navigation.refresh(); } };
}

test("Space-drag moves the camera in all four screen directions without rotating", (t) => {
  const h = setup(t);
  const right = new Vector3().setFromMatrixColumn(h.camera.matrix, 0);
  const up = new Vector3().setFromMatrixColumn(h.camera.matrix, 1);
  const orientation = h.camera.quaternion.clone();
  assert.equal(h.space("keydown").defaultPrevented, true);
  for (const [dx, dy] of [[80, 0], [-80, 0], [0, 80], [0, -80]]) {
    const cameraStart = h.camera.position.clone();
    const targetStart = h.controls.target.clone();
    h.drag(dx, dy);
    const movement = h.camera.position.clone().sub(cameraStart);
    const targetMovement = h.controls.target.clone().sub(targetStart);
    assert.ok(movement.length() > 0.1);
    assert.ok(movement.distanceTo(targetMovement) < 1e-10, "camera and target translate together");
    assert.ok(1 - Math.abs(h.camera.quaternion.dot(orientation)) < 1e-12);
    if (dx) {
      assert.ok(movement.dot(right) * dx < 0, "the scene follows the horizontal drag");
      assert.ok(Math.abs(movement.dot(up)) < 1e-10);
    } else {
      assert.ok(movement.dot(up) * dy > 0, "the scene follows the vertical drag");
      assert.ok(Math.abs(movement.dot(right)) < 1e-10);
    }
  }
  h.space("keyup");
  const target = h.controls.target.clone();
  h.drag(80, 0);
  assert.ok(h.controls.target.distanceTo(target) < 1e-10);
  assert.ok(h.camera.quaternion.angleTo(orientation) > 0.1, "left-drag orbits again after release");
});

test("Pan mode works without a keyboard and survives a temporary Space shortcut", (t) => {
  const h = setup(t);
  h.setMode("pan");
  h.space("keydown");
  h.space("keyup");
  const target = h.controls.target.clone();
  const orientation = h.camera.quaternion.clone();
  h.drag(70, 40);
  assert.ok(h.controls.target.distanceTo(target) > 0.1);
  assert.ok(1 - Math.abs(h.camera.quaternion.dot(orientation)) < 1e-12);
  h.setMode("orbit");
  const pannedTarget = h.controls.target.clone();
  h.drag(70, 40);
  assert.ok(h.controls.target.distanceTo(pannedTarget) < 1e-10);
  assert.ok(h.camera.quaternion.angleTo(orientation) > 0.1);
});

test("Space leaves form and button shortcuts intact, including when the sky is hovered", (t) => {
  const h = setup(t);
  dispatch(h.canvas, "pointerenter");
  for (const tagName of ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY", "A"]) {
    h.document.activeElement = { tagName };
    assert.equal(h.space("keydown").defaultPrevented, false, tagName);
    assert.equal(h.space("keyup").defaultPrevented, false, tagName);
  }
  h.document.activeElement = h.document.body;
  dispatch(h.canvas, "pointerleave");
  assert.equal(h.space("keydown").defaultPrevented, false, "outside the sky");
  dispatch(h.canvas, "pointerenter");
  assert.equal(h.space("keydown", { ctrlKey: true }).defaultPrevented, false);
  assert.equal(h.space("keydown", { isComposing: true }).defaultPrevented, false);
  assert.equal(h.space("keydown").defaultPrevented, true, "hovering the sky with no focused control");
});

test("lost focus, cancellation and hidden tabs cannot leave Space-pan stuck", (t) => {
  const h = setup(t);
  const resets = [
    () => dispatch(h.window, "blur"),
    () => dispatch(h.canvas, "blur"),
    () => dispatch(h.canvas, "pointercancel", { pointerId: 1 }),
    () => { h.document.hidden = true; dispatch(h.document, "visibilitychange"); },
  ];
  for (const reset of resets) {
    h.document.hidden = false;
    h.canvas.focus();
    h.space("keydown");
    reset();
    assert.equal(h.space("keydown", { repeat: true }).defaultPrevented, false);
    const target = h.controls.target.clone();
    const orientation = h.camera.quaternion.clone();
    h.drag(50, 0);
    assert.ok(h.controls.target.distanceTo(target) < 1e-10);
    assert.ok(h.camera.quaternion.angleTo(orientation) > 0.1);
  }
  h.navigation.dispose();
  assert.equal(h.canvas.style.cursor, "crosshair");
  assert.equal(h.space("keydown").defaultPrevented, false, "unmounted views release global shortcuts");
});

test("right-drag and focused arrow keys still pan with Orbit mode selected", (t) => {
  const h = setup(t);
  const orientation = h.camera.quaternion.clone();
  h.drag(50, 30, 2);
  assert.ok(h.controls.target.length() > 0.1);
  const target = h.controls.target.clone();
  const event = dispatch(h.canvas, "keydown", { key: "ArrowLeft", code: "ArrowLeft" });
  assert.equal(event.defaultPrevented, true);
  assert.ok(h.controls.target.distanceTo(target) > 0.01);
  assert.ok(1 - Math.abs(h.camera.quaternion.dot(orientation)) < 1e-12);
});
