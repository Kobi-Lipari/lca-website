// test/integration/club-suggest-club.test.ts
//
// Suggest a club and Start a club (WS09's thirtieth step): POST
// /api/clubs/reports, what a visitor sends from /clubs/suggest, the rows it
// leaves in My region's answer (GET /api/workspace/region), and POST
// /api/admin/club-reports/[reportId], Mark as handled, with the real
// handlers, the real limiter, the real spam check against the harness's
// catch point and the real mail path into the harness's outbox. Each case
// sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself through a getter on a mock of
// their module, and MAIL_LISTS_ON and MAIL_SENDER through getters on a mock
// of the mail switches; no case reads a shipped value of any switch. Every
// club, person and address is made up; the ZIP codes and town names are
// Louisiana's own, the data under test. Every network address is from the
// ranges set aside for documentation.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { CLUB_REQUEST_FIELD_WORDS as WORDS, CLUB_REQUEST_LIMITS } from '../../domain/clubs/newClub'
import {
  CLUB_REQUESTS_BUSY, CLUB_REQUESTS_CLOSED, onRequestPost as requestPost, onRequestOptions as requestOptions,
} from '../../functions/api/clubs/reports'
import * as staticFile from '../../functions/api/clubs/reports'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import {
  ALREADY_HANDLED, HAS_A_CLUB, NOT_A_REQUEST, NOT_YOUR_REGION, REQUESTS_CLOSED, REQUESTS_FOR_KEEPERS, onRequestPost as handledPost,
} from '../../functions/api/admin/club-reports/[reportId]'
import { onRequestPost as suggestPost } from '../../functions/api/clubs/[id]/reports'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestDelete as clubDelete } from '../../functions/api/admin/clubs/[id]'
import { CLUB_REQUEST_NOT_SENT_LOG } from '../../functions/utils/clubs/clubRequests'
import { CLUB_REQUEST_SUBJECTS } from '../../functions/utils/clubs/emails'
import { ADDRESS_HEADER, CANT_SEND_NOW, TOO_MANY } from '../../functions/utils/rateLimit'
import type { Env } from '../../functions/types'
import type { ClubRequestRow, WorkspaceRegionResponse } from '../../domain/contracts'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness, spamCheckBehavior } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})
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
  }
})

const [NEW_ORLEANS, BATON_ROUGE, LAFAYETTE, LAKE_CHARLES, NORTH] = REGIONS
const KEYED = {
  SIGNING_SECRET: 'example-made-up-signing-key-for-new-clubs-00030',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0030',
}
const SITE = 'https://www.louisianachess.org'

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
/** A made-up place of its own for each call that needs one, from 198.51.100.0/24 and 203.0.113.0/24. */
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

