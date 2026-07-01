/**
 * Function-level code extraction using regex boundary detection.
 * Splits files at function/class/method declarations for better embeddings.
 * Falls back to line-based chunking when no boundaries found.
 */
import { relative } from 'node:path';
import { loadConfig } from './config.mjs';

// Regex patterns for function/class boundaries per language
const BOUNDARIES = {
  '.php': /(?:^|\n)\s*(?:(?:public|protected|private|static)\s+)*function\s+\w+\s*\(/gm,
  '.js':  /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:^|\n)\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:^|\n)\s*class\s+\w+/gm,
  '.jsx': /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:^|\n)\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:^|\n)\s*class\s+\w+/gm,
  '.ts':  /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:^|\n)\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:^|\n)\s*class\s+\w+/gm,
  '.tsx': /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:^|\n)\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:^|\n)\s*class\s+\w+/gm,
  '.mjs': /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:^|\n)\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/gm,
  '.vue': /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+\w+|(?:^|\n)\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/gm,
  '.py':  /(?:^|\n)\s*(?:async\s+)?def\s+\w+\s*\(|(?:^|\n)\s*class\s+\w+/gm,
  '.go':  /(?:^|\n)func\s+(?:\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/gm,
  '.rs':  /(?:^|\n)\s*(?:pub\s+)?(?:async\s+)?fn\s+\w+/gm,
  '.java':/(?:^|\n)\s*(?:public|protected|private|static|\s)+[\w<>\[\]]+\s+\w+\s*\(/gm,
};

/**
 * Extract function-level chunks from a file.
 * Falls back to line-based chunking if no boundaries found.
 * @param {string} filePath — absolute path
 * @param {string} content — file content
 * @param {string} workspace — workspace root
 * @returns {Array<{file:string, startLine:number, endLine:number, content:string}>}
 */
export function extractFunctions(filePath, content, workspace) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const pattern = BOUNDARIES[ext];

  if (!pattern) return null; // unsupported language → fall back to line chunking

  const matches = [];
  let m;
  // clone regex to reset state
  const re = new RegExp(pattern.source, pattern.flags);
  while ((m = re.exec(content)) !== null) {
    matches.push({ index: m.index, text: m[0] });
  }

  if (matches.length < 2) return null; // <2 functions → fall back, not worth splitting

  // Split at boundaries
  const lines = content.split('\n');
  const relPath = relative(workspace, filePath).replace(/\\/g, '/');
  const chunks = [];

  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : content.length;

    // Convert byte indices to line numbers
    const startLine = content.slice(0, startIdx).split('\n').length;
    const endLine = content.slice(0, endIdx).split('\n').length;

    // Extract segment
    const segment = content.slice(startIdx, endIdx).trim();
    // max 200 lines per chunk (keep it focused)
    const segmentLines = segment.split('\n');
    const capped = segmentLines.slice(0, 200).join('\n');

    if (capped.length < 15) continue; // skip tiny fragments

    chunks.push({
      file: relPath,
      startLine,
      endLine: Math.min(endLine, startLine + 200),
      content: capped,
    });
  }

  return chunks.length > 1 ? chunks : null;
}
