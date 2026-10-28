import { Fragment, type ReactNode } from "react";
import { t } from "./messages";

/** Named React slots let translators reorder links/emphasis without accepting HTML. */
export function Translated({ message, values }: { message: string; values: Record<string, ReactNode> }) {
  return t(message).split(/(\{[a-zA-Z][a-zA-Z0-9]*\})/g).map((part, index) =>
    <Fragment key={index}>{Object.hasOwn(values, part.slice(1, -1)) && part.startsWith("{")
      ? values[part.slice(1, -1)] : part}</Fragment>);
}
