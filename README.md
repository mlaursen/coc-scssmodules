# coc-cssmodules

[coc.nvim] extension for `autocompletion` and `go-to-definition` functionality
for [CSS Modules].

## Installation

Since this is really just something I wanted to try making to learn how to make
extensions for `coc.nvim`, this won't really be published like the real
`coc.nvim` extensions and will only be supported through [vim's plugin manager
for coc-extensions]

With [vim-plug]:

```vim
Plug 'mlaursen/coc-cssmodules', {'do': 'yarn install'}
```

## Configuration

This extension supports two configuration properties:

```json
{
  "cssmodules.camelCase": {
    "type": ["boolean", "string"],
    "enum": [true, false, "dashes"],
    "default": false,
    "description": "Boolean if the suggestions should be converted to camelCase if you use kebab-case in css files. Should also work with sass parent selectors"
  },
  "cssmodules.hintMessage": {
    "type": "string",
    "default": "string (cssmodule)",
    "description": "The hint message to display next to an autocomplete suggestion from a css module"
  }
}
```

## Acknowledgements

This extension is essentially a port of [vscode-css-modules-plugin] and
[coc-cssmodules].

## Differences with [coc-cssmodules]

The main reason I created this implementation was to support [parent selectors]
within scss since I still like [BEM] for describing different states. If parent
selectors (`&`) are not a concern, you should use the "official"
[coc-cssmodules] instead.

Another small difference is that the `configuration` will be correctly typed
when using `:CocConfig` and show warnings when the `camelCase` option is valid
or invalid. (This could get ported into the "official" module as well though)

Finally, there is another configuration setting that can be used to show hint
details when the autocompletion items if you do not like the default value of
`string (cssmodule)`.

[coc.nvim]: https://github.com/neoclide/coc.nvim
[css modules]: https://github.com/css-modules/css-modules
[vim's plugin manager for coc-extensions]:
  https://github.com/neoclide/coc.nvim/wiki/Using-coc-extensions#use-vims-plugin-manager-for-coc-extension
[vim-plug]: https://github.com/junegunn/vim-plug
[coc-cssmodules]: https://github.com/antonk52/coc-cssmodules
[vscode-css-modules-plugin]: https://github.com/clinyong/vscode-css-modules
[parent selectors]:
  https://sass-lang.com/documentation/style-rules/parent-selector
[bem]: http://getbem.com/
