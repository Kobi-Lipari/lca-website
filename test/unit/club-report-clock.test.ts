// test/unit/club-report-clock.test.ts
//
// The 14 days (WS09's twenty-ninth step), in the parts that need no database:
// - the rule, isSuggestionOverdue in domain/clubs/regionCards.ts, at its
//   edge: 13 days and 23 hours is not due and 14 days is, across both
//   changes of the clock in Central time, with a stamp that cannot be read
//   never due, and only an open suggestion not yet passed on;
// - the email the run sends, overdueSuggestionEmail in
//   functions/utils/clubs/emails.ts: its words for each role and each first
//   keeper, the visitor's words escaped in the HTML and never in the
//   subject, no address and no name, and the last line step 28's ends on;
// - functions/utils/clubs/reportClock.ts kept to the rule
//   test/unit/mail-worker-closure.test.ts holds for a file the daily-emails
//   worker reaches: relative imports only, no package, nothing under
//   functions/api or domain/contracts; and nothing under workers/ calls it
//   yet, since its one line there waits for the mail work's word.
// Every club and word is made up.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SUGGESTION_DUE_DAYS, isSuggestionOverdue, wholeDaysSince } from '../../domain/clubs/regionCards'
import { OVERDUE_HEADING, SUGGESTION_FOOTER, overdueSuggestionEmail } from '../../functions/utils/clubs/emails'

const ROOT = resolve(__dirname, '../..')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const due = (stamp: string, nowMs: number, passedOnAt: string | null = null, status = 'open') =>
  isSuggestionOverdue({ status, passedOnAt, ageDays: wholeDaysSince(stamp, nowMs) })
const ms = (stamp: string) => Date.parse(`${stamp.replace(' ', 'T')}Z`)

describe('the rule of the 14 days', () => {
  it('is 14 whole days of 24 hours: 13 days and 23 hours is not due, 14 days is', () => {
    expect(SUGGESTION_DUE_DAYS).toBe(14)
    const sent = '2026-11-09 18:00:00'
    expect(due(sent, ms(sent) + 14 * DAY - HOUR)).toBe(false)
    expect(due(sent, ms(sent) + 14 * DAY - 1)).toBe(false)
    expect(due(sent, ms(sent) + 14 * DAY)).toBe(true)
    expect(due(sent, ms(sent) + 40 * DAY)).toBe(true)
  })

  it('does not move across either change of the clock in Central time', () => {
    // Sent before the spring change (Sun, Mar 8, 2026) and before the fall change (Sun, Nov 1, 2026).
    for (const sent of ['2026-03-01 18:00:00', '2026-10-25 18:00:00', '2026-03-08 07:30:00', '2026-11-01 06:30:00']) {
      expect(due(sent, ms(sent) + 14 * DAY - HOUR), sent).toBe(false)
      expect(due(sent, ms(sent) + 14 * DAY), sent).toBe(true)
    }
  })

  it('never for a stamp that cannot be read, one passed on already, or one no longer open', () => {
    const later = ms('2027-06-01 00:00:00')
    for (const stamp of ['', 'not a stamp', '2026-13-45 99:99:99']) expect(due(stamp, later), stamp).toBe(false)
    expect(due('2026-11-01 18:00:00', later, '2026-11-15 18:00:00')).toBe(false)
    for (const status of ['answered', 'applied', 'dismissed']) expect(due('2026-11-01 18:00:00', later, null, status), status).toBe(false)
    // An empty stamp of passing on is no stamp.
    expect(due('2026-11-01 18:00:00', later, ' ')).toBe(true)
  })
})

