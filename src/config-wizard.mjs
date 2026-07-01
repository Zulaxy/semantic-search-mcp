/**
 * Interactive TUI config wizard for semantic-search-mcp.
 * Uses @inquirer/prompts for rich terminal UI.
 */
import { checkbox, select, input, number, confirm } from '@inquirer/prompts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from './defaults.mjs';

const MODELS = [
  { name: 'bge-small-en-v1.5 (80MB, 384d) — Best retrieval quality ★', value: 'Xenova/bge-small-en-v1.5' },
  { name: 'all-MiniLM-L6-v2 (80MB, 384d) — Balanced speed/quality', value: 'Xenova/all-MiniLM-L6-v2' },
  { name: 'all-mpnet-base-v2 (420MB, 768d) — Maximum accuracy', value: 'Xenova/all-mpnet-base-v2' },
  { name: 'gte-small (60MB, 384d) — Fastest, retrieval-optimized', value: 'Xenova/gte-small' },
  { name: 'nomic-embed-text-v1 (130MB, 768d) — Good quality/weight ratio', value: 'Xenova/nomic-embed-text-v1' },
];

const ALL_EXTENSIONS = [
  '.php', '.js', '.jsx', '.ts', '.tsx', '.vue',
  '.py', '.rb', '.go', '.rs', '.java', '.cs',
  '.swift', '.kt', '.css', '.scss', '.less',
  '.blade.php', '.mjs', '.cjs',
];

export async function runConfigWizard(workspace) {
  const cwd = workspace || process.cwd();
  const configPath = join(cwd, '.semantic-search.json');

  // Load existing config if any
  let existing = null;
  if (existsSync(configPath)) {
    try { existing = JSON.parse(readFileSync(configPath, 'utf-8')); } catch {}
  }

  console.log('\n🔧 semantic-search-mcp — Config Wizard\n');
  if (existing) console.log('Found existing .semantic-search.json — values shown as defaults.\n');

  // 1. Extensions
  const currentExts = existing?.extensions || DEFAULTS.extensions;
  const extChoices = ALL_EXTENSIONS.map(e => ({
    name: e,
    value: e,
    checked: currentExts.includes(e),
  }));

  const extensions = await checkbox({
    message: 'Select file extensions to index:',
    choices: extChoices,
    pageSize: 10,
    instructions: '(space to toggle, enter to confirm)',
  });

  // 2. Skip dirs
  const currentSkips = existing?.skipDirs || DEFAULTS.skipDirs;
  const skipDirs = await input({
    message: 'Directories to skip (comma-separated):',
    default: currentSkips.join(', '),
    validate: v => v.trim().length > 0 || 'At least one directory required',
  });

  // 3. Model
  const currentModel = existing?.model || DEFAULTS.model;
  const modelIdx = MODELS.findIndex(m => m.value === currentModel);
  const model = await select({
    message: 'Embedding model:',
    choices: MODELS,
    default: modelIdx >= 0 ? modelIdx : 0,
    pageSize: 8,
  });

  // 4. Chunk threshold
  const currentThreshold = existing?.chunkThreshold ?? DEFAULTS.chunkThreshold;
  const chunkThreshold = await number({
    message: 'Chunk threshold (lines before splitting file):',
    default: currentThreshold,
    min: 50,
    max: 2000,
  });

  // 5. Default limit
  const currentLimit = existing?.defaultLimit ?? DEFAULTS.defaultLimit;
  const defaultLimit = await number({
    message: 'Default search results per query:',
    default: currentLimit,
    min: 1,
    max: 50,
  });

  // 6. Max chunks
  const currentMax = existing?.maxChunksPerFile ?? DEFAULTS.maxChunksPerFile;
  const maxChunksPerFile = await number({
    message: 'Max chunks per large file:',
    default: currentMax,
    min: 1,
    max: 10,
  });

  // Build config
  const config = {
    extensions,
    skipDirs: skipDirs.split(',').map(s => s.trim()).filter(Boolean),
    model,
    chunkThreshold,
    defaultLimit,
    maxChunksPerFile,
  };

  // Preview
  console.log('\n──────────────────────────────────────────');
  console.log(JSON.stringify(config, null, 2));
  console.log('──────────────────────────────────────────\n');

  const save = await confirm({
    message: `Save to ${configPath}?`,
    default: true,
  });

  if (save) {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ Saved to ${configPath}\n`);
    console.log('Restart your AI agent for changes to take effect.');
  } else {
    console.log('\n❌ Discarded. No changes made.\n');
  }
}
