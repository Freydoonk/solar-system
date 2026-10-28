import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { languages } from "../src/i18n/languages.ts";
import { initialLanguage, LANGUAGE_STORAGE_KEY, setLanguage, getLanguage, subscribeLanguage, translateFor } from "../src/i18n/messages.ts";
import { locationLabel, searchText } from "../src/i18n/display.ts";
import { placeholders, sourceMessages } from "../scripts/check-i18n.mjs";
import { researchTargetGuide, TELESCOPES } from "../src/components/observing/telescopes.ts";
import { findSkyEvents, eventsCalendar } from "../src/components/observing/events.ts";
import { Body } from "astronomy-engine";

test("every language has all messages, exact interpolation slots, direction and bundled flag", () => {
  const keys = Object.keys(languages.en.messages).sort();
  for (const [code, language] of Object.entries(languages)) {
    assert.deepEqual(Object.keys(language.messages).sort(), keys, code);
    assert.ok(existsSync(`public/flags/${language.flag}.svg`));
    assert.equal(language.direction, ["fa", "ar"].includes(code) ? "rtl" : "ltr");
    for (const key of keys) {
      const translated = (language.messages as Record<string, string>)[key];
      assert.ok(translated.trim(), `${code}: empty ${key}`);
      assert.deepEqual(placeholders(translated), placeholders(key), `${code}: ${key}`);
      assert.ok(!/[\u2014\uFFFD]/.test(translated), `${code}: forbidden/corrupt character in ${key}`);
    }
  }
});

test("interface, accessibility, rich messages and model copy have translation keys", () => {
  const { messages, errors } = sourceMessages();
  for (const message of messages) if (!Object.hasOwn(languages.en.messages, message)) errors.push(`Missing message: ${message}`);
  assert.deepEqual(errors, []);
});

test("catalogue names and generated event copy are covered", () => {
  const names = JSON.parse(readFileSync("src/components/observing/catalogue/constellations.json", "utf8")).map((value: { name: string }) => value.name);
  const events = findSkyEvents({ start: Date.UTC(2025, 0, 1), days: 365, site: null });
  for (const event of events) names.push(event.title, event.descriptionKey ?? event.description);
  for (const name of names) assert.ok(Object.hasOwn(languages.en.messages, name), name);
  const translated = eventsCalendar(events.slice(0, 3), Date.UTC(2025, 0, 1), (text, values) => translateFor("fa", text, values));
  assert.ok(translated.includes("SUMMARY:"));
  assert.ok(!translated.includes("SUMMARY:Full Moon"));
  assert.ok(!translated.includes("undefined"));
  for (const line of translated.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  for (const scope of TELESCOPES) {
    const text = researchTargetGuide(scope, Body.Mars, (text, values) => translateFor("fr", text, values));
    assert.ok(!text.text.includes("{body}"));
  }
});

test("saved language wins, browser languages match by region, unavailable storage stays usable", () => {
  assert.equal(initialLanguage({ getItem: key => key === LANGUAGE_STORAGE_KEY ? "fa" : null }, ["fr-FR"]), "fa");
  assert.equal(initialLanguage(undefined, ["de-DE", "ar-EG"]), "ar");
  assert.equal(initialLanguage({ getItem: () => "deleted-language" }, ["es-MX"]), "es");
  assert.equal(initialLanguage({ getItem: () => { throw new Error("blocked"); } }, ["fr-CA"]), "fr");
  assert.equal(initialLanguage(undefined, ["unknown"]), "en");
  let updates = 0;
  const unsubscribe = subscribeLanguage(() => updates++);
  setLanguage("fa"); setLanguage("fa");
  assert.equal(getLanguage(), "fa"); assert.equal(updates, 1);
  unsubscribe(); setLanguage("en"); assert.equal(updates, 1);
});

test("interpolation stays text, fallback preserves identifiers and external location labels", () => {
  assert.equal(translateFor("fr", "From {value1}", { value1: "<img src=x>" }), "Depuis <img src=x>");
  assert.equal(translateFor("fa", "HIP32349"), "HIP32349");
  assert.equal(translateFor("ar", undefined), "");
  setLanguage("fa");
  assert.equal(locationLabel({ source: "approximate", label: "Cambridge, United Kingdom" }), "Cambridge, United Kingdom");
  assert.equal(locationLabel({ source: "device", label: "Device location" }), translateFor("fa", "Device location"));
  assert.equal(searchText("مريخ"), searchText("مریخ"));
  setLanguage("en");
});
