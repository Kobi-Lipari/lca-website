// test/integration/mail-email-choices.test.ts
//
// WS16 step 3: the two public endpoints a link in optional email opens, and
// the seam's two rules for list mail, through the real handlers and the
// real seam on the D1 database every integration test builds from the
// migrations, 0060 among them. MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN and
// COMPLAINT_STOPS_OTHER_SENDERS are read through getters on the mocked
// functions/utils/mail/switches, set before every case, so no value the
// code ships with decides one. Every token is signed here with the key the
// harness binds, read from the environment. Nothing here reaches an
// outside service: the harness answers Resend and the sign-in service.
//
// - The one-click POST of RFC 8058, in multipart and urlencoded form and as
//   the page's empty JSON: 200 with no Location and no Set-Cookie, the
//   person's 'out' on that one list, and a second and a third POST that
//   change nothing; no cookie and no sign-in read.
// - The GET of the header's address: 303 to the page on the configured
//   site, or the list's name for a GET that asks for JSON; neither writes.
// - A link that does not open: a stranger's tokens of every kind, a contact
//   or a list that is not there, no key, and links not live yet, each 404
//   with the fixed words, writing nothing, the stranger's tokens reading
//   nothing, as a token that never existed; a list email on record keeps
//   the links working with the constant unset, and the previous key keeps
//   the old links working while the key is changed.
// - Choices per list: an unsubscribe leaves every other choice as it was,
//   an address with no member account holds one, and event and account
//   mail still reaches an address that turned everything off.
// - The email preferences endpoint: the newsletter listed for its audience
//   alone, on and off and the stop-all saved, a list not shown refused, an
//   address outside the audience never turning the newsletter on, and a
//   spam report's mark on a list that is not a main mailer, lifted by the
//   person's own choice, read by the gate's own rule.
// - The seam: list mail without its list or its one-click headers refused
//   before the gate and any service, list mail never handed to Resend, a
//   test send through Resend with its headers from noreply@, and event
//   mail's request carrying no headers.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM, SENDER_NAME } from '../../domain/mail/addresses'
import { LIST_FOOTER_WORDS } from '../../domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestOptions as preferencesOptions, onRequestGet as preferencesGet, onRequestPatch as preferencesPatch } from '../../functions/api/mail/preferences/[token]'
import { onRequestOptions as unsubscribeOptions, onRequestGet as unsubscribeGet, onRequestPost as unsubscribePost } from '../../functions/api/mail/unsubscribe/[token]'
import { onRequestPost as registrationPost } from '../../functions/api/registrations'
import { renderEmail } from '../../functions/utils/emailLayout'
import { listMailParts } from '../../functions/utils/mail/footer'
import { LINK_NOT_WORKING } from '../../functions/utils/mail/linkAnswers'
import { MailLinkKeyMissing, signLink } from '../../functions/utils/mail/links'
import { inNewsletterAudience, listAddressSql, NEWSLETTER_AUDIENCE_SQL } from '../../functions/utils/mail/lists'
import { classifyOnce } from '../../functions/utils/mail/outcome'
import { deliver, ONE_CLICK, REFUSAL_WORDS, WAIT_FOR_SES_WORDS, type MailHeader } from '../../functions/utils/mail/send'
import { isListAddress, normalizeAddress } from '../../domain/mail/address'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMailContact, seedMember, seedTournament, type SeedMailContactOptions } from './factories'
import { emailOutbox, fetchCount, invoke, resetHarness } from './harness'
import { bindings, countingDb, message } from './mailRuns'

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

/** A list that is not one of LCA's main mailers, seeded for the cases that need one, since part one has none. */
const CLUB_LIST = 'club-example'
const CLUB_LIST_NAME = 'Example Chess Club news'
const SITE = 'https://www.louisianachess.org'
/** A second made-up key, for a change of key and for a stranger's signature; the harness binds the first. */
const OTHER_KEY = 'test-made-up-other-link-key-1187'
const key = () => (env as unknown as Env).MAIL_LINK_SECRET

const unsubscribeToken = (contactId: string, listId: string = NEWSLETTER_LIST_ID, secret = key()) => signLink(secret, contactId, 'unsubscribe', listId)
const preferencesToken = (contactId: string, secret = key()) => signLink(secret, contactId, 'preferences')

/** Every choice and every contact, as the tables hold them, to show that a call wrote nothing. */
async function tables() {
  const choices = await env.DB.prepare('SELECT contact_id, list_id, choice, source, updated_at FROM mail_list_choices ORDER BY contact_id, list_id').all()
  const contacts = await env.DB.prepare('SELECT id, address, optional_off_at, complained_at FROM mail_contacts ORDER BY id').all()
  return { choices: choices.results, contacts: contacts.results }
}

const choiceOf = (contactId: string, listId: string = NEWSLETTER_LIST_ID) =>
  env.DB.prepare('SELECT choice, source, updated_at FROM mail_list_choices WHERE contact_id = ? AND list_id = ?')
    .bind(contactId, listId).first<{ choice: string; source: string; updated_at: string }>()