describe('the email of the 14 days', () => {
  const base = {
    siteUrl: 'https://www.louisianachess.org',
    clubName: 'Example Knights Club',
    region: 'Example Region',
    choice: 'Meeting day or time',
    message: 'Player One says <script>it</script> meets on Fridays & Saturdays now.',
    hasAddress: true,
    waitedDays: 16,
    dueDays: 14,
    link: 'https://www.louisianachess.org/admin/clubs/c-knights#suggestion-4',
  }

  it('says why it came and for whom it first went, by role alone, for each first keeper and each role', () => {
    const repFirst = overdueSuggestionEmail({ ...base, first: 'club_rep', kind: 'region' })
    expect(repFirst.text).toContain('No one has answered it in 14 days. It went first to the club\'s representative. It comes to you as the Example Region representative.')
    const regionFirst = overdueSuggestionEmail({ ...base, first: 'region', kind: 'lca' })
    expect(regionFirst.text).toContain('No one has answered it in 14 days. It went first to the region\'s representatives. It comes to you as an LCA admin.')
    const reminder = overdueSuggestionEmail({ ...base, first: 'lca', kind: 'lca' })
    expect(reminder.text).toContain('It went first to the LCA admins, so this is a reminder.')
    expect(repFirst.text).toContain('A visitor suggested an update to Example Knights Club\'s listing 16 days ago, and it has not been answered.')
    expect(repFirst.text).toContain('Waiting: 16 days')
    expect(repFirst.text).toContain('What changed: Meeting day or time')
  })

  it('quotes the visitor\'s words escaped in the HTML and as text in the plain part, never in the subject, and ends on step 28\'s last line', () => {
    const mail = overdueSuggestionEmail({ ...base, first: 'club_rep', kind: 'lca' })
    expect(mail.to).toBe('')
    expect(mail.replyTo).toBeUndefined()
    expect(mail.subject).toBe('A suggestion for Example Knights Club\'s listing is still waiting')
    expect(mail.subject).not.toContain('Fridays')
    expect(mail.html).toContain('&lt;script&gt;it&lt;/script&gt; meets on Fridays &amp; Saturdays now.')
    expect(mail.html).not.toContain('<script>')
    expect(mail.text).toContain(base.message)
    expect(mail.html).toContain(OVERDUE_HEADING)
    expect(mail.html).toContain(base.link)
    expect(mail.text!.trim().endsWith(SUGGESTION_FOOTER)).toBe(true)
    expect(SUGGESTION_FOOTER).toBe('A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.')
  })

  it('names no one, holds no address, and keeps to the site\'s plain words', () => {
    for (const first of ['club_rep', 'region', 'lca'] as const) {
      for (const kind of ['region', 'lca'] as const) {
        const mail = overdueSuggestionEmail({ ...base, first, kind, hasAddress: kind === 'lca' })
        const all = `${mail.subject}\n${mail.html}\n${mail.text}`
        expect(all).not.toMatch(/[\u2013\u2014]/)
        expect(all).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b|Hi |Dear `))
        expect(`${mail.subject}\n${mail.text}`).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
      }
    }
    expect(overdueSuggestionEmail({ ...base, first: 'lca', kind: 'lca', hasAddress: false }).text).toContain('They left no email address, so there is no one to reply to.')
  })
})

// ── The worker's rule, for this file ──

const ENTRY = 'functions/utils/clubs/reportClock.ts'
const WORKER = 'workers/daily-emails/src/index.ts'
const specifiersOf = (file: string) => ts.preProcessFile(readFileSync(join(ROOT, file), 'utf8'), true, true).importedFiles.map((f) => f.fileName)

function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate).split('\\').join('/')
  }
  return null
}

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

function codeFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...codeFiles(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

describe('package-free, as the worker\'s closure walk reads it', () => {
  const check = closure(ENTRY)

  it('names no package, finds every import, and reaches nothing under functions/api or domain/contracts', () => {
    expect(check.packages).toEqual([])
    expect(check.missing).toEqual([])
    expect([...check.files].filter((f) => /^functions\/api\/|^domain\/contracts\/|^functions\/utils\/(?:auth|response|supabase)\.ts$/.test(f))).toEqual([])
  })

  it('is outside the worker\'s bundle today, so the worker\'s dry run cannot move with it', () => {
    expect(closure(WORKER).files.has(ENTRY)).toBe(false)
  })

  it('is called by nothing under workers/ yet: its one line waits for the mail work\'s word', () => {
    for (const file of codeFiles('workers')) expect(readFileSync(join(ROOT, file), 'utf8'), file).not.toMatch(/runReportClock|clubs\/reportClock/)
  })

  it('reads the switch inside the function, at each call, and the rule from the domain alone', () => {
    const code = readFileSync(join(ROOT, ENTRY), 'utf8')
    expect(code).toMatch(/if \(!CLUB_KEEPERS_ON\) return none\('closed'\)/)
    expect(code).not.toMatch(/=\s*CLUB_KEEPERS_ON\b/)
    expect(code).toContain('isSuggestionOverdue({')
    expect(code).not.toMatch(/>=\s*14\b|DAY\s*\*\s*14|14\s*\*/)
    expect(code).not.toMatch(/console\.\w+\([^)]*(?:email|message|err)/)
  })
})
