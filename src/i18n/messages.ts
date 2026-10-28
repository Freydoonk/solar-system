import { isLanguage, languages, type Language, type LanguageDefinition } from "./languages.ts";
import { formatMessage, type MessageValues } from "./format.ts";

export const LANGUAGE_STORAGE_KEY = "solar-system-language";
type Values = MessageValues;
export function initialLanguage(storage?: Pick<Storage, "getItem">, preferred: readonly string[] = []): Language {
  try { const saved = storage?.getItem(LANGUAGE_STORAGE_KEY); if (isLanguage(saved)) return saved; } catch { /* Storage can be disabled. */ }
  return preferred.map(value => value.split("-")[0]).find(isLanguage) ?? "en";
}
function browserLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try { return initialLanguage(window.localStorage, navigator.languages); }
  catch { return initialLanguage(undefined, navigator.languages); }
}
let language = browserLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => languages[language].locale;
export const subscribeLanguage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setLanguage(next: Language) {
  if (!isLanguage(next) || next === language) return;
  language = next;
  try { if (typeof window !== "undefined") window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Keep the selection for this tab. */ }
  listeners.forEach(listener => listener());
}
/** Interpolation is text only. React escapes it; user-authored records are never translated. */
export function translateFor(locale: Language, message: string | null | undefined, values?: Values): string {
  if (!message) return message ?? "";
  const catalogue: LanguageDefinition = languages[locale];
  const translated = catalogue.messages[message] ?? languages.en.messages[message as keyof typeof languages.en.messages] ?? message;
  return formatMessage(translated, values);
}
export const t = (message: string | null | undefined, values?: Values) => translateFor(language, message, values);
