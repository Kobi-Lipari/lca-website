// test/integration/newsletter.test.ts
//
// WS16 step 4: the LCA newsletter list and its four admin methods, through
// the real handlers, the real list path of the campaign sender and the real
// seam, on the D1 database every integration test builds from the
// migrations. MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN and
// COMPLAINT_STOPS_OTHER_SENDERS are read through getters on the mocked
// functions/utils/mail/switches, set before every case, so no value the code
// ships with decides one. Every token is signed with the key the harness
// binds, read from the environment; a second, made-up key stands for a
// deployment whose copy differs. Nothing here reaches an outside service:
// the harness answers Resend and the sign-in service.
//
// The newsletter goes out only through Amazon SES, whose sender comes in
// WS16 step 7, so the newsletter's own sends, and the POST's 201 with the
// send behind it, are in that step's suite. This one proves who is on the
// list from the rows createListCampaign writes when it is called directly,
// and the rest of what this step builds:
// - (a) who may use the four methods: an LCA admin with a second factor and
//   the president, the session verified once, and no one else;
// - (b) with MAIL_LISTS_ON unset, a 404 behind the guard from every method,
//   and nothing written;
// - (c) the list as createListCampaign writes it: every address on an
//   account with an active membership, once, and no other, on a list of a
//   few hundred members as well;
// - (e) a link signed for a recipient's contact unsubscribes, the first
//   list campaign row makes the links live whatever the constant says, and
//   the next send leaves the address out;
// - (f) an address that turns the newsletter off after the send began is
//   skipped at its turn, counted in skipped_count and not in failed;
// - (g) one newsletter at a time, two started together making one;
// - (h) the test send carries the real footer and headers, whose links open,
//   and puts the address on no list; (i) event mail in the same case carries
//   neither;
// - (j) while Resend sends, the POST is 409 and writes nothing, and a list
//   campaign waits with its rows back;
// - (k) the stop, its words, its close and its activity row, and the sweep
//   and the next send passing over a stopped newsletter;
// - (m) a list campaign made under another link key sends nothing and says
//   so, and (n) one whose gate cannot be read waits;
// - (o) since WS16 step 5, the summary's words on why the newsletter that
//   is sending waits, the error of its next untried row, and (p) whose
//   words those are: the newsletter's alone, shown to those the guard lets in;
// - and the send's refusals past the first, in their order, each before
//   anything is written.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isListAddress, normalizeAddress } from '../../domain/mail/address'
import { DEFAULT_FROM, SENDER_NAME } from '../../domain/mail/addresses'
import { EVENT_MAIL_STILL_COMES, LIST_FOOTER_WORDS, PREFERENCES_LABEL } from '../../domain/mail/footer'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as campaignsGet } from '../../functions/api/admin/campaigns'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as stopPost } from '../../functions/api/admin/mail/newsletter/stop'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { onRequestGet as preferencesGet } from '../../functions/api/mail/preferences/[token]'
import { onRequestGet as unsubscribeGet, onRequestPost as unsubscribePost } from '../../functions/api/mail/unsubscribe/[token]'
import { onRequestPost as registrationPost } from '../../functions/api/registrations'
import { LINK_KEY_DIFFERS_WORDS, MAIL_KEY_MISSING_WORDS, processCampaign, sweepPendingCampaigns } from '../../functions/utils/admin/campaigns'
import { escapeHtml } from '../../functions/utils/emailLayout'
import { GATE_UNREAD_LOG } from '../../functions/utils/mail/gate'
import { linkKeyCheck, signLink } from '../../functions/utils/mail/links'
import { createListCampaign, NEWSLETTER_AUDIENCE_SQL, newsletterSummary, STOPPED_WORDS, stopListCampaign } from '../../functions/utils/mail/lists'
import { ALREADY_SENDING, LINK_KEY_MISSING, NOBODY_ON_THE_LIST, NOTHING_SENDING, WAITS_FOR_SES } from '../../functions/utils/mail/newsletterAnswers'
import { GATE_UNREAD_WORDS, WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMailContact, seedMember, seedTournament } from './factories'
import { emailOutbox, fetchCount, invoke, resetHarness } from './harness'
import { bindings, countingDb, noLongerReceives } from './mailRuns'
import { campaignOf, rowsOf, stageCampaign } from './campaignRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
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

