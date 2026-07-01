# Changelog

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
