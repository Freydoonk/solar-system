import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const placeholders = text => [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]).sort();

/** Audit actual interface source, including accessibility text and data-driven labels. */
export function sourceMessages(root = "src") {
  const messages = new Set();
  const errors = [];
  const dataFiles = /(?:lessons|planets|telescopes|skyDisplay|events)\.ts$/;
  const dataFields = new Set(["name", "label", "title", "text", "description", "descriptionKey", "design", "owner", "aperture", "band", "capability"]);
  const humanAttributes = new Set(["title", "placeholder", "aria-label", "aria-valuetext", "alt", "label"]);
  for (const file of fs.readdirSync(root, { recursive: true }).filter(file => /\.tsx?$/.test(file) && !/(^|[/\\])ball([/\\])/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
    const report = (node, reason) => errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${reason}`);
    const visit = node => {
      if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) report(node, `Untranslated JSX: ${node.text.trim()}`);
      if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression) && /\p{L}/u.test(node.expression.text)) report(node, `Untranslated JSX expression: ${node.expression.text}`);
      if (ts.isJsxAttribute(node) && humanAttributes.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) && /\p{L}/u.test(node.initializer.text)) {
        report(node, `Untranslated attribute: ${node.name.getText(source)}`);
      }
      if (ts.isStringLiteralLike(node) && node.text.trim()) {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && ["t", "translate"].includes(parent.expression.getText(source)) && parent.arguments[0] === node) messages.add(node.text);
        if (ts.isJsxAttribute(parent) && parent.name.getText(source) === "message") messages.add(node.text);
        if (dataFiles.test(file) && ts.isPropertyAssignment(parent) && dataFields.has(parent.name.getText(source))) messages.add(node.text);
        if (ts.isNewExpression(parent) && parent.expression.getText(source) === "Error" && /[a-zA-Z]+\s+[a-zA-Z]/.test(node.text)) messages.add(node.text);
        if (ts.isCallExpression(parent) && /^set(?:Error|Status|AlignError)$/.test(parent.expression.getText(source))) messages.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { messages, errors };
}
