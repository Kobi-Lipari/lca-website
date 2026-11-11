// test/unit/mail-link-files-closure.test.ts
//
// What WS16 step 3 keeps out of the daily-emails worker. The step adds the
// signed links, the footer, the newsletter's audience and the two endpoints'
// shared answers, and none of them may reach the worker's bundle: the worker
// only checks the headers a message already carries (functions/utils/mail/send.ts)
// and never builds them, so its upload does not grow by a line of them.
// test/unit/mail-worker-closure.test.ts holds what the bundle may reach; this
// holds what it may not, by the same walk from the worker's entry, and that
// the footer's import of the site's address helper, which sits outside
// functions/utils/mail and domain/mail, is therefore harmless. It also holds
// that no code the worker reaches names the key the links are signed with.
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

function closure(entry: string): Set<string> {
  const files = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of specifiersOf(file)) {
      if (!specifier.startsWith('.')) continue
      const found = resolveImport(file, specifier)
      if (found) queue.push(found)
    }
  }
  return files
}

/** The step's own files, none of which the worker may reach. */
const KEPT_OUT = [
  'functions/utils/mail/links.ts',
  'functions/utils/mail/footer.ts',
  'functions/utils/mail/lists.ts',
  'functions/utils/mail/linkAnswers.ts',
  'domain/mail/footer.ts',
  'functions/api/mail/unsubscribe/[token].ts',
  'functions/api/mail/preferences/[token].ts',
  'domain/contracts/mail.ts',
]

describe('the daily-emails worker and the files of the signed links', () => {
  const files = closure(ENTRY)

  it('reaches none of the files that sign links, build the footer, read the newsletter\'s audience or answer the two endpoints', () => {
    for (const file of KEPT_OUT) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
  })

  it('still reaches the seam\'s five files and the gate, so the walk is not blind', () => {
    for (const name of ['send', 'resend', 'switches', 'rules', 'outcome', 'gate']) expect([...files], name).toContain(`functions/utils/mail/${name}.ts`)
  })

  it('names the links\' key in no file it reaches, and no seam file builds a header it only checks', () => {
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(text, file).not.toMatch(/MAIL_LINK_SECRET/)
      expect(text, file).not.toMatch(/\bsignLink\b|\blistMailParts\b|\blinkKeyCheck\b/)
    }
  })

  it('has only the footer and the endpoints\' shared answers import outside functions/utils/mail and domain/mail, the footer for the site\'s address, and both stay out', () => {
    const outside: string[] = []
    for (const file of KEPT_OUT.filter((f) => f.startsWith('functions/utils/mail/') || f.startsWith('domain/mail/'))) {
      for (const specifier of specifiersOf(file)) {
        const found = specifier.startsWith('.') ? resolveImport(file, specifier) : specifier
        if (found && !/^(?:functions\/utils\/mail|domain\/mail)\//.test(found)) outside.push(`${file}: ${found}`)
      }
    }
    for (const line of outside) expect(line, 'a file outside the two folders that the worker could reach').toMatch(/^functions\/utils\/mail\/(?:footer|linkAnswers)\.ts: /)
    expect(outside.some((line) => line.endsWith('functions/utils/site.ts'))).toBe(true)
  })
})
