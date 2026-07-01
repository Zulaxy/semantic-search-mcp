# Changelog

## 1.2.1
- Complete README rewrite — FAQ section, per-project cache explanation, 3-step flow
- Answers: which folder gets indexed, multiple projects, cache location, restart survival

## 1.2.0
- Live progress bar for `semantic-search-mcp index` command
- New flow: index in terminal first, then connect AI agent
- Clean index command output

## 1.1.3
- Startup announcement: "First run: downloading model (~80MB) + indexing"
- ETA tracking during indexing (percentage + estimated time remaining)
- New `get_status` MCP tool — check indexing progress from AI agent

## 1.1.2
- Fix version command BOM handling

## 1.1.1
- Fix relative path resolution in cli.js (bin at package root)

## 1.1.0
- Regex function extraction — split code at function/class boundaries
  - PHP: function, method, class
  - JS/TS/Vue: function, arrow, class
  - Python: def, class | Go: func | Rust: fn | Java: method
  - Falls back to line chunking for unsupported languages

## 1.0.5
- Refresh npm README

## 1.0.4
- Chunk metadata — prepend file path to embedding text
- Hybrid scoring — 70% embedding + 30% keyword match
- CHANGELOG.md

## 1.0.3
- README: document TUI config command

## 1.0.2
- TUI config wizard (`semantic-search-mcp config`) via @inquirer/prompts

## 1.0.1
- Fix bin entry (npm stripping)
- README: update model references to bge-small-en-v1.5

## 1.0.0
- Initial release
- MCP server over stdio (opencode, Claude, Cursor)
- File-level embedding via Xenova/bge-small-en-v1.5
- Config: .semantic-search.json, env vars, CLI args
- Commands: start, init, index, clean