const SITE = 'https://www.louisianachess.org'
/** A second made-up key, for a deployment whose copy of the key differs from the site's; the harness binds the first. */
const OTHER_KEY = 'test-made-up-other-link-key-2291'
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string

/** A newsletter's words, plainly made up. */
const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }

let seq = 0
/** An address of the harness's own kind, which every list may send to. */
const address = (name: string) => `${name}-${++seq}@newsletter.test.lca`

/** A member with an active membership by default, named as sample members are. */
const member = (email: string, opts: { membershipStatus?: string; role?: string } = {}) => seedMember({ email, fullName: 'Player One', ...opts })

/** A send made as the POST makes one, under the harness's key. */
async function makeSend(by: string, linkCheck?: string) {
  return createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: by, linkCheck: linkCheck ?? (await linkKeyCheck(key())) })
}

/** What every newsletter write would leave a trace in, counted, to show a call wrote nothing. */
async function traces() {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    recipients: await count('SELECT COUNT(*) AS n FROM email_campaign_recipients'),
    contacts: await count('SELECT COUNT(*) AS n FROM mail_contacts'),
    choices: await count('SELECT COUNT(*) AS n FROM mail_list_choices'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
  }
}

/**
 * Who the newsletter goes to, worked out here from the members table and the mail tables with the address rules of
 * domain/mail/address.ts, apart from the SQL under test: every address on an account with an active membership that is
 * not a walk-in and is a list address, once, less an 'out' on the newsletter, a stop-all and the do-not-send list.
 */
async function expectedRecipients(): Promise<string[]> {
  const { results: members } = await env.DB.prepare('SELECT email, membership_status, role FROM members').all<{ email: string | null; membership_status: string; role: string }>()
  const audience = new Set(
    members.filter((m) => m.membership_status === 'active' && m.role !== 'guest' && m.email !== null && isListAddress(m.email)).map((m) => normalizeAddress(m.email!)),
  )
  const addressesOf = async (sql: string) => new Set((await env.DB.prepare(sql).bind(NEWSLETTER_LIST_ID).all<{ address: string }>()).results.map((r) => r.address))
  const out = await addressesOf(`SELECT c.address AS address FROM mail_contacts c JOIN mail_list_choices ch ON ch.contact_id = c.id WHERE ch.list_id = ?1 AND ch.choice = 'out'`)
  const off = await addressesOf('SELECT address FROM mail_contacts WHERE optional_off_at IS NOT NULL AND ?1 IS NOT NULL')
  const dead = await addressesOf('SELECT address FROM mail_do_not_send WHERE ?1 IS NOT NULL')
  return [...audience].filter((a) => !out.has(a) && !off.has(a) && !dead.has(a)).sort()
}

const sortedEmails = async (campaignId: string) => (await rowsOf(campaignId)).map((r) => r.email).sort()

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('(a) who may use the newsletter\'s four methods', () => {
  const methods = [
    ['GET /api/admin/mail/newsletter', () => ({ handler: newsletterGet, options: {} })],
    ['POST /api/admin/mail/newsletter', () => ({ handler: newsletterPost, options: { method: 'POST', body: SAMPLE } })],
    ['POST /api/admin/mail/newsletter/test', () => ({ handler: testPost, options: { method: 'POST', body: { to: address('tester'), ...SAMPLE } } })],
    ['POST /api/admin/mail/newsletter/stop', () => ({ handler: stopPost, options: { method: 'POST' } })],
  ] as const

  it('refuses a plain member, an officer, a club rep and an LCA admin without a second factor on all four, and a signed-out caller with 401', async () => {
    const plain = await member(address('plain'))
    const officer = await member(address('officer'), { role: 'lca_officer' })
    const rep = await member(address('rep'), { role: 'club_rep' })
    const admin = await seedAdmin()
    const before = await traces()
    for (const [name, call] of methods) {
      const { handler, options } = call()
      expect((await invoke(handler, options)).status, `${name}, signed out`).toBe(401)
      for (const who of [plain, officer, rep]) expect((await invoke(handler, { ...options, as: who })).status, `${name}, ${who}`).toBe(403)
      const noSecondFactor = await invoke(handler, { ...options, as: admin, aal: 'aal1' })
      expect(noSecondFactor.status, `${name}, an admin without a second factor`).toBe(403)
      expect((await noSecondFactor.json()).mfaRequired, name).toBe(true)
    }
    expect(await traces()).toEqual(before)
  })

  it('lets an LCA admin with a second factor and the president read, test and stop, and pass the guard on the send, which waits for Amazon SES', async () => {
    const admin = await seedAdmin()
    const president = await member(address('president'), { role: 'lca_observer' })
    await member(address('reader'))
    for (const who of [admin, president]) {
      const read = await invoke(newsletterGet, { as: who, aal: who === president ? 'aal1' : 'aal2' })
      expect(read.status, who).toBe(200)
      const send = await invoke(newsletterPost, { as: who, method: 'POST', body: SAMPLE })
      expect(send.status, who).toBe(409)
      expect(await send.json(), who).toEqual({ error: WAITS_FOR_SES })
      const test = await invoke(testPost, { as: who, method: 'POST', body: { to: address('tester'), ...SAMPLE } })
      expect(test.status, who).toBe(200)
      const stop = await invoke(stopPost, { as: who, method: 'POST' })
      expect(stop.status, who).toBe(409)
      expect(await stop.json(), who).toEqual({ error: NOTHING_SENDING })
    }
  })

  it('verifies the session once, where Group email\'s guard verifies an LCA admin\'s twice', async () => {
    const admin = await seedAdmin()
    await invoke(newsletterGet, { as: admin })
    expect(fetchCount).toBe(1)
    resetHarness()
    await invoke(campaignsGet, { as: admin })
    expect(fetchCount).toBe(2)
  })
})

