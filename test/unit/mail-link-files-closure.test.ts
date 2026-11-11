// test/unit/mail-link-files-closure.test.ts
//
// What the daily-emails worker reaches of the files that sign links and
// build the footer, and what it still never reaches. WS16 step 3 kept all of
// them out, since the worker only checked the headers a message carries.
// Since WS16 step 4 the five-minute sweep sends list campaigns through
// functions/utils/admin/campaigns.ts, which signs each person's links and
// builds their footer, so the worker's bundle takes the link signer, the
// footer and the footer's words, and names the link key where it is read.
// It still takes no package and nothing under functions/api or
// domain/contracts, and it still never reaches the newsletter's audience
// and its writes (functions/utils/mail/lists.ts), what the two link
// endpoints share, what the newsletter's three admin endpoints share, or
// any of those endpoints. test/unit/mail-worker-closure.test.ts holds the
// seam's own files and the six files the earlier closure tests keep out;
// this holds the rest, by the same walk from the worker's entry.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const ENTRY = 'workers/daily-emails/src/index.ts'

const specifiersOf = (file: string) => ts.preProcessFile(readFileSync(join(ROOT, file), 'utf8'), true, true).importedFiles.map((f) => f.fileName)

function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate).split('\\').join('/')
  }
  return null
}

function closure(entry: string): { files: Set<string>; packages: string[] } {
  const files = new Set<string>()
  const packages: string[] = []
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
    }
  }
  return { files, packages }
}

/** Code with its comments taken out, so a file is held to what it runs. */
const codeOf = (file: string) => readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** The list path's files, which the worker reaches since WS16 step 4: the link signer, the footer and the footer's words. */
const LIST_PATH = ['functions/utils/mail/links.ts', 'functions/utils/mail/footer.ts', 'domain/mail/footer.ts']

/** The files the worker still never reaches: the newsletter's audience and writes, the endpoints and what they share. */
const KEPT_OUT = [
  'functions/utils/mail/lists.ts',
  'functions/utils/mail/linkAnswers.ts',
  'functions/utils/mail/newsletterAnswers.ts',
  'functions/api/mail/unsubscribe/[token].ts',
  'functions/api/mail/preferences/[token].ts',
  'functions/api/admin/mail/newsletter.ts',
  'functions/api/admin/mail/newsletter/test.ts',
  'functions/api/admin/mail/newsletter/stop.ts',
  'domain/contracts/mail.ts',
]

/** The seam's files and the gate, which check the headers a message carries and never build them. */
const SEAM = ['send', 'resend', 'switches', 'rules', 'outcome', 'gate'].map((name) => `functions/utils/mail/${name}.ts`)

describe('the daily-emails worker and the files of the signed links', () => {
  const { files, packages } = closure(ENTRY)

  it('reaches the list path\'s files through the campaign sender, and still no package and nothing under functions/api or domain/contracts', () => {
    for (const file of [...LIST_PATH, 'functions/utils/admin/campaigns.ts', ...SEAM]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).toContain(file)
    }
    expect(packages).toEqual([])
    expect([...files].filter((file) => file.startsWith('functions/api/') || file.startsWith('domain/contracts/'))).toEqual([])
  })

  it('never reaches the newsletter\'s audience and writes, what the endpoints share, or the endpoints', () => {
    for (const file of KEPT_OUT) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })

  it('names the links\' key only where the list path reads it and in the worker\'s own Env, and builds links only in the list path\'s files', () => {
    const naming = [...files].filter((file) => /MAIL_LINK_SECRET/.test(codeOf(file))).sort()
    expect(naming).toEqual(['functions/utils/admin/campaigns.ts', 'functions/utils/mail/footer.ts', 'workers/daily-emails/src/index.ts'])
    const building = [...files].filter((file) => /\bsignLink\b|\blistMailParts\b|\blinkKeyCheck\b/.test(codeOf(file))).sort()
    expect(building).toEqual(['functions/utils/admin/campaigns.ts', 'functions/utils/mail/footer.ts', 'functions/utils/mail/links.ts'])
    // The seam and the gate only check the headers a message carries.
    for (const file of SEAM) expect(codeOf(file), file).not.toMatch(/MAIL_LINK_SECRET|\bsignLink\b|\blistMailParts\b|\blinkKeyCheck\b/)
  })

  it('has the list path\'s files import, outside functions/utils/mail and domain/mail, only the site\'s address helper and the layout, which the worker bundled before', () => {
    const outside: string[] = []
    for (const file of LIST_PATH) {
      for (const specifier of specifiersOf(file)) {
        const found = specifier.startsWith('.') ? resolveImport(file, specifier) : specifier
        if (found && !/^(?:functions\/utils\/mail|domain\/mail)\//.test(found)) outside.push(`${file}: ${found}`)
      }
    }
    expect(outside.sort()).toEqual(['functions/utils/mail/footer.ts: functions/utils/emailLayout.ts', 'functions/utils/mail/footer.ts: functions/utils/site.ts'])
    // The worker reached both before WS16 step 4, through the campaign sender.
    for (const file of ['functions/utils/emailLayout.ts', 'functions/utils/site.ts']) expect([...files], file).toContain(file)
  })
})
