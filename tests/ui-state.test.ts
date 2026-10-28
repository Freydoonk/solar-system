import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { act, createElement, StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

test("mounted app preserves choices across location races and language/page changes", async () => {
  // DOM integration only. Three.js is replaced here; actual rendering/layout needs browser QA.
  const dom = new JSDOM('<html><head></head><body><div id="root"></div></body></html>', { url: "http://localhost/solar-system/", pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const install = (key: string, value: unknown) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  install("window", dom.window); install("document", dom.window.document); install("navigator", dom.window.navigator);
  install("HTMLElement", dom.window.HTMLElement); install("IS_REACT_ACT_ENVIRONMENT", true);
  install("requestAnimationFrame", () => 1); install("cancelAnimationFrame", () => {});
  install("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: false }) });
  Object.defineProperty(dom.window, "scrollTo", { value: () => {} });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const pending: PositionCallback[] = [];
  Object.defineProperty(navigator, "permissions", { value: { query: async () => ({ state: "granted" }) } });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (success: PositionCallback) => pending.push(success) } });
  let ipCalls = 0;
  install("fetch", async () => { ipCalls++; throw new Error("unexpected IP request"); });
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: "custom", esbuild: { jsx: "automatic" },
    plugins: [{ name: "dom-test-renderers", enforce: "pre", load(id) {
      if (/(?:SpaceScene|SkyScene|EyepieceScene)\.tsx$/.test(id)) return "export default function Scene() { return null; }";
    } }] });
  const container = document.getElementById("root")!;
  let root = createRoot(container);
  try {
    const { useObserverLocation } = await server.ssrLoadModule("/src/components/observing/useObserverLocation.ts");
    let location: ReturnType<typeof useObserverLocation>;
    function Probe() {
      const value = useObserverLocation(true);
      useLayoutEffect(() => { location = value; }, [value]);
      return null;
    }
    await act(async () => { root.render(createElement(StrictMode, null, createElement(Probe))); });
    assert.equal(pending.length, 1, "Strict Mode shares startup request");
    await act(async () => { location.manualLocation("35.7", "51.4", "1000"); });
    await act(async () => { pending.shift()!({ coords: { latitude: 51.5, longitude: -0.1, altitude: 10, accuracy: 3 } } as GeolocationPosition); });
    assert.equal(location.site.source, "manual"); assert.equal(location.site.latitude, 35.7);
    await act(async () => { location.deviceLocation(); });
    await act(async () => { location.manualLocation("40", "-3", "600"); });
    await act(async () => { pending.shift()!({ coords: { latitude: 1, longitude: 2, altitude: 0, accuracy: 3 } } as GeolocationPosition); });
    assert.equal(location.site.latitude, 40, "late button result preserves manual choice");
    await act(async () => { root.unmount(); });
    root = createRoot(container);
    const { default: App } = await server.ssrLoadModule("/src/App.tsx");
    const { languages } = await server.ssrLoadModule("/src/i18n/languages.ts");
    await act(async () => { root.render(createElement(App)); });
    const picker = container.querySelector(".languagePicker select") as HTMLSelectElement;
    assert.equal(picker.options.length, 5);
    assert.equal(container.querySelector(".languagePicker span"), null, "no visible language title");
    for (const [code, definition] of Object.entries(languages) as [string, { direction: string; messages: Record<string, string> }][]) {
      await act(async () => { picker.value = code; picker.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
      assert.equal(document.documentElement.lang, code);
      assert.equal(document.documentElement.dir, definition.direction);
      assert.equal(container.querySelector('a[href="#observe"]')?.textContent, definition.messages.Observe);
      assert.equal(document.title, definition.messages["Solar System"]);
    }
    assert.equal(dom.window.localStorage.getItem("solar-system-language"), "fr");
    // Preload lazy modules to avoid wall-clock waits in the test.
    await server.ssrLoadModule("/src/components/observing/Sky.tsx");
    await act(async () => { window.history.replaceState(null, "", "#sky"); window.dispatchEvent(new dom.window.HashChangeEvent("hashchange")); });
    await act(async () => {});
    const menu = [...container.querySelectorAll("details")].find(element => element.querySelector("summary")?.textContent === languages.fr.messages.Display)!;
    assert.ok(menu); assert.equal(menu.open, false);
    const choices = [...menu.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    assert.equal(choices.length, 9);
    assert.equal(choices[0].checked, true);
    await act(async () => { choices[0].click(); });
    assert.equal(choices[0].checked, false);
    await act(async () => { picker.value = "fa"; picker.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    assert.equal(choices[0].checked, false, "language switch retains display choices");
    await act(async () => { window.history.replaceState(null, "", "#explore"); window.dispatchEvent(new dom.window.HashChangeEvent("hashchange")); });
    await act(async () => { window.history.replaceState(null, "", "#sky"); window.dispatchEvent(new dom.window.HashChangeEvent("hashchange")); });
    assert.equal(choices[0].checked, false, "navigation retains display choices");
    assert.equal(ipCalls, 0);
    assert.deepEqual(Object.keys(dom.window.localStorage), ["solar-system-language"], "coordinates remain in memory");
  } finally {
    await act(async () => root.unmount());
    await server.close(); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