describe('(b) with MAIL_LISTS_ON unset', () => {
  it('answers every method 404 behind the guard, writing nothing, and a signed-out caller and a plain member get the guard\'s answer', async () => {
    flags.listsOn = false
    const admin = await seedAdmin()
    const president = await member(address('president'), { role: 'lca_observer' })
    const plain = await member(address('plain'))
    const before = await traces()
    for (const [handler, options] of [
      [newsletterGet, {}],
      [newsletterPost, { method: 'POST', body: SAMPLE }],
      [testPost, { method: 'POST', body: { to: address('tester'), ...SAMPLE } }],
      [stopPost, { method: 'POST' }],
    ] as const) {
      for (const who of [admin, president]) {
        const res = await invoke(handler, { ...options, as: who })
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: 'Not found' })
      }
      expect((await invoke(handler, options)).status).toBe(401)
      expect((await invoke(handler, { ...options, as: plain })).status).toBe(403)
    }
    expect(emailOutbox).toEqual([])
    expect(await traces()).toEqual(before)
  })
})

describe('(c) the list, as createListCampaign writes its rows', () => {
  it('holds every address on an account with an active membership once, and no other address, whatever choice it holds', async () => {
    const admin = await seedAdmin()
    const family = address('family')
    const parent = await member(family)
    for (const child of [await member(family.toUpperCase()), await member(`  ${family}  `)]) {
      await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    }
    const active = address('active')
    await member(active)
    const lapsedWithIn = address('lapsed-in')
    await member(lapsedWithIn, { membershipStatus: 'expired' })
    await seedMailContact({ address: lapsedWithIn, choices: { [NEWSLETTER_LIST_ID]: { choice: 'in', source: 'preferences' } } })
    const lapsed = address('lapsed')
    await member(lapsed, { membershipStatus: 'expired' })
    const never = address('never')
    await member(never, { membershipStatus: 'pending' })
    const guest = address('guest')
    await member(guest, { role: 'guest' })
    await member(`guest-${++seq}@walkin.lca.invalid`, { role: 'guest' })
    await member(`reserved-${++seq}@club.invalid`)
    await member(`sample-${++seq}@example.org`)
    const dead = address('dead')
    await member(dead)
    await noLongerReceives(dead)
    const turnedOff = address('turned-off')
    await member(turnedOff)
    await seedMailContact({ address: turnedOff, choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    const stoppedAll = address('stopped-all')
    await member(stoppedAll)
    await seedMailContact({ address: stoppedAll, optionalOffAt: '2026-11-01 10:00:00' })
    const typedIn = address('typed-in')
    await seedMailContact({ address: typedIn })
    const noAccountWithIn = address('no-account')
    await seedMailContact({ address: noAccountWithIn, choices: { [NEWSLETTER_LIST_ID]: { choice: 'in', source: 'signup' } } })

    const made = await makeSend(admin)
    expect(made).not.toBeNull()
    const emails = await sortedEmails(made!.campaignId)
    // Compared with a count this case reads: the migrations seed members of their own, and the file's other cases seed more.
    expect(emails).toEqual(await expectedRecipients())
    expect(made!.totalRecipients).toBe(emails.length)
    expect(emails.filter((e) => e === family)).toHaveLength(1)
    expect(emails).toContain(active)
    for (const left of [lapsedWithIn, lapsed, never, guest, dead, turnedOff, stoppedAll, typedIn, noAccountWithIn]) expect(emails, left).not.toContain(left)
    expect(emails.filter((e) => /\.invalid$|@example\.(?:org|com|net)$|@louisianachess\.org$/.test(e))).toEqual([])

    const rows = await rowsOf(made!.campaignId)
    const contacts = new Map((await env.DB.prepare('SELECT id, address FROM mail_contacts').all<{ id: string; address: string }>()).results.map((c) => [c.address, c.id]))
    for (const row of rows) {
      expect(row.contact_id, row.email).toBe(contacts.get(row.email))
      expect(row.status, row.email).toBe('pending')
    }
    const memberIds = await env.DB.prepare('SELECT COUNT(*) AS n FROM email_campaign_recipients WHERE member_id IS NOT NULL').first<{ n: number }>()
    expect(memberIds!.n).toBe(0)
    expect(await campaignOf(made!.campaignId)).toMatchObject({ status: 'sending', list_id: NEWSLETTER_LIST_ID, total_recipients: emails.length, skipped_count: 0 })
    expect(JSON.parse((await campaignOf(made!.campaignId))!.filter_json)).toEqual({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()) })
    // Every address of the audience has a contact now, and none of them a choice it did not have.
    const choices = await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_list_choices').first<{ n: number }>()
    expect(choices!.n).toBe(3)
  })

  it('writes, counts and stops a list of a few hundred members, its statements inside D1\'s limits whatever the list\'s size', async () => {
    const admin = await seedAdmin()
    const many = Array.from({ length: 300 }, (_, i) => `bulk-${String(i).padStart(3, '0')}-${++seq}@newsletter.test.lca`)
    const inserts = many.map((email, i) =>
      env.DB.prepare(`INSERT INTO members (id, email, full_name, membership_status, role) VALUES (?, ?, 'Player One', 'active', 'member')`).bind(`bulk-${seq}-${i}`, email),
    )
    for (let at = 0; at < inserts.length; at += 50) await env.DB.batch(inserts.slice(at, at + 50))
    await noLongerReceives(many[7])

    const expected = await expectedRecipients()
    const summary = await newsletterSummary(env.DB)
    expect(summary.willGet).toBe(expected.length)
    expect(summary.doNotSend).toBe(1)
    const made = await makeSend(admin)
    expect(made!.totalRecipients).toBe(expected.length)
    expect(await sortedEmails(made!.campaignId)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(299)

    // The list path reads its gate for the batch it claims, and the stop fails every row it has not marked.
    expect(await processCampaign(bindings, made!.campaignId, 120)).toEqual({ sent: 0, failed: 0, remaining: expected.length, done: false })
    expect(await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)).toBe(expected.length)
    expect((await newsletterSummary(env.DB)).recent[0]).toMatchObject({ id: made!.campaignId, status: 'failed', failedCount: expected.length })
  })
})

describe('(e) the links', () => {
  it('a link signed for a recipient\'s contact unsubscribes, live from the first list campaign row whatever the constant says, and the next send leaves the address out', async () => {
    flags.listsOn = false
    const admin = await seedAdmin()
    const reader = address('reader')
    await member(reader)
    const contactId = await seedMailContact({ address: reader })
    const token = await signLink(key(), contactId, 'unsubscribe', NEWSLETTER_LIST_ID)
    const oneClick = () => invoke(unsubscribePost, { method: 'POST', params: { token }, rawBody: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })

    // No list email on record and the constant unset: the link is not live yet.
    expect((await oneClick()).status).toBe(404)
    const first = await makeSend(admin)
    expect(await sortedEmails(first!.campaignId)).toContain(reader)
    // The first list campaign row makes every link live, with MAIL_LISTS_ON still unset.
    expect((await oneClick()).status).toBe(200)
    expect(await env.DB.prepare('SELECT choice FROM mail_list_choices WHERE contact_id = ?').bind(contactId).first()).toEqual({ choice: 'out' })

    await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)
    const next = await makeSend(admin)
    expect(await sortedEmails(next!.campaignId)).not.toContain(reader)
  })
})