const contactRow = (id: string) =>
  env.DB.prepare('SELECT optional_off_at, complained_at FROM mail_contacts WHERE id = ?').bind(id).first<{ optional_off_at: string | null; complained_at: string | null }>()

async function seedClubList(): Promise<void> {
  await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer) VALUES (?, 'club', ?, 0)`).bind(CLUB_LIST, CLUB_LIST_NAME).run()
}

/** A list email on record, as WS16 step 4's send leaves one: a campaign row with its list named. */
async function listEmailOnRecord(): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, status, list_id) VALUES (?, 'Sample newsletter', '<p>Hi</p>', '{}', 0, 'completed', ?)`,
  ).bind(`campaign-list-${Date.now().toString(36)}`, NEWSLETTER_LIST_ID).run()
}

/** A member with an active membership and a contact for the address, as the newsletter's send makes one. */
async function memberContact(address: string, opts: Omit<SeedMailContactOptions, 'address'> = {}) {
  await seedMember({ email: address, fullName: 'Player One' })
  return seedMailContact({ address, ...opts })
}

const MULTIPART_BOUNDARY = 'sample-boundary-7f3a'
const BODIES = {
  multipart: {
    rawBody: `--${MULTIPART_BOUNDARY}\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--${MULTIPART_BOUNDARY}--\r\n`,
    headers: { 'Content-Type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}` },
  },
  urlencoded: { rawBody: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  'the page\'s empty JSON': { rawBody: '{}', headers: { 'Content-Type': 'application/json' } },
  'no body at all': { rawBody: undefined, headers: {} },
} as const

const post = (token: string, body: { rawBody?: string; headers: Record<string, string> } = BODIES.urlencoded, extra: { env?: Partial<Env>; as?: string } = {}) =>
  invoke(unsubscribePost, { method: 'POST', params: { token }, path: `/api/mail/unsubscribe/${token}`, rawBody: body.rawBody, headers: { ...body.headers }, ...extra })
const getLink = (token: string, accept?: string, extra: { env?: Partial<Env>; as?: string } = {}) =>
  invoke(unsubscribeGet, { params: { token }, path: `/api/mail/unsubscribe/${token}`, headers: accept ? { Accept: accept } : {}, ...extra })
const getChoices = (token: string, extra: { env?: Partial<Env>; as?: string } = {}) =>
  invoke(preferencesGet, { params: { token }, path: `/api/mail/preferences/${token}`, ...extra })
const patchChoices = (token: string, body: unknown, extra: { env?: Partial<Env>; as?: string } = {}) =>
  invoke(preferencesPatch, { method: 'PATCH', params: { token }, path: `/api/mail/preferences/${token}`, body, ...extra })

/** The two one-click headers as a newsletter message carries them, for a contact. */
const listHeaders = async (contactId: string): Promise<MailHeader[]> =>
  (await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: key() }, { contactId, listId: NEWSLETTER_LIST_ID })).headers

/** The same pair for a list that has no footer words of its own, such as the club list seeded here, signed for that list. */
const clubHeaders = async (contactId: string): Promise<MailHeader[]> => [
  { name: 'List-Unsubscribe', value: `<${SITE}/api/mail/unsubscribe/${await unsubscribeToken(contactId, CLUB_LIST)}>` },
  { name: 'List-Unsubscribe-Post', value: ONE_CLICK },
]

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['mail_list_choices', 'mail_contacts', 'mail_do_not_send']) await env.DB.prepare(`DELETE FROM ${table}`).run()
  await env.DB.prepare(`DELETE FROM mail_lists WHERE id NOT IN ('lca-newsletter', 'lca-tournaments')`).run()
  await env.DB.prepare('DELETE FROM email_campaigns WHERE list_id IS NOT NULL').run()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('the one-click POST, as RFC 8058 has a mail program send it', () => {
  it.each(Object.keys(BODIES) as Array<keyof typeof BODIES>)('takes %s, unsubscribes from that one list and answers 200, with no Location, no Set-Cookie and no-store', async (kind) => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await unsubscribeToken(contactId)
    const res = await post(token, BODIES[kind])
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ unsubscribed: true, list: 'LCA newsletter', preferencesToken: await preferencesToken(contactId) })
    expect(res.response.headers.get('Location')).toBeNull()
    expect(res.response.headers.get('Set-Cookie')).toBeNull()
    expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
    expect(emailOutbox).toEqual([])
  })

  it('answers a second and a third POST with the same 200 and changes nothing', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await unsubscribeToken(contactId)
    const first = await (await post(token, BODIES.multipart)).json()
    // An old time on the row, so any write of a later POST would show.
    await env.DB.prepare(`UPDATE mail_list_choices SET updated_at = '2026-11-01 12:00:00' WHERE contact_id = ?`).bind(contactId).run()
    const before = await tables()
    for (const body of [BODIES.urlencoded, BODIES.multipart]) {
      const again = await post(token, body)
      expect(again.status).toBe(200)
      expect(await again.json()).toEqual(first)
    }
    expect(await tables()).toEqual(before)
  })

  it('leaves an \'out\' the person chose on the preferences page as it was', async () => {
    const contactId = await memberContact('player.one@test.lca', { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out', source: 'preferences', at: '2026-11-02 09:00:00' } } })
    const before = await tables()
    expect((await post(await unsubscribeToken(contactId))).status).toBe(200)
    expect(await tables()).toEqual(before)
  })

  it('reads no cookie and no sign-in: an LCA admin\'s session and a cookie change nothing, and the token alone names the person', async () => {
    const admin = await seedAdmin()
    const one = await memberContact('player.one@test.lca')
    const two = await memberContact('player.two@test.lca')
    const res = await post(await unsubscribeToken(two), { rawBody: BODIES.urlencoded.rawBody, headers: { ...BODIES.urlencoded.headers, Cookie: 'session=made-up' } }, { as: admin })
    expect(res.status).toBe(200)
    expect(await choiceOf(two)).toMatchObject({ choice: 'out' })
    expect(await choiceOf(one)).toBeNull()
  })
})

