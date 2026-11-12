// test/integration/mail-email-choices-edges.test.ts
//
// WS16 step 3, the edges of the two public link endpoints that
// test/integration/mail-email-choices.test.ts leaves: what a stranger or a
// mail provider could do that the plain cases do not.
//
// - Races: eight one-click POSTs at once, and a one-click POST beside the
//   preferences page's own writes, leave one row for the person and the list,
//   never an error.
// - Nothing private leaves: no log line, no answer's words and no audit row
//   holds a token, a contact's id or an address (the preferences answer's
//   masked address apart).
// - The POST takes whatever a provider sends: a very large body, a body that
//   is not what its Content-Type says, a foreign Origin, a cookie.
// - A link keeps working for the person it was sent to whatever has changed
//   since: a lapsed membership, a stop-all choice already made, another
//   list's choice.
// - A route that gives no single token is 404 like every other bad link.
// - The page's writes: an empty body changes nothing, a person's newer 'in'
//   is not written again, an 'in' made in the same second as a spam report
//   reads as the gate reads it, and no 'in' is ever written on one of LCA's
//   main mailers.
// - The seam's test send with no headers, and the same list mail held back
//   while the rules and the sender take every value.
// MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN and COMPLAINT_STOPS_OTHER_SENDERS
// are read through getters on the mocked functions/utils/mail/switches, set
// before every case. Every token is signed with the key the harness binds,
// read from the environment. Nothing here reaches an outside service.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM, SENDER_NAME } from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as preferencesGet, onRequestPatch as preferencesPatch } from '../../functions/api/mail/preferences/[token]'
import { onRequestGet as unsubscribeGet, onRequestPost as unsubscribePost } from '../../functions/api/mail/unsubscribe/[token]'
import { openGate } from '../../functions/utils/mail/gate'
import { LINK_NOT_WORKING } from '../../functions/utils/mail/linkAnswers'
import { signLink } from '../../functions/utils/mail/links'
import { deliver } from '../../functions/utils/mail/send'
import type { Env } from '../../functions/types'
import { seedMailContact, seedMember } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'
import { bindings, message } from './mailRuns'

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

const CLUB_LIST = 'club-example'
const key = () => (env as unknown as Env).MAIL_LINK_SECRET
const unsubscribeToken = (contactId: string, listId: string = NEWSLETTER_LIST_ID) => signLink(key(), contactId, 'unsubscribe', listId)
const preferencesToken = (contactId: string) => signLink(key(), contactId, 'preferences')

