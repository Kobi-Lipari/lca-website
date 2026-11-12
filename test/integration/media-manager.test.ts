// test/integration/media-manager.test.ts
//
// WS16 step 6: who may send the LCA newsletter, now that the media manager
// joins the LCA admins and the president, through the real handlers, the real
// guard (requireListMailer in functions/utils/auth.ts) and the real seat read
// (holdsMediaManagerSeat in functions/utils/admin/mediaManager.ts), on the D1
// database every integration test builds from the migrations. The grant is a
// board seat whose link name is 'media-manager', seeded as the seat screens
// write a seat and a term (seedSeat in ./factories). MAIL_LISTS_ON,
// MAIL_SENDER, WORKERS_PLAN and COMPLAINT_STOPS_OTHER_SENDERS are read through
// getters on the mocked functions/utils/mail/switches, set before every case,
// so no value the code ships with decides one. Nothing here reaches an outside
// service: the harness answers Resend and the sign-in service.
//
// It tries what a person who should not send would try, and what a media
// manager who may send would try beyond their reach:
// - (a) with MAIL_LISTS_ON unset, every answer of the newsletter's four
//   methods is WS16 step 4's, byte for byte, for each kind of caller, the
//   seat holder among them, no seat is read, and the endpoint that tells a
//   member what they are answers false;
// - (b) with it set, the seat's holder signed in with a second factor reads,
//   tests and stops the newsletter and passes the guard on the send, which
//   waits for Amazon SES, the session verified once and the seat read in one
//   statement; and still gets today's 403 from each of today's five campaign
//   methods, writing nothing and sending nothing;
// - (c) the second factor: a holder signed in without one, a token whose
//   claim is missing or is not exactly 'aal2', a token the sign-in service
//   refuses, and an LCA admin who holds the seat without one;
// - (d) the seat read at each request: a term ended between two calls, a
//   seat marked inactive, and seats named almost the same;
// - (e) every other part of Admin the media manager might try: the members
//   list, a member's record and its export, a role change and logging in as a
//   member, support, the activity log, News posts, the banner, the board
//   seats, tournaments and a director's announce for an event they do not
//   manage, each refused in today's words with nothing written or sent;
// - (f) a club rep and a director who hold the seat keep their own rights;
// - (g) with the constant set, who else is refused and in what words, an
//   officer who holds the seat among them;
// - (h) the answer GET /api/me/media-manager gives is never the grant.
// A test through Amazon SES, asked by the box only an LCA admin is shown, is
// read from WS16 step 7, so it has no case here yet. Every name, address,
// club, subject and seat title here is made up but the seat's own,
// "Media manager", whose link name the code keys on.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as campaignsGet, onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import { onRequestGet as campaignGet } from '../../functions/api/admin/campaigns/[id]'
import { onRequestPost as previewPost } from '../../functions/api/admin/campaigns/preview'
import { onRequestPost as campaignTestPost } from '../../functions/api/admin/campaigns/test'
import { onRequestGet as clubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as announcementGet, onRequestPost as announcementPost } from '../../functions/api/admin/announcement'
import { onRequestGet as auditGet } from '../../functions/api/admin/audit'
import { onRequestGet as boardSeatsGet, onRequestPost as boardSeatsPost } from '../../functions/api/admin/board-seats'
import { onRequestPost as impersonatePost } from '../../functions/api/admin/impersonate/[memberId]'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as stopPost } from '../../functions/api/admin/mail/newsletter/stop'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { onRequestGet as membersGet } from '../../functions/api/admin/members'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestPatch as namePatch } from '../../functions/api/admin/members/[id]/name'
import { onRequestPatch as rolePatch } from '../../functions/api/admin/members/[id]/role'
import { onRequestGet as exportGet } from '../../functions/api/admin/members/export'
import { onRequestGet as postsGet, onRequestPost as postsPost } from '../../functions/api/admin/posts'
import { onRequestGet as supportGet } from '../../functions/api/admin/support'
import { onRequestPost as tournamentsPost } from '../../functions/api/admin/tournaments'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as announcePost } from '../../functions/api/admin/tournaments/[id]/announce'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as mediaManagerGet } from '../../functions/api/me/media-manager'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR } from '../../functions/utils/auth'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createListCampaign } from '../../functions/utils/mail/lists'
import { NOTHING_SENDING, WAITS_FOR_SES } from '../../functions/utils/mail/newsletterAnswers'
import type { Env } from '../../functions/types'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedSeat, seedTournament, seedTournamentDirector } from './factories'
import { emailOutbox, fetchCount, invoke, resetHarness, type InvokeOptions } from './harness'
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