describe('(f) an address that turns the newsletter off after the send began', () => {
  it('is skipped at its turn: taken out of the campaign, counted in skipped_count and out of the total, not in failed', async () => {
    const admin = await seedAdmin()
    const leaving = address('leaving')
    const staying = address('staying')
    await member(leaving)
    await member(staying)
    const made = await makeSend(admin)
    const total = made!.totalRecipients
    const contact = await env.DB.prepare('SELECT id FROM mail_contacts WHERE address = ?').bind(leaving).first<{ id: string }>()
    await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, ?, 'out', 'link')`).bind(contact!.id, NEWSLETTER_LIST_ID).run()

    expect(await processCampaign(bindings, made!.campaignId, 1000)).toEqual({ sent: 0, failed: 0, remaining: total - 1, done: false })
    expect(await sortedEmails(made!.campaignId)).not.toContain(leaving)
    expect(await sortedEmails(made!.campaignId)).toContain(staying)
    expect(await campaignOf(made!.campaignId)).toMatchObject({ skipped_count: 1, total_recipients: total - 1, failed_count: 0, sent_count: 0 })
  })
})

describe('(g) one newsletter at a time', () => {
  it('makes no second send while one is sending, and two started together make one', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    const first = await makeSend(admin)
    expect(first).not.toBeNull()
    expect(await makeSend(admin)).toBeNull()
    await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)

    const together = await Promise.all([makeSend(admin), makeSend(admin)])
    expect(together.filter((made) => made !== null)).toHaveLength(1)
    const sending = await env.DB.prepare(`SELECT COUNT(*) AS n FROM email_campaigns WHERE list_id = ? AND status = 'sending'`).bind(NEWSLETTER_LIST_ID).first<{ n: number }>()
    expect(sending!.n).toBe(1)
    const made = together.find((m) => m !== null)!
    expect(await rowsOf(made.campaignId)).toHaveLength(made.totalRecipients)
  })
})

describe('(h) the test send, and (i) event mail beside it', () => {
  it('carries the real footer and the two headers for its address, whose links open, puts the address on no list, and event mail carries neither', async () => {
    const admin = await seedAdmin()
    const to = address('tester')
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: `  ${to.toUpperCase()} `, ...SAMPLE } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: true })

    const [test] = emailOutbox.filter((e) => e.to === to)
    expect(test.subject).toBe(`[TEST] ${SAMPLE.subject}`)
    expect(test.from).toBe(`${SENDER_NAME} <${DEFAULT_FROM}>`)
    expect(Object.keys(test.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
    const unsubscribeToken = /^<https:\/\/www\.louisianachess\.org\/api\/mail\/unsubscribe\/([^<>\s,]+)>$/.exec(test.headers!['List-Unsubscribe'])?.[1]
    expect(unsubscribeToken).toBeDefined()
    expect(test.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    const words = LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID]
    for (const piece of [escapeHtml(words.reason), escapeHtml(words.unsubscribeLabel), PREFERENCES_LABEL, `${SITE}/email/unsubscribe/${unsubscribeToken}`]) expect(test.html, piece).toContain(piece)
    const preferencesToken = new RegExp(`${SITE.replace(/[.]/g, '\\.')}/email/preferences/([^"<>\\s]+)`).exec(test.html)?.[1]
    expect(preferencesToken).toBeDefined()
    expect(test.html).not.toMatch(/\bP\.?\s?O\.?\s+Box\b|\bSuite\b|\b\d{5}(?:-\d{4})?\b/i)

    // The contact was made for the address, and it is on no list.
    const contact = await env.DB.prepare('SELECT id FROM mail_contacts WHERE address = ?').bind(to).first<{ id: string }>()
    expect(contact).not.toBeNull()
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_list_choices WHERE contact_id = ?').bind(contact!.id).first()).toEqual({ n: 0 })

    // The links open on the two public endpoints: the page's question, the preferences, and the one-click POST.
    const asked = await invoke(unsubscribeGet, { params: { token: unsubscribeToken! }, headers: { Accept: 'application/json' } })
    expect(await asked.json()).toEqual({ list: 'LCA newsletter' })
    const choices = await invoke(preferencesGet, { params: { token: decodeURIComponent(preferencesToken!) } })
    expect(choices.status).toBe(200)
    const oneClick = await invoke(unsubscribePost, { method: 'POST', params: { token: unsubscribeToken! }, rawBody: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    expect(oneClick.status).toBe(200)

    // Someone who turned the newsletter off can still send themselves a test.
    const again = await invoke(testPost, { as: admin, method: 'POST', body: { to, ...SAMPLE } })
    expect(again.status).toBe(200)
    expect(emailOutbox.filter((e) => e.to === to)).toHaveLength(2)

    // A registration confirmation in the same case: no headers, no footer.
    const player = address('player')
    const playerId = await member(player)
    const tournamentId = await seedTournament({ name: 'Sample Winter Open', sections: [{ name: 'Open', entryFee: 0 }] })
    expect((await invoke(registrationPost, { method: 'POST', as: playerId, body: { tournamentId, section: 'Open' } })).status).toBe(201)
    const [confirmation] = emailOutbox.filter((e) => e.to === player)
    expect(confirmation.subject).toBe("You're registered: Sample Winter Open")
    expect(confirmation.headers).toBeUndefined()
    for (const piece of [escapeHtml(words.reason), escapeHtml(words.unsubscribeLabel), PREFERENCES_LABEL, '/email/unsubscribe/', escapeHtml(EVENT_MAIL_STILL_COMES)]) {
      expect(confirmation.html, piece).not.toContain(piece)
    }
  })
})

describe('(j) while Resend sends', () => {
  it('the POST is 409 and writes nothing, and a list campaign staged by hand waits with its rows back and nothing in the outbox', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    const before = await traces()
    const res = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: WAITS_FOR_SES })
    expect(await traces()).toEqual(before)

    const people = [address('waiting'), address('waiting')]
    const contacts = [await seedMailContact({ address: people[0] }), await seedMailContact({ address: people[1] })]
    const id = await stageCampaign({
      listId: NEWSLETTER_LIST_ID,
      filterJson: JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()) }),
      recipients: people.map((email, i) => ({ email, contactId: contacts[i] })),
    })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 2, done: false })
    const rows = await rowsOf(id)
    expect(rows.map((r) => [r.status, r.claimed_at, r.sending_at, r.attempts])).toEqual([['pending', null, null, 0], ['pending', null, null, 0]])
    expect(rows.map((r) => r.error)).toContain(WAIT_FOR_SES_WORDS)
    expect(emailOutbox).toEqual([])
    expect(await campaignOf(id)).toMatchObject({ status: 'sending' })
  })
})