const FORM = { rawBody: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
const post = (token: string, body: { rawBody?: string; headers: Record<string, string> } = FORM, params: Record<string, string | string[]> = { token }) =>
  invoke(unsubscribePost, { method: 'POST', params, path: `/api/mail/unsubscribe/${token}`, rawBody: body.rawBody, headers: { ...body.headers } })
const getChoices = (token: string, params: Record<string, string | string[]> = { token }) => invoke(preferencesGet, { params, path: `/api/mail/preferences/${token}` })
const patchChoices = (token: string, body: unknown) => invoke(preferencesPatch, { method: 'PATCH', params: { token }, path: `/api/mail/preferences/${token}`, body })

async function tables() {
  const choices = await env.DB.prepare('SELECT contact_id, list_id, choice, source, updated_at FROM mail_list_choices ORDER BY contact_id, list_id').all()
  const contacts = await env.DB.prepare('SELECT id, address, optional_off_at, complained_at FROM mail_contacts ORDER BY id').all()
  return { choices: choices.results, contacts: contacts.results }
}

const choiceOf = (contactId: string, listId: string = NEWSLETTER_LIST_ID) =>
  env.DB.prepare('SELECT choice, source, updated_at FROM mail_list_choices WHERE contact_id = ? AND list_id = ?')
    .bind(contactId, listId).first<{ choice: string; source: string; updated_at: string }>()

const rowCount = async (contactId: string) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_list_choices WHERE contact_id = ?').bind(contactId).first<{ n: number }>())?.n

async function memberContact(address: string, opts: Parameters<typeof seedMailContact>[0] extends infer O ? Omit<O & object, 'address'> : never = {}) {
  await seedMember({ email: address, fullName: 'Player One' })
  return seedMailContact({ address, ...opts })
}

async function seedClubList(): Promise<void> {
  await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer) VALUES (?, 'club', 'Example Chess Club news', 0)`).bind(CLUB_LIST).run()
}

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
})

describe('writes that arrive together', () => {
  it('answers eight one-click POSTs at once with the same 200 and leaves one row for the person and the list', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await unsubscribeToken(contactId)
    const bodies = [FORM, { rawBody: '{}', headers: { 'Content-Type': 'application/json' } }, { rawBody: undefined, headers: {} }, FORM, FORM, FORM, FORM, FORM]
    const answers = await Promise.all(bodies.map((body) => post(token, body)))
    for (const res of answers) {
      expect(res.status).toBe(200)
      expect(res.response.headers.get('Location')).toBeNull()
    }
    const unique = new Set(await Promise.all(answers.map(async (res) => JSON.stringify(await res.json()))))
    expect(unique.size).toBe(1)
    expect(await rowCount(contactId)).toBe(1)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
  })

  it('answers a one-click POST beside the page\'s own off and stop-all writes without an error, and leaves the person out of the list', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const unsubscribe = await unsubscribeToken(contactId)
    const preferences = await preferencesToken(contactId)
    const answers = await Promise.all([
      post(unsubscribe),
      patchChoices(preferences, { lists: { [NEWSLETTER_LIST_ID]: false } }),
      post(unsubscribe),
      patchChoices(preferences, { optionalOff: true }),
    ])
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 200])
    expect(await rowCount(contactId)).toBe(1)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out' })
    expect((await env.DB.prepare('SELECT optional_off_at FROM mail_contacts WHERE id = ?').bind(contactId).first<{ optional_off_at: string | null }>())?.optional_off_at).not.toBeNull()
  })

  it('answers a one-click POST beside the page turning the list on with a 200 either way and never more than one row', async () => {
    const contactId = await memberContact('player.one@test.lca', { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out', source: 'preferences', at: '2026-11-02 09:00:00' } } })
    const answers = await Promise.all([post(await unsubscribeToken(contactId)), patchChoices(await preferencesToken(contactId), { lists: { [NEWSLETTER_LIST_ID]: true } })])
    expect(answers.map((res) => res.status)).toEqual([200, 200])
    expect(await rowCount(contactId)).toBeLessThanOrEqual(1)
  })
})

describe('nothing private leaves', () => {
  it('writes no token, contact id or address to a log line, to an answer\'s words or to the audit log, whatever the link came to', async () => {
    const lines: string[] = []
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) ?? String(a))).join(' '))
      })
    }
    const address = 'player.private@test.lca'
    const contactId = await memberContact(address)
    const unsubscribe = await unsubscribeToken(contactId)
    const preferences = await preferencesToken(contactId)
    const strangers = [`${unsubscribe}x`, unsubscribe.toUpperCase(), `${contactId}.${NEWSLETTER_LIST_ID}.${'A'.repeat(22)}`, `${contactId}.p.${'B'.repeat(22)}`]
    const auditBefore = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n

    const answers = [
      await getChoices(preferences),
      await patchChoices(preferences, { lists: { [NEWSLETTER_LIST_ID]: false } }),
      await patchChoices(preferences, { lists: { 'lca-tournaments': true } }),
      await post(unsubscribe),
      await invoke(unsubscribeGet, { params: { token: unsubscribe }, headers: { Accept: 'application/json' } }),
      await invoke(unsubscribeGet, { params: { token: unsubscribe } }),
      ...(await Promise.all(strangers.flatMap((token) => [post(token), getChoices(token)]))),
    ]
    // The unsubscribe answer hands the page a fresh preferences token by design, and that token holds the contact's id as every token does; it is taken out before the id is looked for.
    const spoken = (await Promise.all(answers.map(async (res) => `${[...res.response.headers].filter(([name]) => name !== 'location').map(([n, v]) => `${n}:${v}`).join(' ')} ${await res.response.clone().text()}`)))
      .join('\n').split(preferences).join('')
    const logged = lines.join('\n')
    for (const [what, secret] of [['the address', address], ['the contact id', contactId]] as const) {
      expect(logged, `a log line holds ${what}`).not.toContain(secret)
      expect(spoken, `an answer holds ${what}`).not.toContain(secret)
    }
    for (const token of [unsubscribe, preferences, ...strangers]) expect(logged, 'a log line holds a token').not.toContain(token)
    // No answer carries the key or the unsubscribe token itself.
    expect(spoken).not.toContain(key())
    expect(spoken).not.toContain(unsubscribe)
    const audit = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n
    expect(audit).toBe(auditBefore)
    const rows = await env.DB.prepare('SELECT * FROM admin_audit_log').all()
    expect(JSON.stringify(rows.results)).not.toContain(contactId)
  })
})

describe('the one-click POST takes whatever a provider sends', () => {
  it('answers 200 and unsubscribes for a body of two million characters, one that is not what its Content-Type says, a foreign Origin and a cookie', async () => {
    const cases: Array<{ rawBody?: string; headers: Record<string, string> }> = [
      { rawBody: `List-Unsubscribe=One-Click&padding=${'x'.repeat(2_000_000)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      { rawBody: 'this is not json', headers: { 'Content-Type': 'application/json' } },
      { rawBody: '--broken boundary', headers: { 'Content-Type': 'multipart/form-data; boundary=never-closed' } },
      { rawBody: '{"list":"somebody-else"}', headers: { 'Content-Type': 'text/plain' } },
      { rawBody: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://mail.example.org', Cookie: 'sample=1' } },
    ]
    for (const body of cases) {
      await env.DB.prepare('DELETE FROM mail_list_choices').run()
      const contactId = await memberContact(`p${Math.random().toString(36).slice(2, 10)}@test.lca`)
      const res = await post(await unsubscribeToken(contactId), body)
      expect(res.status, body.headers['Content-Type']).toBe(200)
      expect(res.response.headers.get('Set-Cookie')).toBeNull()
      expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
      await env.DB.prepare('DELETE FROM mail_contacts WHERE id = ?').bind(contactId).run()
    }
  })

  it('takes the list from the token alone: a body or a query naming another list changes nothing about which list is left', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const res = await post(await unsubscribeToken(contactId), { rawBody: `list=${TOURNAMENTS_LIST_ID}&List-Unsubscribe=One-Click`, headers: FORM.headers })
    expect(res.status).toBe(200)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out' })
    expect(await choiceOf(contactId, TOURNAMENTS_LIST_ID)).toBeNull()
  })
})