/** A newsletter's words, plainly made up. */
const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string
const OFFICER_WORDS = 'Group email is limited to admins and the LCA Observer'
const ADMIN_SECOND_FACTOR = 'Two-factor authentication is required for admin access. Set it up in your account security settings.'

let seq = 0
/** An address of the harness's own kind, which every list may send to. */
const address = (name: string) => `${name}-${++seq}@media.test.lca`

/** A member with an active membership and a made-up name. */
const member = (opts: { role?: string; clubId?: string | null; email?: string } = {}) =>
  seedMember({ fullName: 'Player One', email: opts.email ?? address('member'), role: opts.role, clubId: opts.clubId })

/** A member who holds the Media manager seat now, with the role given, a member's by default. */
async function holder(opts: { role?: string; clubId?: string | null } = {}): Promise<{ id: string; seat: string }> {
  const id = await member(opts)
  const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [id])
  return { id, seat }
}

/** The newsletter's four methods, each with a body it would take. */
const NEWSLETTER: ReadonlyArray<readonly [string, () => { handler: Handler; options: InvokeOptions }]> = [
  ['GET /api/admin/mail/newsletter', () => ({ handler: newsletterGet, options: {} })],
  ['POST /api/admin/mail/newsletter', () => ({ handler: newsletterPost, options: { method: 'POST', body: SAMPLE } })],
  ['POST /api/admin/mail/newsletter/test', () => ({ handler: testPost, options: { method: 'POST', body: { to: address('tester'), ...SAMPLE } } })],
  ['POST /api/admin/mail/newsletter/stop', () => ({ handler: stopPost, options: { method: 'POST' } })],
]

/** The body of an answer as it was written, and its status, to hold an answer byte for byte. */
async function written(res: { status: number; response: Response }): Promise<{ status: number; type: string | null; body: string }> {
  return { status: res.status, type: res.response.headers.get('Content-Type'), body: await res.response.clone().text() }
}
const answerOf = (status: number, body: Record<string, unknown>) => ({ status, type: 'application/json', body: JSON.stringify(body) })

/** What any write of these endpoints would leave a trace in, counted, with the outbox, to show a call wrote and sent nothing. */
async function traces() {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    recipients: await count('SELECT COUNT(*) AS n FROM email_campaign_recipients'),
    contacts: await count('SELECT COUNT(*) AS n FROM mail_contacts'),
    choices: await count('SELECT COUNT(*) AS n FROM mail_list_choices'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
    posts: await count('SELECT COUNT(*) AS n FROM lca_posts'),
    banners: await count('SELECT COUNT(*) AS n FROM site_announcements'),
    tournaments: await count('SELECT COUNT(*) AS n FROM tournaments'),
    members: await count('SELECT COUNT(*) AS n FROM members'),
    admins: await count("SELECT COUNT(*) AS n FROM members WHERE role = 'lca_admin'"),
    seats: await count('SELECT COUNT(*) AS n FROM board_members'),
    terms: await count('SELECT COUNT(*) AS n FROM board_seat_assignments WHERE ended_at IS NULL'),
    tickets: await count('SELECT COUNT(*) AS n FROM support_tickets'),
    sent: emailOutbox.length,
  }
}