describe('the GET of the header\'s address', () => {
  it('answers a plain GET with 303 to the unsubscribe page on the configured site, never the request\'s host, and changes nothing', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await unsubscribeToken(contactId)
    const before = await tables()
    for (const accept of [undefined, 'text/html,application/xhtml+xml', '*/*']) {
      const res = await getLink(token, accept)
      expect(res.status, String(accept)).toBe(303)
      expect(res.response.headers.get('Location')).toBe(`${SITE}/email/unsubscribe/${token}`)
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
      expect(res.response.headers.get('Set-Cookie')).toBeNull()
    }
    expect(await tables()).toEqual(before)
  })

  it('answers a GET that asks for JSON, as the page does, with the list\'s name, and changes nothing', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const before = await tables()
    const res = await getLink(await unsubscribeToken(contactId), 'application/json')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ list: 'LCA newsletter' })
    expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    expect(await tables()).toEqual(before)
  })

  it('answers the browser\'s check before a call from the page with no-store, on both endpoints', async () => {
    for (const options of [unsubscribeOptions, preferencesOptions]) {
      const res = await invoke(options, { method: 'OPTIONS' })
      expect(res.status).toBe(204)
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    }
  })
})

describe('a link that does not open', () => {
  type Call = (token: string, db: D1Database) => ReturnType<typeof invoke>
  const UNSUBSCRIBE_CALLS: Call[] = [
    (token, db) => getLink(token, 'application/json', { env: { DB: db } }),
    (token, db) => getLink(token, undefined, { env: { DB: db } }),
    (token, db) => post(token, BODIES.multipart, { env: { DB: db } }),
  ]
  const PREFERENCES_CALLS: Call[] = [
    (token, db) => getChoices(token, { env: { DB: db } }),
    (token, db) => patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: false }, optionalOff: true }, { env: { DB: db } }),
  ]

  /** Each answer to one token, with the statements each call ran on a database of its own. */
  async function answersTo(token: string, calls: Call[] = [...UNSUBSCRIBE_CALLS, ...PREFERENCES_CALLS]) {
    const out: Array<{ status: number; body: unknown; noStore: string | null; ran: string[] }> = []
    for (const call of calls) {
      const { db, ran } = countingDb()
      const res = await call(token, db)
      out.push({ status: res.status, body: await res.json(), noStore: res.response.headers.get('Cache-Control'), ran: ran.map((r) => r.sql) })
    }
    return out
  }

  /** What a stranger could make of a real token: every way of changing it the brief names. */
  function tamperedFrom(real: string, another: string, signedElsewhere: string): Record<string, string> {
    const [contactId, scope, mac] = real.split('.')
    const [otherContact, , otherMac] = another.split('.')
    return {
      'cut short': real.slice(0, -1),
      lengthened: `${real}A`,
      'its signature from another contact': `${contactId}.${scope}.${otherMac}`,
      'another contact with its signature': `${otherContact}.${scope}.${mac}`,
      'signed for another list': `${contactId}.lca-tournaments.${mac}`,
      'signed with another key': signedElsewhere,
      'in capitals': real.toUpperCase(),
      'its signature in another case': `${contactId}.${scope}.${mac.replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))}`,
      'with a trailing dot': `${real}.`,
      'with a trailing slash': `${real}/`,
      'percent-encoded': real.replace(/\./g, '%2E'),
      'very long': `${real}${'x'.repeat(5000)}`,
      empty: '',
    }
  }

  it('answers a stranger\'s token of every kind as a token that never existed: 404, the fixed words, no-store, nothing read and nothing written', async () => {
    const one = await memberContact('player.one@test.lca')
    const two = await memberContact('player.two@test.lca')
    const unsubscribe = await unsubscribeToken(one)
    const preferences = await preferencesToken(one)
    const strangers = {
      ...Object.fromEntries(Object.entries(tamperedFrom(unsubscribe, await unsubscribeToken(two), await unsubscribeToken(one, NEWSLETTER_LIST_ID, OTHER_KEY)))
        .map(([what, token]) => [`an unsubscribe token ${what}`, token])),
      ...Object.fromEntries(Object.entries(tamperedFrom(preferences, await preferencesToken(two), await preferencesToken(one, OTHER_KEY)))
        .map(([what, token]) => [`a preferences token ${what}`, token])),
    }
    const before = await tables()
    const never = await answersTo('never-signed-at-all')
    for (const answer of never) {
      expect(answer).toEqual({ status: 404, body: { error: LINK_NOT_WORKING }, noStore: 'no-store', ran: [] })
    }
    for (const [what, token] of Object.entries(strangers)) {
      expect(await answersTo(token), what).toEqual(never)
    }
    // The purpose swapped: a preferences token on the unsubscribe endpoint, and an unsubscribe token on the preferences one.
    expect(await answersTo(preferences, UNSUBSCRIBE_CALLS)).toEqual(never.slice(0, UNSUBSCRIBE_CALLS.length))
    expect(await answersTo(unsubscribe, PREFERENCES_CALLS)).toEqual(never.slice(UNSUBSCRIBE_CALLS.length))
    expect(await tables()).toEqual(before)
  })

  it('answers 404 for a link that verifies but names a contact or a list that is not there, and writes nothing', async () => {
    const gone = await memberContact('player.one@test.lca')
    const goneToken = await unsubscribeToken(gone)
    const goneChoices = await preferencesToken(gone)
    await env.DB.prepare('DELETE FROM mail_contacts WHERE id = ?').bind(gone).run()
    const here = await memberContact('player.two@test.lca')
    const noList = await unsubscribeToken(here, 'club-never-made')
    const before = await tables()
    for (const res of [await post(goneToken), await getLink(goneToken, 'application/json'), await getChoices(goneChoices), await post(noList), await getLink(noList)]) {
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: LINK_NOT_WORKING })
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(await tables()).toEqual(before)
  })

  it('answers 404 to every link without MAIL_LINK_SECRET, as on the Preview environment and in the browser tests, and signs nothing', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const unsubscribe = await unsubscribeToken(contactId)
    const preferences = await preferencesToken(contactId)
    const before = await tables()
    for (const missing of [{ MAIL_LINK_SECRET: '' }, { MAIL_LINK_SECRET: undefined }, { MAIL_LINK_SECRET: '', MAIL_LINK_SECRET_PREVIOUS: key() }]) {
      const { db, ran } = countingDb()
      const extra = { env: { ...missing, DB: db } as Partial<Env> }
      const answers = [
        await post(unsubscribe, BODIES.urlencoded, extra), await getLink(unsubscribe, 'application/json', extra), await getChoices(preferences, extra),
        await patchChoices(preferences, { optionalOff: true }, extra),
      ]
      for (const res of answers) {
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: LINK_NOT_WORKING })
      }
      // With no key, no request to either route reads a table.
      expect(ran).toEqual([])
    }
    await expect(listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: '' }, { contactId, listId: NEWSLETTER_LIST_ID })).rejects.toBeInstanceOf(MailLinkKeyMissing)
    await expect(listMailParts({ SITE_URL: SITE }, { contactId, listId: NEWSLETTER_LIST_ID })).rejects.toBeInstanceOf(MailLinkKeyMissing)
    expect(await tables()).toEqual(before)
  })

  it('answers 404 with MAIL_LISTS_ON unset and no list email on record, for a link that would open, reading only whether one is', async () => {
    flags.listsOn = false
    const contactId = await memberContact('player.one@test.lca')
    const unsubscribe = await unsubscribeToken(contactId)
    const preferences = await preferencesToken(contactId)
    const before = await tables()
    const { db, ran } = countingDb()
    const answers = [
      await post(unsubscribe, BODIES.multipart, { env: { DB: db } }), await getLink(unsubscribe, 'application/json', { env: { DB: db } }),
      await getLink(unsubscribe, undefined, { env: { DB: db } }), await getChoices(preferences, { env: { DB: db } }),
      await patchChoices(preferences, { optionalOff: true }, { env: { DB: db } }),
    ]
    for (const res of answers) {
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: LINK_NOT_WORKING })
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(ran.map((r) => r.sql)).toEqual(Array(5).fill('SELECT 1 FROM email_campaigns WHERE list_id IS NOT NULL LIMIT 1'))
    expect(await tables()).toEqual(before)
  })

  it('keeps every link working with MAIL_LISTS_ON unset once a list email is on record, so a revert of the switch breaks no link already sent', async () => {
    flags.listsOn = false
    await listEmailOnRecord()
    const contactId = await memberContact('player.one@test.lca')
    expect((await getLink(await unsubscribeToken(contactId), 'application/json')).status).toBe(200)
    expect((await getChoices(await preferencesToken(contactId))).status).toBe(200)
    expect((await post(await unsubscribeToken(contactId))).status).toBe(200)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
  })

  it('opens no link for a session that a stranger could not open: an LCA admin\'s or a member\'s sign-in changes no answer', async () => {
    const admin = await seedAdmin()
    const memberId = await seedMember({ email: 'signed.in@test.lca', fullName: 'Player Two' })
    const contactId = await memberContact('player.one@test.lca')
    const unsubscribe = await unsubscribeToken(contactId)
    const preferences = await preferencesToken(contactId)
    const before = await tables()
    for (const as of [admin, memberId]) {
      for (const res of [await post('never-signed-at-all', BODIES.urlencoded, { as }), await getChoices('never-signed-at-all', { as }), await patchChoices('never-signed-at-all', { optionalOff: true }, { as })]) {
        expect(res.status).toBe(404)
      }
      // Links not live yet: a sign-in does not open them either.
      flags.listsOn = false
      for (const res of [await post(unsubscribe, BODIES.urlencoded, { as }), await getChoices(preferences, { as }), await patchChoices(preferences, { optionalOff: true }, { as })]) {
        expect(res.status).toBe(404)
      }
      flags.listsOn = true
    }
    expect(await tables()).toEqual(before)
    // With a link that opens, the answer is the token's person, whoever is signed in: never the signed-in member's own.
    const res = await getChoices(preferences, { as: memberId })
    expect(await res.json()).toEqual({ address: 'p...@test.lca', lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }], optionalOff: false })
  })

  it('keeps a link signed under the old key working while it is the previous key, and signs every fresh link under the new one', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const old = await unsubscribeToken(contactId)
    const rotated = { env: { MAIL_LINK_SECRET: OTHER_KEY, MAIL_LINK_SECRET_PREVIOUS: key() } as Partial<Env> }
    const res = await post(old, BODIES.urlencoded, rotated)
    expect(res.status).toBe(200)
    expect((await res.json<{ preferencesToken: string }>()).preferencesToken).toBe(await preferencesToken(contactId, OTHER_KEY))
    // Once the old key is let go, the old link no longer opens.
    expect((await getLink(old, 'application/json', { env: { MAIL_LINK_SECRET: OTHER_KEY } as Partial<Env> })).status).toBe(404)
  })
})

