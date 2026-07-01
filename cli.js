#!/usr/bin/env node

/**
 * semantic-search-mcp CLI
 *
 * Commands:
 *   (none)     Start the MCP server
 *   config     Interactive TUI to set up .semantic-search.json
 *   init       Print opencode config snippet
 *   index      Pre-build the embeddings index
 *   clean      Remove index cache
 *   --help     This message
 *   --version  Print version
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const cmd = process.argv[2];

switch (cmd) {
  case 'config':
    import('./src/config-wizard.mjs').then(m => m.runConfigWizard(process.cwd())).catch(e => { console.error(e.message); process.exit(1); });
    break;

  case 'init':
    printInit();
    break;

  case 'index': {
    const ws = process.argv[3] || process.cwd();
    console.error(`Building index for: ${ws}`);
    indexCommand(ws);
    break;
  }

  case 'clean': {
    const ws = process.argv[4] || process.cwd();
    cleanCommand(ws);
    break;
  }

  case '--help':
  case '-h':
    printHelp();
    break;

  case '--version':
  case '-v': {
    const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf-8'));
    console.log(pkg.version);
    break;
  }

  default:
    if (cmd && cmd.startsWith('-')) {
      console.error(`Unknown flag: ${cmd}`);
      printHelp();
      process.exit(1);
    }
    startServer();
    break;
}

// ─── Commands ────────────────────────────────────────────────────────────────

function startServer() {
  // Import and run the server directly
  import('./src/server.mjs').catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });
}

function printInit() {
  console.log(`
Add this to your opencode.jsonc (project or user-level):
${'─'.repeat(62)}
{
  "mcp": {
    "semantic-search": {
      "type": "local",
      "command": ["npx", "-y", "semantic-search-mcp"],
      "enabled": true
    }
  }
}
${'─'.repeat(62)}

For Claude Desktop, add to claude_desktop_config.json:
{
  "mcpServers": {
    "semantic-search": {
      "command": "npx",
      "args": ["-y", "semantic-search-mcp"]
    }
  }
}

Config file options (create .semantic-search.json in project root):
{
  "extensions": [".php", ".js", ".ts"],
  "skipDirs": ["node_modules", "vendor", ".git"],
  "model": "Xenova/all-MiniLM-L6-v2",
  "chunkThreshold": 300,
  "maxChunksPerFile": 4
}

Env vars (prefix SEMANTIC_SEARCH_):
  SEMANTIC_SEARCH_EXTENSIONS=.php,.js,.ts
  SEMANTIC_SEARCH_SKIPDIRS=node_modules,vendor
  SEMANTIC_SEARCH_MODEL=Xenova/all-MiniLM-L6-v2
`);
}

function indexCommand(ws) {
  // Run server in index-only mode
  const child = spawn(process.execPath, [
    '-e', `
      import('./src/server.mjs').then(() => {
        // Server auto-indexes on notifications/initialized
        // Send init + initialized, wait for indexing, then exit
        const rl = require('readline').createInterface({input:process.stdin});
        process.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\\n');
        process.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\\n');
        process.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/exit'})+'\\n');
      });
    `,
  ], {
    cwd: ws,
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('exit', code => process.exit(code || 0));
}

function cleanCommand(ws) {
  const fs = require('fs');
  const cacheDir = resolve(ws, '.opencode', 'mcp-cache', 'semantic-search');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log(`Cleared cache: ${cacheDir}`);
  } else {
    console.log('No cache found.');
  }
}

function printHelp() {
  console.log(`
semantic-search-mcp — Semantic code search for AI coding agents

USAGE
  semantic-search-mcp [command]

COMMANDS
  (default)    Start the MCP server (for opencode/Claude to connect)
  config       Interactive TUI to set up .semantic-search.json
  init         Print config snippets for opencode / Claude Desktop
  index [dir]  Pre-build embeddings index for a directory
  clean [dir]  Remove index cache

CONFIG
  Run semantic-search-mcp config for interactive setup.
  Or create .semantic-search.json manually:
  https://github.com/Zulaxy/semantic-search-mcp#configuration

EXAMPLES
  semantic-search-mcp          # Start server (for MCP clients)
  semantic-search-mcp config   # Interactive config setup
  semantic-search-mcp init     # Show config snippets
  npx semantic-search-mcp      # Run without installing
`);
}