/** A bearer token in the harness's shape with the claims given, for the claims the harness's own tokens never carry. */
function tokenWith(claims: Record<string, unknown>): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.harness-not-a-signature`
}

/** A newsletter sending now, made as the POST makes one, for the stop to stop. */
async function sendingNewsletter(by: string) {
  await member({ email: address('reader') })
  const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: by, linkCheck: await linkKeyCheck(key()) })
  expect(made).not.toBeNull()
  return made!
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  // The seats a case made, with their terms, which cascade; and every newsletter and mail row a case left.
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) with MAIL_LISTS_ON unset', () => {
  it('answers each kind of caller as WS16 step 4 did, byte for byte, on all four methods, and reads no seat', async () => {
    flags.listsOn = false
    const plain = await member()
    const rep = await member({ role: 'club_rep', clubId: await seedClub({ name: 'Example Chess Club', city: 'Sample City' }) })
    const officer = await member({ role: 'lca_officer' })
    const president = await member({ role: 'lca_observer' })
    const admin = await seedAdmin()
    const seated = await holder()
    await seedSeat({ slug: 'sample-seat-officer', role: 'Sample seat' }, [officer])
    const counting = countingDb()
    const before = await traces()
    const callers: ReadonlyArray<readonly [string, InvokeOptions, ReturnType<typeof answerOf>]> = [
      ['signed out', {}, answerOf(401, { error: 'Unauthorized' })],
      ['a plain member', { as: plain }, answerOf(403, { error: 'Forbidden' })],
      ['a club rep', { as: rep }, answerOf(403, { error: 'Forbidden' })],
      ['the seat holder with a second factor', { as: seated.id }, answerOf(403, { error: 'Forbidden' })],
      ['the seat holder without one', { as: seated.id, aal: 'aal1' }, answerOf(403, { error: 'Forbidden' })],
      ['an officer', { as: officer }, answerOf(403, { error: OFFICER_WORDS })],
      ['an LCA admin without a second factor', { as: admin, aal: 'aal1' }, answerOf(403, { error: ADMIN_SECOND_FACTOR, mfaRequired: true })],
      ['an LCA admin', { as: admin }, answerOf(404, { error: 'Not found' })],
      ['the president', { as: president, aal: 'aal1' }, answerOf(404, { error: 'Not found' })],
    ]
    for (const [name, call] of NEWSLETTER) {
      for (const [who, as, expected] of callers) {
        const { handler, options } = call()
        expect(await written(await invoke(handler, { ...options, ...as, env: { DB: counting.db } })), `${name}, ${who}`).toEqual(expected)
      }
    }
    expect(counting.ran.filter((r) => r.sql.includes('board_seat_assignments'))).toEqual([])
    expect(await traces()).toEqual(before)
  })

  it('tells the seat holder they are not the media manager, and leaves today\'s five campaign methods refusing them as today', async () => {
    flags.listsOn = false
    const seated = await holder()
    const told = await invoke(mediaManagerGet, { as: seated.id, path: '/api/me/media-manager' })
    expect(await told.json()).toEqual({ mediaManager: false, secondFactor: true })
    for (const [handler, options] of [
      [campaignsGet, {}], [campaignsPost, { method: 'POST', body: { subject: SAMPLE.subject, bodyHtml: SAMPLE.bodyHtml, filter: {} } }],
      [campaignGet, { params: { id: 'campaign-sample' } }], [previewPost, { method: 'POST', body: { filter: {} } }],
      [campaignTestPost, { method: 'POST', body: { email: address('tester'), ...SAMPLE } }],
    ] as const) {
      expect(await written(await invoke(handler, { ...options, as: seated.id }))).toEqual(answerOf(403, { error: 'Forbidden' }))
    }
  })
})

describe('(b) with MAIL_LISTS_ON set, the media manager signed in with a second factor', () => {
  it('reads the newsletter, sends a test, passes the guard on the send, which waits for Amazon SES, and stops one that is sending', async () => {
    const seated = await holder()
    const read = await invoke(newsletterGet, { as: seated.id })
    expect(read.status).toBe(200)
    expect((await read.json<{ list: { id: string } }>()).list.id).toBe(NEWSLETTER_LIST_ID)

    const send = await invoke(newsletterPost, { as: seated.id, method: 'POST', body: SAMPLE })
    expect(send.status).toBe(409)
    expect(await send.json()).toEqual({ error: WAITS_FOR_SES })

    const to = address('tester')
    const test = await invoke(testPost, { as: seated.id, method: 'POST', body: { to, ...SAMPLE } })
    expect(test.status).toBe(200)
    expect(await test.json()).toEqual({ sent: true })
    expect(emailOutbox.map((e) => [e.to, e.subject])).toEqual([[to, `[TEST] ${SAMPLE.subject}`]])

    const nothing = await invoke(stopPost, { as: seated.id, method: 'POST' })
    expect(nothing.status).toBe(409)
    expect(await nothing.json()).toEqual({ error: NOTHING_SENDING })

    const admin = await seedAdmin()
    const made = await sendingNewsletter(admin)
    const stop = await invoke(stopPost, { as: seated.id, method: 'POST' })
    expect(stop.status).toBe(200)
    expect(await stop.json()).toEqual({ stopped: made.totalRecipients })
    // The activity row names the media manager as who stopped it, as a member and not an admin.
    const row = await env.DB.prepare(`SELECT actor_id, action FROM admin_audit_log WHERE action = 'group_email_stopped' ORDER BY rowid DESC LIMIT 1`).first<{ actor_id: string; action: string }>()
    expect(row).toEqual({ actor_id: seated.id, action: 'group_email_stopped' })
  })

  it('verifies the session once, reads the seat in one statement that names its columns, and is told so by GET /api/me/media-manager', async () => {
    const seated = await holder()
    const counting = countingDb()
    const read = await invoke(newsletterGet, { as: seated.id, env: { DB: counting.db } })
    expect(read.status).toBe(200)
    expect(fetchCount).toBe(1)
    const seatReads = counting.ran.filter((r) => r.sql.includes('board_seat_assignments'))
    expect(seatReads).toHaveLength(1)
    expect(seatReads[0].sql).not.toMatch(/SELECT\s+\*/i)
    expect(seatReads[0].sql).toMatch(/ended_at IS NULL/)
    expect(seatReads[0].binds).toBe(2)
    const told = await invoke(mediaManagerGet, { as: seated.id, path: '/api/me/media-manager' })
    expect(await told.json()).toEqual({ mediaManager: true, secondFactor: true })
  })

  it('still gets today\'s 403 from all five of today\'s campaign methods, so no typed-in address, hand-picked member or preview of the list reaches them, and nothing is written or sent', async () => {
    const seated = await holder()
    const other = await member({ email: address('picked') })
    await env.DB.prepare(
      `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, created_by, status) VALUES ('campaign-sample', 'Sample group message', '<p>Example.</p>', '{}', 0, ?, 'completed')`,
    ).bind(seated.id).run()
    const before = await traces()
    for (const [name, handler, options] of [
      ['GET /api/admin/campaigns', campaignsGet, {}],
      ['POST /api/admin/campaigns', campaignsPost, {
        method: 'POST',
        body: { subject: SAMPLE.subject, bodyHtml: SAMPLE.bodyHtml, filter: {}, extraEmails: ['typed.in@example.org'], includeMemberIds: [other], onlySelected: true },
      }],
      ['GET /api/admin/campaigns/[id]', campaignGet, { params: { id: 'campaign-sample' } }],
      ['POST /api/admin/campaigns/preview', previewPost, { method: 'POST', body: { filter: {} } }],
      ['POST /api/admin/campaigns/test', campaignTestPost, { method: 'POST', body: { email: 'typed.in@example.org', ...SAMPLE } }],
    ] as const) {
      expect(await written(await invoke(handler, { ...options, as: seated.id })), name).toEqual(answerOf(403, { error: 'Forbidden' }))
    }
    expect(await traces()).toEqual(before)
  })
})

describe('(c) the second factor', () => {
  it('refuses the seat holder signed in without one on all four methods, 403 with mfaRequired in words of its own, writing nothing', async () => {
    const seated = await holder()
    const before = await traces()
    for (const [name, call] of NEWSLETTER) {
      const { handler, options } = call()
      expect(await written(await invoke(handler, { ...options, as: seated.id, aal: 'aal1' })), name)
        .toEqual(answerOf(403, { error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }))
    }
    expect(await traces()).toEqual(before)
  })

  it('refuses a token whose second-factor claim is missing or is not exactly aal2, and one the sign-in service refuses', async () => {
    const seated = await holder()
    for (const claim of [undefined, 'aal1', 'AAL2', 'aal2 ', ' aal2', 'aal3', true, 2, ['aal2'], { aal: 'aal2' }, null]) {
      const claims: Record<string, unknown> = { sub: seated.id, role: 'authenticated' }
      if (claim !== undefined) claims.aal = claim
      const res = await invoke(newsletterGet, { headers: { Authorization: `Bearer ${tokenWith(claims)}` } })
      expect(await written(res), JSON.stringify(claim)).toEqual(answerOf(403, { error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }))
    }
    const refused = await invoke(newsletterGet, { headers: { Authorization: 'Bearer invalid-sample-token' } })
    expect(await written(refused)).toEqual(answerOf(401, { error: 'Unauthorized' }))
  })

  it('leaves an LCA admin who holds the seat to the admins\' own rule: without a second factor, the admins\' 403, which the seat does not stand in for', async () => {
    const admin = await seedAdmin()
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [admin])
    for (const [name, call] of NEWSLETTER) {
      const { handler, options } = call()
      expect(await written(await invoke(handler, { ...options, as: admin, aal: 'aal1' })), name).toEqual(answerOf(403, { error: ADMIN_SECOND_FACTOR, mfaRequired: true }))
    }
    expect((await invoke(newsletterGet, { as: admin })).status).toBe(200)
  })
})

describe('(d) the seat, read at each request', () => {
  it('refuses a holder at once when the term ends between two calls, and a former holder beside a current one', async () => {
    const seated = await holder()
    const next = await member()
    expect((await invoke(newsletterGet, { as: seated.id })).status).toBe(200)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ? AND member_id = ?`).bind(seated.seat, seated.id).run()
    expect(await written(await invoke(newsletterGet, { as: seated.id }))).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
    await env.DB.prepare(`INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES ('term-sample-next', ?, ?, datetime('now'))`).bind(seated.seat, next).run()
    expect((await invoke(newsletterGet, { as: next })).status).toBe(200)
    expect(await written(await invoke(newsletterGet, { as: seated.id }))).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
  })

  it('refuses the holder of the seat once it is marked inactive', async () => {
    const seated = await holder()
    expect((await invoke(newsletterGet, { as: seated.id })).status).toBe(200)
    await env.DB.prepare('UPDATE board_members SET is_active = 0 WHERE id = ?').bind(seated.seat).run()
    expect(await written(await invoke(newsletterGet, { as: seated.id }))).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
  })

  it('grants nothing for a seat whose link name is almost the same, or whose title is the same and its link name another', async () => {
    for (const [slug, role] of [
      ['media-manager ', 'Media Manager '], ['Media-Manager', 'Media Manager'], ['media-manager-2', 'Media manager'], ['media_manager', 'Media manager'],
      ['media-managers', 'Media managers'], ['assistant-media-manager', 'Assistant media manager'], ['media-manager-assistant', 'Media manager assistant'],
      ['sample-seat-two', 'Media manager'],
    ] as const) {
      const id = await member()
      await seedSeat({ slug, role }, [id])
      expect(await written(await invoke(newsletterGet, { as: id })), slug).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
      expect(await (await invoke(mediaManagerGet, { as: id, path: '/api/me/media-manager' })).json(), slug).toEqual({ mediaManager: false, secondFactor: true })
      await env.DB.prepare('DELETE FROM board_members WHERE slug = ?').bind(slug).run()
    }
  })
})

