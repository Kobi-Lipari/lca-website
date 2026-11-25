// test/integration/newsletter-page-test.test.ts
//
// WS16 part two, page step 6, the test half: "Send a test to me" from the
// newsletter's own page. POST /api/admin/mail/newsletter/test takes a second
// form of body, { issueId, version }, while MAIL_PAGE_ON is set, through the
// real handler, the real guard (requireListMailer), the real footer and the
// real seam, on the D1 database every integration test builds from the
// migrations. MAIL_PAGE_ON, MAIL_LISTS_ON and the module's other constants
// are read through getters on the mocked functions/utils/mail/switches, set
// before every case. Nothing here reaches an outside service: the harness
// answers the sign-in service and stands in for the mail service.
//
// - (a) who may: an LCA admin with a second factor, the president and the
//   media manager with a second factor, an officer who holds the seat among
//   them; everyone else gets the guard's own answer, as today's form does.
// - (b) one address: the account's own, whatever the body holds; an account
//   with no usable address and an address mail no longer reaches get
//   today's words.
// - (c) the stored letter is what is sent, byte for byte as the navy layout
//   draws it with the real footer and both headers for that person.
// - (d) a letter that is not the open one at the version named gets the
//   save's 409, in the save's words; one of another list, 404.
// - (e) a letter with no subject or no words, and an email too long as
//   drawn, are refused in words.
// - (f) the link key and the service: today's 503 and 502, one send for one
//   press.
// - (g) nothing is written on the letter, and no campaign.
// - (h) with MAIL_PAGE_ON unset the new form is refused as today, and
//   today's form answers as today with the switch either way.
// - (i) the refusals in today's order where they apply.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maskAddress } from '../../domain/mail/address'
import { DEFAULT_FROM, SENDER_NAME } from '../../domain/mail/addresses'
import { defaultSubject } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { EMAIL_MAX_BYTES, renderNewsletter } from '../../domain/mail/newsletterLayout'
import { TEST_NO_SUBJECT, TEST_NO_SUBJECT_OR_WORDS, TEST_NO_WORDS, testTooLong } from '../../domain/mail/newsletterWords'
import { onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as testPost, TEST_SERVICE_REFUSED } from '../../functions/api/admin/mail/newsletter/test'
import { onRequestGet as preferencesGet } from '../../functions/api/mail/preferences/[token]'
import { onRequestGet as unsubscribeGet } from '../../functions/api/mail/unsubscribe/[token]'
import { listMessage, NO_CLEAR_ANSWER_WORDS } from '../../functions/utils/admin/campaigns'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR } from '../../functions/utils/auth'
import { listMailParts } from '../../functions/utils/mail/footer'
import { CHANGED_SINCE_READ, SENT_SINCE_READ, SET_ASIDE_SINCE_READ } from '../../functions/utils/mail/issues'
import { LINK_KEY_MISSING, TEST_TO_OWN_ADDRESS } from '../../functions/utils/mail/newsletterAnswers'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMember, seedPresident, seedSeat } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness, type InvokeOptions } from './harness'
import { noLongerReceives } from './mailRuns'

