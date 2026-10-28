import en from "./en.json" with { type: "json" };
import fa from "./fa.json" with { type: "json" };
import ar from "./ar.json" with { type: "json" };
import es from "./es.json" with { type: "json" };
import fr from "./fr.json" with { type: "json" };

export type LanguageDefinition = { label: string; flag: string; locale: string; direction: "ltr" | "rtl"; messages: Record<string, string> };
/** Add a catalogue and one entry here to offer another language. */
export const languages = {
  en: { label: "English", flag: "gb", locale: "en-GB", direction: "ltr", messages: en },
  fa: { label: "فارسی", flag: "ir", locale: "fa-IR-u-ca-gregory", direction: "rtl", messages: fa },
  ar: { label: "العربية", flag: "sa", locale: "ar-SA-u-ca-gregory", direction: "rtl", messages: ar },
  es: { label: "Español", flag: "es", locale: "es-ES", direction: "ltr", messages: es },
  fr: { label: "Français", flag: "fr", locale: "fr-FR", direction: "ltr", messages: fr },
} satisfies Record<string, LanguageDefinition>;
export type Language = keyof typeof languages;
export const isLanguage = (value: unknown): value is Language => typeof value === "string" && Object.hasOwn(languages, value);