describe('(e) every other part of Admin, refused to the media manager in today\'s words', () => {
  it('refuses the members list, a member\'s record, its export, a role change, logging in as a member, support, the activity log, News posts, the banner, the board seats, tournaments and an event\'s entrants, with nothing written or sent', async () => {
    const seated = await holder()
    const other = await member({ email: address('other') })
    const elsewhere = await seedTournament({ name: 'Sample Winter Open' })
    await seedRegistration({ tournamentId: elsewhere, memberId: other })
    const before = await traces()
    const tries: ReadonlyArray<readonly [string, Handler, InvokeOptions]> = [
      ['GET /api/admin/members', membersGet, {}],
      ['GET /api/admin/members/export', exportGet, {}],
      ['PATCH /api/admin/members/[id]/name', namePatch, { method: 'PATCH', params: { id: other }, body: { fullName: 'Player Two' } }],
      ['DELETE /api/admin/members/[id]', memberDelete, { method: 'DELETE', params: { id: other } }],
      ['PATCH /api/admin/members/[id]/role, for themselves', rolePatch, { method: 'PATCH', params: { id: seated.id }, body: { role: 'lca_admin' } }],
      ['PATCH /api/admin/members/[id]/role, for another', rolePatch, { method: 'PATCH', params: { id: other }, body: { role: 'lca_observer' } }],
      ['POST /api/admin/impersonate/[memberId]', impersonatePost, { method: 'POST', params: { memberId: other } }],
      ['GET /api/admin/support', supportGet, {}],
      ['GET /api/admin/audit', auditGet, {}],
      ['GET /api/admin/posts', postsGet, {}],
      ['POST /api/admin/posts', postsPost, { method: 'POST', body: { title: 'Sample news post' } }],
      ['GET /api/admin/announcement', announcementGet, {}],
      ['POST /api/admin/announcement', announcementPost, { method: 'POST', body: { message: 'Sample banner words.' } }],
      ['GET /api/admin/board-seats', boardSeatsGet, {}],
      ['POST /api/admin/board-seats', boardSeatsPost, { method: 'POST', body: { seatId: seated.seat, memberId: other } }],
      ['POST /api/admin/tournaments', tournamentsPost, { method: 'POST', body: { name: 'Sample Spring Swiss', location: 'Sample City', date: '2026-12-12', entryFee: 0 } }],
      ['PATCH /api/admin/tournaments/[id]', tournamentPatch, { method: 'PATCH', params: { id: elsewhere }, body: { name: 'Sample Autumn Quads' } }],
      ['POST /api/admin/tournaments/[id]/announce', announcePost, { method: 'POST', params: { id: elsewhere }, body: { subject: 'Sample notice', body: 'Example words for a sample notice.' } }],
    ]
    for (const [name, handler, options] of tries) {
      expect(await written(await invoke(handler, { ...options, as: seated.id })), name).toEqual(answerOf(403, { error: 'Forbidden' }))
    }
    expect(await traces()).toEqual(before)
    const own = await env.DB.prepare('SELECT role, full_name FROM members WHERE id = ?').bind(seated.id).first()
    expect(own).toEqual({ role: 'member', full_name: 'Player One' })
  })
})

