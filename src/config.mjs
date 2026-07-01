/**
 * Config loader: built-in defaults → project config file → env vars.
 *
 * Load order (later wins):
 *   1. src/defaults.js     — built-in sensible defaults
 *   2. .semantic-search.json (or .js) in workspace  — per-project overrides
 *   3. SEMANTIC_SEARCH_* env vars  — CI/container overrides
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULTS } from './defaults.mjs';

/**
 * Load and merge configuration.
 * @param {string} [workspace] — workspace root (default: process.cwd())
 * @returns {object} merged config
 */
export function loadConfig(workspace) {
  const cwd = workspace || process.cwd();
  let config = { ...DEFAULTS };

  // 1. Project config file
  const fileConfig = loadFileConfig(cwd);
  if (fileConfig) {
    config = deepMerge(config, fileConfig);
  }

  // 2. Environment variables (prefixed with SEMANTIC_SEARCH_)
  const envConfig = loadEnvConfig();
  if (envConfig) {
    config = deepMerge(config, envConfig);
  }

  // Resolve cacheDir relative to workspace
  if (!config.cacheDir.startsWith('/') && !/^[A-Z]:/i.test(config.cacheDir)) {
    config.cacheDir = resolve(cwd, config.cacheDir);
  }

  return config;
}

function loadFileConfig(cwd) {
  const candidates = [
    '.semantic-search.json',
    '.semantic-search.config.json',
    'semantic-search.config.json',
    'semantic-search.config.js',
    '.semantic-search.jsonc',
  ];
  for (const name of candidates) {
    const path = join(cwd, name);
    if (existsSync(path)) {
      try {
        if (name.endsWith('.js')) {
          // Dynamic import for ESM — file must export default or named
          return readJSConfig(path);
        }
        const raw = readFileSync(path, 'utf-8');
        // .jsonc — strip comments
        const cleaned = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        return JSON.parse(cleaned);
      } catch (e) {
        console.error(`[semantic-search] Config error in ${name}: ${e.message}`);
      }
    }
  }
  return null;
}

// JS config files need dynamic import (ESM). Try both import + require-like.
async function readJSConfig(path) {
  try {
    const mod = await import(`file://${path}`);
    return mod.default || mod.config || mod;
  } catch {
    return null;
  }
}

function loadEnvConfig() {
  const prefix = 'SEMANTIC_SEARCH_';
  const config = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix)) continue;
    const configKey = key.slice(prefix.length).toLowerCase();
    config[configKey] = parseEnvValue(value, configKey);
  }

  return Object.keys(config).length ? config : null;
}

function parseEnvValue(value, key) {
  // Comma-separated list → array
  if (['extensions', 'skipdirs'].includes(key)) {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  // Numeric values
  if (['chunkthreshold', 'maxchunksperfile', 'maxresults', 'defaultlimit', 'maxembedchars'].includes(key)) {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }
  // Unicode underscores in keys
  const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (['chunkThreshold', 'maxChunksPerFile', 'maxResults', 'defaultLimit', 'maxEmbedChars'].includes(camel)) {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }
  return value;
}

/** Simple deep merge (objects only, no arrays inside objects). */
function deepMerge(base, overrides) {
  const result = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (Array.isArray(base[key]) && Array.isArray(val)) {
      // For extension/skipDirs — override, not merge
      result[key] = val;
    } else if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key]) && val && typeof val === 'object') {
      result[key] = deepMerge(base[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}