beforeEach(async () => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = false
  flags.listsOn = false
  flags.sender = 'resend'
  // The middle of the run's own hour, held still, so every call of a case lands in one hour.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
  // Each case starts with no seat over any region and no open row of the two kinds, so where an email goes is its own.
  await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
  await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE club_id IS NULL AND status = 'open'`).run()
  // The limiter's counts of every place and every set of keepers start afresh in each case.
  await env.DB.prepare('DELETE FROM rate_limits').run()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── Made-up people ──

interface Person { id: string; name: string; email: string }

/** A seat over the region, held now by the member, or held once and ended. */
async function giveSeat(region: string, memberId: string, ended = false): Promise<void> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare(`INSERT INTO board_seat_assignments (seat_id, member_id${ended ? ', ended_at' : ''}) VALUES (?, ?${ended ? ", datetime('now')" : ''})`)
    .bind(seat, memberId).run()
}

async function person(opts: { role?: string; clubId?: string } = {}): Promise<Person> {
  const m = mark()
  const made = { id: '', name: `Example Person ${m}`, email: `person-${m}@example.org` }
  made.id = await seedMember({ fullName: made.name, email: made.email, role: opts.role as never, clubId: opts.clubId })
  return made
}

/** A representative of the region, holding its seat now. */
async function rep(region: string, opts: { role?: string } = {}): Promise<Person> {
  const made = await person(opts)
  await giveSeat(region, made.id)
  return made
}

/** An LCA admin of the case's own, and the only one on file, so the emails to the admins stay few. */
async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return person({ role: 'lca_admin' })
}

/** What a visitor sends: the club and the person made up, the place Louisiana's own unless the case gives another. */
function request(over: Record<string, unknown> = {}) {
  const m = mark()
  return {
    kind: 'new_club',
    clubName: `Example Knights Club ${m}`,
    place: '70791',
    message: `Tuesdays at 7:00 PM at the Example Library, ${m}.`,
    name: `Player One ${m}`,
    email: `player-${m}@example.org`,
    token: 'example-made-up-token',
    ...over,
  }
}

const post = (body: unknown, opts: { address?: string; over?: Partial<Env>; as?: string } = {}) =>
  invoke(requestPost, {
    method: 'POST',
    body,
    env: opts.over ?? KEYED,
    path: '/api/clubs/reports',
    headers: { [ADDRESS_HEADER]: opts.address ?? place() },
    as: opts.as,
  })

const handle = (reportId: number | string, as?: string, body: unknown = { action: 'handled' }, aal: 'aal1' | 'aal2' = 'aal1') =>
  invoke(handledPost, { method: 'POST', params: { reportId: String(reportId) }, body, env: KEYED, path: `/api/admin/club-reports/${reportId}`, as, aal })

const regionOf = (as: string) => invoke(regionGet, { as, path: '/api/workspace/region' })

interface Row {
  id: number
  club_id: string | null
  kind: string
  field: string | null
  message: string
  proposed_json: string | null
  region: string | null
  reporter_email: string | null
  status: string
  resolved_by: string | null
  resolved_at: string | null
  escalated_at: string | null
}
const lastRow = async () => (await env.DB.prepare('SELECT * FROM club_reports WHERE club_id IS NULL ORDER BY id DESC LIMIT 1').first<Row>())!
const rowById = async (id: number) => (await env.DB.prepare('SELECT * FROM club_reports WHERE id = ?').bind(id).first<Row>())!

/** Every table of the database with its count of rows. */
async function tableCounts(): Promise<Record<string, number>> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name <> 'd1_migrations' ORDER BY name`,
  ).all<{ name: string }>()
  const counts: Record<string, number> = {}
  for (const { name } of results) counts[name] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).first<{ n: number }>())!.n
  return counts
}
const grown = (before: Record<string, number>, after: Record<string, number>) =>
  Object.keys(after).filter((name) => after[name] !== before[name])

/** Every line written to the console while the work runs, each argument as text. */
async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

/** The whole of a caught email, every part and header, as text. */
const whole = (mail: unknown) => JSON.stringify(mail)

/** The cases that send to several people wait the pause between emails, so they are given longer. */
const SLOW = 30_000

