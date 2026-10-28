import { useLayoutEffect, useSyncExternalStore } from "react";
import { getLanguage, setLanguage, subscribeLanguage, t } from "./messages";
import { languages } from "./languages";

export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = languages[language].direction;
    document.title = t("Solar System");
  }, [language]);
  return { language, setLanguage };
}
