// test/unit/club-routing-server-only.test.ts
//
// functions/utils/clubs/routing.ts answers names and addresses to server code
// only (WS09 step 6): no handler answers with them, no page or contract reads
// the file, it imports nothing so the daily-emails worker can take it later,
// and the one place that reads it is the save notice, which sends through
// trySendEmail and never through deliver() or a mail service by name.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name)
    if (statSync(join(ROOT, path)).isDirectory()) found.push(...sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(name)) found.push(path)
  }
  return found
}
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const READERS = /\b(keeperOf|clubRepsOf|regionRepresentativesOf|lcaAdmins)\b|clubs\/routing['"]/

describe('who keeps a club is for server code only', () => {
  it('no handler, page, area or contract reads routing.ts', () => {
    for (const dir of ['functions/api', 'src', 'domain']) {
      for (const file of sourceFiles(dir)) {
        expect(READERS.test(read(file)), file).toBe(false)
      }
    }
  })

  it('only the save notice reads it among the server\'s own files, and it names no mail service', () => {
    const all = sourceFiles('functions')
      .filter((file) => relative(ROOT, join(ROOT, file)) !== 'functions/utils/clubs/routing.ts')
      .filter((file) => /from '\.\/routing'|clubs\/routing'/.test(read(file)))
    // The club page's author line (WS09 step 20) read who keeps the club until K's decision 12 took it off the page
    // (checkpoint W); the told line's file reads it no longer, and the mail's readers are the two below.
    expect(all).not.toContain('functions/utils/clubs/authorLine.ts')
    const readers = all.filter((file) => file !== 'functions/utils/clubs/authorLine.ts')
    // The monthly check (WS09 step 14) reads the seat rule the other way round, each holder with their clubs.
    expect(readers).toEqual(['functions/utils/clubs/emails.ts', 'functions/utils/clubs/monthlyCheck.ts'])
    const notice = read('functions/utils/clubs/emails.ts')
    expect(notice).toContain('trySendEmail')
    expect(notice).not.toMatch(/\bdeliver\(/)
    expect(notice).not.toMatch(/resend|amazon|\bses\b/i)
  })

  it('routing.ts imports nothing, so the worker can take it', () => {
    expect(read('functions/utils/clubs/routing.ts')).not.toMatch(/^\s*import\s/m)
  })
})
