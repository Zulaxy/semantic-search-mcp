# semantic-search-mcp: Semantic code search for opencode, Claude, Cursor

Hey r/opencode! I built an MCP server that adds semantic code search to AI coding agents.

## What it does

Instead of grepping for exact words, your AI can now search by **meaning**. Ask "where do we handle authentication?" and it returns `AuthController.php:login()`, `config/auth.php`, `Google2FAController.php` — even if the word "handle" doesn't appear.

## Try it (30 seconds)

```bash
npx semantic-search-mcp init
```

Copy the snippet into opencode.jsonc, restart, done.

## Features

- **Function-level extraction** — splits code at function/class boundaries (PHP, JS, TS, Python, Go, Rust, Java)
- **Hybrid scoring** — 70% embedding similarity + 30% keyword match
- **Local only** — 80MB model, runs ONNX on your machine, zero API calls
- **TUI config wizard** — `semantic-search-mcp config` gives you checkboxes for extensions, searchable model picker
- **Configurable** — `.semantic-search.json`, env vars, CLI args

## Install

```bash
npm i -g semantic-search-mcp
npx semantic-search-mcp config  # interactive setup
```

## Links

- npm: npmjs.com/package/semantic-search-mcp
- GitHub: github.com/Zulaxy/semantic-search-mcp