describe('while CLUB_PAGES_ON or CLUB_KEEPERS_ON is unset', () => {
  it('the public POST answers the closed 403 in words before anything is read, and writes nothing', async () => {
    flags.keepersOn = true
    const counting = countingDb()
    const before = await tableCounts()
    const result = await invoke(requestPost, {
      method: 'POST', body: request(), env: { ...KEYED, DB: counting.db }, path: '/api/clubs/reports', headers: { [ADDRESS_HEADER]: place() },
    })
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: CLUB_REQUESTS_CLOSED })
    expect(counting.ran).toEqual([])
    expect(grown(before, await tableCounts())).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('Mark as handled answers its closed 403 while CLUB_KEEPERS_ON is unset, before the sign-in is read', async () => {
    const admin = await onlyAdmin()
    const counting = countingDb()
    const result = await invoke(handledPost, {
      method: 'POST', params: { reportId: '1' }, body: { action: 'handled' }, env: { ...KEYED, DB: counting.db }, path: '/api/admin/club-reports/1', as: admin.id,
    })
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: REQUESTS_CLOSED })
    expect(counting.ran).toEqual([])
  })

  it('as main stands (CLUB_KEEPERS_ON set, CLUB_PAGES_ON unset): no row can be made, My region has no new key, and Mark as handled finds no row', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    const clubRep = await person({ role: 'club_rep' })
    await giveSeat(LAKE_CHARLES, clubRep.id)
    const closed = await post(request({ place: 'Lake Charles' }))
    expect(closed.status).toBe(403)
    expect(await closed.json()).toEqual({ error: CLUB_REQUESTS_CLOSED })
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id IS NULL AND status = 'open'`).first<{ n: number }>())!.n).toBe(0)
    for (const who of [admin.id, holder.id, clubRep.id]) {
      const answer = await regionOf(who)
      expect(answer.status).toBe(200)
      expect(Object.keys(await answer.json<WorkspaceRegionResponse>()).sort()).toEqual(['clubs', 'regions', 'thisMonth'])
    }
    // With no row of the two kinds at all, as a database main has run on holds none: every id is refused in words.
    await env.DB.prepare('DELETE FROM club_reports WHERE club_id IS NULL').run()
    const ids = (await env.DB.prepare('SELECT id FROM club_reports').all<{ id: number }>()).results.map((r) => String(r.id))
    for (const id of [...ids, '999999', 'not-a-number']) {
      const result = await handle(id, admin.id)
      expect(result.status, id).not.toBe(200)
      expect([{ error: NOT_A_REQUEST }, { error: HAS_A_CLUB }], id).toContainEqual(await result.json())
    }
    const none = await handle('999999', admin.id)
    expect(await none.json()).toEqual({ error: NOT_A_REQUEST })
  })
})

describe('the static file beside the dynamic one', () => {
  it('takes POST and OPTIONS alone, so a GET of /api/clubs/reports reaches the club handler and answers its "Club not found" as before', async () => {
    expect(Object.keys(staticFile).filter((name) => name.startsWith('onRequest')).sort()).toEqual(['onRequestOptions', 'onRequestPost'])
    expect((await invoke(requestOptions, { method: 'OPTIONS', path: '/api/clubs/reports' })).status).toBe(204)
    const got = await invoke(clubGet, { params: { id: 'reports' }, path: '/api/clubs/reports' })
    expect(got.status).toBe(404)
    expect(await got.json()).toEqual({ error: 'Club not found' })
  })
})

describe('where a request goes', () => {
  it('a ZIP routes to its region\'s representatives, one email each, with the place quoted and neither the person\'s name nor address in it', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const first = await rep(BATON_ROUGE)
    const second = await rep(BATON_ROUGE)
    const elsewhere = await rep(LAFAYETTE)
    const body = request({ clubName: 'Example <b>Knights</b> & Rooks', message: 'Tuesdays at 7:00 PM, <script>Example</script>' })
    const result = await post(body)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ sent: true })
    const row = await lastRow()
    expect(row.region).toBe(BATON_ROUGE)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([first.email, second.email].sort())
    expect(emailOutbox.map((e) => e.to)).not.toContain(elsewhere.email)
    for (const mail of emailOutbox) {
      expect(mail.subject).toBe(CLUB_REQUEST_SUBJECTS.new_club)
      expect(mail.text).toContain(`It came to you as the ${BATON_ROUGE} representative.`)
      expect(mail.text).toContain(body.clubName)
      expect(mail.text).toContain('70791')
      expect(mail.text).toContain(body.message)
      expect(mail.html).toContain('Example &lt;b&gt;Knights&lt;/b&gt; &amp; Rooks')
      expect(mail.html).not.toContain('<script>')
      expect(mail.html).not.toContain('<b>Knights')
      expect(mail.text).toContain(`${SITE}/workspace/region#club-request-${row.id}`)
      expect(mail.text).toContain('A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.')
      expect(whole(mail)).not.toContain(body.name)
      expect(whole(mail)).not.toContain(body.email)
      expect(mail.subject).not.toContain('Knights')
      // No keeper is shown another's address.
      for (const other of [first, second]) if (other.email !== mail.to) expect(whole(mail)).not.toContain(other.email)
    }
  }, SLOW)

  it('a town\'s name routes, matched without regard to case, spaces, full stops or the two spellings of Saint', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const lakeCharles = await rep(LAKE_CHARLES)
    const batonRouge = await rep(BATON_ROUGE)
    const north = await rep(NORTH)
    for (const [typed, region, to] of [
      ['  lake charles  ', LAKE_CHARLES, lakeCharles],
      ['Saint Gabriel', BATON_ROUGE, batonRouge],
      ['St. Gabriel, LA', BATON_ROUGE, batonRouge],
      ['RUSTON', NORTH, north],
      ['Shreveport, LA 71101', NORTH, north],
    ] as const) {
      emailOutbox.length = 0
      expect((await post(request({ kind: 'start_club', place: typed }))).status, typed).toBe(200)
      expect((await lastRow()).region, typed).toBe(region)
      expect(emailOutbox.map((e) => e.to), typed).toEqual([to.email])
      expect(emailOutbox[0].subject).toBe(CLUB_REQUEST_SUBJECTS.start_club)
    }
  }, SLOW)

  it('an open seat, a place not found and a place outside Louisiana go to the LCA admins; a guest holding a seat is never written to', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    const former = await person()
    await giveSeat(NEW_ORLEANS, former.id, true)
    const guest = await person({ role: 'guest' })
    await giveSeat(LAKE_CHARLES, guest.id)
    for (const [typed, region, words] of [
      ['70112', NEW_ORLEANS, `no one holds the ${NEW_ORLEANS} seat`],
      ['Picayune', NEW_ORLEANS, `no one holds the ${NEW_ORLEANS} seat`],
      ['70601', LAKE_CHARLES, `no one holds the ${LAKE_CHARLES} seat`],
      ['Example Nowhere', null, 'the place they gave was not found in Louisiana'],
      ['90210', null, 'the place they gave was not found in Louisiana'],
      ['39470', null, 'the place they gave was not found in Louisiana'],
    ] as const) {
      emailOutbox.length = 0
      expect((await post(request({ place: typed }))).status, typed).toBe(200)
      expect((await lastRow()).region, typed).toBe(region)
      expect(emailOutbox.map((e) => e.to), typed).toEqual([admin.email])
      expect(emailOutbox[0].text, typed).toContain(words)
      expect(whole(emailOutbox), typed).not.toContain(guest.email)
      expect(whole(emailOutbox), typed).not.toContain(former.email)
    }
  }, SLOW)

  it('writes to each person once, an LCA admin who holds the seat among them, and never to the address the person typed', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    await giveSeat(LAFAYETTE, admin.id)
    const other = await rep(LAFAYETTE)
    expect((await post(request({ place: '70501' }))).status).toBe(200)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([admin.email, other.email].sort())
    emailOutbox.length = 0
    expect((await post(request({ place: 'Lafayette', email: other.email }))).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([admin.email])
  }, SLOW)

  it('saves the row and says it was sent when no email is taken, logging one fixed line, and the row shows in My region', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    emailBehavior.succeed = false
    const body = request({ place: 'Sulphur' })
    const logs = await logsOf(async () => {
      const result = await post(body)
      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ sent: true })
    })
    vi.restoreAllMocks()
    emailBehavior.succeed = true
    expect(logs.filter((line) => line === CLUB_REQUEST_NOT_SENT_LOG)).toHaveLength(2)
    for (const line of logs) {
      for (const secret of [body.email, body.name, body.message, body.clubName, 'Sulphur']) expect(line).not.toContain(secret)
    }
    const row = await lastRow()
    expect(row).toMatchObject({ region: LAKE_CHARLES, status: 'open', reporter_email: body.email })
    for (const who of [holder.id, admin.id]) {
      const got = await regionOf(who)
      const answer = await got.json<WorkspaceRegionResponse>()
      expect(answer.clubRequests?.map((r) => r.id), who).toContain(row.id)
      // An answer that carries a person's name and address is kept by no cache.
      expect(got.response.headers.get('cache-control'), who).toBe('no-store')
    }
  }, SLOW)
})

