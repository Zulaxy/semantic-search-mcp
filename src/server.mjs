/**
 * semantic-search-mcp — MCP server
 *
 * Protocol: MCP over stdio (JSON-RPC 2.0)
 * Config: src/defaults.js → .semantic-search.json → SEMANTIC_SEARCH_* env
 */
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pipeline, env } from '@xenova/transformers';
import { loadConfig } from './config.mjs';
import { extractFunctions } from './extractor.mjs';

// ─── Bootstrap config ───────────────────────────────────────────────────────

const config = loadConfig(process.cwd());
const WORKSPACE = process.cwd();
const CACHE_FILE = join(config.cacheDir, 'index.json');
const MODEL_CACHE_DIR = join(config.cacheDir, 'models');
const EXTENSIONS = new Set(config.extensions.map(e => e.toLowerCase()));
const SKIP_DIRS = new Set(config.skipDirs.map(d => d.toLowerCase()));

// ─── State ───────────────────────────────────────────────────────────────────

let index = null;
let indexReadyPromise = null;
let indexReadyResolve = null;
let indexStartTime = null;

// Progress tracking for status reports
let status = { stage: 'starting', progress: 0, total: 0, files: 0, chunks: 0 };

// ─── Embedding Engine (singleton) ────────────────────────────────────────────

let embedder = null;
let embedderPromise = null;

async function getEmbedder() {
  if (embedder) return embedder;
  if (!embedderPromise) {
    embedderPromise = (async () => {
      env.localModelPath = MODEL_CACHE_DIR;
      console.error(`[${config.serverName}] Loading ${config.model}...`);
      embedder = await pipeline('feature-extraction', config.model, { quantized: true });
      console.error(`[${config.serverName}] Model loaded.`);
      return embedder;
    })();
  }
  return embedderPromise;
}

async function embedText(text) {
  const pipe = await getEmbedder();
  const truncated = text.length > config.maxEmbedChars ? text.slice(0, config.maxEmbedChars) : text;
  const result = await pipe(truncated, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Simple keyword match score (0-1). Catches exact terms the embedding might miss. */
function keywordScore(text, query) {
  const qTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const txt = text.toLowerCase();
  let score = 0;
  for (const term of qTerms) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = txt.match(new RegExp(safe, 'g'));
    if (matches) score += Math.min(matches.length, 5);
  }
  return Math.min(score / (qTerms.length * 3), 1);
}

/** Blend embedding similarity (70%) + keyword match (30%) */
function hybridScore(chunk, query, embedScore) {
  if (!chunk.content) return embedScore;
  const kw = keywordScore(chunk.content, query);
  return 0.7 * embedScore + 0.3 * kw;
}

/** Build embedding-ready text with file path context */
function embedContent(chunk) {
  return `File: ${chunk.file}, lines ${chunk.startLine}-${chunk.endLine}\n${chunk.content}`;
}

async function searchIndex(query, limit, pathFilter) {
  const qEmb = await embedText(query);
  const scored = [];
  for (const chunk of index) {
    if (pathFilter && !chunk.file.startsWith(pathFilter.replace(/\\/g, '/'))) continue;
    const embedScore = cosineSimilarity(qEmb, chunk.embedding);
    scored.push({ ...chunk, score: hybridScore(chunk, query, embedScore) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(limit, config.maxResults)).map(c => ({
    file: c.file, line: c.startLine,
    snippet: c.content.slice(0, 300),
    score: Math.round(c.score * 1000) / 1000,
  }));
}

// ─── File Discovery ──────────────────────────────────────────────────────────

function isIndexable(name) {
  const lower = name.toLowerCase();
  for (const ext of EXTENSIONS) { if (lower.endsWith(ext)) return true; }
  return false;
}

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name.toLowerCase());
}

async function walkDir(dir) {
  const files = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) { files.push(...await walkDir(fp)); }
    } else if (entry.isFile() && isIndexable(entry.name)) {
      files.push(fp);
    }
  }
  return files;
}

function chunkContent(filePath, content) {
  const relPath = relative(WORKSPACE, filePath).replace(/\\/g, '/');
  const lines = content.split('\n');
  const total = lines.length;
  if (total <= config.chunkThreshold) {
    return [{ file: relPath, startLine: 1, endLine: total, content }];
  }
  const numChunks = Math.min(config.maxChunksPerFile, Math.ceil(total / config.chunkThreshold));
  const size = Math.ceil(total / numChunks);
  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const s = i * size, e = Math.min(s + size, total);
    chunks.push({ file: relPath, startLine: s + 1, endLine: e, content: lines.slice(s, e).join('\n') });
  }
  return chunks;
}

// ─── Index ───────────────────────────────────────────────────────────────────

