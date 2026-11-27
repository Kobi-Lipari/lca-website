// test/unit/club-forms-review-edges.test.ts
//
// Edges of WS09 checkpoint X's review fixes that the cases beside each fix do
// not reach:
// - F4: a row's age is whole days of 24 hours, so a clock change in
//   America/Chicago moves nothing: a row made 23 hours before across the fall
//   change, or across the spring change, is less than a day old, and one made
//   24 hours before is 1 day old, whatever the wall clock reads.
// - C1: the directory sentence is in the keeper's question alone; the email
//   to the member who was named still says only what it said.
// - D4: every integration file of the public forms that sends mail stands in
//   the mail switches itself, so none changes its result when the mail work
//   turns one.
// Every club and person is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REP_DIRECTORY_WORDS } from '../../domain/clubs/repRequest'
import { wholeDaysSince } from '../../domain/clubs/regionCards'
import { ageWords } from '../../domain/clubs/suggestion'
import { REP_NAMED_CAN, repNamedEmail } from '../../functions/utils/clubs/emails'

const HOUR = 60 * 60 * 1000

describe('an age is whole days of 24 hours across a clock change in America/Chicago', () => {
  it('the fall change (Sunday, November 1, 2026, 2:00 AM CDT back to 1:00 AM CST): 23 hours is less than a day, 24 hours is 1 day', () => {
    // 11:30 PM CDT on Saturday, October 31, 2026 is 4:30 AM UTC on Sunday, November 1.
    const made = '2026-11-01 04:30:00'
    const at = Date.UTC(2026, 10, 1, 4, 30, 0)
    // 23 hours on reads 10:30 PM CST on Sunday under the new clock: the wall clock has moved 22 hours and a calendar
    // day, and the row is still less than a day old.
    expect(ageWords(wholeDaysSince(made, at + 23 * HOUR))).toBe('less than a day ago')
    expect(ageWords(wholeDaysSince(made, at + 24 * HOUR - 1))).toBe('less than a day ago')
    expect(ageWords(wholeDaysSince(made, at + 24 * HOUR))).toBe('1 day ago')
    expect(ageWords(wholeDaysSince(made, at + 14 * 24 * HOUR))).toBe('14 days ago')
  })

  it('the spring change (Sunday, March 8, 2026, 2:00 AM CST forward to 3:00 AM CDT): 23 hours is less than a day, 24 hours is 1 day', () => {
    // 11:30 PM CST on Saturday, March 7, 2026 is 5:30 AM UTC on Sunday, March 8.
    const made = '2026-03-08 05:30:00'
    const at = Date.UTC(2026, 2, 8, 5, 30, 0)
    // 23 hours on is 1:30 AM CDT on Monday: a new calendar day, and still less than a day old.
    expect(ageWords(wholeDaysSince(made, at + 23 * HOUR))).toBe('less than a day ago')
    expect(ageWords(wholeDaysSince(made, at + 24 * HOUR))).toBe('1 day ago')
    expect(ageWords(wholeDaysSince(made, at + 48 * HOUR))).toBe('2 days ago')
  })

  it('never says today or yesterday, and never a day count below one', () => {
    for (let hours = 0; hours <= 96; hours += 7) {
      const words = ageWords(wholeDaysSince('2026-11-01 04:30:00', Date.UTC(2026, 10, 1, 4, 30, 0) + hours * HOUR))
      expect(words).toMatch(/^(less than a day ago|1 day ago|[2-9] days ago)$/)
    }
  })
})

describe('what the named member is told is not what the keeper is asked', () => {
  it('the member\'s email says what it said and does not speak of the member directory', () => {
    const mail = repNamedEmail({ siteUrl: 'https://example.org', clubName: 'Example Chess Club' })
    expect(REP_NAMED_CAN).toBe('As its rep you can edit the club\'s page, create its events and set their fees.')
    expect(mail.text).toContain(REP_NAMED_CAN)
    for (const part of [mail.subject, mail.html, mail.text ?? '']) expect(part).not.toMatch(/directory|US Chess ID/i)
    expect(REP_DIRECTORY_WORDS).toMatch(/member directory/)
  })
})

describe('the public forms\' integration files that send mail stand in the mail switches themselves', () => {
  const ROOT = resolve(__dirname, '../..')
  const FILES = [
    'club-contact-relay', 'club-contact-relay-edges', 'club-reply', 'club-reply-edges', 'club-reports', 'club-reports-edges',
    'club-report-clock', 'club-report-clock-edges', 'club-suggest-club', 'club-suggest-club-edges', 'club-rep-requests', 'club-rep-requests-edges',
    'club-forms-busy-service-edges',
  ]
  it('names the module of the mail switches in a mock, and never reads the shipped value in a case', () => {
    for (const name of FILES) {
      const source = readFileSync(join(ROOT, `test/integration/${name}.test.ts`), 'utf8')
      expect(source, name).toMatch(/vi\.mock\('\.\.\/\.\.\/functions\/utils\/mail\/switches'/)
      expect(source, name).toMatch(/get MAIL_LISTS_ON\(\)/)
      expect(source, name).toMatch(/get MAIL_SENDER\(\)/)
    }
  })
})
