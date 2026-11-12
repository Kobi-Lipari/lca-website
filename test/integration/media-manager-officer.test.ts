// test/integration/media-manager-officer.test.ts
//
// Checkpoint M's review, K's decision 52 of Thursday, November 12, 2026: an
// LCA officer who holds the Media manager seat may send the newsletter, the
// seat being what counts whatever the person's role, through the real
// handlers, the real guard (requireListMailer and sendsAsMediaManager in
// functions/utils/auth.ts) and the real seat read, on the D1 database every
// integration test builds from the migrations. The switches are read through
// getters on the mocked functions/utils/mail/switches, set before every
// case. Nothing here reaches an outside service: the harness answers Resend
// and the sign-in service.
//
// - (a) The guard, with MAIL_LISTS_ON set: an officer who holds the seat and
//   is signed in with a second factor reads, tests and stops the newsletter
//   and passes the guard on the send, which waits for Amazon SES; without a
//   second factor the media manager's 403 with mfaRequired; an officer
//   without the seat, and one whose term has ended, LIST_MAILERS_ONLY.
// - (b) With MAIL_LISTS_ON unset, an officer who holds the seat gets the
//   officer's own words of WS16 step 4, byte for byte, on all four methods,
//   and no seat is read.
// - (c) GET /api/me/media-manager reads true for them by the same rule.
// - (d) Every Admin handler swept as an officer who holds the seat: the
//   three newsletter files answer, and every other method answers exactly
//   what it answers an officer without the seat, writing the same and
//   sending nothing.
// - (e) requireMailer and today's five campaign methods do not change: an
//   officer who holds the seat still gets the officer's words from each.
// - The sweep (d) is also made with no second factor, where the three
//   newsletter files refuse both officers, the seat holder in the media
//   manager's own words, and with MAIL_LISTS_ON unset, where every method,
//   the three files among them, answers the two officers alike.
// - (f) The edges of the seat: another seat, or this one while it is not
//   active; two officers who hold it together; a term that ends between two
//   requests; an LCA admin and the president who also hold it, who send as
//   themselves; and the endpoint's answer for each.
// Every name, address and subject here is made up but the seat's own title.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as campaignsGet, onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import { onRequestGet as campaignGet } from '../../functions/api/admin/campaigns/[id]'
import { onRequestPost as previewPost } from '../../functions/api/admin/campaigns/preview'
import { onRequestPost as campaignTestPost } from '../../functions/api/admin/campaigns/test'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as stopPost } from '../../functions/api/admin/mail/newsletter/stop'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { onRequestGet as mediaManagerGet } from '../../functions/api/me/media-manager'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR } from '../../functions/utils/auth'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createListCampaign } from '../../functions/utils/mail/lists'
import { NOTHING_SENDING, WAITS_FOR_SES } from '../../functions/utils/mail/newsletterAnswers'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMember, seedSeat, seedTournament } from './factories'
import { emailOutbox, invoke, resetHarness, type InvokeOptions } from './harness'
import { countingDb } from './mailRuns'

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

type Handler = Parameters<typeof invoke>[0]

const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string
/** The officer's own words of WS16 step 4, which requireMailer gives an officer today. */
const OFFICER_WORDS = 'Group email is limited to admins and the LCA Observer'

let seq = 0
const address = (name: string) => `${name}-${++seq}@officer.test.lca`

/** An LCA officer, with their address, holding the Media manager seat when asked. */
async function officer(opts: { seat?: boolean } = {}): Promise<{ id: string; email: string; seat: string | null }> {
  const email = address('officer')
  const id = await seedMember({ fullName: 'Player One', email, role: 'lca_officer' })
  const seat = opts.seat ? await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [id]) : null
  return { id, email, seat }
}

/** The newsletter's four methods, each with a body it would take; the test goes to the address given. */
const newsletterCalls = (to: string): ReadonlyArray<readonly [string, Handler, InvokeOptions]> => [
  ['GET /api/admin/mail/newsletter', newsletterGet, {}],
  ['POST /api/admin/mail/newsletter', newsletterPost, { method: 'POST', body: SAMPLE }],
  ['POST /api/admin/mail/newsletter/test', testPost, { method: 'POST', body: { to, ...SAMPLE } }],
  ['POST /api/admin/mail/newsletter/stop', stopPost, { method: 'POST' }],
]

type Written = { status: number; type: string | null; body: string }
async function written(res: { status: number; response: Response }): Promise<Written> {
  return { status: res.status, type: res.response.headers.get('Content-Type'), body: await res.response.clone().text() }
}
const answerOf = (status: number, body: Record<string, unknown>) => ({ status, type: 'application/json', body: JSON.stringify(body) })

