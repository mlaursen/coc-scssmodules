import { TextDocument } from "vscode-languageserver-textdocument";
import { dirname, join } from "path";

export function uniq<T>(things: readonly T[]): T[] {
  return Array.from(new Set(things));
}

export function getDirname(document: TextDocument): string {
  return dirname(document.uri).replace(/^file:\/\//, "");
}

export function getImportRegExp(key: string): RegExp {
  const file = "(.+\\.\\S{1,2}ss)";
  const fromOrRequire = "(?:from\\s+|=\\s+require(?:<any>)?\\()";
  const requireEndOptional = "\\)?";
  const pattern = `${key}\\s+${fromOrRequire}["']${file}["']${requireEndOptional}`;

  return new RegExp(pattern);
}

export function getImportPath(
  document: TextDocument,
  importName: string
): string {
  const folder = getDirname(document);
  const match = document.getText().match(getImportRegExp(importName));

  const fileName = match?.[1] || "";
  if (!fileName) {
    return "";
  }

  return join(folder, fileName);
}
