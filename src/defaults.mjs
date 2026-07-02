/**
 * Built-in defaults for semantic-search-mcp.
 * Users override via .semantic-search.json or env vars.
 */
export const DEFAULTS = {
  /** HuggingFace model for embeddings (small=fast, large=accurate) */
  model: 'Xenova/bge-small-en-v1.5',

  /** File extensions to index */
  extensions: [
    '.php', '.js', '.jsx', '.ts', '.tsx', '.vue',
    '.py', '.rb', '.go', '.rs', '.java', '.cs',
    '.swift', '.kt', '.css', '.scss', '.less',
    '.blade.php', '.mjs', '.cjs',
  ],

  /** Directory names to skip (case-insensitive check) */
  skipDirs: [
    'node_modules', 'vendor', '.git', 'dist',
    'build', '.cache', '.turbo', '.next',
    'public', 'storage', 'target', '__pycache__',
    '.venv', 'venv', 'env', 'bower_components',
  ],

  /** Directory for index cache (relative to workspace, gitignore this) */
  cacheDir: '.semantic-search/cache',

  /** Lines above which to split file into chunks */
  chunkThreshold: 300,

  /** Max number of chunks per large file */
  maxChunksPerFile: 4,

  /** Maximum search results */
  maxResults: 50,

  /** Default number of results per search */
  defaultLimit: 10,

  /** Max characters fed to embedding model (model truncates to 256 tokens anyway) */
  maxEmbedChars: 8000,

  /** MCP protocol version */
  mcpProtocolVersion: '2024-11-05',

  /** Server name reported in MCP handshake */
  serverName: 'semantic-search',

  /** Server version */
  serverVersion: '1.0.0',
};