describe('a link keeps working for the person it was sent to', () => {
  it('lets a member whose membership has since lapsed leave the newsletter, and keeps their stop-all mark and every other choice as it was', async () => {
    await seedClubList()
    const address = 'lapsed.since@test.lca'
    await seedMember({ email: address, fullName: 'Player One', membershipStatus: 'expired' })
    const contactId = await seedMailContact({
      address,
      optionalOffAt: '2026-11-03 10:00:00',
      choices: { [CLUB_LIST]: { choice: 'in', source: 'signup', at: '2026-11-03 10:00:00' } },
    })
    const club = await choiceOf(contactId, CLUB_LIST)
    const res = await post(await unsubscribeToken(contactId))
    expect(res.status).toBe(200)
    expect(await choiceOf(contactId)).toMatchObject({ choice: 'out', source: 'link' })
    expect(await choiceOf(contactId, CLUB_LIST)).toEqual(club)
    expect((await env.DB.prepare('SELECT optional_off_at FROM mail_contacts WHERE id = ?').bind(contactId).first<{ optional_off_at: string }>())?.optional_off_at).toBe('2026-11-03 10:00:00')
    // The preferences page lists no newsletter for them, and the club list they are on is still theirs.
    const body = await (await getChoices(await preferencesToken(contactId))).json<{ lists: Array<{ id: string }> }>()
    expect(body.lists.map((l) => l.id)).toEqual([CLUB_LIST])
  })

  it('lets the tournament list be left by an address that is not on it as a member, leaving the newsletter alone', async () => {
    const contactId = await seedMailContact({ address: 'no.account@test.lca' })
    const res = await post(await unsubscribeToken(contactId, TOURNAMENTS_LIST_ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ unsubscribed: true, list: 'LCA tournament email' })
    expect(await choiceOf(contactId, TOURNAMENTS_LIST_ID)).toMatchObject({ choice: 'out', source: 'link' })
    expect(await choiceOf(contactId)).toBeNull()
  })
})

