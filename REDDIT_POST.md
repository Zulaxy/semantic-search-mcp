# I built semantic code search for opencode — npm package, fully local, 80MB model

Came from Cursor where semantic search is built-in. opencode didn't have it. So I built it.

## What it does

Your AI agent can now search your codebase by **meaning**, not just exact keywords. Ask *"where do I change profile picture?"* and it returns:

```
0.835  edit-profile-picture-drawer.jsx    ← the exact React drawer component
0.798  profile-info-card.jsx              ← profile card with photo handling
0.776  update_picture_type_id migration   ← DB schema
0.756  UsersProfileUserSettingsController.php  ← backend controller
```

On a 6,892 file codebase. In 2 seconds. From cache.

## Install (3 steps)

```bash
# 1. Install
npm i -g semantic-search-mcp

# 2. Index your project (live progress bar)
cd /your-project
semantic-search-mcp index
# ████████████░░░░░░░░ 68% — ~120s remaining

# 3. Add to opencode.json
# {"mcp":{"semantic-search":{"type":"local","command":["semantic-search-mcp"],"enabled":true}}}
# Restart opencode. Done.
```

## Features

- **Per-function extraction** — splits at function/class boundaries (PHP, JS, TS, Python, Go, Rust, Java)
- **Hybrid scoring** — 70% embedding similarity + 30% keyword match
- **100% local** — 80MB model (bge-small-en-v1.5), runs ONNX on your machine, zero API calls
- **TUI config wizard** — `semantic-search-mcp config` — checkboxes for languages, searchable model picker
- **Per-project cache** — `cd project-a && index`, `cd project-b && index` — each gets its own cache
- **Survives restarts** — cache is just a file on disk

## Links

- **npm**: [npmjs.com/package/semantic-search-mcp](https://www.npmjs.com/package/semantic-search-mcp)
- **GitHub**: [github.com/Zulaxy/semantic-search-mcp](https://github.com/Zulaxy/semantic-search-mcp)
- **v1.2.2** — published today
