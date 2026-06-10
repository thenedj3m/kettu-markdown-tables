# Markdown Tables for Kettu / Revenge

Locally renders GitHub-style Markdown pipe tables in Discord mobile messages as compact aligned text tables.

Discord mobile does not natively render GFM tables. This plugin watches incoming/local message dispatches and rewrites detected table blocks into fenced monospace tables on your client only.

## Install

Paste this plugin base URL into Kettu/Revenge/Vendetta-style client plugin installer:

```text
https://thenedj3m.github.io/kettu-markdown-tables/markdownTables
```

Kettu appends `/manifest.json` to plugin URLs internally, so do **not** paste the raw `manifest.json` URL directly.

Fallback raw GitHub base URL:

```text
https://raw.githubusercontent.com/thenedj3m/kettu-markdown-tables/main/dist/markdownTables
```

## Supported syntax

```md
| Name | Count | Note |
|---|---:|:---:|
| A | 1 | x |
| B\|C | 22 | yy |
```

Supports:

- outer pipes optional
- left/center/right delimiter alignment
- escaped pipes inside cells (`\|`)
- multiple tables per message
- skips fenced code blocks

## Limitations

- This is a local display transform, not real Discord Markdown support.
- Existing messages may need a channel reload to be reprocessed, depending on client cache behavior.
- Complex inline Markdown inside cells is treated as plain text.

## Development

```sh
pnpm install
pnpm test
pnpm build
```

Built output goes to `dist/markdownTables/`.