describe('(f) the seat holder keeps their own role\'s rights', () => {
  it('lets a club rep who holds the seat keep their club\'s page, their club\'s events and the members list, and gain the newsletter', async () => {
    const club = await seedClub({ name: 'Example Chess Club', city: 'Sample City' })
    const rep = await holder({ role: 'club_rep', clubId: club })
    const event = await seedTournament({ name: 'Sample Winter Open', clubId: club })
    expect((await invoke(clubGet, { as: rep.id, params: { id: club } })).status).toBe(200)
    expect((await invoke(manageGet, { as: rep.id, params: { id: event } })).status).toBe(200)
    expect((await invoke(membersGet, { as: rep.id })).status).toBe(200)
    expect((await invoke(newsletterGet, { as: rep.id })).status).toBe(200)
    expect(await (await invoke(mediaManagerGet, { as: rep.id, path: '/api/me/media-manager' })).json()).toEqual({ mediaManager: true, secondFactor: true })

    flags.listsOn = false
    expect(await written(await invoke(newsletterGet, { as: rep.id }))).toEqual(answerOf(403, { error: 'Forbidden' }))
    expect((await invoke(clubGet, { as: rep.id, params: { id: club } })).status).toBe(200)
  })

  it('lets a director who holds the seat email their own event\'s entrants, and refuses them another event\'s, sending nothing for it', async () => {
    const director = await holder()
    const entrant = await member({ email: address('entrant') })
    const theirs = await seedTournament({ name: 'Sample Spring Swiss' })
    const another = await seedTournament({ name: 'Sample Autumn Quads' })
    await seedTournamentDirector(theirs, director.id)
    for (const event of [theirs, another]) await seedRegistration({ tournamentId: event, memberId: entrant })
    const notice = { subject: 'Sample notice', body: 'Example words for a sample notice.' }

    const refused = await invoke(announcePost, { as: director.id, method: 'POST', params: { id: another }, body: notice })
    expect(await written(refused)).toEqual(answerOf(403, { error: 'Forbidden' }))
    expect(emailOutbox).toEqual([])

    const own = await invoke(announcePost, { as: director.id, method: 'POST', params: { id: theirs }, body: notice })
    expect(own.status).toBe(200)
    expect(await own.json()).toEqual({ sent: 1, failed: 0, total: 1 })
    expect(emailOutbox.map((e) => e.to)).toEqual([(await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(entrant).first<{ email: string }>())!.email])
  })
})