async function buildIndex() {
  indexStartTime = Date.now();
  status = { stage: 'indexing', progress: 0, total: 0, files: 0, chunks: 0 };
  console.error(`[${config.serverName}] First run: indexing codebase. This is one-time ~10-15 min.`);
  console.error(`[${config.serverName}] Scanning workspace...`);
  const files = await walkDir(WORKSPACE);
  status.files = files.length;
  console.error(`[${config.serverName}] Found ${files.length} indexable files.`);

  const allChunks = [];
  for (const fp of files) {
    try {
      const c = readFileSync(fp, 'utf-8');
      if (c.length < 10) continue;
      const extracted = extractFunctions(fp, c, WORKSPACE);
      if (extracted) allChunks.push(...extracted);
      else allChunks.push(...chunkContent(fp, c));
    } catch {}
  }
  status.chunks = allChunks.length;
  status.total = allChunks.length;
  console.error(`[${config.serverName}] Generated ${allChunks.length} chunks. Computing embeddings...`);

  const BATCH_SIZE = 10;
  const indexed = [];

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const embs = await Promise.all(batch.map(c => embedText(embedContent(c))));
    for (let j = 0; j < batch.length; j++) indexed.push({ ...batch[j], embedding: embs[j] });
    const done = Math.min(i + BATCH_SIZE, allChunks.length);
    status.progress = done;
    if (done % 100 === 0 || done >= allChunks.length) {
      const elapsed = (Date.now() - indexStartTime) / 1000;
      const rate = done / elapsed;
      const remaining = Math.round((allChunks.length - done) / rate);
      console.error(`[${config.serverName}]  ${Math.round(done/allChunks.length*100)}% (${done}/${allChunks.length}) — ~${remaining}s remaining`);
    }
  }
  saveCache(indexed);
  console.error(`[${config.serverName}] Indexing complete: ${indexed.length} chunks in ${Math.round((Date.now()-indexStartTime)/1000)}s.`);
  status = { stage: 'ready', progress: indexed.length, total: indexed.length, files: files.length, chunks: indexed.length };
  return indexed;
}

function saveCache(data) {
  try {
    if (!existsSync(config.cacheDir)) mkdirSync(config.cacheDir, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error(`[${config.serverName}] Cache save failed: ${e.message}`);
  }
}

function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return null;
    console.error(`[${config.serverName}] Loaded ${data.length} chunks from cache.`);
    return data;
  } catch {
    console.error(`[${config.serverName}] Cache corrupt, will re-index.`);
    return null;
  }
}

// ─── MCP Protocol ────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

function send(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

async function handleMessage(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return send(id, {
        protocolVersion: config.mcpProtocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: config.serverName, version: config.serverVersion },
      });

    case 'notifications/initialized':
      return startIndexing();

    case 'notifications/exit':
      process.exit(0);
      return;

    case 'tools/list':
      return send(id, {
        tools: [
          {
            name: 'semantic_search',
            description: 'Search the codebase by semantic meaning. Finds relevant code even when exact keywords differ.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Natural-language query' },
                limit: { type: 'number', description: `Max results (default ${config.defaultLimit}, max ${config.maxResults})`, default: config.defaultLimit },
                path: { type: 'string', description: 'Optional subdirectory filter' },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_status',
            description: 'Check if the server is ready. Returns indexing progress, files count, elapsed time.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      });

    case 'tools/call': {
      const { name, arguments: args } = params || {};

      if (name === 'get_status') {
        const elapsed = indexStartTime ? Math.round((Date.now() - indexStartTime) / 1000) : 0;
        return send(id, {
          content: [{ type: 'text', text: JSON.stringify({
            stage: status.stage,
            progress: status.progress,
            total: status.total,
            pct: status.total ? Math.round(status.progress / status.total * 100) : 0,
            files: status.files,
            chunks: status.chunks,
            elapsed,
            ready: status.stage === 'ready',
            model: config.model,
          }, null, 2) }],
        });
      }

      if (name !== 'semantic_search') {
        return send(id, { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true });
      }
      if (indexReadyPromise) await indexReadyPromise;
      if (!index || index.length === 0) {
        return send(id, { content: [{ type: 'text', text: JSON.stringify({ error: 'Indexing in progress. Try again shortly.', results: [] }) }] });
      }
      try {
        const query = (args?.query || '').trim();
        if (!query) return send(id, { content: [{ type: 'text', text: 'Error: query is required' }], isError: true });
        const results = await searchIndex(query, Math.min(args?.limit || config.defaultLimit, config.maxResults), args?.path || null);
        send(id, { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] });
      } catch (e) {
        send(id, { content: [{ type: 'text', text: `Search error: ${e.message}` }], isError: true });
      }
      return;
    }

    default:
      if (id != null) send(id, { content: [{ type: 'text', text: `Unknown: ${method}` }], isError: true });
  }
}

// ─── Index Initialization ────────────────────────────────────────────────────

function startIndexing() {
  if (indexReadyPromise) return;
  status = { stage: 'starting', progress: 0, total: 0, files: 0, chunks: 0 };
  indexReadyPromise = new Promise(res => { indexReadyResolve = res; });
  const cached = loadCache();
  if (cached) {
    index = cached;
    status = { stage: 'ready', progress: index.length, total: index.length, files: index.length, chunks: index.length };
    console.error(`[${config.serverName}] Ready. ${index.length} chunks cached.`);
    if (indexReadyResolve) indexReadyResolve();
    return;
  }
  console.error(`[${config.serverName}] First run: downloading model (~80MB) + indexing. One-time setup.`);
  console.error(`[${config.serverName}] Model: ${config.model}`);
  console.error(`[${config.serverName}] Extensions: ${config.extensions.join(' ')}`);
  (async () => {
    try { index = await buildIndex(); } catch (e) { console.error(`[${config.serverName}] Error: ${e.message}`); index = []; status.stage = 'error'; }
    if (indexReadyResolve) indexReadyResolve();
  })();
}

// ─── Entry ───────────────────────────────────────────────────────────────────

console.error(`[${config.serverName}] Server starting (workspace: ${WORKSPACE})`);
console.error(`[${config.serverName}] Config: model=${config.model}, extensions=${config.extensions.join(',')}`);
console.error(`[${config.serverName}] Cache: ${config.cacheDir}`);

rl.on('line', async (line) => {
  try { await handleMessage(JSON.parse(line)); } catch (e) { console.error(`[${config.serverName}] Protocol error: ${e.message}`); }
});
rl.on('close', () => process.exit(0));
