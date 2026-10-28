export type MessageValues = Record<string, string | number | null | undefined>;
export type Translate = (message: string | null | undefined, values?: MessageValues) => string;
/** Shared by pure calculation/export helpers, without loading a language or browser state. */
export const formatMessage: Translate = (message, values) => (message ?? "").replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
  (token, key: string) => values && Object.hasOwn(values, key) ? String(values[key] ?? "") : token);