describe('a route that gives no single token', () => {
  it('answers 404 with the fixed words for no token, a list of tokens and an empty one, on every method', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const unsubscribe = await unsubscribeToken(contactId)
    const preferences = await preferencesToken(contactId)
    const before = await tables()
    for (const params of [{}, { token: [unsubscribe, unsubscribe] }, { token: [unsubscribe] }, { token: '' }] as Array<Record<string, string | string[]>>) {
      for (const res of [await post('x', FORM, params), await invoke(unsubscribeGet, { params }), await getChoices('x', params), await invoke(preferencesPatch, { method: 'PATCH', params, body: { optionalOff: true } })]) {
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: LINK_NOT_WORKING })
        expect(res.response.headers.get('Cache-Control')).toBe('no-store')
      }
    }
    expect(preferences).not.toBe('')
    expect(await tables()).toEqual(before)
  })
})

describe('the preferences page\'s writes', () => {
  it('changes nothing for an empty body, an empty lists object, a stop-all that is already off and a list already as asked', async () => {
    const contactId = await memberContact('player.one@test.lca')
    const token = await preferencesToken(contactId)
    const before = await tables()
    for (const body of [{}, { lists: {} }, { optionalOff: false }, { lists: { [NEWSLETTER_LIST_ID]: true } }]) {
      const res = await patchChoices(token, body)
      expect(res.status, JSON.stringify(body)).toBe(200)
      expect(await res.json()).toEqual({ address: 'p...@test.lca', lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }], optionalOff: false })
    }
    expect(await tables()).toEqual(before)
  })

  it('does not write an \'in\' again for a list the person already turned on after a spam report, and keeps the time of the first', async () => {
    await seedClubList()
    const contactId = await memberContact('reporter@test.lca', {
      complainedAt: '2026-11-05 12:00:00',
      choices: { [CLUB_LIST]: { choice: 'in', source: 'preferences', at: '2026-11-06 08:30:00' } },
    })
    const before = await choiceOf(contactId, CLUB_LIST)
    const res = await patchChoices(await preferencesToken(contactId), { lists: { [CLUB_LIST]: true } })
    expect(res.status).toBe(200)
    expect(await choiceOf(contactId, CLUB_LIST)).toEqual(before)
  })

  it('turns a list on again after the person turned it off following a spam report, so the newest choice always wins', async () => {
    await seedClubList()
    const contactId = await memberContact('reporter@test.lca', {
      complainedAt: '2026-11-05 12:00:00',
      choices: { [CLUB_LIST]: { choice: 'in', source: 'signup', at: '2026-11-04 12:00:00' } },
    })
    const token = await preferencesToken(contactId)
    const list = async () => (await (await getChoices(token)).json<{ lists: Array<{ id: string; on: boolean }> }>()).lists.find((l) => l.id === CLUB_LIST)
    expect(await list()).toMatchObject({ on: false })
    await patchChoices(token, { lists: { [CLUB_LIST]: true } })
    expect(await list()).toMatchObject({ on: true })
    await patchChoices(token, { lists: { [CLUB_LIST]: false } })
    expect(await list()).toMatchObject({ on: false })
    expect(await choiceOf(contactId, CLUB_LIST)).toMatchObject({ choice: 'out', source: 'preferences' })
    await patchChoices(token, { lists: { [CLUB_LIST]: true } })
    expect(await list()).toMatchObject({ on: true })
    expect(await choiceOf(contactId, CLUB_LIST)).toMatchObject({ choice: 'in', source: 'preferences' })
  })

  it('reads an \'in\' made in the same second as the report as the gate does, not yet back on, and a turn on then leaves the gate letting the list through', async () => {
    await seedClubList()
    const address = 'reporter@test.lca'
    const contactId = await memberContact(address, {
      complainedAt: '2026-11-05 12:00:00',
      choices: { [CLUB_LIST]: { choice: 'in', source: 'preferences', at: '2026-11-05 12:00:00' } },
    })
    const token = await preferencesToken(contactId)
    const shown = async () => (await (await getChoices(token)).json<{ lists: Array<{ id: string; on: boolean }> }>()).lists.find((l) => l.id === CLUB_LIST)
    const atGate = async () => (await openGate(env.DB, [address], CLUB_LIST)).refusal(address, 'optional', CLUB_LIST)
    // One rule read in both places: an 'in' no newer than the mark is off on the page and refused at the gate.
    expect(await shown()).toMatchObject({ on: false })
    expect(await atGate()).toBe('opted_out')
    const res = await patchChoices(token, { lists: { [CLUB_LIST]: true } })
    expect(res.status).toBe(200)
    expect(await shown()).toMatchObject({ on: true })
    expect(await atGate()).toBeNull()
    expect(await choiceOf(contactId, CLUB_LIST)).toMatchObject({ choice: 'in', source: 'preferences' })
  })

  it('never writes an \'in\' on one of LCA\'s main mailers, a person with a spam report\'s mark included: turning it on only takes the \'out\' away', async () => {
    const contactId = await memberContact('reporter@test.lca', {
      complainedAt: '2026-11-05 12:00:00',
      choices: { [TOURNAMENTS_LIST_ID]: { choice: 'out', source: 'link', at: '2026-11-04 12:00:00' } },
    })
    const token = await preferencesToken(contactId)
    const shown = await (await getChoices(token)).json<{ lists: Array<{ id: string; on: boolean }> }>()
    expect(shown.lists.find((l) => l.id === TOURNAMENTS_LIST_ID)).toMatchObject({ on: false })
    const res = await patchChoices(token, { lists: { [TOURNAMENTS_LIST_ID]: true } })
    expect(res.status).toBe(200)
    const rows = await env.DB.prepare(`SELECT list_id, choice FROM mail_list_choices WHERE contact_id = ? AND choice = 'in'`).bind(contactId).all()
    expect(rows.results).toEqual([])
    expect(await choiceOf(contactId, TOURNAMENTS_LIST_ID)).toBeNull()
  })

  it('leaves a person\'s \'out\' on one list alone when the page turns another on, and writes nothing for a list asked on and off at once in two calls', async () => {
    await seedClubList()
    const contactId = await memberContact('player.one@test.lca', {
      choices: { [CLUB_LIST]: { choice: 'out', source: 'link', at: '2026-11-04 12:00:00' }, [TOURNAMENTS_LIST_ID]: { choice: 'out', source: 'link', at: '2026-11-04 12:00:00' } },
    })
    await patchChoices(await preferencesToken(contactId), { lists: { [CLUB_LIST]: true } })
    expect(await choiceOf(contactId, CLUB_LIST)).toBeNull()
    expect(await choiceOf(contactId, TOURNAMENTS_LIST_ID)).toMatchObject({ choice: 'out', source: 'link', updated_at: '2026-11-04 12:00:00' })
  })
})

describe('the seam, with the rules and the sender at every value', () => {
  it('sends a test through Resend with no headers key when the message carries none, from noreply@louisianachess.org', async () => {
    for (const listsOn of [false, true]) {
      flags.listsOn = listsOn
      emailOutbox.length = 0
      const result = await deliver(bindings as never, message('tester@test.lca', { kind: 'test', from: 'other.sender@example.org', shape: 'campaign' }))
      expect(result, String(listsOn)).toEqual({ ok: true })
      expect(emailOutbox).toHaveLength(1)
      expect(emailOutbox[0].from).toBe(`${SENDER_NAME} <${DEFAULT_FROM}>`)
      expect(emailOutbox[0].headers).toBeUndefined()
    }
  })
})