const flags = vi.hoisted(() => ({ pageOn: true, listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
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
    get MAIL_SENDER() {
      return flags.sender
    },
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

type Row = Record<string, unknown>

const SITE = 'https://www.louisianachess.org'
const MONTH = 'December 2026'
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p><h2>Sample heading two</h2><p>More sample words.</p>'
const PREVIEW = 'Sample preview line for the inbox'
/** Today's form of the body: an address, a subject and a message, as Group email's newsletter tab sends them. */
const TODAY = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }

let seq = 0
const address = (name: string) => `${name}-${++seq}@page-test.test.lca`
const person = (fullName: string, role = 'member', email = address('person')) => seedMember({ fullName, email, role })
const emailOf = async (id: string) => (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(id).first<{ email: string }>())!.email

/** A seat holder of the Media manager seat, with the role given, a member's by default: the seat made once, each holder a term on it. */
async function holder(role = 'member'): Promise<string> {
  const id = await person('Player Four', role)
  const seat = await env.DB.prepare('SELECT id FROM board_members WHERE slug = ?').bind(MEDIA_MANAGER_SEAT).first<{ id: string }>()
  if (!seat) await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [id])
  else await env.DB.prepare(`INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES (?, ?, ?, datetime('now'))`).bind(`term-sample-${++seq}`, seat.id, id).run()
  return id
}

/** A letter saved through the page's own save, as the page saves one: the cleaner's output is what the table holds. */
async function saved(as: string, over: Partial<{ subject: string; preheader: string; bodyHtml: string; monthLabel: string }> = {}): Promise<{ id: string; version: number }> {
  const body = { id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: PREVIEW, bodyHtml: LETTER, ...over }
  const res = await invoke(issuePut, { method: 'PUT', as, body })
  expect(res.status, JSON.stringify(await res.json())).toBe(200)
  const answer = await res.json<{ id: string; version: number }>()
  return { id: answer.id, version: answer.version }
}

/** A letter written straight into the table, for the states the page's own methods cannot reach. */
async function seedLetter(opts: { id: string; listId?: string; body?: string; by?: string | null; subject?: string; campaignId?: string | null; setAsideAt?: string | null; version?: number }) {
  await env.DB.prepare(
    `INSERT INTO newsletter_issues (id, list_id, month_label, subject, body_html, version, created_by, updated_by, updated_at, campaign_id, set_aside_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-11-01 15:00:00', ?, ?)`,
  ).bind(
    opts.id, opts.listId ?? NEWSLETTER_LIST_ID, MONTH, opts.subject ?? 'Sample subject one', opts.body ?? LETTER, opts.version ?? 1,
    opts.by ?? null, opts.by ?? null, opts.campaignId ?? null, opts.setAsideAt ?? null,
  ).run()
}

/** A send on the list, as the plain tab makes one, for a letter marked sent by hand. */
async function seedSend(id: string, by: string | null) {
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, created_at, list_id)
     VALUES (?, 'Sample newsletter one', '<p>Sample words.</p>', '{}', 3, 3, 'completed', ?, '2026-11-02 15:00:00', ?)`,
  ).bind(id, by, NEWSLETTER_LIST_ID).run()
}

/** The test of a letter, by its id and version, with anything else the body is given beside them. */
const testOf = (as: string | undefined, letter: { id: string; version: number }, extra: Record<string, unknown> = {}, opts: InvokeOptions = {}) =>
  invoke(testPost, { method: 'POST', ...(as ? { as } : {}), body: { issueId: letter.id, version: letter.version, ...extra }, ...opts })

const rows = async () => (await env.DB.prepare('SELECT * FROM newsletter_issues ORDER BY rowid').all<Row>()).results
const rowOf = async (id: string) => (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(id).first<Row>())!
const contactOf = async (to: string) => (await env.DB.prepare('SELECT id FROM mail_contacts WHERE address = ?').bind(to).first<{ id: string }>())?.id ?? null

/** Every table a test of the letter must leave as it was, counted, and the outbox. Contacts are counted apart. */
async function traces() {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    recipients: await count('SELECT COUNT(*) AS n FROM email_campaign_recipients'),
    choices: await count('SELECT COUNT(*) AS n FROM mail_list_choices'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
    sent: emailOutbox.length,
  }
}
const contacts = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_contacts').first<{ n: number }>())!.n

/** The email the layout draws for a stored letter and one address, with that address's own footer: what the test must send. */
async function drawnFor(id: string, to: string): Promise<string> {
  const row = await rowOf(id)
  const contactId = await contactOf(to)
  expect(contactId, to).not.toBeNull()
  const parts = await listMailParts(env as unknown as Env, { contactId: contactId!, listId: NEWSLETTER_LIST_ID })
  return renderNewsletter({
    siteUrl: SITE, month: String(row.month_label), subject: String(row.subject), preheader: String(row.preheader), bodyHtml: String(row.body_html), footerHtml: parts.footerHtml,
  })
}
const bytes = (text: string) => new TextEncoder().encode(text).byteLength

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) who may send a test of the letter', () => {
  it('sends it for an LCA admin with a second factor, the president, and the media manager with a second factor, an officer who holds the seat among them', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const president = await person('Player One', 'lca_observer')
    await seedPresident(president)
    const people = [admin, president, await holder(), await holder('lca_officer')]
    for (const who of people) {
      const res = await testOf(who, letter)
      expect(res.status, who).toBe(200)
      expect(await res.json(), who).toEqual({ sent: true, to: await emailOf(who) })
    }
    expect(emailOutbox.map((e) => e.to)).toEqual(await Promise.all(people.map(emailOf)))
  })

  it('gives everyone else the guard\'s own answer, byte for byte as today\'s form gets it, sending nothing and writing nothing', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const plain = await person('Player Two')
    const officer = await person('Player Three', 'lca_officer')
    const seated = await holder()
    const observer = await person('Player Four', 'lca_observer')
    const president = await person('Player Five', 'lca_observer')
    await seedPresident(president)
    const before = { rows: await rows(), traces: await traces(), contacts: await contacts() }
    const cases: Array<[string, string | undefined, 'aal1' | 'aal2']> = [
      ['an LCA admin without a second factor', admin, 'aal1'],
      ['an LCA Observer without the President seat', observer, 'aal1'],
      ['the president without a second factor', president, 'aal1'],
      ['the media manager without a second factor', seated, 'aal1'],
      ['an officer without the seat', officer, 'aal2'],
      ['a member', plain, 'aal2'],
      ['a signed-out caller', undefined, 'aal2'],
    ]
    for (const [who, as, aal] of cases) {
      const res = await testOf(as, letter, {}, { aal })
      const today = await invoke(testPost, { method: 'POST', ...(as ? { as } : {}), aal, body: { to: address('reader'), ...TODAY } })
      expect(res.status, who).toBe(today.status)
      expect(await res.response.clone().text(), who).toBe(await today.response.clone().text())
      expect([401, 403], who).toContain(res.status)
    }
    expect(await (await testOf(plain, letter)).json()).toEqual({ error: LIST_MAILERS_ONLY })
    expect(await (await testOf(observer, letter, {}, { aal: 'aal1' })).json()).toEqual({ error: LIST_MAILERS_ONLY })
    expect(await (await testOf(seated, letter, {}, { aal: 'aal1' })).json()).toEqual({ error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true })
    expect(await (await testOf(president, letter, {}, { aal: 'aal1' })).json()).toEqual({ error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true })
    expect({ rows: await rows(), traces: await traces(), contacts: await contacts() }).toEqual(before)
  })
})

describe('(b) to the account\'s own address and to no other', () => {
  it('sends to the address on the account, as the mail tables keep it, whatever the body holds beside the letter, and never through Amazon SES', async () => {
    const written = address('admin')
    const admin = await person('Player One', 'lca_admin', `  ${written.toUpperCase()} `)
    const letter = await saved(admin)
    const other = address('other')
    const res = await testOf(admin, letter, { to: other, cc: other, bcc: other, replyTo: other, email: other, address: other, service: 'ses' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: true, to: written })
    expect(emailOutbox.map((e) => [e.to, e.via])).toEqual([[written, 'resend']])
    expect(JSON.stringify(emailOutbox)).not.toContain(other)
  })

  it('holds the media manager to their own address the same way, whatever they type', async () => {
    const seated = await holder()
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const res = await testOf(seated, letter, { to: await emailOf(admin) })
    expect(res.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([await emailOf(seated)])
  })

  it('answers an account with no address mail can reach with today\'s words, 403, sending nothing and making no contact', async () => {
    const admin = await person('Player One', 'lca_admin', 'player.one@sample.invalid')
    const letter = await saved(await seedAdmin())
    const before = { traces: await traces(), contacts: await contacts() }
    const res = await testOf(admin, letter)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: TEST_TO_OWN_ADDRESS })
    expect({ traces: await traces(), contacts: await contacts() }).toEqual(before)
  })

  it('answers an address the do-not-send list holds with the gate\'s own words, 502, as today\'s test does, sending nothing', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    await noLongerReceives(await emailOf(admin))
    const res = await testOf(admin, letter)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Failed to send test email: Not sent: this address no longer receives mail.' })
    expect(emailOutbox).toEqual([])
  })
})

describe('(c) the stored letter is what is sent', () => {
  it('sends the letter as stored: "[TEST] " and its subject, the navy email with its month, words and preview line, and the real footer and both headers for that person, byte for byte as the layout draws it', async () => {
    const admin = await seedAdmin()
    const to = await emailOf(admin)
    const letter = await saved(admin, { subject: 'Sample subject for December' })
    const res = await testOf(admin, letter)
    expect(res.status).toBe(200)
    const [sent] = emailOutbox
    expect(emailOutbox).toHaveLength(1)
    expect(sent.to).toBe(to)
    expect(sent.subject).toBe('[TEST] Sample subject for December')
    expect(sent.from).toBe(`${SENDER_NAME} <${DEFAULT_FROM}>`)
    expect(sent.html).toBe(await drawnFor(letter.id, to))
    for (const piece of ['LCA Newsletter', MONTH, 'Example words for a sample letter.', 'In this issue', PREVIEW, 'Sample subject for December']) expect(sent.html, piece).toContain(piece)
    // Both headers, signed for this person's own contact, and the footer's two links, which open.
    expect(Object.keys(sent.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
    expect(sent.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    const token = /^<https:\/\/www\.louisianachess\.org\/api\/mail\/unsubscribe\/([^<>\s,]+)>$/.exec(sent.headers!['List-Unsubscribe'])?.[1]
    expect(token).toBeDefined()
    expect(sent.html).toContain(`${SITE}/email/unsubscribe/${token}`)
    const preferences = /https:\/\/www\.louisianachess\.org\/email\/preferences\/([^"<>\s]+)/.exec(sent.html)?.[1]
    expect(preferences).toBeDefined()
    const asked = await invoke(unsubscribeGet, { params: { token: token! }, headers: { Accept: 'application/json' } })
    expect(await asked.json()).toEqual({ list: 'LCA newsletter' })
    const choices = await invoke(preferencesGet, { params: { token: decodeURIComponent(preferences!) } })
    expect(choices.status).toBe(200)
    // The preferences link is the person's own: it opens on their own address, masked as the page shows it.
    expect((await choices.json<{ address: string }>()).address).toBe(maskAddress(to))
    // The contact is the person's own, and it is on no list.
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_list_choices').first()).toEqual({ n: 0 })
    // No postal address, and nothing of today's layout.
    expect(sent.html).not.toMatch(/\bP\.?\s?O\.?\s+Box\b|\bSuite\b|\b\d{5}(?:-\d{4})?\b/i)
  })

  it('never sends words from the request: a body that carries a subject and a letter of its own sends the stored letter', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const res = await testOf(admin, letter, { subject: 'Sample words from the request', bodyHtml: '<p>Sample request words</p>', preheader: 'Sample request line' })
    expect(res.status).toBe(200)
    const [sent] = emailOutbox
    expect(sent.subject).toBe(`[TEST] ${defaultSubject(MONTH)}`)
    expect(sent.html).toBe(await drawnFor(letter.id, await emailOf(admin)))
    for (const piece of ['Sample words from the request', 'Sample request words', 'Sample request line']) expect(sent.html).not.toContain(piece)
  })

  it('draws each person\'s own footer: the president\'s test carries the president\'s links, not the admin\'s', async () => {
    const admin = await seedAdmin()
    const president = await person('Player One', 'lca_observer')
    await seedPresident(president)
    const letter = await saved(admin)
    expect((await testOf(admin, letter)).status).toBe(200)
    expect((await testOf(president, letter)).status).toBe(200)
    const [first, second] = emailOutbox
    expect(first.html).toBe(await drawnFor(letter.id, await emailOf(admin)))
    expect(second.html).toBe(await drawnFor(letter.id, await emailOf(president)))
    expect(first.headers!['List-Unsubscribe']).not.toBe(second.headers!['List-Unsubscribe'])
  })
})

describe('(d) a letter that is not the open one at the version named', () => {
  it('refuses an old version with the save\'s 409, in the save\'s words, naming who saved last and when, and sends nothing', async () => {
    const admin = await seedAdmin()
    const other = await person('Player Two', 'lca_observer')
    await seedPresident(other)
    const first = await saved(admin)
    const save = await invoke(issuePut, { method: 'PUT', as: other, body: { id: first.id, version: first.version, monthLabel: MONTH, subject: 'Sample subject two', preheader: '', bodyHtml: LETTER } })
    expect(save.status).toBe(200)
    const row = await rowOf(first.id)
    const res = await testOf(admin, first)
    expect(res.status).toBe(409)
    const refused = { error: CHANGED_SINCE_READ, reason: 'changed', changedBy: 'Player Two', changedAt: row.updated_at }
    expect(await res.json()).toEqual(refused)
    // The same answer the save gives at that version.
    const asSave = await invoke(issuePut, { method: 'PUT', as: admin, body: { id: first.id, version: first.version, monthLabel: MONTH, subject: 'x', preheader: '', bodyHtml: LETTER } })
    expect(asSave.status).toBe(409)
    expect(await asSave.json()).toEqual(refused)
    expect(emailOutbox).toEqual([])
  })

  it('refuses a version the letter never had, and a letter sent or set aside, with the save\'s 409 and words, and sends nothing', async () => {
    const admin = await seedAdmin()
    const sender = await person('Player Three', 'lca_observer')
    const open = await saved(admin)
    expect((await testOf(admin, { id: open.id, version: open.version + 5 })).status).toBe(409)
    await seedSend('campaign-sample-1', sender)
    await env.DB.prepare('UPDATE newsletter_issues SET campaign_id = ? WHERE id = ?').bind('campaign-sample-1', open.id).run()
    const sent = await testOf(admin, open)
    expect(sent.status).toBe(409)
    expect(await sent.json()).toEqual({ error: SENT_SINCE_READ, reason: 'sent', changedBy: 'Player Three', changedAt: '2026-11-02 15:00:00' })
    await seedLetter({ id: 'sample-aside-1', by: sender, setAsideAt: '2026-11-03 15:00:00' })
    const aside = await testOf(admin, { id: 'sample-aside-1', version: 1 })
    expect(aside.status).toBe(409)
    expect(await aside.json()).toEqual({ error: SET_ASIDE_SINCE_READ, reason: 'set_aside', changedBy: 'Player Three', changedAt: '2026-11-03 15:00:00' })
    expect(emailOutbox).toEqual([])
  })

  it('answers a letter of another list, or one that does not exist, 404 "Not found", alike, and sends nothing', async () => {
    const admin = await seedAdmin()
    await seedLetter({ id: 'sample-other-list', listId: 'lca-tournaments' })
    for (const id of ['sample-other-list', 'sample-no-such-letter']) {
      const res = await testOf(admin, { id, version: 1 })
      expect(res.status, id).toBe(404)
      expect(await res.response.clone().text(), id).toBe('{"error":"Not found"}')
    }
    expect(emailOutbox).toEqual([])
  })

  it('refuses a body whose letter or version is not one, with the field\'s words, before anything is read', async () => {
    const admin = await seedAdmin()
    for (const body of [{ issueId: '', version: 1 }, { issueId: 'x'.repeat(65), version: 1 }, { issueId: 12, version: 1 }, { issueId: 'sample-letter', version: 0 }, { issueId: 'sample-letter', version: 1.5 }, { issueId: 'sample-letter' }]) {
      const res = await invoke(testPost, { method: 'POST', as: admin, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
      const answer = await res.json<{ error: string; fields: Record<string, string> }>()
      expect(answer.error, JSON.stringify(body)).toBe('Some fields are missing or not valid.')
      expect(Object.keys(answer.fields).every((field) => field === 'issueId' || field === 'version'), JSON.stringify(answer)).toBe(true)
    }
    expect(emailOutbox).toEqual([])
  })
})

describe('(e) a letter that cannot be tested yet', () => {
  it('refuses a letter with no subject, one with no words and one with neither, 400 in words that say which, and sends nothing', async () => {
    const admin = await seedAdmin()
    const cases: Array<[Parameters<typeof saved>[1], string]> = [
      [{ subject: '' }, TEST_NO_SUBJECT],
      [{ bodyHtml: '' }, TEST_NO_WORDS],
      [{ bodyHtml: '<p></p><p><br></p><h2></h2>' }, TEST_NO_WORDS],
      [{ subject: '   ', bodyHtml: '' }, TEST_NO_SUBJECT_OR_WORDS],
    ]
    for (const [over, words] of cases) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const letter = await saved(admin, over)
      const res = await testOf(admin, letter)
      expect(res.status, words).toBe(400)
      expect(await res.json(), words).toEqual({ error: words })
    }
    expect(emailOutbox).toEqual([])
    expect(TEST_NO_SUBJECT).toBe('This letter has no subject yet, so no test was sent. Add a subject first.')
    expect(TEST_NO_WORDS).toBe('This letter has no words yet, so no test was sent. Write the letter first.')
    expect(TEST_NO_SUBJECT_OR_WORDS).toBe('This letter has no subject and no words yet, so no test was sent. Add a subject and write the letter first.')
  })

  it('refuses an email over 102,000 bytes as drawn, in words that say by about how much, and sends nothing; one under it goes', async () => {
    const admin = await seedAdmin()
    const to = await emailOf(admin)
    const links = (count: number) => Array.from({ length: count }, (_, at) => `<p><a href="https://www.example.org/sample-${at}">Sample link</a></p>`).join('')
    const long = await saved(admin, { bodyHtml: links(1000) })
    const res = await testOf(admin, long)
    const drawn = await drawnFor(long.id, to)
    expect(bytes(drawn)).toBeGreaterThan(EMAIL_MAX_BYTES)
    const over = bytes(drawn) - EMAIL_MAX_BYTES
    expect(res.status).toBe(413)
    const words = (await res.json<{ error: string }>()).error
    expect(words).toBe(testTooLong(over))
    const about = Math.ceil(over / 100) * 100
    expect(words).toBe(`This email is too long: it is about ${about.toLocaleString('en-US')} characters over what Gmail shows whole. Make the letter shorter, then send a test again.`)
    expect(emailOutbox).toEqual([])
    // A letter that draws an email under the limit goes.
    await env.DB.prepare('DELETE FROM newsletter_issues').run()
    const shorter = await saved(admin, { bodyHtml: links(700) })
    const sent = await testOf(admin, shorter)
    expect(sent.status).toBe(200)
    expect(bytes(emailOutbox[0].html)).toBeLessThanOrEqual(EMAIL_MAX_BYTES)
    expect(emailOutbox[0].html).toBe(await drawnFor(shorter.id, to))
  })

  it('says about how much in plain figures, rounded up to the next hundred', () => {
    expect(testTooLong(1)).toContain('about 100 characters')
    expect(testTooLong(100)).toContain('about 100 characters')
    expect(testTooLong(101)).toContain('about 200 characters')
    expect(testTooLong(23_456)).toContain('about 23,500 characters')
    expect(testTooLong(1_234_567)).toContain('about 1,234,600 characters')
  })
})

describe('(f) the link key and the mail service', () => {
  it('answers 503 in today\'s words without the link key, before any contact is made, and sends nothing', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const before = await contacts()
    for (const missing of ['', undefined]) {
      const res = await testOf(admin, letter, {}, { env: { MAIL_LINK_SECRET: missing } })
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: LINK_KEY_MISSING })
    }
    expect(await contacts()).toBe(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers a refusal by the service with 502 in plain words that keep the service\'s own detail out, and a lost answer with the no-clear-answer words, trying once for one press', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    emailBehavior.succeed = false
    emailBehavior.status = 500
    const refused = await testOf(admin, letter)
    expect(refused.status).toBe(502)
    const text = await refused.response.clone().text()
    expect(JSON.parse(text)).toEqual({ error: TEST_SERVICE_REFUSED })
    expect(text).not.toMatch(/Resend|Amazon|SES/)
    expect(emailOutbox).toEqual([])
    resetHarness()
    emailBehavior.loseAnswer = 1
    const lost = await testOf(admin, letter)
    expect(lost.status).toBe(502)
    expect(await lost.json()).toEqual({ error: `Failed to send test email: ${NO_CLEAR_ANSWER_WORDS}` })
    expect(emailOutbox).toHaveLength(1)
  })

  it('answers today\'s form refused by the service in today\'s words, byte for byte, with the switch either way', async () => {
    const admin = await seedAdmin()
    const to = address('reader')
    const bodies: string[] = []
    for (const pageOn of [false, true]) {
      flags.pageOn = pageOn
      resetHarness()
      emailBehavior.succeed = false
      emailBehavior.status = 500
      const res = await invoke(testPost, { method: 'POST', as: admin, body: { to, ...TODAY } })
      expect(res.status, String(pageOn)).toBe(502)
      bodies.push(await res.response.clone().text())
    }
    expect(bodies[1]).toBe(bodies[0])
    expect(JSON.parse(bodies[0]).error).toMatch(/^Failed to send test email: Resend 500: /)
  })

  it('sends one test for one press and two for two, each to the same address with the same contact\'s links', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    expect((await testOf(admin, letter)).status).toBe(200)
    expect(emailOutbox).toHaveLength(1)
    expect((await testOf(admin, letter)).status).toBe(200)
    expect(emailOutbox).toHaveLength(2)
    expect(emailOutbox[0].headers!['List-Unsubscribe']).toBe(emailOutbox[1].headers!['List-Unsubscribe'])
    expect(await contacts()).toBe(1)
  })
})

describe('(g) nothing is written on the letter', () => {
  it('leaves the letter\'s row byte for byte as it was, its version, time, writer and send among it, writes no campaign, recipient, choice or activity row, and makes only the person\'s own contact', async () => {
    const admin = await seedAdmin()
    const other = await person('Player Two', 'lca_observer')
    await seedPresident(other)
    const letter = await saved(other)
    const before = { rows: await rows(), traces: await traces() }
    expect((await testOf(admin, letter)).status).toBe(200)
    expect((await testOf(admin, { ...letter, version: letter.version + 1 })).status).toBe(409)
    expect((await testOf(admin, letter, {}, { env: { MAIL_LINK_SECRET: '' } })).status).toBe(503)
    expect(await rows()).toEqual(before.rows)
    const row = await rowOf(letter.id)
    expect([row.version, row.updated_by, row.campaign_id, row.set_aside_at]).toEqual([letter.version, other, null, null])
    expect(await traces()).toEqual({ ...before.traces, sent: 1 })
    expect(await env.DB.prepare('SELECT address FROM mail_contacts').all<{ address: string }>().then((r) => r.results.map((c) => c.address))).toEqual([await emailOf(admin)])
  })
})

describe('(h) with MAIL_PAGE_ON unset', () => {
  it('refuses the letter form exactly as today\'s endpoint refuses a body it cannot read: 400 with today\'s field words, sending nothing and writing nothing', async () => {
    flags.pageOn = false
    const admin = await seedAdmin()
    await seedLetter({ id: 'sample-letter-1', by: admin })
    const before = { rows: await rows(), traces: await traces(), contacts: await contacts() }
    const res = await testOf(admin, { id: 'sample-letter-1', version: 1 })
    expect(res.status).toBe(400)
    // As main's handler answers this body: its schema's words for each of today's three fields.
    expect(await res.response.clone().text()).toBe(JSON.stringify({
      error: 'Some fields are missing or not valid.',
      fields: { to: 'Add the address the test goes to.', subject: 'Add a subject.', bodyHtml: 'Add the message.' },
    }))
    expect({ rows: await rows(), traces: await traces(), contacts: await contacts() }).toEqual(before)
  })

  it('answers today\'s form as today with the switch either way: 200 { sent: true }, to the address typed, in today\'s layout, byte for byte', async () => {
    const admin = await seedAdmin()
    const to = address('reader')
    const html: string[] = []
    for (const pageOn of [false, true]) {
      flags.pageOn = pageOn
      resetHarness()
      const res = await invoke(testPost, { method: 'POST', as: admin, body: { to, ...TODAY } })
      expect(res.status, String(pageOn)).toBe(200)
      expect(await res.response.clone().text(), String(pageOn)).toBe('{"sent":true}')
      expect(emailOutbox.map((e) => [e.to, e.subject]), String(pageOn)).toEqual([[to, `[TEST] ${TODAY.subject}`]])
      html.push(emailOutbox[0].html)
    }
    expect(html[1]).toBe(html[0])
    const contactId = (await contactOf(to))!
    const today = await listMessage(env as unknown as Env, { listId: NEWSLETTER_LIST_ID, contactId, subject: `[TEST] ${TODAY.subject}`, bodyHtml: TODAY.bodyHtml })
    expect(html[0]).toBe(today.html)
  })

  it('gives the guard\'s answer and then the 404 with MAIL_LISTS_ON unset, for the letter form as for today\'s, writing nothing', async () => {
    flags.listsOn = false
    flags.pageOn = false
    const admin = await seedAdmin()
    const seated = await holder()
    for (const [as, status] of [[admin, 404], [seated, 403]] as const) {
      const res = await testOf(as, { id: 'sample-letter-1', version: 1 })
      const today = await invoke(testPost, { method: 'POST', as, body: { to: address('reader'), ...TODAY } })
      expect(res.status).toBe(status)
      expect(await res.response.clone().text()).toBe(await today.response.clone().text())
    }
    expect(emailOutbox).toEqual([])
  })
})

describe('(i) the refusals in today\'s order where they apply', () => {
  it('answers the guard, the 404, the body, the address and the link key before the letter, and the letter\'s state before its words and its size', async () => {
    const admin = await seedAdmin()
    const nowhere = await person('Player One', 'lca_admin', 'player.one@sample.invalid')
    const empty = await saved(admin, { subject: '', bodyHtml: '' })
    const stale = { ...empty, version: empty.version + 1 }
    // The address before the letter: an account mail cannot reach is told so, whatever the letter.
    expect((await testOf(nowhere, stale)).status).toBe(403)
    // The link key before the letter.
    expect((await testOf(admin, stale, {}, { env: { MAIL_LINK_SECRET: '' } })).status).toBe(503)
    // The letter's state before its words.
    expect((await testOf(admin, stale)).status).toBe(409)
    // Its words, once it is the letter named.
    expect(await (await testOf(admin, empty)).json()).toEqual({ error: TEST_NO_SUBJECT_OR_WORDS })
    // With the guard refusing, the body is not read: a body that is not JSON gets the guard's answer.
    const signedOut = await invoke(testPost, { method: 'POST', rawBody: 'not json {', headers: { 'Content-Type': 'application/json' } })
    expect(signedOut.status).toBe(401)
    const notJson = await invoke(testPost, { method: 'POST', as: admin, rawBody: 'not json {', headers: { 'Content-Type': 'application/json' } })
    expect(notJson.status).toBe(400)
    expect(await notJson.json()).toEqual({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } })
    expect(emailOutbox).toEqual([])
  })
})
