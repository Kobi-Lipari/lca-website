// test/unit/club-monthly-check.test.ts
//
// The monthly check of WS09 step 14, apart from what D1 answers
// (test/integration/club-check-emails.test.ts holds that):
// - the due rule, isCheckDue in domain/clubs/monthlyCheck.ts, which the
//   check imports and does not copy: true only on the first Monday of the
//   month from 8:00 AM Central to the end of that day, by Intl's
//   America/Chicago and never a fixed offset;
// - the month's key and the month in words;
// - the email's words as functions/utils/clubs/emails.ts draws them;
// - functions/utils/clubs/monthlyCheck.ts walked as
//   test/unit/mail-worker-closure.test.ts walks the daily-emails worker: no
//   package, nothing under functions/api or domain/contracts, and the files
//   the worker's bundle would gain at WS09 step 15, when the worker's one
//   line calls it; nothing under workers/ calls it yet.
//
// Every club, person and link here is made up.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { checkMonthKey, isCheckDue, monthInWords } from '../../domain/clubs/monthlyCheck'
import { LINK_LIFE, MONTHLY_CHECK_BY_HAND, MONTHLY_CHECK_HEADING, MONTHLY_CHECK_TIMED, MONTHLY_CHECK_WHY, monthlyCheckEmail } from '../../functions/utils/clubs/emails'
import { CHECK_JOB, CONFIRM_PURPOSE, LINK_TTL_SECONDS, PRESS_SENDS, TIMED_SENDS } from '../../functions/utils/clubs/monthlyCheck'
import { EXPECTED_INTERVAL_DAYS } from '../../functions/utils/admin/automations'

const ROOT = resolve(__dirname, '../..')
const ENTRY = 'functions/utils/clubs/monthlyCheck.ts'
const WORKER = 'workers/daily-emails/src/index.ts'
const at = (iso: string) => new Date(iso)
/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

describe('the due rule: the first Monday from 8:00 AM Central to the end of that day', () => {
  it('7:59 AM and 8:00 AM on a first Monday in January and in July', () => {
    expect(isCheckDue(at('2027-01-04T13:59:00Z'))).toBe(false)
    expect(isCheckDue(at('2027-01-04T14:00:00Z'))).toBe(true)
    expect(isCheckDue(at('2027-07-05T12:59:00Z'))).toBe(false)
    expect(isCheckDue(at('2027-07-05T13:00:00Z'))).toBe(true)
  })

  it('Monday, November 2, 2026, the day after the clocks go back', () => {
    expect(isCheckDue(at('2026-11-02T13:00:00Z'))).toBe(false)
    expect(isCheckDue(at('2026-11-02T13:59:00Z'))).toBe(false)
    expect(isCheckDue(at('2026-11-02T14:00:00Z'))).toBe(true)
  })

  it('a month whose 1st is a Monday and one whose first Monday is the 7th', () => {
    expect(isCheckDue(at('2027-02-01T14:00:00Z'))).toBe(true)
    expect(isCheckDue(at('2027-02-08T14:00:00Z'))).toBe(false)
    expect(isCheckDue(at('2026-12-07T14:00:00Z'))).toBe(true)
    expect(isCheckDue(at('2026-12-01T14:00:00Z'))).toBe(false)
  })

  it('the last minute of the day and the first of the next', () => {
    expect(isCheckDue(at('2026-12-08T05:59:00Z'))).toBe(true)
    expect(isCheckDue(at('2026-12-08T06:00:00Z'))).toBe(false)
  })

  it('the second Monday, and a time that is not one', () => {
    expect(isCheckDue(at('2026-12-14T14:00:00Z'))).toBe(false)
    expect(isCheckDue(Number.NaN)).toBe(false)
  })
})

describe('the month\'s key and the month in words', () => {
  it('keys a month by its first Monday in Central time, whatever day of it the call falls on', () => {
    expect(checkMonthKey(at('2026-12-07T14:00:00Z'))).toBe('2026-12-07')
    expect(checkMonthKey(at('2026-12-31T23:00:00Z'))).toBe('2026-12-07')
    // Midnight UTC on January 1 is still New Year's Eve in Louisiana.
    expect(checkMonthKey(at('2027-01-01T03:00:00Z'))).toBe('2026-12-07')
    expect(checkMonthKey(at('2027-02-01T14:00:00Z'))).toBe('2027-02-01')
    expect(checkMonthKey(Number.NaN)).toBe('')
  })

  it('words a moment and a stored stamp in Central time', () => {
    expect(monthInWords(at('2026-12-07T14:00:00Z'))).toBe('December 2026')
    expect(monthInWords('2026-12-01 03:30:00')).toBe('November 2026')
    expect(monthInWords(null)).toBe('')
  })

  it('signs for one purpose, 30 days, ten a timed run and 45 a press, and runs at most five weeks apart', () => {
    expect(CHECK_JOB).toBe('club_monthly_check')
    expect(EXPECTED_INTERVAL_DAYS[CHECK_JOB]).toBe(35)
    expect(CONFIRM_PURPOSE).toBe('club_confirm')
    expect(LINK_TTL_SECONDS).toBe(2_592_000)
    expect(TIMED_SENDS).toBe(10)
    expect(PRESS_SENDS).toBe(45)
  })
})

