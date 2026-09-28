// Lets plain Node (22.6+) run this TypeScript without tsx: resolves
// extensionless relative imports to .ts files and, when CHESS_SHIM=1,
// points `chess.js` at the sandbox shim instead of the npm package.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SHIM = new URL('./chess-shim/src/index.ts', import.meta.url).href;

export async function resolve(spec, ctx, next) {
  if (spec === 'chess.js' && process.env.CHESS_SHIM === '1') {
    return { url: SHIM, shortCircuit: true, format: 'module' };
  }
  if ((spec.startsWith('.') || spec.startsWith('/')) && ctx.parentURL && !path.extname(spec)) {
    const base = spec.startsWith('/') ? spec : path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    for (const cand of [base + '.ts', base + '/index.ts']) {
      if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true, format: 'module' };
    }
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.endsWith('.ts')) return next(url, { ...ctx, format: 'module-typescript' });
  return next(url, ctx);
}
