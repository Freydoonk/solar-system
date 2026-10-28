import { t } from "./messages.ts";

export function locationLabel(site: { source: string; label: string }): string {
  return site.source === "device" ? t("Device location") : site.source === "manual" ? t("Custom observing site")
    : site.label === "Approximate region" ? t(site.label) : site.label;
}

/** Match both translated names and original catalogue identifiers. */
export const searchText = (text: string) => text.toLocaleLowerCase().replaceAll("ي", "ی").replaceAll("ك", "ک").replace(/[\s\u200c]/g, "");