describe('choices per list, keyed by address', () => {
  it('takes the person off the one list the link names and leaves every other choice and mark as it was', async () => {
    await seedClubList()
    const contactId = await memberContact('player.one@test.lca', {
      optionalOffAt: '2026-11-03 18:00:00',
      complainedAt: '2026-11-04 12:00:00',
      choices: { [CLUB_LIST]: { choice: 'in', source: 'preferences', at: '2026-11-03 18:30:00' } },
    })
    const club = await choiceOf(contactId, CLUB_LIST)
    const marks = await contactRow(contactId)
    expect(marks).toEqual({ optional_off_at: '2026-11-03 18:00:00', complained_at: '2026-11-04 12:00:00' })
    expect((await post(await unsubscribeToken(contactId))).status).toBe(200)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
    expect(await choiceOf(contactId, CLUB_LIST)).toEqual(club)
    expect(await choiceOf(contactId, 'lca-tournaments')).toBeNull()
    expect(await contactRow(contactId)).toEqual(marks)
  })

  it('lets an address that belongs to no member hold a choice, made from its own link', async () => {
    const stranger = 'no.account@test.lca'
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE lower(email) = ?').bind(stranger).first()).toEqual({ n: 0 })
    const contactId = await seedMailContact({ address: stranger })
    expect((await post(await unsubscribeToken(contactId))).status).toBe(200)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
    // It is no member's address, so the newsletter is not among its choices to turn back on.
    expect(await (await getChoices(await preferencesToken(contactId))).json()).toEqual({ address: 'n...@test.lca', lists: [], optionalOff: false })
  })

  it('still delivers event and account mail to an address that turned everything off, with the rules on and off', async () => {
    const address = 'stopped.all@test.lca'
    const memberId = await seedMember({ email: address, fullName: 'Player One' })
    const contactId = await seedMailContact({ address, complainedAt: '2026-11-05 12:00:00', choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    expect((await patchChoices(await preferencesToken(contactId), { optionalOff: true })).status).toBe(200)
    expect(await contactRow(contactId)).toMatchObject({ optional_off_at: expect.any(String), complained_at: '2026-11-05 12:00:00' })
    for (const listsOn of [true, false]) {
      flags.listsOn = listsOn
      emailOutbox.length = 0
      const tournamentId = await seedTournament({ name: `Sample Winter Open ${listsOn ? 'One' : 'Two'}`, sections: [{ name: 'Open', entryFee: 0 }] })
      const res = await invoke(registrationPost, { method: 'POST', as: memberId, body: { tournamentId, section: 'Open' } })
      expect(res.status, String(listsOn)).toBe(201)
      expect(emailOutbox.map((e) => e.to), String(listsOn)).toEqual([address])
      expect(await deliver(bindings as never, message(address)), String(listsOn)).toEqual({ ok: true })
      expect(emailOutbox.map((e) => e.to), String(listsOn)).toEqual([address, address])
    }
  })
})

describe('the email preferences endpoint', () => {
  it('lists the newsletter, on, for a member\'s address, with the address masked and the stop-all off, and no-store', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const res = await getChoices(await preferencesToken(contactId))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ address: 'p...@test.lca', lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }], optionalOff: false })
    expect(res.response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('reads the member\'s address however the account wrote it, trimmed and lowercased, and a family\'s one address once', async () => {
    await seedMember({ email: '  Family.Sample@Test.LCA ', fullName: 'Player One' })
    await seedMember({ email: 'family.sample@test.lca', fullName: 'Player Two', membershipStatus: 'expired' })
    const contactId = await seedMailContact({ address: 'family.sample@test.lca' })
    const body = await (await getChoices(await preferencesToken(contactId))).json<{ lists: unknown[] }>()
    expect(body.lists).toEqual([{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }])
  })

  it('turns the newsletter off, writing \'out\' from the page, and on again, taking the \'out\' away and writing no \'in\' on a main mailer', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await preferencesToken(contactId)
    const off = await patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: false } })
    expect(off.status).toBe(200)
    expect(await off.json()).toEqual({ address: 'p...@test.lca', lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: false }], optionalOff: false })
    expect(off.response.headers.get('Cache-Control')).toBe('no-store')
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'preferences' })
    const on = await patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: true } })
    expect((await on.json<{ lists: unknown[] }>()).lists).toEqual([{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }])
    expect(await choiceOf(contactId)).toBeNull()
    // Turning it on again, or off twice, writes nothing more.
    await patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: true } })
    expect(await choiceOf(contactId)).toBeNull()
    await patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: false } })
    await env.DB.prepare(`UPDATE mail_list_choices SET updated_at = '2026-11-01 12:00:00' WHERE contact_id = ?`).bind(contactId).run()
    const before = await tables()
    await patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: false } })
    expect(await tables()).toEqual(before)
  })

  it('stops all optional email and starts it again, leaving the list choices as they are', async () => {
    const contactId = await memberContact('player.one@test.lca', { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out', source: 'link', at: '2026-11-02 09:00:00' } } })
    const token = await preferencesToken(contactId)
    const choice = await choiceOf(contactId)
    const stop = await patchChoices(token, { optionalOff: true })
    expect(await stop.json()).toEqual({ address: 'p...@test.lca', lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: false }], optionalOff: true })
    const marked = (await contactRow(contactId))?.optional_off_at
    expect(marked).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    // A second stop keeps the first mark's time.
    await patchChoices(token, { optionalOff: true })
    expect((await contactRow(contactId))?.optional_off_at).toBe(marked)
    const start = await patchChoices(token, { optionalOff: false })
    expect((await start.json<{ optionalOff: boolean }>()).optionalOff).toBe(false)
    expect(await contactRow(contactId)).toMatchObject({ optional_off_at: null })
    expect(await choiceOf(contactId)).toEqual(choice)
  })

  it('refuses a list the GET would not show with 400 and writes nothing', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await preferencesToken(contactId)
    const before = await tables()
    for (const lists of [{ 'lca-tournaments': true }, { 'club-never-made': false }, { [NEWSLETTER_LIST_ID]: false, 'lca-tournaments': false }]) {
      const res = await patchChoices(token, { lists, optionalOff: true })
      expect(res.status, JSON.stringify(lists)).toBe(400)
      expect(await res.json()).toEqual({ error: 'That list is not one of yours.' })
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(await tables()).toEqual(before)
  })

  it('answers a body that is not valid with 400 and no-store, and writes nothing', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await preferencesToken(contactId)
    const before = await tables()
    for (const body of [{ lists: { [NEWSLETTER_LIST_ID]: 'yes' } }, { optionalOff: 'true' }, { lists: [true] }]) {
      const res = await patchChoices(token, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    }
    const notJson = await invoke(preferencesPatch, { method: 'PATCH', params: { token }, rawBody: 'not json', headers: { 'Content-Type': 'application/json' } })
    expect(notJson.status).toBe(400)
    expect(notJson.response.headers.get('Cache-Control')).toBe('no-store')
    expect(await tables()).toEqual(before)
  })

  it('never lets an address outside the newsletter\'s audience turn it on: a lapsed member holding an \'in\' or an \'out\' gets 400, nothing written, and no newsletter listed', async () => {
    for (const [address, choice] of [['lapsed.in@test.lca', 'in'], ['lapsed.out@test.lca', 'out']] as const) {
      await seedMember({ email: address, fullName: 'Player One', membershipStatus: 'expired' })
      const contactId = await seedMailContact({ address, choices: { [NEWSLETTER_LIST_ID]: { choice } } })
      const token = await preferencesToken(contactId)
      expect(await (await getChoices(token)).json(), address).toEqual({ address: 'l...@test.lca', lists: [], optionalOff: false })
      const before = await tables()
      const res = await patchChoices(token, { lists: { [NEWSLETTER_LIST_ID]: true } })
      expect(res.status, address).toBe(400)
      expect(await res.json()).toEqual({ error: 'That list is not one of yours.' })
      expect(await tables()).toEqual(before)
    }
  })

  it('reads a spam report\'s mark on a list that is not a main mailer as the gate does: off until the person turns it on, which writes \'in\' and lifts the mark there', async () => {
    await seedClubList()
    const address = 'reporter@test.lca'
    const contactId = await memberContact(address, {
      complainedAt: '2026-11-05 12:00:00',
      choices: { [CLUB_LIST]: { choice: 'in', source: 'signup', at: '2026-11-04 12:00:00' } },
    })
    const token = await preferencesToken(contactId)
    const club = (body: { lists: Array<{ id: string; on: boolean }> }) => body.lists.find((l) => l.id === CLUB_LIST)
    const before = await (await getChoices(token)).json<{ lists: Array<{ id: string; on: boolean }> }>()
    expect(before.lists).toEqual([{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }, { id: CLUB_LIST, name: CLUB_LIST_NAME, on: false }])
    const list = async () => message(address, { kind: 'optional', listId: CLUB_LIST, headers: await clubHeaders(contactId) })
    expect(await deliver(bindings as never, await list())).toEqual({ ok: false, refused: 'opted_out', error: REFUSAL_WORDS.opted_out })
    // With the setting off, the mark stops no other list, on the page as at the gate.
    flags.complaintStops = false
    expect(club(await (await getChoices(token)).json())).toMatchObject({ on: true })
    flags.complaintStops = true

    const on = await patchChoices(token, { lists: { [CLUB_LIST]: true } })
    expect(club(await on.json())).toMatchObject({ on: true })
    expect(await choiceOf(contactId, CLUB_LIST)).toMatchObject({ choice: 'in', source: 'preferences' })
    expect(await contactRow(contactId)).toMatchObject({ complained_at: '2026-11-05 12:00:00' })
    // The gate now lets it through, and the seam holds it back for Amazon SES.
    expect(await deliver(bindings as never, await list())).toEqual({ ok: false, waitForSes: true, error: WAIT_FOR_SES_WORDS })
    // A contact with no mark that turns the list on only loses the 'out'.
    const plain = await memberContact('plain.member@test.lca', { choices: { [CLUB_LIST]: { choice: 'out' } } })
    await patchChoices(await preferencesToken(plain), { lists: { [CLUB_LIST]: true } })
    expect(await choiceOf(plain, CLUB_LIST)).toBeNull()
  })

  it('holds the newsletter\'s audience in SQL to isListAddress\'s rules, and to an active membership with no walk-in', async () => {
    const cases = [
      'player.one@test.lca', 'p@x.co', 'two@@test.lca', '@test.lca', 'no-at-sign', 'one@two@test.lca', 'a b@test.lca', 'tab\tin@test.lca', 'nbsp in@test.lca',
      'dot@test.', 'dot@.test.lca', 'dot@test..lca', 'nodot@lca', 'guest-1@walkin.lca.invalid', 'x@lca.test', 'x@site.example', 'x@here.localhost',
      'x@louisianachess.org', 'x@sub.louisianachess.org', 'x@notlouisianachess.org', 'x@example.org', 'x@mail.example.com', 'x@example.net', 'x@myexample.org',
      // Three spaces past ASCII inside an address, written as escapes so that the file holds none of them.
      'em\u2003space@test.lca', 'byte\uFEFFmark@test.lca', 'wide\u3000space@test.lca',
    ]
    for (const address of cases) {
      const row = await env.DB.prepare(`SELECT ${listAddressSql('?1')} AS yes`).bind(address).first<{ yes: number }>()
      expect(row?.yes === 1, address).toBe(isListAddress(address))
    }
    // A member's address with one of those at an end is trimmed as normalizeAddress trims it, so both read it as a list address.
    const spaced = ['ends.byte.mark@test.lca\uFEFF', '\u2003starts.em.space@test.lca', 'ends.wide.space@test.lca\u3000']
    for (const address of spaced) {
      await seedMember({ email: address })
      expect(await inNewsletterAudience(env.DB, normalizeAddress(address)), address).toBe(isListAddress(address))
      expect(isListAddress(address), address).toBe(true)
    }
    const walkIn = 'guest-2@walkin.lca.invalid'
    await seedMember({ email: walkIn, role: 'guest', membershipStatus: 'active' })
    await seedMember({ email: 'guest.role@test.lca', role: 'guest', membershipStatus: 'active' })
    await seedMember({ email: 'never.joined@test.lca', membershipStatus: 'none' })
    await seedMember({ email: 'active.member@test.lca' })
    for (const [address, expected] of [[walkIn, false], ['guest.role@test.lca', false], ['never.joined@test.lca', false], ['active.member@test.lca', true]] as const) {
      expect(await inNewsletterAudience(env.DB, address), address).toBe(expected)
    }
    const audience = await env.DB.prepare(NEWSLETTER_AUDIENCE_SQL).all<{ address: string }>()
    const addresses = audience.results.map((r) => r.address)
    expect(addresses).toContain('active.member@test.lca')
    for (const address of spaced) expect(addresses, address).toContain(normalizeAddress(address))
    expect(addresses).not.toContain('guest.role@test.lca')
    expect(new Set(addresses).size).toBe(addresses.length)
  })
})

