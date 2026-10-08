// test/unit/routes.ts
// The routes Pages serves from the files under functions/, shared by the
// route audit (api.ts calls a route that exists) and the contract coverage
// test (every endpoint has a contract or is listed as pending).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface RouteFile {
  /** Path segments as file routing names them: ['api', 'tournaments', '[id]']. */
  segments: string[]
  /** Absolute path of the file. */
  file: string
}

/**
 * Every .ts file under dir with the route it serves: index.ts takes its
 * folder's route, .test.ts and .d.ts files are skipped, and nothing else is
 * filtered, so helper folders such as utils/ come back too.
 */
export function collectRouteFiles(dir: string, prefix: string[] = []): RouteFile[] {
  const routes: RouteFile[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      routes.push(...collectRouteFiles(full, [...prefix, entry]))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      const name = entry.replace(/\.ts$/, '')
      routes.push({ segments: name === 'index' ? [...prefix] : [...prefix, name], file: full })
    }
  }
  return routes
}

/** The route segments alone, as the route audit matches them. */
export function collectRoutes(dir: string, prefix: string[] = []): string[][] {
  return collectRouteFiles(dir, prefix).map((r) => r.segments)
}

export const HANDLER_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const
export type HandlerMethod = (typeof HANDLER_METHODS)[number]

/**
 * The methods a handler file exports: onRequestGet is GET, and so on. A bare
 * onRequest, which answers every method, comes back as 'ALL'.
 */
export function exportedMethods(source: string): Array<HandlerMethod | 'ALL'> {
  const found = new Set<HandlerMethod | 'ALL'>()
  // Comments do not export anything, and an export statement starts its line,
  // so an example inside a string does not count either.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const declared = /^\s*export\s+(?:const|let|var|async\s+function|function)\s+onRequest(\w*)\b/gm
  const listed = /^\s*export\s*\{([^}]*)\}/gm
  const add = (suffix: string) => {
    if (suffix === '') found.add('ALL')
    else {
      const method = suffix.toUpperCase()
      if ((HANDLER_METHODS as readonly string[]).includes(method)) found.add(method as HandlerMethod)
    }
  }
  for (const m of code.matchAll(declared)) add(m[1])
  for (const m of code.matchAll(listed)) {
    for (const part of m[1].split(',')) {
      const name = /(?:\bas\s+)?(\w+)\s*$/.exec(part.trim())?.[1] ?? ''
      const handler = /^onRequest(\w*)$/.exec(name)
      if (handler) add(handler[1])
    }
  }
  return [...found]
}

/** exportedMethods for a file on disk. */
export function fileMethods(file: string): Array<HandlerMethod | 'ALL'> {
  return exportedMethods(readFileSync(file, 'utf-8'))
}