describe('what the row holds', () => {
  it('holds the least, the same for a signed-in sender, grows no table but its own and the limiter\'s, and logs nothing of the person, in each state of the mail switches', async () => {
    for (const [listsOn, sender] of [[false, 'resend'], [true, 'resend'], [true, 'ses']] as const) {
      resetHarness()
      await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
      flags.pagesOn = true
      flags.listsOn = listsOn
      flags.sender = sender
      await onlyAdmin()
      const holder = await rep(NORTH)
      const member = await person()
      const before = await tableCounts()
      const words = request({ place: '71201' })
      const signedIn = request({ kind: 'start_club', place: 'Monroe' })
      const logs = await logsOf(async () => {
        expect((await post(words)).status, sender).toBe(200)
        const a = (await lastRow()).id
        expect((await post(signedIn, { as: member.id })).status, sender).toBe(200)
        expect((await lastRow()).id).toBe(a + 1)
      })
      vi.restoreAllMocks()
      expect(grown(before, await tableCounts()).sort(), `${listsOn} ${sender}`).toEqual(['club_reports', 'rate_limits'])
      expect(emailOutbox.map((e) => e.to), sender).toEqual([holder.email, holder.email])
      const second = await lastRow()
      const first = await rowById(second.id - 1)
      expect(first).toMatchObject({
        club_id: null, kind: 'new_club', field: null, message: words.message, region: NORTH, reporter_email: words.email,
        status: 'open', resolved_by: null, resolved_at: null, escalated_at: null,
      })
      expect(JSON.parse(first.proposed_json!)).toEqual({ clubName: words.clubName, place: '71201', name: words.name })
      expect(second).toMatchObject({ kind: 'start_club', region: NORTH, reporter_email: signedIn.email })
      expect(JSON.parse(second.proposed_json!)).toEqual({ clubName: signedIn.clubName, place: 'Monroe', name: signedIn.name })
      // A signed-in sender's row holds no more than anyone's: no member id, no name or address of the account.
      for (const value of [member.id, member.email, member.name]) expect(JSON.stringify(second)).not.toContain(value)
      for (const line of logs) {
        for (const secret of [words.message, words.email, words.name, '71201', signedIn.email, 'Monroe']) expect(line).not.toContain(secret)
      }
    }
  }, 60_000)

  it('caps each part, refusing in the field\'s words, and takes a long one at its cap', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const L = CLUB_REQUEST_LIMITS
    const over = await post(request({
      clubName: 'x'.repeat(L.clubName + 1), place: 'y'.repeat(L.place + 1), message: 'z'.repeat(L.message + 1), name: 'n'.repeat(L.name + 1),
      email: `${'e'.repeat(L.email)}@example.org`,
    }))
    expect(over.status).toBe(400)
    expect((await over.json<{ fields: Record<string, string> }>()).fields).toEqual({
      clubName: WORDS.clubNameLong, place: WORDS.placeLong, message: WORDS.messageLong, name: WORDS.nameLong, email: WORDS.emailLong,
    })
    const atCap = await post(request({ clubName: 'x'.repeat(L.clubName), message: 'z'.repeat(L.message), name: 'n'.repeat(L.name) }))
    expect(atCap.status).toBe(200)
  })
})

