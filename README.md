# semantic-search-mcp

> Semantic code search MCP server for AI coding agents. Local embeddings, no API keys.

[![npm version](https://img.shields.io/npm/v/semantic-search-mcp)](https://www.npmjs.com/package/semantic-search-mcp)
[![node](https://img.shields.io/node/v/semantic-search-mcp)](https://nodejs.org)

AI coding agents (opencode, Claude, Cursor) can grep for exact words - but `semantic-search-mcp` lets them **find code by meaning**. Ask "where do we handle authentication?" and get back `config/auth.php`, `AuthController.php`, `login.blade.php` - even if the word "handle" doesn't appear.

**Powered by:** [`bge-small-en-v1.5`](https://huggingface.co/Xenova/bge-small-en-v1.5) via ONNX runtime. Everything runs **locally**, no data leaves your machine. 80MB, 384-dim, optimized for retrieval.

## Quick Start

### 1. Install

```bash
npm install -g semantic-search-mcp
```

Or run without installing:

```bash
npx semantic-search-mcp
```

### 2. Connect to your AI agent

**opencode** - add to `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "semantic-search": {
      "type": "local",
      "command": ["npx", "-y", "semantic-search-mcp"],
      "enabled": true
    }
  }
}
```

**Claude Desktop** - add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "semantic-search": {
      "command": "npx",
      "args": ["-y", "semantic-search-mcp"]
    }
  }
}
```

### 3. Done!

Restart your AI agent. The first search will index your codebase (~5-15 min depending on size). Subsequent searches are instant (cached).

## Configuration

⚡ **Interactive setup:** `semantic-search-mcp config` - TUI wizard for extensions, model, thresholds.

Or manually create `.semantic-search.json` in your project root:

```json
{
  "extensions": [".php", ".js", ".jsx", ".ts", ".tsx"],
  "skipDirs": ["node_modules", "vendor", ".git", "dist"],
  "model": "Xenova/bge-small-en-v1.5",
  "chunkThreshold": 300,
  "maxChunksPerFile": 4
}
```

Or use environment variables:

```bash
export SEMANTIC_SEARCH_EXTENSIONS=".php,.js,.jsx,.ts,.tsx"
export SEMANTIC_SEARCH_SKIPDIRS="node_modules,vendor"
export SEMANTIC_SEARCH_MODEL="Xenova/bge-small-en-v1.5"
```

### All config options

| Key | Default | Description |
|-----|---------|-------------|
| `extensions` | `[".php", ".js", ".jsx", ".ts", ".tsx", ".vue", ".py", ".rb", ".go", ".rs", ".java", ".cs", ...]` | File extensions to index |
| `skipDirs` | `["node_modules", "vendor", ".git", "dist", "build", ...]` | Directories to skip |
| `model` | `"Xenova/bge-small-en-v1.5"` | HuggingFace model (smaller=faster, larger=more accurate) |
| `cacheDir` | `".opencode/mcp-cache/semantic-search"` | Where to store the index (relative to workspace) |
| `chunkThreshold` | `300` | Lines above which to split files into chunks |
| `maxChunksPerFile` | `4` | Max chunks per large file |
| `maxResults` | `50` | Maximum search results |
| `defaultLimit` | `10` | Default number of results |

### Alternative models

| Model | Size | Dims | Speed | Quality |
|-------|------|------|-------|---------|
| `Xenova/bge-small-en-v1.5` | 80MB | 384 | Fast | Best retrieval |
| `Xenova/all-MiniLM-L6-v2` | 80MB | 384 | Fast | Good |
| `Xenova/all-mpnet-base-v2` | 420MB | 768 | Medium | Better |
| `Xenova/multi-qa-MiniLM-L6-cos-v1` | 80MB | 384 | Fast | Better for QA |

## CLI Commands

```bash
# Start the MCP server (default - for AI agents to connect)
semantic-search-mcp

# Interactive TUI config wizard
semantic-search-mcp config

# Print config snippets for your AI agent
semantic-search-mcp init

# Pre-build the index (optional, happens automatically on first use)
semantic-search-mcp index

# Clear the index cache
semantic-search-mcp clean

# Help
semantic-search-mcp --help
```

## How It Works

1. **Walk the workspace** - find all code files matching the configured extensions
2. **Chunk files** - split large files into manageable pieces (default: 300 lines per chunk, max 4 per file)
3. **Embed with ONNX** - run each chunk through [`bge-small-en-v1.5`](https://huggingface.co/Xenova/bge-small-en-v1.5) locally (384-dimensional vectors)
4. **Cache** - save the index to disk for instant restarts
5. **Search** - embed the query, compute cosine similarity against all chunks, return top matches

Everything runs on your machine. No API calls, no telemetry, no data leaves your computer.

## Score Interpretation

| Score | Meaning |
|-------|---------|
| 0.7+ | Very strong match - almost certainly what you're looking for |
| 0.5-0.7 | Strong match - likely relevant |
| 0.3-0.5 | Moderate match - tangentially related |
| <0.3 | Weak match - may be noise |

## Supported Languages

The default config indexes files with these extensions:
`.php`, `.js`, `.jsx`, `.ts`, `.tsx`, `.vue`, `.py`, `.rb`, `.go`, `.rs`, `.java`, `.cs`, `.swift`, `.kt`, `.css`, `.scss`, `.less`, `.blade.php`, `.mjs`, `.cjs`

Customize via `.semantic-search.json` or `SEMANTIC_SEARCH_EXTENSIONS` env var.

## Requirements

- Node.js >= 18.0.0
- ~80MB disk for the embedding model (first run)
- ~50-100MB disk for the index cache (varies by project size)

## License

MIT

## Related

- [Cursor's semantic search blog](https://cursor.com/blog/semsearch) - 12.5% better accuracy with semantic search
- [sturdy-dev/semantic-code-search](https://github.com/sturdy-dev/semantic-code-search) - Python CLI, per-function embeddings
- [@xenova/transformers](https://github.com/xenova/transformers) - ONNX models in JavaScript