describe('the email', () => {
  const clubs = [
    { name: 'Example Chess Club', city: 'Example City', statement: 'Tuesdays at 7:00 PM.', confirmUrl: 'https://example.org/clubs/confirm/v1.s.a.b', updateUrl: 'https://example.org/workspace/region/clubs/example-chess-club' },
    { name: 'Example <Knights> Club', city: 'Example Town', statement: null, confirmUrl: 'https://example.org/clubs/confirm/v1.s.c.d', updateUrl: 'https://example.org/workspace/region/clubs/example-knights-club' },
  ]
  const mail = monthlyCheckEmail({ siteUrl: 'https://example.org', fullName: 'Player One', month: 'December 2026', linksEnd: at('2027-01-06T14:00:00Z'), clubs })

  it('greets the person by first name and asks about each club, with its statement and its two links', () => {
    expect(mail.to).toBe('')
    expect(mail.subject).toBe(MONTHLY_CHECK_HEADING)
    expect(MONTHLY_CHECK_HEADING).toBe('Your region\'s clubs: still accurate?')
    expect(mail.text).toContain('Hi Player,')
    expect(mail.text).toContain('Here are the 2 clubs in your region, for December 2026. For each one, press Still accurate if its listing is right, or Update to change it.')
    expect(mail.text).toContain('Tuesdays at 7:00 PM.')
    expect(mail.text).toContain('How the club meets is not listed yet.')
    for (const club of clubs) {
      expect(mail.text).toContain(`Still accurate: ${club.confirmUrl}`)
      expect(mail.text).toContain(`Update: ${club.updateUrl}`)
      expect(mail.html).toContain(`href="${club.confirmUrl}"`)
      expect(mail.html).toContain(`href="${club.updateUrl}"`)
    }
    expect(mail.html).toContain('Example &lt;Knights&gt; Club')
    expect(mail.html).not.toContain('<Knights>')
  })

  it('says how long the link works with the day it stops and its weekday, and why the person gets it, with no unsubscribe line', () => {
    expect(LINK_LIFE).toBe('Still accurate works without logging in for 30 days')
    for (const words of [mail.text!, mail.html]) {
      expect(words).toContain(`${LINK_LIFE}, until Wed, Jan 6, 2027.`)
      expect(words).toContain(`${MONTHLY_CHECK_WHY} ${MONTHLY_CHECK_TIMED}`)
      expect(words).toContain('8:00 AM')
      expect(words).not.toMatch(DASHES)
      expect(words).not.toMatch(/unsubscribe|email choices/i)
    }
  })

  it('draws a name with line breaks as one line, and a person with no name as "there"', () => {
    const odd = monthlyCheckEmail({ siteUrl: 'https://example.org', fullName: '  ', month: 'December 2026', linksEnd: at('2027-01-06T14:00:00Z'), clubs: [{ ...clubs[0], name: 'Example\nChess Club' }] })
    expect(odd.text).toContain('Hi there,')
    expect(odd.text).toContain('Example Chess Club')
    expect(odd.text).toContain('Here is the club in your region, for December 2026. Press Still accurate if its listing is right, or Update to change it.')
  })

  it('says why in words true of one seat or two, and a copy sent by hand says so in place of naming the first Monday', () => {
    expect(MONTHLY_CHECK_WHY).toBe('You get this because you are a regional representative.')
    expect(MONTHLY_CHECK_TIMED).toBe('It comes on the first Monday of each month at 8:00 AM.')
    expect(MONTHLY_CHECK_BY_HAND).toBe('An LCA admin sent this one by hand.')
    const byHand = monthlyCheckEmail({ siteUrl: 'https://example.org', fullName: 'Player One', month: 'December 2026', linksEnd: at('2027-01-06T14:00:00Z'), clubs, byHand: true })
    for (const words of [byHand.text!, byHand.html]) {
      expect(words).toContain(`${MONTHLY_CHECK_WHY} ${MONTHLY_CHECK_BY_HAND}`)
      expect(words).not.toContain('first Monday')
      expect(words).not.toMatch(DASHES)
    }
    for (const words of [mail.text!, mail.html]) expect(words).not.toContain(MONTHLY_CHECK_BY_HAND)
    expect(`${mail.text} ${byHand.text}`).not.toMatch(/your seat keeps|board seat covers/)
  })
})

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

/** Every code file under a folder. */
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

  it('would bring these files, and no more, into the worker\'s bundle at WS09 step 15', () => {
    const worker = closure(WORKER).files
    expect([...check.files].filter((f) => !worker.has(f)).sort()).toEqual([
      'domain/clubs/monthlyCheck.ts',
      'domain/format/clock.ts',
      'functions/utils/admin/automations.ts',
      'functions/utils/clubs/emails.ts',
      'functions/utils/clubs/migrationLag.ts',
      'functions/utils/clubs/monthlyCheck.ts',
      'functions/utils/clubs/pages.ts',
      'functions/utils/clubs/routing.ts',
      'functions/utils/tokens.ts',
    ])
  })

  it('is called by nothing under workers/ yet: the worker\'s one line is WS09 step 15\'s', () => {
    for (const file of codeFiles('workers')) expect(readFileSync(join(ROOT, file), 'utf8'), file).not.toMatch(/runMonthlyCheck|clubs\/monthlyCheck/)
  })
})
