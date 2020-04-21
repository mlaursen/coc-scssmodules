import { ExtensionContext, languages, workspace } from "coc.nvim";
import { DocumentFilter } from "vscode-languageserver-protocol";

import DefinitionProvider from "./DefinitionProvider";
import { CamelCaseValues } from "./types";
import CompletionProvider from "./CompletionProvider";

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
      new DefinitionProvider(camelCase, context.logger)
    )
  );
  subscriptions.push(
    languages.registerCompletionItemProvider(
      "coc-cssmodules",
      hintMessage,
      VIM_FILETYPES,
      new CompletionProvider(camelCase, context.logger),
      ["."]
    )
  );
}
