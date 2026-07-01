# Changelog


## 1.1.0
- **Regex function extraction** � split code at function/class boundaries for better embeddings
  - PHP: function, method, class declarations
  - JS/TS/Vue: function, arrow, class declarations
  - Python: def, class
  - Go: func
  - Rust: fn
  - Java: method declarations
  - Falls back to line chunking for unsupported languages

## 1.0.4
- Chunk metadata (file path prepended to embedding text)
- Hybrid scoring (70% embedding + 30% keyword match)
- CHANGELOG.md


## 1.0.4
- **Chunk metadata** — prepend file path to embedding text for better context awareness
- **Hybrid scoring** — combine embedding similarity + keyword match (70/30 blend)
- **CHANGELOG.md** — track version changes

## 1.0.3
- README: document `semantic-search-mcp config` TUI command

## 1.0.2
- TUI config wizard (`semantic-search-mcp config`) using @inquirer/prompts
- Checkbox extensions, searchable model picker, threshold inputs

## 1.0.1
- Fix bin entry (npm stripping)
- README: update model references to bge-small-en-v1.5

## 1.0.0
- Initial release
- MCP server over stdio for opencode, Claude, Cursor
- File-level embedding via Xenova/bge-small-en-v1.5
- Config: .semantic-search.json, env vars, CLI args
- Commands: start, init, index, clean