describe('the limit and the spam check', () => {
  it('refuses in words in step 28\'s order: the body, the limit by place, the spam check, then the place', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const before = await tableCounts()
    const bad = await post({ kind: 'suggestion', clubName: '', place: 'Line one\nline two', message: ' ', name: 'Player\nOne', email: 'not an address', token: 't' })
    expect(bad.status).toBe(400)
    expect((await bad.json<{ fields: Record<string, string> }>()).fields).toEqual({
      kind: WORDS.kindMissing, clubName: WORDS.clubNameMissing, place: WORDS.placeBreak, message: WORDS.messageMissing, name: WORDS.nameBreak, email: WORDS.emailForm,
    })
    spamCheckBehavior.answer = 'fail'
    const spam = await post(request())
    expect(spam.status).toBe(403)
    expect(await spam.json()).toEqual({ error: CANT_SEND_NOW })
    spamCheckBehavior.answer = 'pass'
    const here = place()
    for (let i = 0; i < 5; i++) expect((await post(request({ place: 'Example Nowhere' }), { address: here })).status).toBe(200)
    const sixth = await post(request(), { address: here })
    expect(sixth.status).toBe(429)
    expect(await sixth.json()).toEqual({ error: TOO_MANY })
    expect(grown(before, await tableCounts()).sort()).toEqual(['club_reports', 'rate_limits'])
  }, SLOW)

  it('sends one set of keepers ten in an hour at most, counted only after the spam check, so a representative is sent at most 240 a day by this door', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    spamCheckBehavior.answer = 'fail'
    for (let i = 0; i < 3; i++) expect((await post(request({ place: '70601' }))).status).toBe(403)
    spamCheckBehavior.answer = 'pass'
    for (let i = 0; i < 10; i++) expect((await post(request({ place: i % 2 ? '70601' : 'Lake Charles' }))).status).toBe(200)
    const busy = await post(request({ place: 'Sulphur' }))
    expect(busy.status).toBe(429)
    expect(await busy.json()).toEqual({ error: CLUB_REQUESTS_BUSY })
    expect(emailOutbox.filter((e) => e.to === holder.email)).toHaveLength(10)
    // The admins' count is their own: a place not found still goes to them in the same hour.
    expect((await post(request({ place: 'Example Nowhere' }))).status).toBe(200)
    expect(emailOutbox.filter((e) => e.to === admin.email)).toHaveLength(1)
  }, 60_000)

  it('counts a row its representatives could not be reached for against the admins\' own hour, so no region\'s count is spent on the admins', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    emailBehavior.succeed = false
    emailBehavior.failFor = [holder.email]
    const toAdmin = () => emailOutbox.filter((e) => e.to === admin.email)
    for (let i = 0; i < 6; i++) expect((await post(request({ place: 'Example Nowhere' }))).status).toBe(200)
    for (let i = 0; i < 4; i++) expect((await post(request({ place: 'Lake Charles' }))).status).toBe(200)
    expect(toAdmin()).toHaveLength(10)
    // The admins' hour is used up: the row is saved and the person told it was sent, and no admin is written to.
    const quiet = await post(request({ place: '70601' }))
    expect(quiet.status).toBe(200)
    expect(await quiet.json()).toEqual({ sent: true })
    expect(toAdmin()).toHaveLength(10)
    expect(emailOutbox.filter((e) => e.to === holder.email)).toHaveLength(0)
    const row = await lastRow()
    expect(row).toMatchObject({ region: LAKE_CHARLES, status: 'open' })
    expect((await (await regionOf(admin.id)).json<WorkspaceRegionResponse>()).clubRequests?.map((r) => r.id)).toContain(row.id)
    const busy = await post(request({ place: 'Example Nowhere' }))
    expect(busy.status).toBe(429)
    expect(await busy.json()).toEqual({ error: CLUB_REQUESTS_BUSY })
    expect(toAdmin()).toHaveLength(10)
  }, 60_000)

  it('takes a representative who typed their own address as reached: nothing goes to them or to the admins, and the row is on their own list', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    const ids: number[] = []
    for (let i = 0; i < 3; i++) {
      expect((await post(request({ place: 'Lake Charles', email: holder.email.toUpperCase() }))).status).toBe(200)
      ids.push((await lastRow()).id)
    }
    expect(emailOutbox).toHaveLength(0)
    expect((await (await regionOf(holder.id)).json<WorkspaceRegionResponse>()).clubRequests?.map((r) => r.id)).toEqual(expect.arrayContaining(ids))
    // The admins' hour is untouched: ten places not found still reach the admin in the same hour.
    for (let i = 0; i < 10; i++) expect((await post(request({ place: 'Example Nowhere' }))).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual(Array(10).fill(admin.email))
    for (const mail of emailOutbox) expect(mail.text).not.toContain('could not reach the region\'s representatives')
  }, 60_000)

  it('answers 503 in words with no signing key, and saves nothing', async () => {
    flags.pagesOn = true
    const before = await tableCounts()
    const result = await post(request(), { over: { TURNSTILE_SECRET_KEY: KEYED.TURNSTILE_SECRET_KEY, SIGNING_SECRET: '' } })
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ error: CANT_SEND_NOW })
    expect(grown(before, await tableCounts())).toEqual([])
  })
})