describe('(k) the stop', () => {
  it('fails the untried rows with the words, leaves a row marked sending to its run, closes the send, and logs it with no address', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    await member(address('reader'))
    const made = await makeSend(admin)
    const [inFlight] = await rowsOf(made!.campaignId)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = datetime('now'), sending_at = datetime('now'), attempts = 1 WHERE id = ?`).bind(inFlight.id).run()

    const res = await invoke(stopPost, { as: admin, method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stopped: made!.totalRecipients - 1 })
    const rows = await rowsOf(made!.campaignId)
    expect(rows.find((r) => r.id === inFlight.id)).toMatchObject({ status: 'pending' })
    expect(rows.filter((r) => r.id !== inFlight.id).every((r) => r.status === 'failed' && r.error === STOPPED_WORDS)).toBe(true)
    expect(await campaignOf(made!.campaignId)).toMatchObject({ status: 'failed', failed_count: made!.totalRecipients - 1 })

    const logged = await env.DB.prepare(`SELECT target_label, detail FROM admin_audit_log WHERE action = 'group_email_stopped' ORDER BY rowid DESC LIMIT 1`).first<{ target_label: string; detail: string }>()
    expect(logged!.target_label).toBe(SAMPLE.subject)
    expect(JSON.parse(logged!.detail)).toEqual({ campaign_id: made!.campaignId, stopped: made!.totalRecipients - 1 })
    expect(logged!.detail).not.toContain('@')

    // A second press finds nothing sending; the sweep and the next send pass over the stopped one.
    expect((await invoke(stopPost, { as: admin, method: 'POST' })).status).toBe(409)
    expect((await sweepPendingCampaigns(bindings)).campaignsTouched).toBe(0)
    expect(await makeSend(admin)).not.toBeNull()
  })

  it('still stops a newsletter after the switch is reverted, and answers 404 once none is sending', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    const made = await makeSend(admin)
    flags.listsOn = false
    const res = await invoke(stopPost, { as: admin, method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stopped: made!.totalRecipients })
    expect((await invoke(stopPost, { as: admin, method: 'POST' })).status).toBe(404)
  })
})

describe('(m) the link key a list campaign was made with', () => {
  it('sends nothing from a deployment whose key differs, claims nothing and says so in the history; the previous key passes, and no key says it is missing', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    const made = await makeSend(admin, await linkKeyCheck(OTHER_KEY))
    const id = made!.campaignId
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: made!.totalRecipients, done: false })
    let rows = await rowsOf(id)
    expect(rows.every((r) => r.claimed_at === null && r.attempts === 0 && r.status === 'pending')).toBe(true)
    expect(rows[0].error).toBe(LINK_KEY_DIFFERS_WORDS)

    // While the key is being changed, the key before it is the one the campaign was made with: it may go, and waits for Amazon SES.
    expect(await processCampaign({ ...bindings, MAIL_LINK_SECRET_PREVIOUS: OTHER_KEY } as never, id)).toEqual({ sent: 0, failed: 0, remaining: made!.totalRecipients, done: false })
    rows = await rowsOf(id)
    expect(rows.map((r) => r.error)).toContain(WAIT_FOR_SES_WORDS)

    expect(await processCampaign({ ...bindings, MAIL_LINK_SECRET: '' } as never, id)).toEqual({ sent: 0, failed: 0, remaining: made!.totalRecipients, done: false })
    rows = await rowsOf(id)
    expect(rows.find((r) => r.error === MAIL_KEY_MISSING_WORDS)).toBeDefined()
    expect(emailOutbox).toEqual([])
  })
})

describe('(n) a gate that cannot be read', () => {
  it('holds the newsletter back: every claimed row goes back untried, with the words, and one log line that names no address', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    const made = await makeSend(admin)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { db } = countingDb({ refuse: 'mail_do_not_send' })
    expect(await processCampaign({ ...bindings, DB: db } as never, made!.campaignId)).toEqual({ sent: 0, failed: 0, remaining: made!.totalRecipients, done: false })
    const rows = await rowsOf(made!.campaignId)
    expect(rows.every((r) => r.status === 'pending' && r.claimed_at === null && r.attempts === 0)).toBe(true)
    expect(rows.map((r) => r.error)).toContain(GATE_UNREAD_WORDS)
    expect(warn.mock.calls.filter(([words]) => words === GATE_UNREAD_LOG)).toHaveLength(1)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('@')
    expect(emailOutbox).toEqual([])
  })
})

describe('(o) why a sending newsletter waits, in the summary (WS16 step 5)', () => {
  it('answers the words on the next untried row of the newsletter that is sending, and null when none is sending, that row holds none or a run has it', async () => {
    const admin = await seedAdmin()
    const read = async () => (await (await invoke(newsletterGet, { as: admin })).json<{ summary: { waits: string | null } }>()).summary.waits
    expect(await read()).toBeNull()
    for (let i = 0; i < 3; i += 1) await member(address('reader'))
    const made = await makeSend(admin, await linkKeyCheck(OTHER_KEY))
    const id = made!.campaignId
    // Made and not tried yet: its rows hold no words.
    expect(await read()).toBeNull()

    // A deployment whose key differs claims nothing and writes why on the next row.
    await processCampaign(bindings, id)
    expect(await read()).toBe(LINK_KEY_DIFFERS_WORDS)
    expect((await newsletterSummary(env.DB)).waits).toBe(LINK_KEY_DIFFERS_WORDS)
    // Under the key before, it may go, and waits for Amazon SES while Resend sends.
    await processCampaign({ ...bindings, MAIL_LINK_SECRET_PREVIOUS: OTHER_KEY } as never, id)
    expect(await read()).toBe(WAIT_FOR_SES_WORDS)

    // A row a run has marked sending is not the next untried row: the one after it, which holds no words, is.
    const [first] = await rowsOf(id)
    expect(first.error).toBe(WAIT_FOR_SES_WORDS)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = datetime('now'), sending_at = datetime('now') WHERE id = ?`).bind(first.id).run()
    expect(await read()).toBeNull()

    // Once stopped, no newsletter is sending, whatever its rows hold.
    expect((await invoke(stopPost, { as: admin, method: 'POST' })).status).toBe(200)
    expect(await read()).toBeNull()
    expect(emailOutbox).toEqual([])
  })
})

