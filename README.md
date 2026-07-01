# semantic-search-mcp

> Semantic code search for AI coding agents. Local embeddings. No API keys. No data leaves your machine.

[![npm version](https://img.shields.io/npm/v/semantic-search-mcp)](https://www.npmjs.com/package/semantic-search-mcp)
[![node](https://img.shields.io/node/v/semantic-search-mcp)](https://nodejs.org)

Your AI agent (opencode, Claude) can grep for exact words - but `semantic-search-mcp` lets it **find code by meaning**. Ask *"where do we handle authentication?"* and it returns `auth.controller.ts`, `login.component.jsx`, `auth.config.php` - even if the word "handle" doesn't appear in any of them.

**80MB model. Runs 100% locally. Powered by [`bge-small-en-v1.5`](https://huggingface.co/Xenova/bge-small-en-v1.5).**

### Grep vs. Semantic Search

On a 6,900-file codebase:

| Query | Grep | semantic-search-mcp |
|-------|------|---------------------|
| "where users upload avatars" | 30+ results, unsorted, mixed noise | 5 ranked, best match first (0.835) |
| "how error logs are sent" | 0 results (no file contains "sent" + "logs") | 5 results across handlers, mailers, config |
| "scheduled task for cleanup" | 2 results (only exact matches) | 5 results - cron jobs, queues, commands |
| **Time** | ~30s searching + scanning | **2 seconds** from cache |

---

## Quick Start (3 steps)

### 1. Install

```bash
npm install -g semantic-search-mcp
```

### 2. Index your project

```bash
cd /path/to/your-project
semantic-search-mcp index
```

The folder you run this from gets indexed. Shows live progress:

```
████████████████░░░░░░ 70% (5200/7368) - ~120s remaining
██████████████████████ Done! 7368 chunks in 726s.
```

First run downloads the model (~80MB, one-time) + indexes your code (5-15 min depending on project size). After that, the cache is saved and restarts are instant.

**Multiple projects?** Run `cd /project-a && semantic-search-mcp index`, then `cd /project-b && semantic-search-mcp index`. Each project gets its own cache automatically.

### 3. Connect your AI agent

Add this to your `opencode.json` (or `opencode.jsonc`) in the project root:

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

**Claude Code (CLI)** - add `.mcp.json` to your project root:

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

**Claude Code (CLI)** - add `.mcp.json` to your project root:

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

Restart your AI agent. Done. Searches are instant - cache was already built.

---

## FAQ

### Which folder gets indexed?

The folder you `cd` into before running `semantic-search-mcp index`. It's your current working directory. When opencode or Claude starts the MCP server, that same folder gets used automatically.

### I have 3 projects. Do I index each one?

Yes. Each project has its own cache:

```
project-a/.opencode/mcp-cache/semantic-search/index.json
project-b/.opencode/mcp-cache/semantic-search/index.json
project-c/.opencode/mcp-cache/semantic-search/index.json
```

### Where is the cache stored?

`{your-project}/.opencode/mcp-cache/semantic-search/index.json`

About 50-100MB per project. Survives PC restarts, Git pulls, everything. It's just files on disk. Only cleared if you run `semantic-search-mcp clean`.

### How do I remove the cache?

```bash
semantic-search-mcp clean
```

### Do I need to re-index after code changes?

No. But if you add many new files or want fresh results: `semantic-search-mcp clean && semantic-search-mcp index`.

### What model does it use?

`Xenova/bge-small-en-v1.5` by default (80MB, 384-dim, retrieval-optimized). You can switch models via `semantic-search-mcp config`.

### Is my code sent anywhere?

No. Everything runs on your machine - model, embeddings, search. Zero network calls after model download.

---

## CLI Commands

```bash
semantic-search-mcp index    # Index current folder (live progress bar)
semantic-search-mcp config   # Interactive TUI to pick extensions, model, thresholds
semantic-search-mcp clean    # Remove index cache
semantic-search-mcp init     # Print opencode/Claude config snippet
semantic-search-mcp           # Start the MCP server (used by AI agents)
semantic-search-mcp --help   # All commands
```

## Configuration

Run `semantic-search-mcp config` for interactive setup (checkboxes for extensions, searchable model picker, number inputs).

Or create `.semantic-search.json` in your project root:

```json
{
  "extensions": [".php", ".js", ".jsx", ".ts", ".tsx"],
  "skipDirs": ["node_modules", "vendor", ".git", "dist"],
  "model": "Xenova/bge-small-en-v1.5",
  "chunkThreshold": 300,
  "maxChunksPerFile": 4
}
```

Or env vars: `SEMANTIC_SEARCH_EXTENSIONS=.php,.js`, `SEMANTIC_SEARCH_MODEL=Xenova/bge-small-en-v1.5`

### All options

| Key | Default | |
|-----|---------|---|
| `extensions` | 20+ code extensions | File types to index |
| `skipDirs` | node_modules, vendor, .git, ... | Directories to skip |
| `model` | Xenova/bge-small-en-v1.5 | HuggingFace embedding model |
| `cacheDir` | .opencode/mcp-cache/semantic-search | Where cache is stored (per project) |
| `chunkThreshold` | 300 | Lines before splitting file |
| `maxChunksPerFile` | 4 | Max chunks per large file |
| `maxResults` | 50 | Max search results |
| `defaultLimit` | 10 | Default results per query |

## How It Works

1. **Scan** - walk your project, find code files
2. **Extract** - split at function/class boundaries (PHP, JS, TS, Python, Go, Rust, Java)
3. **Embed** - run each chunk through a local ONNX model (384-dim vectors)
4. **Cache** - save everything to disk
5. **Search** - embed your query, find closest matches via cosine similarity

## License

MIT