describe('list mail at the seam', () => {
  const variants = async (contactId: string): Promise<Record<string, MailHeader[] | undefined>> => {
    const [unsubscribe, oneClick] = await listHeaders(contactId)
    return {
      'no headers': undefined,
      'no headers at all, as an empty list': [],
      'the two in the other order': [oneClick, unsubscribe],
      'List-Unsubscribe alone': [unsubscribe],
      'a mailto beside the address': [{ name: 'List-Unsubscribe', value: `<mailto:unsubscribe@test.lca>, ${unsubscribe.value}` }, oneClick],
      'an address that is not HTTPS': [{ name: 'List-Unsubscribe', value: unsubscribe.value.replace('https:', 'http:') }, oneClick],
      'another value for the one-click header': [unsubscribe, { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=one-click' }],
      'a third header': [unsubscribe, oneClick, { name: 'List-Id', value: '<newsletter.test.lca>' }],
    }
  }

  it('refuses list mail without its list or its one-click headers before the gate is read and before any service is called, whatever the constants say', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const cases = { ...(await variants(contactId)) }
    for (const listsOn of [false, true]) {
      for (const sender of ['resend', 'ses']) {
        flags.listsOn = listsOn
        flags.sender = sender
        const calls = fetchCount
        const { db, ran } = countingDb()
        for (const [what, headers] of Object.entries(cases)) {
          const result = await deliver({ ...bindings, DB: db } as never, message('player.one@test.lca', { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers }))
          expect(result, `${what}, ${String(listsOn)}, ${sender}`).toEqual({ ok: false, refused: 'not_list_mail', error: REFUSAL_WORDS.not_list_mail })
          expect(classifyOnce(result)).toBe('never')
        }
        // List mail that names no list, which only a cast can write, is refused the same way, where it once waited.
        const noList = { ...message('player.one@test.lca'), kind: 'optional', headers: await listHeaders(contactId) } as never
        expect(await deliver({ ...bindings, DB: db } as never, noList)).toEqual({ ok: false, refused: 'not_list_mail', error: REFUSAL_WORDS.not_list_mail })
        expect(ran).toEqual([])
        expect(fetchCount).toBe(calls)
      }
    }
    expect(emailOutbox).toEqual([])
  })

  it('never hands list mail to Resend: the gate is asked and its refusals stay final, and mail it lets through waits, untried, for Amazon SES', async () => {
    const reader = await memberContact('reader@test.lca')
    const out = await memberContact('out.reader@test.lca', { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    for (const listsOn of [false, true]) {
      flags.listsOn = listsOn
      const calls = fetchCount
      const waiting = await deliver(bindings as never, message('reader@test.lca', { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: await listHeaders(reader) }))
      expect(waiting).toEqual({ ok: false, waitForSes: true, error: WAIT_FOR_SES_WORDS })
      expect(classifyOnce(waiting)).toBe('later')
      const refused = await deliver(bindings as never, message('out.reader@test.lca', { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: await listHeaders(out) }))
      expect(refused).toEqual({ ok: false, refused: 'opted_out', error: REFUSAL_WORDS.opted_out })
      expect(fetchCount).toBe(calls)
    }
    expect(emailOutbox).toEqual([])
    // Since WS16 step 7 Amazon SES has its transport: while it sends, the message goes to Amazon SES's catch point, and
    // still nothing reaches Resend's.
    flags.sender = 'ses'
    expect(await deliver(bindings as never, message('reader@test.lca', { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: await listHeaders(reader) })))
      .toMatchObject({ ok: true })
    expect(emailOutbox.map((e) => [e.to, e.via])).toEqual([['reader@test.lca', 'ses']])
  })

  it('sends a test through Resend with its one-click headers and its footer, from noreply@louisianachess.org whatever From it was given', async () => {
    const contactId = await memberContact('tester@test.lca')
    const parts = await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: key() }, { contactId, listId: NEWSLETTER_LIST_ID })
    const html = renderEmail({ siteUrl: SITE, heading: 'Sample newsletter', body: '<p>Sample news.</p>', listFooter: parts.footerHtml })
    for (const from of [DEFAULT_FROM, 'some.other.sender@example.org']) {
      const result = await deliver(bindings as never, message('tester@test.lca', { kind: 'test', from, html, shape: 'campaign', headers: parts.headers }))
      expect(result).toEqual({ ok: true })
    }
    expect(emailOutbox).toHaveLength(2)
    for (const sent of emailOutbox) {
      expect(sent.from).toBe(`${SENDER_NAME} <${DEFAULT_FROM}>`)
      expect(sent.headers).toEqual({ 'List-Unsubscribe': parts.headers[0].value, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })
      expect(sent.headers?.['List-Unsubscribe']).toBe(`<${SITE}/api/mail/unsubscribe/${await unsubscribeToken(contactId)}>`)
      expect(sent.html).toContain(LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID].unsubscribeLabel)
    }
    // The header's address opens: its one-click POST unsubscribes.
    const token = parts.headers[0].value.slice(`<${SITE}/api/mail/unsubscribe/`.length, -1)
    expect((await post(token, BODIES.multipart)).status).toBe(200)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
  })

  it('sends event mail with no headers object at all, so its request is the same as before', async () => {
    expect(await deliver(bindings as never, message('player.one@test.lca'))).toEqual({ ok: true })
    expect(await deliver(bindings as never, message('player.one@test.lca', { shape: 'campaign' }))).toEqual({ ok: true })
    // No headers object, and since WS16 step 7 the mark of the catch point that took the message, Resend's.
    for (const sent of emailOutbox) expect(Object.keys(sent).sort()).toEqual(['from', 'html', 'subject', 'text', 'to', 'via'])
    for (const sent of emailOutbox) expect(sent.via).toBe('resend')
  })
})
