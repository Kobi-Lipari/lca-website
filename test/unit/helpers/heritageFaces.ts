// test/unit/helpers/heritageFaces.ts
//
// The faces a stylesheet declares, followed the way the build follows them:
// each @import of a package stylesheet is read from node_modules, and each
// url() in a face is resolved to its file, relative to the stylesheet that
// names it, or inside node_modules for a package path. The heritage look's
// budget and glyph tests read the real font files through this, so they
// check what src/styles/themes/heritage.css really names.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { parseRules, ROOT, stripComments } from './cssTokens'

export interface DeclaredFace {
  /** The family, without quotes. */
  family: string
  /** "normal" or "italic". */
  style: string
  /** The unicode-range, or "" when the face has none (it then covers every character). */
  range: string
  /** The woff2 file, as a path from the repository root, or "" for a face of the device's own fonts. */
  woff2: string
  /** Every file the face names, in its order: a browser takes the first format it reads. */
  files: string[]
  /** The faces of the device's own fonts it names (local()). */
  local: string[]
  /** The stylesheet that declares it, as a path from the repository root. */
  from: string
}

/** The path, from the repository root, a url() or @import in `from` points at. */
export function resolveFrom(from: string, target: string): string {
  if (/^\.{1,2}\//.test(target)) return normalize(join(dirname(from), target))
  return normalize(join('node_modules', target))
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, '$2')

/** The stylesheets `css` imports, as paths from the repository root, each with its text. */
export function importsOf(css: string, from: string, readFile = (path: string) => readFileSync(join(ROOT, path), 'utf8')): Array<{ path: string; css: string }> {
  return [...stripComments(css).matchAll(/@import\s+(?:url\()?\s*(['"])([^'"]+)\1\s*\)?\s*;/g)].map((m) => {
    const path = resolveFrom(from, m[2])
    return { path, css: readFile(path) }
  })
}

/** Every face `css` declares, its imports' faces first, as the build puts them. */
export function declaredFaces(css: string, from: string, readFile?: (path: string) => string): DeclaredFace[] {
  const imported = importsOf(css, from, readFile).flatMap((sheet) => declaredFaces(sheet.css, sheet.path, readFile))
  const own = parseRules(css)
    .filter((rule) => rule.selector === '@font-face')
    .map((rule) => {
      const src = rule.decls.get('src') ?? ''
      const files = [...src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => resolveFrom(from, m[2]))
      return {
        family: unquote(rule.decls.get('font-family') ?? ''),
        style: rule.decls.get('font-style') ?? 'normal',
        range: rule.decls.get('unicode-range') ?? '',
        woff2: files.find((file) => file.endsWith('.woff2')) ?? '',
        files,
        local: [...src.matchAll(/local\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]),
        from,
      }
    })
  return [...imported, ...own]
}

/** Whether a file a face names is on disk. */
export const onDisk = (path: string) => existsSync(join(ROOT, path))