describe('the keeper\'s rows in My region', () => {
  it('a region\'s representative sees the rows of their region with the person\'s name and address; an LCA admin sees every row; no one else does', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(BATON_ROUGE)
    const otherRegion = await rep(LAFAYETTE)
    const clubRep = await person({ role: 'club_rep' })
    const member = await person()
    const ours = request({ place: 'Zachary' })
    const startOurs = request({ kind: 'start_club', place: '70726' })
    const lost = request({ place: 'Example Nowhere' })
    for (const body of [ours, startOurs, lost]) expect((await post(body)).status).toBe(200)
    const lostRow = await lastRow()

    const mine = (await (await regionOf(holder.id)).json<WorkspaceRegionResponse>()).clubRequests!
    expect(mine.map((r) => [r.kind, r.clubName, r.place, r.name, r.email, r.region, r.ageDays])).toEqual([
      ['new_club', ours.clubName, 'Zachary', ours.name, ours.email, BATON_ROUGE, 0],
      ['start_club', startOurs.clubName, '70726', startOurs.name, startOurs.email, BATON_ROUGE, 0],
    ])
    const everyone = (await (await regionOf(admin.id)).json<WorkspaceRegionResponse>()).clubRequests!
    expect(everyone.map((r) => r.clubName)).toEqual([ours.clubName, startOurs.clubName, lost.clubName])
    expect(everyone.find((r) => r.id === lostRow.id)).toMatchObject({ region: null, place: 'Example Nowhere' } satisfies Partial<ClubRequestRow>)

    // Another region's representative: My region answers, with none of these rows.
    const theirs = await regionOf(otherRegion.id)
    expect(theirs.status).toBe(200)
    const theirsText = JSON.stringify(await theirs.json())
    for (const body of [ours, startOurs, lost]) for (const value of [body.email, body.name, body.clubName]) expect(theirsText).not.toContain(value)
    // A club's rep and a member with no seat are refused My region outright, as before.
    for (const who of [clubRep.id, member.id]) {
      const refused = await regionOf(who)
      expect(refused.status).toBe(403)
      const text = JSON.stringify(await refused.json())
      for (const body of [ours, startOurs, lost]) expect(text).not.toContain(body.email)
    }
  }, SLOW)
})

