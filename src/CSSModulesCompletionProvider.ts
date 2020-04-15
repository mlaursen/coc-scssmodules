import { CompletionItemProvider, workspace } from "coc.nvim";
import { readFileSync } from "fs";
import lodashCamelCase from "lodash.camelcase";
import { CompletionItem } from "vscode-languageserver-protocol";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { CamelCaseValues } from "./types";
import { getImportPath, uniq } from "./utils";

type ClassNameTransformer = (className: string) => string;

export default class CSSModulesCompletionProvider
  implements CompletionItemProvider {
  private transformer: ClassNameTransformer;

  constructor(camelCase: CamelCaseValues) {
    switch (camelCase) {
      case true:
        this.transformer = lodashCamelCase;
        break;
      case "dashes":
        this.transformer = (s) =>
          s.replace(/-(\w)/g, (_, firstLetter) => firstLetter.toUpperCase());
        break;
      default:
        this.transformer = (s) => s;
    }
  }

  private isCompletionTrigger(line: string, position: Position): boolean {
    const index = position.character - 1;

    return line[index] === "." || (index > 1 && line[index - 1] === ".");
  }

  private getParts(line: string, position: Position): [string, string] {
    const text = line.slice(0, position.character);
    const index = text.search(/[a-z0-9\._]*$/i);
    if (index === -1) {
      return ["", ""];
    }

    const remaining = text.slice(index);
    if (!remaining || !remaining.includes(".")) {
      return ["", ""];
    }

    const [importName = "", className = ""] = remaining.split(".");
    return [importName, className];
  }

  private getClassNames(filePath: string, keyword: string): string[] {
    const content = readFileSync(filePath, "utf8");
    const matches = content.match(/(\.|&)[A-z][A-z0-9-_]+/g) || [];

    let lastClass = "";
    const classes = matches.reduce<string[]>((classNames, line) => {
      let className = line
        .replace(/(,|{)\s*$/, "")
        .trim()
        .replace(/^\./, "");

      if (className.startsWith("&")) {
        className = `${lastClass}${className.substring(1)}`;
      }

      className = this.transformer(className);
      lastClass = className;

      if (!keyword || className.includes(keyword)) {
        return [...classNames, className];
      }

      return classNames;
    }, []);

    return uniq(classes);
  }

  public async provideCompletionItems(
    document: TextDocument,
    position: Position
  ): Promise<CompletionItem[]> {
    const { nvim } = workspace;
    const line = await nvim.eval('getline(".")');

    if (typeof line !== "string" || !this.isCompletionTrigger(line, position)) {
      return [];
    }

    const [importName, className] = this.getParts(line, position);
    if (!importName) {
      return [];
    }

    const importPath = getImportPath(document, importName);
    if (!importPath) {
      return [];
    }

    const classNames = this.getClassNames(importPath, className);
    return classNames.map((name) => CompletionItem.create(name));
  }
}