async function traces() {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    recipients: await count('SELECT COUNT(*) AS n FROM email_campaign_recipients'),
    contacts: await count('SELECT COUNT(*) AS n FROM mail_contacts'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
    posts: await count('SELECT COUNT(*) AS n FROM lca_posts'),
    banners: await count('SELECT COUNT(*) AS n FROM site_announcements'),
    tournaments: await count('SELECT COUNT(*) AS n FROM tournaments'),
    members: await count('SELECT COUNT(*) AS n FROM members'),
    roles: JSON.stringify((await env.DB.prepare('SELECT id, role FROM members ORDER BY id').all()).results),
    seats: await count('SELECT COUNT(*) AS n FROM board_members'),
    terms: await count('SELECT COUNT(*) AS n FROM board_seat_assignments'),
    tickets: await count('SELECT COUNT(*) AS n FROM support_tickets'),
    sent: emailOutbox.length,
  }
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) the guard, with MAIL_LISTS_ON set', () => {
  it('admits an officer who holds the seat, signed in with a second factor: the newsletter read, a test to their own address, the send waiting for Amazon SES, and the stop', async () => {
    const seated = await officer({ seat: true })
    const read = await invoke(newsletterGet, { as: seated.id })
    expect(read.status).toBe(200)
    expect((await read.json<{ list: { id: string } }>()).list.id).toBe(NEWSLETTER_LIST_ID)
    expect(await written(await invoke(newsletterPost, { as: seated.id, method: 'POST', body: SAMPLE }))).toEqual(answerOf(409, { error: WAITS_FOR_SES }))
    const test = await invoke(testPost, { as: seated.id, method: 'POST', body: { to: seated.email, ...SAMPLE } })
    expect(test.status).toBe(200)
    expect(emailOutbox.map((e) => [e.to, e.subject])).toEqual([[seated.email, `[TEST] ${SAMPLE.subject}`]])
    expect(await written(await invoke(stopPost, { as: seated.id, method: 'POST' }))).toEqual(answerOf(409, { error: NOTHING_SENDING }))

    const reader = await seedMember({ fullName: 'Player Two', email: address('reader') })
    const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: reader, linkCheck: await linkKeyCheck(key()) })
    const stop = await invoke(stopPost, { as: seated.id, method: 'POST' })
    expect(stop.status).toBe(200)
    expect(await stop.json()).toEqual({ stopped: made!.totalRecipients })
  })

  it('gives an officer who holds the seat without a second factor the media manager\'s 403 with mfaRequired on all four methods, writing nothing', async () => {
    const seated = await officer({ seat: true })
    const before = await traces()
    for (const [name, handler, options] of newsletterCalls(seated.email)) {
      expect(await written(await invoke(handler, { ...options, as: seated.id, aal: 'aal1' })), name).toEqual(answerOf(403, { error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }))
    }
    expect(await traces()).toEqual(before)
  })

  it('refuses an officer without the seat, and one whose term has ended, LIST_MAILERS_ONLY on all four methods, writing nothing', async () => {
    const plain = await officer()
    const former = await officer({ seat: true })
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?`).bind(former.seat).run()
    const before = await traces()
    for (const who of [plain, former]) {
      for (const [name, handler, options] of newsletterCalls(who.email)) {
        for (const aal of ['aal2', 'aal1'] as const) {
          expect(await written(await invoke(handler, { ...options, as: who.id, aal })), `${name}, ${aal}`).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
        }
      }
    }
    expect(await traces()).toEqual(before)
  })
})

describe('(b) with MAIL_LISTS_ON unset', () => {
  it('gives an officer who holds the seat the officer\'s own words of WS16 step 4, byte for byte, on all four methods, and reads no seat', async () => {
    flags.listsOn = false
    const seated = await officer({ seat: true })
    const counting = countingDb()
    const before = await traces()
    for (const [name, handler, options] of newsletterCalls(seated.email)) {
      for (const aal of ['aal2', 'aal1'] as const) {
        const res = await invoke(handler, { ...options, as: seated.id, aal, env: { DB: counting.db } })
        expect(await written(res), `${name}, ${aal}`).toEqual(answerOf(403, { error: OFFICER_WORDS }))
      }
    }
    expect(counting.ran.filter((r) => r.sql.includes('board_seat_assignments') || r.sql.includes('board_members'))).toEqual([])
    expect(await traces()).toEqual(before)
  })
})

describe('(c) GET /api/me/media-manager', () => {
  it('reads true for an officer who holds the seat, false for one without it, and false for both with the constant unset', async () => {
    const seated = await officer({ seat: true })
    const plain = await officer()
    const ask = async (id: string) => (await invoke(mediaManagerGet, { method: 'GET', as: id, path: '/api/me/media-manager' })).json()
    expect(await ask(seated.id)).toEqual({ mediaManager: true, secondFactor: true })
    expect(await ask(plain.id)).toEqual({ mediaManager: false, secondFactor: true })
    flags.listsOn = false
    expect(await ask(seated.id)).toEqual({ mediaManager: false, secondFactor: true })
  })
})

describe('(d) every Admin handler, swept as an officer who holds the seat', () => {
  const modules = import.meta.glob('../../functions/api/admin/**/*.ts', { eager: true }) as Record<string, Record<string, unknown>>
  const NEWSLETTER_FILES = ['mail/newsletter.ts', 'mail/newsletter/stop.ts', 'mail/newsletter/test.ts']
  const METHODS: Record<string, string> = { Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Delete: 'DELETE' }
  const ID = 'sample-id'
  const PARAMS = { id: ID, memberId: ID, newsId: ID, officerId: ID, gameId: ID, round: '1' }
  const handlers: Array<{ file: string; method: string; handler: Handler }> = []
  for (const [path, mod] of Object.entries(modules)) {
    const file = path.replace('../../functions/api/admin/', '')
    for (const [name, value] of Object.entries(mod)) {
      const method = METHODS[name.replace(/^onRequest/, '')]
      if (method && typeof value === 'function') handlers.push({ file, method, handler: value as Handler })
    }
  }

  /**
   * Every handler asked as an officer who holds the seat and as one without it, with the session's assurance level given.
   * Every method outside the three newsletter files must answer the one as the other, the answers that name the caller
   * read with the two officers' ids made one; the three files are returned for the case to hold.
   */
  async function sweep(aal: 'aal1' | 'aal2'): Promise<{ differ: string[]; newsletter: Record<string, { without: Written; withSeat: Written }> }> {
    await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
    const seated = await officer({ seat: true })
    const plain = await officer()
    const event = await seedTournament({ name: 'Sample Winter Open' })
    const options = (method: string, as: string): InvokeOptions => ({
      method, params: { ...PARAMS, id: event }, path: '/api/test?section=Open', as, aal, body: method === 'GET' || method === 'DELETE' ? undefined : {},
    })
    expect(handlers.length).toBeGreaterThanOrEqual(60)
    const differ: string[] = []
    const newsletter: Record<string, { without: Written; withSeat: Written }> = {}
    for (const { file, method, handler } of handlers) {
      const without = await written(await invoke(handler, options(method, plain.id)))
      const withSeat = await written(await invoke(handler, options(method, seated.id)))
      if (NEWSLETTER_FILES.includes(file)) {
        newsletter[`${method} ${file}`] = { without, withSeat }
        continue
      }
      // An answer that names the caller, such as a list of who did what, is compared with the two officers' ids made one.
      const same = (answer: { body: string }) => answer.body.split(plain.id).join('officer').split(seated.id).join('officer')
      if (without.status !== withSeat.status || same(without) !== same(withSeat)) differ.push(`${method} ${file}: ${without.status} and ${withSeat.status}`)
    }
    expect(emailOutbox).toEqual([])
    return { differ, newsletter }
  }

  it('lets the three newsletter files answer, and answers every other method exactly as it answers an officer without the seat, sending nothing', async () => {
    const { differ, newsletter } = await sweep('aal2')
    expect(differ).toEqual([])
    const answering = Object.entries(newsletter).filter(([, a]) => a.withSeat.status !== 403).map(([name]) => name)
    expect(answering.sort()).toEqual(['GET mail/newsletter.ts', 'POST mail/newsletter.ts', 'POST mail/newsletter/stop.ts', 'POST mail/newsletter/test.ts'])
    for (const [name, a] of Object.entries(newsletter)) expect(a.without.status, `${name} without the seat`).toBe(403)
  })

  it('answers every other method as it answers an officer without the seat, also when the session has no second factor, and the three newsletter files refuse both, the seat holder in the media manager\'s own words', async () => {
    const { differ, newsletter } = await sweep('aal1')
    expect(differ).toEqual([])
    for (const [name, a] of Object.entries(newsletter)) {
      expect(a.without, `${name} without the seat`).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
      expect(a.withSeat, `${name} with the seat`).toEqual(answerOf(403, { error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }))
    }
  })

  it('with MAIL_LISTS_ON unset answers every method, the three newsletter files included, byte for byte as it answers an officer without the seat', async () => {
    flags.listsOn = false
    for (const aal of ['aal2', 'aal1'] as const) {
      const { differ, newsletter } = await sweep(aal)
      expect(differ, aal).toEqual([])
      for (const [name, a] of Object.entries(newsletter)) {
        expect(a.withSeat, `${name}, ${aal}`).toEqual(a.without)
        expect(a.withSeat, `${name}, ${aal}`).toEqual(answerOf(403, { error: OFFICER_WORDS }))
      }
    }
  })
})

describe('(f) the edges of the seat', () => {
  it('refuses an officer who holds only another seat, or the Media manager seat while it is not active, with LIST_MAILERS_ONLY, writing nothing', async () => {
    const elsewhere = await officer()
    await seedSeat({ slug: 'sample-seat-one', role: 'Sample seat one' }, [elsewhere.id])
    const inactive = await officer()
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager', isActive: false }, [inactive.id])
    const before = await traces()
    for (const who of [elsewhere, inactive]) {
      for (const [name, handler, options] of newsletterCalls(who.email)) {
        expect(await written(await invoke(handler, { ...options, as: who.id })), name).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
      }
    }
    expect(await traces()).toEqual(before)
  })

  it('admits two officers who hold the seat together, and refuses only the one whose term has ended', async () => {
    const first = await officer()
    const second = await officer()
    const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [first.id, second.id])
    for (const who of [first, second]) expect((await invoke(newsletterGet, { as: who.id })).status).toBe(200)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ? AND member_id = ?`).bind(seat, first.id).run()
    expect(await written(await invoke(newsletterGet, { as: first.id }))).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
    expect((await invoke(newsletterGet, { as: second.id })).status).toBe(200)
  })

  it('reads the seat at each request: an officer admitted a moment ago is refused the moment their term ends, with the same session', async () => {
    const seated = await officer({ seat: true })
    expect((await invoke(newsletterGet, { as: seated.id })).status).toBe(200)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?`).bind(seated.seat).run()
    expect(await written(await invoke(newsletterGet, { as: seated.id }))).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
  })

  it('admits an LCA admin and the president who also hold the seat as themselves: the admin asked for a second factor in the admin\'s own words, the president not', async () => {
    const admin = await seedAdmin()
    const president = await seedMember({ fullName: 'Player Three', email: address('president'), role: 'lca_observer' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [admin, president])
    for (const who of [admin, president]) expect((await invoke(newsletterGet, { as: who })).status).toBe(200)
    const noFactor = await invoke(newsletterGet, { as: admin, aal: 'aal1' })
    expect(noFactor.status).toBe(403)
    expect((await noFactor.json<{ error: string }>()).error).not.toBe(MEDIA_MANAGER_SECOND_FACTOR)
    expect((await invoke(newsletterGet, { as: president, aal: 'aal1' })).status).toBe(200)
  })

  it('reads GET /api/me/media-manager false for an officer whose term has ended or whose seat is not active, and reads it afresh each time', async () => {
    const former = await officer({ seat: true })
    const ask = async (id: string) => (await invoke(mediaManagerGet, { method: 'GET', as: id, path: '/api/me/media-manager' })).json()
    expect(await ask(former.id)).toEqual({ mediaManager: true, secondFactor: true })
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?`).bind(former.seat).run()
    expect(await ask(former.id)).toEqual({ mediaManager: false, secondFactor: true })
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = NULL WHERE seat_id = ?`).bind(former.seat).run()
    expect(await ask(former.id)).toEqual({ mediaManager: true, secondFactor: true })
    await env.DB.prepare(`UPDATE board_members SET is_active = 0 WHERE id = ?`).bind(former.seat).run()
    expect(await ask(former.id)).toEqual({ mediaManager: false, secondFactor: true })
  })
})

describe('(e) requireMailer and today\'s five campaign methods', () => {
  it('still give an officer who holds the seat the officer\'s words, so Specific people is not theirs, writing and sending nothing', async () => {
    const seated = await officer({ seat: true })
    const before = await traces()
    const today: ReadonlyArray<readonly [Handler, InvokeOptions]> = [
      [campaignsGet, {}],
      [campaignsPost, { method: 'POST', body: { subject: SAMPLE.subject, bodyHtml: SAMPLE.bodyHtml, filter: {}, extraEmails: [address('typed')] } }],
      [campaignGet, { params: { id: 'sample-id' } }],
      [previewPost, { method: 'POST', body: { filter: {} } }],
      [campaignTestPost, { method: 'POST', body: { email: seated.email, ...SAMPLE } }],
    ]
    for (const [handler, options] of today) {
      expect(await written(await invoke(handler, { ...options, as: seated.id }))).toEqual(answerOf(403, { error: OFFICER_WORDS }))
    }
    expect(await traces()).toEqual(before)
  })
})
