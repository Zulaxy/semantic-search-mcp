#!/usr/bin/env node

/**
 * semantic-search-mcp CLI
 *
 * Commands:
 *   (none)     Start the MCP server
 *   config     Interactive TUI to set up .semantic-search.json
 *   index      Pre-build index with live progress bar
 *   clean      Remove index cache
 *   init       Print opencode config snippet
 *   --help     This message
 *   --version  Print version
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

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
    try {
      const raw = readFileSync(new URL('./package.json', import.meta.url), 'utf-8');
      const pkg = JSON.parse(raw.replace(/^\uFEFF/, ''));
      console.log(pkg.version);
    } catch { console.log('1.1.1'); }
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
  const proc = spawn(process.execPath, [new URL('./src/server.mjs', import.meta.url).pathname], {
    cwd: ws,
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env },
  });

  let buf = '';
  proc.stdout.on('data', c => { buf += c.toString(); });

  function send(m) { proc.stdin.write(JSON.stringify(m) + '\n'); }

  function wait(id, t = 30000) {
    return new Promise((res, rej) => {
      const check = () => {
        for (const line of buf.split('\n')) {
          try { const m = JSON.parse(line.trim()); if (m.id === id) { res(m); return; } } catch {}
        }
        setTimeout(check, 100);
      };
      setTimeout(() => rej(new Error('timeout')), t);
      check();
    });
  }

  function bar(pct, w = 30) {
    const f = Math.round(pct / 100 * w);
    return '[' + '█'.repeat(f) + '░'.repeat(w - f) + ']';
  }

  (async () => {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    await wait(1);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    let lastPct = -1;
    console.log('');
    while (true) {
      await new Promise(r => setTimeout(r, 2000));
      send({ jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'get_status', arguments: {} } });
      try {
        const resp = await wait(99, 5000);
        const s = JSON.parse(resp.result.content[0].text);
        if (s.ready) {
          process.stdout.write(`\r${bar(100)} Done! ${s.chunks} chunks in ${s.elapsed}s.\x1b[K\n`);
          break;
        }
        if (s.pct !== lastPct && s.pct > 0) {
          lastPct = s.pct;
          const eta = s.total ? `${Math.round((s.total - s.progress) / (s.progress / Math.max(s.elapsed, 1)))}s` : '...';
          process.stdout.write(`\r${bar(s.pct)} ${s.pct}% (${s.progress}/${s.total}) — ~${eta}\x1b[K`);
        }
      } catch { /* poll again */ }
    }
    proc.kill();
    console.log('   Add to opencode.jsonc to connect your AI agent.\n');
  })().catch(e => { console.error(e.message); proc.kill(); process.exit(1); });
}

function cleanCommand(ws) {
  const cacheDir = resolve(ws, '.opencode', 'mcp-cache', 'semantic-search');
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
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
  index        Pre-build index with live progress bar (run this first!)
  (default)    Start the MCP server (for opencode/Claude to connect)
  config       Interactive TUI to set up .semantic-search.json
  clean        Remove index cache
  init         Print config snippets for opencode / Claude Desktop

EXAMPLES
  semantic-search-mcp index    # Index current project (first step)
  semantic-search-mcp config   # Interactive config setup
  semantic-search-mcp init     # Show config snippets for your AI agent
`);
}
