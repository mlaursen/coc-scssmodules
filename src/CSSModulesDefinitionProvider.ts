import { DefinitionProvider, Uri, workspace } from "coc.nvim";
import { readFileSync } from "fs";
import os from "os";
import { resolve } from "path";
import {
  CancellationToken,
  Location,
  Position,
  Range,
} from "vscode-languageserver-protocol";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CamelCaseValues } from "./types";
import { getDirname, getImportPath, getImportRegExp } from "./utils";

export default class CSSModulesDefinitionProvider
  implements DefinitionProvider {
  private camelCase: CamelCaseValues;

  constructor(camelCase: CamelCaseValues) {
    this.camelCase = camelCase;
  }

  /**
   * Check if the current character is on the import style object or
   * a class name field on the style object.
   *
   * Good examples:
   * import styles from "./Something.module.scss"
   *        ^
   * import styles from "./Something.module.scss"
   *           ^
   *
   * Bad examples:
   * import styles from "./Something.module.scss"
   *   ^
   * import styles from "./Something.module.scss"
   *               ^
   */
  private isImportLine(
    line: string,
    character: number,
    importName: string,
    fileName: string
  ): boolean {
    if (!importName || !fileName) {
      return false;
    }

    const importNameIndex = line.indexOf(importName) + 1;
    const fileNameIndex = line.indexOf(fileName) + 1;

    return (
      (character > importNameIndex &&
        character < importNameIndex + importName.length) ||
      (character > fileNameIndex && character < fileNameIndex + fileName.length)
    );
  }

  /**
   * Try to find the styles import object and the className from
   * the current line based on the current character position.
   *
   * Good examples:
   *   return <div className={styles.container} />
   *                          ^
   *   return <div className={styles.container} />
   *                                 ^
   *   return <div className={styles.container} />
   *                                     ^
   *
   * Bad examples:
   *   return <div className={styles.container} />
   *   ^
   *   return <div className={styles.container} />
   *                                ^
   *   return <div className={styles.container} />
   *                   ^
   */
  private getParts(line: string, position: Position): [string, string] {
    const text = line.slice(0, position.character);
    const index = text.search(/[a-z0-9\._]*$/i);
    if (index === -1 || !text.includes(".")) {
      return ["", ""];
    }

    const [, remaining = ""] = /^([a-z0-9\._]*)/i.exec(line.slice(index)) || [];
    const [importName = "", className = ""] = remaining.split(".");
    return [importName, className];
  }

  private getPosition(importPath: string, className: string): Position | null {
    const contents = readFileSync(importPath, "utf8");
    const lines = contents.split(os.EOL);
    let name = className;
    if (this.camelCase && /^[a-z]+[A-Z]/.test(className)) {
      name = className.replace(/^[a-z]+/, "");
    }
    const keyword = new RegExp(name.split("").join("\\S*"), "i");

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const matches = line.match(/(\.|&)[A-z][A-z0-9-_]+/g) || [];
      if (!matches.length) {
        continue;
      }

      const lineMatches = line.match(keyword);
      if (!lineMatches) {
        continue;
      }

      const character = lineMatches.index ?? line.indexOf(lineMatches[0]);
      if (character !== -1) {
        return Position.create(lineNumber, character);
      }
    }
    return null;
  }

  public async provideDefinition(
    document: TextDocument,
    position: Position,
    _token: CancellationToken
  ): Promise<Location | null> {
    const { nvim } = workspace;

    const line = await nvim.eval('getline(".")');
    if (typeof line !== "string") {
      return null;
    }

    // first check if the current line is from
    // import css from "path-to-css.module.scss"
    const [, importName = "", fileName = ""] =
      getImportRegExp("(\\S+)").exec(line) || [];

    if (this.isImportLine(line, position.character, importName, fileName)) {
      // create a location to the start of the file

      const filePath = Uri.file(
        resolve(getDirname(document), fileName)
      ).toString();
      const range = Range.create(Position.create(0, 0), Position.create(0, 0));

      return Location.create(filePath, range);
    }

    const [stylesObject, className] = this.getParts(line, position);
    const importPath = getImportPath(document, stylesObject);
    if (!importPath) {
      return null;
    }

    const classNamePosition = this.getPosition(importPath, className);
    if (!classNamePosition) {
      return null;
    }

    const filePath = Uri.file(importPath).toString();
    const range = Range.create(classNamePosition, classNamePosition);
    return Location.create(filePath, range);
  }
}
