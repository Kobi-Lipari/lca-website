// test/unit/mail-worker-closure.test.ts
//
// What WS16 step 1 does to the daily-emails worker. Its deploy runs on any
// change under functions/utils/ or domain/, so the merge redeploys it, and
// this time its bundle grows: the worker sends through
// functions/utils/email.ts and functions/utils/admin/campaigns.ts, which
// now hand every message to the seam. This walks the worker's imports
// from its entry, workers/daily-emails/src/index.ts, file by file, as its
// bundler would, types included, relative imports followed and anything
// else recorded as a package, the walk test/unit/published-review-closure.test.ts
// makes, and holds that the seam's five files and domain/mail/addresses.ts
// are in it, that it names no package anywhere, and that it reaches nothing
// under functions/api or domain/contracts and none of the six files the two
// earlier closure tests keep out of the worker. Those two tests,
// test/unit/search-worker-closure.test.ts and
// test/unit/published-review-closure.test.ts, are not changed. Since WS16
// step 7 the seam holds Amazon SES's transport, functions/utils/mail/ses.ts,
// and its signer, functions/utils/mail/sigv4.ts, Web Crypto alone, so the
// worker's closure holds both, still with no package. The worker receives
// nothing: the receiver of Amazon's reports (WS16 step 8), its endpoint
// functions/api/mail/ses-events.ts, the check of SNS's signature
// functions/utils/mail/sns.ts and the code that applies a report
// functions/utils/mail/sesEvents.ts, stays out of its closure, so its
// upload does not grow by them.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const ENTRY = 'workers/daily-emails/src/index.ts'

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

/** The seam: deliver(), the two transports and Amazon SES's signer, the switches, the rules that read them and the answer's kinds. */
const SEAM = ['send', 'resend', 'ses', 'sigv4', 'switches', 'rules', 'outcome'].map((name) => `functions/utils/mail/${name}.ts`)
const ADDRESSES = 'domain/mail/addresses.ts'
/** The files the two earlier closure tests keep out of the worker: the sign-in client and what reaches it, the answer helpers, the audit log, the tickets and the creation rules. */
const KEPT_OUT = [
  'functions/utils/admin/members.ts', 'functions/utils/supabase.ts', 'functions/utils/response.ts', 'functions/utils/admin/audit.ts',
  'functions/utils/admin/tickets.ts', 'functions/utils/events/creation.ts',
]

describe('the daily-emails worker\'s imports, with the seam', () => {
  const { files, packages, missing } = closure(ENTRY)

  it('are all found, so the walk below is not blind, and reach the two senders the worker has always used', () => {
    expect(missing).toEqual([])
    for (const file of [ENTRY, 'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/emailLayout.ts']) expect([...files], file).toContain(file)
  })

  it('hold the seam\'s seven files and the addresses, each a file of the tree', () => {
    for (const file of [...SEAM, ADDRESSES]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).toContain(file)
    }
  })

  it('name no package anywhere, so the worker bundles the seam as it bundles the rest', () => {
    expect(packages).toEqual([])
  })

  it('reach nothing under functions/api, where the endpoints live, and nothing of the contracts, which carry zod', () => {
    expect([...files].filter((file) => file.startsWith('functions/api/') || file.startsWith('domain/contracts/'))).toEqual([])
  })

  it('reach none of the six files the earlier closure tests keep out of the worker', () => {
    for (const file of KEPT_OUT) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })

  it('reach none of the receiver of Amazon\'s reports, which the worker never runs: its endpoint, the check of SNS\'s signature and the code that applies a report', () => {
    const receiver = ['functions/api/mail/ses-events.ts', 'functions/utils/mail/sns.ts', 'functions/utils/mail/sesEvents.ts']
    for (const file of receiver) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
    expect([...files].filter((file) => file.startsWith('functions/api/mail/'))).toEqual([])
    // The walk does find the receiver's own imports from its endpoint, so the case above is not blind.
    const { files: endpoint } = closure('functions/api/mail/ses-events.ts')
    for (const file of ['functions/utils/mail/sns.ts', 'functions/utils/mail/sesEvents.ts', 'functions/utils/mail/ses.ts']) expect([...endpoint], file).toContain(file)
  })
})

describe('the seam\'s own files', () => {
  it('import relative files only, each inside functions/utils/mail or domain/mail', () => {
    for (const file of [...SEAM, ADDRESSES]) {
      for (const specifier of specifiersOf(file)) {
        expect(specifier.startsWith('.'), `${file}: ${specifier}`).toBe(true)
        expect(resolveImport(file, specifier), `${file}: ${specifier}`).toMatch(/^(?:functions\/utils\/mail|domain\/mail)\//)
      }
    }
    expect(specifiersOf(ADDRESSES)).toEqual([])
    // The signer is Web Crypto alone: it imports nothing at all.
    expect(specifiersOf('functions/utils/mail/sigv4.ts')).toEqual([])
  })

  it('the walk that says so does find a package where one is named', () => {
    const { packages } = closure('functions/utils/admin/members.ts')
    expect(packages).toContain('functions/utils/supabase.ts: @supabase/supabase-js')
  })
})