describe('(g) with MAIL_LISTS_ON set, everyone else', () => {
  it('refuses a plain member, a club rep, a director, an auditor and an officer without the seat, and an officer who holds it, in one plain sentence, and a signed-out caller with 401', async () => {
    const people = {
      'a plain member': await member(),
      'a club rep without the seat': await member({ role: 'club_rep', clubId: await seedClub({ name: 'Example Chess Club', city: 'Sample City' }) }),
      'a director without the seat': await member({ role: 'tournament_director' }),
      'an auditor without the seat': await member({ role: 'lca_auditor' }),
      'an officer without the seat': await member({ role: 'lca_officer' }),
      'an officer who holds the seat': (await holder({ role: 'lca_officer' })).id,
    }
    const before = await traces()
    for (const [name, call] of NEWSLETTER) {
      const { handler, options } = call()
      expect(await written(await invoke(handler, options)), `${name}, signed out`).toEqual(answerOf(401, { error: 'Unauthorized' }))
      for (const [who, id] of Object.entries(people)) {
        for (const aal of ['aal2', 'aal1'] as const) {
          expect(await written(await invoke(handler, { ...options, as: id, aal })), `${name}, ${who}, ${aal}`).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
        }
      }
    }
    expect(await traces()).toEqual(before)
  })

  it('says who may send in its words, and what the media manager without a second factor must do', () => {
    expect(LIST_MAILERS_ONLY).toBe('Group email is limited to LCA admins, the president and the media manager.')
    expect(MEDIA_MANAGER_SECOND_FACTOR).toBe('Two-factor sign-in is required to send group email. Set it up in your account security settings.')
  })
})

describe('(h) the answer that draws the page is never the grant', () => {
  it('refuses a member whose page was told they are the media manager, once the term has ended, and tells them so the next time they ask', async () => {
    const seated = await holder()
    const told = await invoke(mediaManagerGet, { as: seated.id, path: '/api/me/media-manager' })
    expect(await told.json()).toEqual({ mediaManager: true, secondFactor: true })
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?`).bind(seated.seat).run()
    const before = await traces()
    for (const [name, call] of NEWSLETTER) {
      const { handler, options } = call()
      expect(await written(await invoke(handler, { ...options, as: seated.id })), name).toEqual(answerOf(403, { error: LIST_MAILERS_ONLY }))
    }
    expect(await traces()).toEqual(before)
    expect(await (await invoke(mediaManagerGet, { as: seated.id, path: '/api/me/media-manager' })).json()).toEqual({ mediaManager: false, secondFactor: true })
  })
})