describe('Mark as handled', () => {
  it('a region\'s representative marks a row of their region: one statement empties the address and the name, with one audit entry of the id and kind alone', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    const body = request({ kind: 'start_club', place: 'DeRidder' })
    expect((await post(body)).status).toBe(200)
    const row = await lastRow()
    const before = await tableCounts()
    const logs = await logsOf(async () => {
      const done = await handle(row.id, holder.id)
      expect(done.status).toBe(200)
      expect(await done.json()).toEqual({ id: row.id, status: 'answered' })
    })
    vi.restoreAllMocks()
    const after = await rowById(row.id)
    expect(after).toMatchObject({ status: 'answered', resolved_by: holder.id, reporter_email: null, region: LAKE_CHARLES, message: body.message })
    expect(after.resolved_at).not.toBeNull()
    expect(JSON.parse(after.proposed_json!)).toEqual({ clubName: body.clubName, place: 'DeRidder' })
    expect(grown(before, await tableCounts())).toEqual(['admin_audit_log'])
    const audit = await env.DB.prepare(`SELECT action, target_member_id, target_label, detail FROM admin_audit_log WHERE action = 'club_request_handled' AND actor_id = ?`)
      .bind(holder.id).all<Record<string, unknown>>()
    expect(audit.results).toEqual([{ action: 'club_request_handled', target_member_id: null, target_label: 'Wants to start a club', detail: JSON.stringify({ reportId: row.id, kind: 'start_club' }) }])
    for (const value of [body.email, body.name, body.message, body.clubName, 'DeRidder']) {
      expect(JSON.stringify(audit.results)).not.toContain(value)
      for (const line of logs) expect(line).not.toContain(value)
    }
    // Gone from My region once handled, and a second press is told in words.
    const emptied = await regionOf(holder.id)
    expect((await emptied.json<WorkspaceRegionResponse>()).clubRequests).toBeUndefined()
    // With no such row the answer's headers are as before: no cache mark of this step's.
    expect(emptied.response.headers.get('cache-control')).toBeNull()
    const again = await handle(row.id, holder.id)
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: ALREADY_HANDLED })
  })

  it('an LCA admin marks any row, one with no region among them; of two presses at once one wins and the other is told', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(NEW_ORLEANS)
    expect((await post(request({ place: 'Example Nowhere' }))).status).toBe(200)
    const lost = await lastRow()
    // The row with no region is the LCA admins' alone.
    const refused = await handle(lost.id, holder.id)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: NOT_YOUR_REGION })
    const [a, b] = await Promise.all([handle(lost.id, admin.id), handle(lost.id, admin.id)])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const loser = a.status === 409 ? a : b
    expect(await loser.json()).toEqual({ error: ALREADY_HANDLED })
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_request_handled' AND actor_id = ?`).bind(admin.id).first<{ n: number }>())!.n).toBe(1)
    // An admin asks no second factor for it: a row of New Orleans Metro, marked at aal1.
    expect((await post(request({ place: '70433' }))).status).toBe(200)
    expect((await handle((await lastRow()).id, admin.id, { action: 'handled' }, 'aal1')).status).toBe(200)
  }, SLOW)

  it('refuses everyone else in words: signed out, a member, a club\'s rep, a guest with a seat and another region\'s representative', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    await onlyAdmin()
    await rep(LAFAYETTE)
    const otherRegion = await rep(NORTH)
    const member = await person()
    const clubRep = await person({ role: 'club_rep' })
    const guest = await person({ role: 'guest' })
    await giveSeat(LAFAYETTE, guest.id)
    expect((await post(request({ place: 'Opelousas' }))).status).toBe(200)
    const row = await lastRow()
    expect(row.region).toBe(LAFAYETTE)
    expect((await handle(row.id)).status).toBe(401)
    for (const who of [member.id, clubRep.id, guest.id]) {
      const result = await handle(row.id, who)
      expect(result.status, who).toBe(403)
      expect(await result.json()).toEqual({ error: REQUESTS_FOR_KEEPERS })
    }
    const theirs = await handle(row.id, otherRegion.id)
    expect(theirs.status).toBe(403)
    expect(await theirs.json()).toEqual({ error: NOT_YOUR_REGION })
    expect(await rowById(row.id)).toMatchObject({ status: 'open', reporter_email: row.reporter_email, proposed_json: row.proposed_json })
  })

  it('refuses a suggestion of step 28 in words, leaves it as it was, and refuses an id of no row', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const m = mark()
    await env.DB.prepare(`INSERT INTO clubs (id, name, city, slug, region) VALUES (?, ?, 'Example City', ?, ?)`).bind(`club-${m}`, `Example Rooks Club ${m}`, `example-rooks-club-${m}`, NORTH).run()
    expect((await invoke(suggestPost, {
      method: 'POST', params: { id: `club-${m}` }, body: { field: 'venue', message: 'Moved to the Example Library.', token: 'example-made-up-token' }, env: KEYED,
      path: `/api/clubs/club-${m}/reports`, headers: { [ADDRESS_HEADER]: place() },
    })).status).toBe(200)
    const suggestion = (await env.DB.prepare('SELECT * FROM club_reports WHERE club_id = ?').bind(`club-${m}`).first<Row>())!
    const refused = await handle(suggestion.id, admin.id)
    expect(refused.status).toBe(400)
    expect(await refused.json()).toEqual({ error: HAS_A_CLUB })
    expect(await rowById(suggestion.id)).toEqual(suggestion)
    const none = await handle(987654321, admin.id)
    expect(none.status).toBe(404)
    expect(await none.json()).toEqual({ error: NOT_A_REQUEST })
    const body = await handle(suggestion.id, admin.id, { action: 'dismiss' })
    expect(body.status).toBe(400)
  })
})

