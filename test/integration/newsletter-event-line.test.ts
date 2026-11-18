// test/integration/newsletter-event-line.test.ts
//
// The event's line from "Add an event" on the newsletter's own page (eventLine.ts) against the server, through the real
// save handler, the real guard and the real cleaner, on the D1 database every integration test builds from the
// migrations. The line adds nothing to the cleaner and nothing stored: it is plain words and one link. Pinned here:
// a letter holding each form of the line, as the editor writes it, is saved and read back the same, the " · " and the
// " ↗" included; the email drawn from it (renderNewsletter, the function the server sends with) shows the line as one
// paragraph, its link with its address alone; and a person the guard refuses cannot save it. Every name, address and
// word here is made up.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSubject } from '../../domain/mail/letter'
import { renderNewsletter } from '../../domain/mail/newsletterLayout'
import { onRequestGet as issueGet, onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { cleanLetterHtml } from '../../functions/utils/mail/letterClean'
import { seedAdmin, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ pageOn: true, listsOn: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_PAGE_ON() {
      return flags.pageOn
    },
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
  }
})

beforeEach(() => {
  resetHarness()
})

const MONTH = 'December 2026'
/**
 * Each form of the line as the letter's editor writes it from eventLine.ts (whose own unit test,
 * test/unit/newsletter-event-line.test.ts, pins the same words): one paragraph, the link with its address alone. Written
 * out here because this suite runs in the Workers runtime, which does not resolve the page's own import paths.
 */
const FORMS: [string, string][] = [
  ['one day, with a link', '<p>Sat, Jan 9, 2027 · Sample Winter Open · Sample City · <a href="https://register.sample.lca/winter">Register on King Registration</a> ↗</p>'],
  ['days in one month, run by a club', '<p>Sat to Sun, Feb 6 to 7, 2027 · Example Memorial · Anytown · run by Example Chess Club · <a href="https://club.sample.lca/memorial">Registers on the organizer\'s site</a> ↗</p>'],
  ['across two months', '<p>Sat to Mon, Jan 30 to Feb 1, 2027 · Sample Midwinter Swiss · <a href="https://sample.lca/a?b=1&amp;c=2">Details</a> ↗</p>'],
  ['across two years, no link', '<p>Thu to Sat, Dec 30, 2027 to Jan 1, 2028 · Sample New Year Open · Sample City</p>'],
]

const LETTER = (lines: string[]) => `<h2>Sample heading one</h2><p>Sample words one</p><h2>Coming up</h2>${lines.join('')}`

const saveBody = (bodyHtml: string) => ({ id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml })

describe("the event's line, saved and read back", () => {
  it.each(FORMS)('keeps %s exactly, the middle dots and the arrow included', async (_name, line) => {
    expect(line).toContain(' · ')
    expect(await cleanLetterHtml(line)).toBe(line)
  })

  it('saves a letter holding every form of the line and reads it back the same', async () => {
    const admin = await seedAdmin()
    const body = LETTER(FORMS.map(([, line]) => line))
    const saved = await invoke(issuePut, { method: 'PUT', as: admin, body: saveBody(body) })
    expect(saved.status).toBe(200)
    // The cleaner changed nothing, so the answer carries no cleaned letter of its own.
    expect((await saved.json<{ bodyHtml: string | null }>()).bodyHtml).toBeNull()
    const read = await (await invoke(issueGet, { as: admin })).json<{ issue: { bodyHtml: string } }>()
    expect(read.issue.bodyHtml).toBe(body)
    expect(read.issue.bodyHtml).toContain('Register on King Registration</a> ↗</p>')
  })

  it('refuses the save for a person the guard refuses, with none of the words in the answer', async () => {
    const member = await seedMember()
    const body = LETTER([FORMS[0][1]])
    const refused = await invoke(issuePut, { method: 'PUT', as: member, body: saveBody(body) })
    expect(refused.status).toBe(403)
    expect(JSON.stringify(await refused.json())).not.toContain('Sample Winter Open')
  })
})

describe("the email drawn from a letter holding the line", () => {
  it('shows each line as one paragraph under "Coming up", its link with its address alone and the arrow after it', () => {
    const lines = FORMS.map(([, line]) => line)
    const email = renderNewsletter({ siteUrl: 'https://sample.lca', month: MONTH, subject: defaultSubject(MONTH), bodyHtml: LETTER(lines), footerHtml: '<p>Sample footer</p>' })
    expect(email.indexOf('Coming up')).toBeLessThan(email.indexOf('Sat, Jan 9, 2027 · Sample Winter Open'))
    for (const words of [
      'Sat, Jan 9, 2027 · Sample Winter Open · Sample City · ',
      'Sat to Sun, Feb 6 to 7, 2027 · Example Memorial · Anytown · run by Example Chess Club · ',
      'Sat to Mon, Jan 30 to Feb 1, 2027 · Sample Midwinter Swiss · ',
      'Thu to Sat, Dec 30, 2027 to Jan 1, 2028 · Sample New Year Open · Sample City</p>',
    ]) expect(email).toContain(words)
    expect(email).toMatch(/<a [^>]*href="https:\/\/register\.sample\.lca\/winter"[^>]*>Register on King Registration<\/a> ↗<\/p>/)
    expect(email).toMatch(/<p[^>]*>Sat to Sun, Feb 6 to 7, 2027 · /)
  })
})
