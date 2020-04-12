import { ExtensionContext, languages, workspace } from "coc.nvim";
import { DocumentFilter } from "vscode-languageserver-protocol";

import CSSModulesDefinitionProvider from "./CSSModulesDefinitionProvider";
import { CamelCaseValues } from "./types";
import CSSModulesCompletionProvider from "./CSSModulesCompletionProvider";

const VIM_FILETYPES = [
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
];

export async function activate(context: ExtensionContext): Promise<void> {
  const { subscriptions } = context;

  const filters: DocumentFilter[] = VIM_FILETYPES.map((language) => ({
    language,
    scheme: "file",
  }));
  const configuration = workspace.getConfiguration("cssmodules");

  const camelCase = configuration.get<CamelCaseValues>("camelCase", false);
  const hintMessage = configuration.get<string>(
    "hintMessage",
    "string (cssmodule)"
  );

  subscriptions.push(
    languages.registerDefinitionProvider(
      filters,
      new CSSModulesDefinitionProvider(camelCase)
    )
  );
  subscriptions.push(
    languages.registerCompletionItemProvider(
      "coc-cssmodules",
      hintMessage,
      VIM_FILETYPES,
      new CSSModulesCompletionProvider(camelCase),
      ["."]
    )
  );
}
