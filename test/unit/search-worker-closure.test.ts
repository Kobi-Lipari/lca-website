// test/unit/search-worker-closure.test.ts
//
// What checkpoint G's merge does to the daily-emails worker (WS02 step 9):
// the worker's deploy runs on any change under functions/utils/ or domain/,
// so the merge redeploys it, but it bundles nothing the search adds or
// changes. This walks the worker's imports from its entry,
// workers/daily-emails/src/index.ts, file by file, as its bundler would,
// and holds that none of the search's new files (the listing condition, the
// endpoint and its reads, the normaliser and the contract) and none of the
// shared files the search changed (the JSON answer's helper and the
// contracts' registry and index) is among them, so the worker built after
// the merge is the worker that runs today.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const ENTRY = 'workers/daily-emails/src/index.ts'

/** The file a relative import names, as a bundler finds it: the path, with .ts or .tsx, or its folder's index. */
function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate)
  }
  return null
}

/** Every file the worker's entry reaches through relative imports and re-exports, types included, and the specifiers none of them could find. */
function closure(entry: string): { files: Set<string>; missing: string[] } {
  const files = new Set<string>()
  const missing: string[] = []
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const { fileName } of ts.preProcessFile(readFileSync(join(ROOT, file), 'utf8'), true, true).importedFiles) {
      if (!fileName.startsWith('.')) continue
      const found = resolveImport(file, fileName)
      if (found) queue.push(found)
      else missing.push(`${file}: ${fileName}`)
    }
  }
  return { files, missing }
}

/** The search's new files, and the shared files it changed. */
const SEARCH_FILES = [
  'functions/api/search.ts',
  'functions/utils/search.ts',
  'functions/utils/events/listing.ts',
  'domain/format/searchText.ts',
  'domain/contracts/search.ts',
]
const CHANGED_SHARED = ['functions/utils/response.ts', 'domain/contracts/registry.ts', 'domain/contracts/index.ts']

describe('the daily-emails worker\'s imports', () => {
  const { files, missing } = closure(ENTRY)

  it('are all found, so the walk below is not blind, and reach the Central clock the worker has always used', () => {
    expect(missing).toEqual([])
    expect(files.size).toBeGreaterThan(5)
    for (const file of [ENTRY, 'functions/utils/time.ts', 'functions/utils/email.ts', 'domain/format/centralTime.ts', 'domain/format/date.ts']) expect([...files], file).toContain(file)
  })

  it('hold none of the search\'s new files', () => {
    for (const file of SEARCH_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })

  it('hold none of the shared files the search changed, so the worker the merge deploys bundles the same code', () => {
    for (const file of CHANGED_SHARED) expect([...files], file).not.toContain(file)
  })

  it('reach nothing under functions/api, where the endpoint lives, and nothing of the contracts, which carry zod', () => {
    expect([...files].filter((file) => file.startsWith('functions/api/') || file.startsWith('domain/contracts/'))).toEqual([])
  })
})