describe('(p) the waiting words belong to the newsletter and to those who may read it (WS16 step 5)', () => {
  it('reads no words from another list\'s campaign or from Group email\'s, whichever is sending', async () => {
    const admin = await seedAdmin()
    const read = async () => (await (await invoke(newsletterGet, { as: admin })).json<{ summary: { waits: string | null } }>()).summary.waits
    const words = 'Not sent yet: sample words for another send.'
    for (const listId of [null, TOURNAMENTS_LIST_ID]) {
      const id = await stageCampaign({ listId, recipients: [{ email: address('reader') }] })
      await env.DB.prepare('UPDATE email_campaign_recipients SET error = ? WHERE campaign_id = ?').bind(words, id).run()
      expect(await read(), String(listId)).toBeNull()
    }
  })

  it('shows the words to no one the guard refuses, and to no one at all while MAIL_LISTS_ON is unset', async () => {
    const admin = await seedAdmin()
    const plain = await member(address('plain'))
    const officer = await member(address('officer'), { role: 'lca_officer' })
    await member(address('reader'))
    const made = await makeSend(admin, await linkKeyCheck(OTHER_KEY))
    await processCampaign(bindings, made!.campaignId)
    expect((await invoke(newsletterGet, { as: admin })).status).toBe(200)
    for (const res of [
      await invoke(newsletterGet),
      await invoke(newsletterGet, { as: plain }),
      await invoke(newsletterGet, { as: officer }),
      await invoke(newsletterGet, { as: admin, aal: 'aal1' }),
    ]) {
      expect([401, 403]).toContain(res.status)
      expect(JSON.stringify(await res.json())).not.toContain(LINK_KEY_DIFFERS_WORDS)
    }
    flags.listsOn = false
    const off = await invoke(newsletterGet, { as: admin })
    expect(off.status).toBe(404)
    expect(await off.json()).toEqual({ error: 'Not found' })
  })
})

