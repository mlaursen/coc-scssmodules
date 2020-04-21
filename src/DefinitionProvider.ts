import { DefinitionProvider, Uri, workspace, ExtensionContext } from "coc.nvim";
import { readFileSync, existsSync } from "fs";
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
  private logger: ExtensionContext["logger"];

  public constructor(
    camelCase: CamelCaseValues,
    logger: ExtensionContext["logger"]
  ) {
    this.camelCase = camelCase;
    this.logger = logger;
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

    const importNameIndex = line.indexOf(importName);
    const fileNameIndex = line.indexOf(fileName);

    return (
      (character >= importNameIndex &&
        character <= importNameIndex + importName.length) ||
      (character >= fileNameIndex &&
        character <= fileNameIndex + fileName.length)
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

  /**
   * Creates a regexp string that makes all the parent selectors optional. This
   * should be used with the camelCase option.
   *
   * Example:
   *
   * // so this should match:
   * // .container-child, &-child, &_child, &--child, &__child
   * "containerChild" -> "(container|&)(-|_){1,2}Child"
   *
   * // so this should match:
   * // .container-child-element,
   * // &-child-element
   * // &_child-element
   * // &--child-element
   * // &__child-element
   * // &-element
   * // &_element
   * // &--element
   * // &__element
   * "containerChildElement" -> "((container|&)(-|_){1,2})?(Child|&)(-|_){1,2}Element"
   *
   * but... it's best practice to not really do this much nesting so don't
   * really even know if this works 100%
   */
  private optionalSelectorPrefix(
    [className, ...remaining]: string[],
    currentRegex: string
  ): string {
    if (!remaining.length) {
      return `${currentRegex}${className}`;
    }

    let prefix = currentRegex;
    if (currentRegex) {
      prefix = `(${currentRegex})?`;
    }

    return this.optionalSelectorPrefix(
      remaining,
      `${prefix}(${className}|&)(-|_){1,2}`
    );
  }

  /**
   * This is really only used for hyphenated bem camelCase configuration. This
   * ensures that if there is a child selector with the same name as a "root"
   * selector later in the file, the "root" selector will be chosen instead.
   *
   * Example:
   *
   * ```scss
   * .container {
   *   &--clear {
   *     background-color: transparent;
   *   }
   *
   *   &--red {
   *     background-color: red;
   *   }
   * }
   *
   * .clear {
   *   clear: both;
   * }
   *
   * .red, .red-fg, .red-thing {
   *   color: red;
   * }
   * ```
   *
   * ```tsx
   * // want this to match .clear instead of &--clear
   * styles.clear
   *
   * // want this to match .red instead of &--red
   * styles.red
   * ```
   */
  private isNotBestSelectorMatch(
    remainingLines: string[],
    className: string
  ): boolean {
    if (!this.camelCase) {
      return false;
    }

    const lineStartsWithClassName = new RegExp(
      `^.${className}(,\\s*\.[A-z_-]+)*\\s*({|,)\\s*$`
    );

    return !!remainingLines.find((line) => line.match(lineStartsWithClassName));
  }

  /**
   * Find the position of the classname within the css/scss module file by
   * expanding camel case for parent selectors (if camelCase is enabled).
   */
  private getPosition(importPath: string, className: string): Position | null {
    const contents = readFileSync(importPath, "utf8");
    const lines = contents.split(os.EOL);
    let nameOrRegexpString = className;
    if (this.camelCase && /^[a-z]+[A-Z]/.test(className)) {
      const parts = className.split(/(?=[A-Z][a-z])/);
      nameOrRegexpString = this.optionalSelectorPrefix(parts, "");
    }

    const keyword = new RegExp(nameOrRegexpString, "i");

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];

      // match either:
      // .className
      // .class-name
      // .className-oh_why_wouldYoudoThis
      //   &-class
      //   &--modifier
      //   &__child
      const matches = line.match(
        /^(\.[A-z])|(\s*&[-_]+)[A-z0-9_-]+\s*(,|{)\s*$/
      );

      if (!matches || !matches.length) {
        continue;
      }

      const lineMatches = line.match(keyword);
      if (
        !lineMatches ||
        this.isNotBestSelectorMatch(lines.slice(lineNumber + 1), className)
      ) {
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

    // next check if we can find an import name based on the styles object
    const [stylesObject, className] = this.getParts(line, position);
    const importPath = getImportPath(document, stylesObject);
    if (!importPath || !existsSync(importPath)) {
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
