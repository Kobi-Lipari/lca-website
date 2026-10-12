// scripts/check-bundle.ts
//
// Run after `npm run build` (npm run check:bundle). It fails when any file
// the site build wrote under dist/assets carries zod's runtime.
//
// zod belongs to the server: the request and response contracts in
// domain/contracts are zod schemas, and the site may take only their types
// (`import type`), which the compiler erases. One runtime import of a
// contract from a page would put the whole of zod in the browser bundle,
// and nothing else would notice, so this check looks for it in the output.
//
// What it looks for: zod names its error class "ZodError" in a string that
// survives minifying, in zod 3, zod 4 and zod 4 mini alike, and zod 4 keeps
// every schema's definition on the `_zod.def` property, which minifiers do
// not rename. A minified bundle of the smallest zod import carries both
// (test/unit/check-bundle.test.ts builds one and runs this check on it).
//
// Usage (see package.json):
//   node --no-warnings --experimental-strip-types scripts/check-bundle.ts [--dir <folder>]
//
// It only reads files.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Strings zod's runtime always carries, and the site's own code never does. */
export const ZOD_MARKERS = ['ZodError', '_zod.def'] as const

export interface ZodHit {
  /** The file, relative to the folder searched. */
  file: string
  marker: string
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

/** Every file under `dir` that carries a zod marker, with the first marker found. */
export function findZod(dir: string): ZodHit[] {
  const hits: ZodHit[] = []
  for (const path of filesUnder(dir).sort()) {
    const content = readFileSync(path)
    const marker = ZOD_MARKERS.find((m) => content.includes(m))
    if (marker) hits.push({ file: relative(dir, path).split('\\').join('/'), marker })
  }
  return hits
}

function main(): number {
  const argv = process.argv.slice(2)
  const at = argv.indexOf('--dir')
  const dir = at >= 0 ? argv[at + 1] ?? '' : 'dist/assets'
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`Stopped: ${dir || 'no folder given'} is not a folder. Run npm run build first.`)
    return 1
  }
  const hits = findZod(dir)
  if (hits.length > 0) {
    console.error(`zod is in the site bundle (${dir}):`)
    for (const h of hits) console.error(`  - ${h.file} (contains "${h.marker}")`)
    console.error('A page or library imports domain/contracts (or zod) at runtime. Import the contract types with `import type` instead.')
    return 1
  }
  console.log(`No zod in the site bundle: ${filesUnder(dir).length} files in ${dir} checked.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