describe('the send\'s refusals past the first, in their order', () => {
  it('without the link key 503, with nobody on the list 400, and while one is sending 409, each before anything is written', async () => {
    // The sender is read as Amazon SES's here, which has no transport until WS16 step 7, so the POST passes its first
    // refusal; none of the three answers below reaches a send.
    flags.sender = 'ses'
    const admin = await seedAdmin()
    await member(address('reader'))
    let before = await traces()
    const noKey = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE, env: { MAIL_LINK_SECRET: '' } })
    expect(noKey.status).toBe(503)
    expect(await noKey.json()).toEqual({ error: LINK_KEY_MISSING })
    expect(await traces()).toEqual(before)

    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason) SELECT a.address, 'admin' FROM (${NEWSLETTER_AUDIENCE_SQL}) a`).run()
    before = await traces()
    const nobody = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(nobody.status).toBe(400)
    expect(await nobody.json()).toEqual({ error: NOBODY_ON_THE_LIST })
    expect(await traces()).toEqual(before)
    await env.DB.prepare('DELETE FROM mail_do_not_send').run()

    await makeSend(admin)
    before = await traces()
    const sending = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(sending.status).toBe(409)
    expect(await sending.json()).toEqual({ error: ALREADY_SENDING })
    expect(await traces()).toEqual(before)
  })

  it('refuses a body its contract does not take with the field errors, before the first refusal', async () => {
    const admin = await seedAdmin()
    const res = await invoke(newsletterPost, { as: admin, method: 'POST', body: { subject: '   ', bodyHtml: SAMPLE.bodyHtml } })
    expect(res.status).toBe(400)
    expect(Object.keys((await res.json<{ fields: Record<string, string> }>()).fields)).toEqual(['subject'])
  })
})
