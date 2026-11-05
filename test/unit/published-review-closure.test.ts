// test/unit/published-review-closure.test.ts
//
// What checkpoint K's merge does to the daily-emails worker (WS08 step 6):
// the worker's deploy runs on any change under functions/utils/ or domain/,
// so the merge redeploys it, but it bundles nothing the first part of WS08
// adds or changes there. This walks the worker's imports from its entry,
// workers/daily-emails/src/index.ts, file by file, as its bundler would,
// types included, the walk test/unit/search-worker-closure.test.ts makes,
// and holds that none of the part's server files is among them: the notice,
// functions/utils/events/publishedReview.ts; the database half of the
// creation rules, functions/utils/events/creation.ts; and
// functions/utils/admin/tickets.ts, which exists today and WS08 step 7
// changes; nor the other files checkpoint K changes under those folders, nor
// anything under functions/api or domain/contracts. It also holds
// publishedReview.ts to the five imports it names, and its own walk to files
// a worker can bundle, so the console part's five-minute phase can call it.
//
// The console part rewrites this file: once that phase calls
// sendPublishedReviewNotice, publishedReview.ts and creation.ts join the
// worker's imports, and the lists below change with it. No record test of a
// closed step reads them.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const ENTRY = 'workers/daily-emails/src/index.ts'
const NOTICE = 'functions/utils/events/publishedReview.ts'

/** The specifiers a file names, as its bundler reads them: imports, re-exports and import(), types included. */
const specifiersOf = (file: string) => ts.preProcessFile(readFileSync(join(ROOT, file), 'utf8'), true, true).importedFiles.map((f) => f.fileName)

/** The file a relative import names, as a bundler finds it: the path, with .ts or .tsx, or its folder's index. */
function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate).split('\\').join('/')
  }
  return null
}

/** Every file an entry reaches through relative imports, the packages it names, and the specifiers none of them could find. */
function closure(entry: string): { files: Set<string>; packages: string[]; missing: string[] } {
  const files = new Set<string>()
  const packages: string[] = []
  const missing: string[] = []
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of specifiersOf(file)) {
      if (!specifier.startsWith('.')) {
        packages.push(`${file}: ${specifier}`)
        continue
      }
      const found = resolveImport(file, specifier)
      if (found) queue.push(found)
      else missing.push(`${file}: ${specifier}`)
    }
  }
  return { files, packages, missing }
}

/** The part's server files the worker must not bundle yet: the notice, the creation rules' database half, and the support tickets' helper WS08 step 7 changes. */
const PART_FILES = [NOTICE, 'functions/utils/events/creation.ts', 'functions/utils/admin/tickets.ts']
/** The other files of code checkpoint K changes under the folders the worker's deploy watches. */
const CHECKPOINT_K_SHARED = ['functions/utils/events/sectionsRepo.ts', 'functions/utils/admin/audit.ts', 'domain/events/creation.ts']

describe('the daily-emails worker\'s imports, as checkpoint K leaves them', () => {
  const { files, missing } = closure(ENTRY)

  it('are all found, so the walk below is not blind, and reach the email files the worker has always used', () => {
    expect(missing).toEqual([])
    expect(files.size).toBeGreaterThan(5)
    for (const file of [ENTRY, 'functions/utils/email.ts', 'functions/utils/emailLayout.ts', 'functions/utils/site.ts', 'domain/format/date.ts']) {
      expect([...files], file).toContain(file)
    }
  })

  it('hold none of the part\'s server files: the notice, the creation rules\' database half and the support tickets\' helper', () => {
    for (const file of PART_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })

  it('hold none of the other files checkpoint K changes under functions/utils or domain, so the worker the merge deploys bundles the same code', () => {
    for (const file of CHECKPOINT_K_SHARED) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })

  it('reach nothing under functions/api, where the endpoints live, and nothing of the contracts, which carry zod', () => {
    expect([...files].filter((file) => file.startsWith('functions/api/') || file.startsWith('domain/contracts/'))).toEqual([])
  })
})

describe('the notice\'s own imports, which the console part\'s phase will bundle', () => {
  it('are exactly five: the email transport, its layout, the creation rules\' database half, the site\'s address and the date format', () => {
    expect(specifiersOf(NOTICE)).toEqual(['../email', '../emailLayout', './creation', '../site', '../../../domain/format/date'])
  })

  it('reach only files a worker can bundle: no package, nothing under functions/api or domain/contracts, and none of the files that would bring in the sign-in client or zod', () => {
    const { files, packages, missing } = closure(NOTICE)
    expect(missing).toEqual([])
    expect(packages).toEqual([])
    expect([...files].filter((file) => file.startsWith('functions/api/') || file.startsWith('domain/contracts/'))).toEqual([])
    for (const file of ['functions/utils/admin/members.ts', 'functions/utils/supabase.ts', 'functions/utils/response.ts']) expect([...files], file).not.toContain(file)
    for (const file of ['functions/utils/email.ts', 'functions/utils/emailLayout.ts', 'functions/utils/events/creation.ts', 'functions/utils/site.ts', 'domain/format/date.ts']) {
      expect([...files], file).toContain(file)
    }
  })

  it('the walk that says so does find the sign-in client from functions/utils/admin/members.ts', () => {
    const { files, packages } = closure('functions/utils/admin/members.ts')
    expect([...files]).toContain('functions/utils/supabase.ts')
    expect(packages).toContain('functions/utils/supabase.ts: @supabase/supabase-js')
  })
})