describe('the fourteen days do not reach these rows', () => {
  it('an old open row of each kind is neither counted nor passed on by the admin\'s button', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE kind = 'suggestion' AND status = 'open'`).run()
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
    const ids: number[] = []
    for (const kind of ['new_club', 'start_club']) {
      expect((await post(request({ kind, place: 'Example Nowhere' }))).status).toBe(200)
      const row = await lastRow()
      await env.DB.prepare('UPDATE club_reports SET created_at = ? WHERE id = ?').bind(old, row.id).run()
      ids.push(row.id)
    }
    emailOutbox.length = 0
    const asked = await invoke(checkPost, { method: 'POST', as: admin.id, env: KEYED, body: { action: 'run_report_clock', send: false } })
    expect(asked.status).toBe(200)
    expect(await asked.json()).toMatchObject({ due: 0 })
    const sent = await invoke(checkPost, { method: 'POST', as: admin.id, env: KEYED, body: { action: 'run_report_clock', send: true } })
    expect(await sent.json()).toMatchObject({ due: 0, passedOn: 0, sent: 0 })
    expect(emailOutbox).toEqual([])
    for (const id of ids) expect(await rowById(id)).toMatchObject({ status: 'open', escalated_at: null })
    // My region still shows them, 20 days old.
    const rows = (await (await regionOf(admin.id)).json<WorkspaceRegionResponse>()).clubRequests!
    expect(rows.filter((r) => ids.includes(r.id)).map((r) => r.ageDays)).toEqual([20, 20])
  })
})

describe('step 4\'s deletes meet this step\'s rows', () => {
  it('a member named as a row\'s resolver but not by the activity log is deleted, the row keeping its outcome with no member id; a club\'s delete leaves a row with no club', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    expect((await post(request({ place: 'Houma' }))).status).toBe(200)
    const row = await lastRow()
    expect(row.region).toBe(NEW_ORLEANS)
    // Handled as the endpoint handles it, by a member the activity log does not name.
    const resolver = await person()
    await env.DB.prepare(
      `UPDATE club_reports SET status = 'answered', resolved_by = ?, resolved_at = datetime('now'), reporter_email = NULL, proposed_json = json_remove(proposed_json, '$.name') WHERE id = ?`,
    ).bind(resolver.id, row.id).run()
    const leaving = await invoke(memberDelete, { method: 'DELETE', as: admin.id, params: { id: resolver.id } })
    expect(leaving.status).toBe(200)
    expect(await env.DB.prepare('SELECT status, resolved_by FROM club_reports WHERE id = ?').bind(row.id).first()).toEqual({ status: 'answered', resolved_by: null })
    const m = mark()
    await env.DB.prepare(`INSERT INTO clubs (id, name, city, slug) VALUES (?, ?, 'Example City', ?)`).bind(`club-${m}`, `Example Pawns Club ${m}`, `example-pawns-club-${m}`).run()
    const gone = await invoke(clubDelete, { method: 'DELETE', as: admin.id, params: { id: `club-${m}` } })
    expect(gone.status).toBe(200)
    expect(await rowById(row.id)).toMatchObject({ status: 'answered', club_id: null })
  })

  it('a keeper who marked a row through the endpoint is named by the activity log, so their delete fails as main\'s does for any such member', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAFAYETTE)
    expect((await post(request({ place: 'Morgan City' }))).status).toBe(200)
    expect((await handle((await lastRow()).id, holder.id)).status).toBe(200)
    await expect(invoke(memberDelete, { method: 'DELETE', as: admin.id, params: { id: holder.id } })).rejects.toThrow(/FOREIGN KEY constraint failed/)
  })
})
