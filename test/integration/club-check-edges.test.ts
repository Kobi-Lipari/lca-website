// test/integration/club-check-edges.test.ts
//
// The edges of the monthly check (WS09 step 14) that its two main suites,
// test/integration/club-check-emails.test.ts and
// test/integration/club-confirm-link.test.ts, leave open:
//
// - (a) the email names the clubs My region shows a holder who is not an
//   LCA admin, a region added to a seat and a second seat among them, and
//   an LCA admin who holds a seat is emailed the seat's clubs, not every
//   club as the page shows an admin;
// - (b) the do-not-send gate, read once for a run, with the mail engine's
//   rules off and on;
// - (c) a send worth another try in the middle of a run, a press that meets
//   one, a person with no address on a press, and the Central day boundaries
//   of the mark's month;
// - (d) the words of an email drawn from a club name and a statement that
//   carry markup, and a club with no statement;
// - (e) the button's role-safety: no sign-in, a wrong role and an admin
//   without the second factor, asked and pressed, and a bad body;
// - (f) the link: the token in no log line and no answer, one answer for a
//   club that exists and one that does not, the same write as the button on
//   a club's card, an inactive seat, and a body the contract refuses;
// - (g) the mark table: its columns, its key and its member rule.
//
// CLUB_KEEPERS_ON and the mail engine's switch are set through getters on
// mocked modules; the keys are made up and written here, and every club,
// person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as buttonConfirm } from '../../functions/api/admin/clubs/[id]/confirm'
import { onRequestGet as linkGet, onRequestPost as linkPost } from '../../functions/api/clubs/confirm/[token]'
import { onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS, runMonthlyCheck, type MonthlyCheckEnv } from '../../functions/utils/clubs/monthlyCheck'
import { readToken, signToken } from '../../functions/utils/tokens'
import { seedAdmin, seedClub, seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ keepersOn: true, listsOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
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
  }
})

const KEY = 'example-made-up-signing-key-for-the-edges-01'
const keyed = (db: D1Database = env.DB): MonthlyCheckEnv => ({ ...(env as unknown as MonthlyCheckEnv), DB: db, SIGNING_SECRET: KEY })
const FAST = { pauseMs: 0 }

const DEC_7_8AM = new Date('2026-12-07T14:00:00Z')
const DEC_3 = new Date('2026-12-03T18:00:00Z')

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`

async function person(name = 'Player One', extra: { role?: string; email?: string } = {}): Promise<{ id: string; email: string }> {
  const email = extra.email ?? `player-${next()}@example.org`
  const id = await seedMember({ fullName: name, email, role: extra.role })
  return { id, email }
}

async function club(region: string, name = 'Example Chess Club', statement: string | null = 'Tuesdays at 7:00 PM.'): Promise<string> {
  const id = await seedClub({ name, city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, how_we_meet_text = ? WHERE id = ?').bind(region, statement, id).run()
  return id
}

async function seat(regions: string[], holders: string[], opts: { active?: boolean; ended?: boolean } = {}): Promise<string> {
  const id = `seat-${next()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', ?)`,
  ).bind(id, id, opts.active === false ? 0 : 1).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  for (const holder of holders) {
    await env.DB.prepare(`INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, ${opts.ended ? "datetime('now')" : 'NULL'})`).bind(id, holder).run()
  }
  return id
}

async function holder(name = 'Player One') {
  const region = `Example Region ${next()}`
  const clubId = await club(region)
  const who = await person(name)
  const seatId = await seat([region], [who.id])
  return { ...who, region, clubId, seatId }
}

const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)
const markRows = async () => (await env.DB.prepare('SELECT member_id, month FROM club_check_marks ORDER BY member_id').all<{ member_id: string; month: string }>()).results
const tokensIn = (text: string | undefined) => [...(text ?? '').matchAll(/Still accurate: \S+\/clubs\/confirm\/(\S+)/g)].map((m) => decodeURIComponent(m[1]))
const clubIdsInMail = async (mail: { text?: string }, at = DEC_7_8AM) => {
  const claims = await Promise.all(tokensIn(mail.text).map((t) => readToken({ current: KEY }, CONFIRM_PURPOSE, t, at)))
  return claims.map((c) => (c.ok ? String(c.claim.club) : 'unreadable')).sort()
}
const capture = () => {
  const logged: string[] = []
  for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(' ')) })
  }
  return logged
}

beforeEach(async () => {
  resetHarness()
  flags.keepersOn = true
  flags.listsOn = false
  await env.DB.batch([
    env.DB.prepare('DELETE FROM board_seat_assignments'),
    env.DB.prepare('DELETE FROM club_check_marks'),
    env.DB.prepare('DELETE FROM automation_runs'),
    env.DB.prepare('DELETE FROM mail_do_not_send'),
  ])
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('(a) the email names the clubs the seats keep, as My region shows a holder', () => {
  it('a seat\'s added region, a second seat, an ended seat and an inactive one: the email lists what My region shows', async () => {
    const regionA = `Example Region ${next()}`
    const regionB = `Example Region ${next()}`
    const regionAdded = `Example Region ${next()}`
    const regionEnded = `Example Region ${next()}`
    const regionInactive = `Example Region ${next()}`
    const a1 = await club(regionA, 'Example Chess Club')
    const a2 = await club(regionA, 'Example Knights Club')
    const b1 = await club(regionB, 'Example Rooks Club')
    const added = await club(regionAdded, 'Example Bishops Club')
    await club(regionEnded, 'Example Pawns Club')
    await club(regionInactive, 'Example Queens Club')
    await club(`Example Region ${next()}`, 'Example Kings Club')
    const who = await person('Player One')
    await seat([regionA], [who.id])
    // A second seat, with a region an LCA admin added to it after the seat was made.
    const second = await seat([regionB], [who.id])
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(second, regionAdded).run()
    await seat([regionEnded], [who.id], { ended: true })
    await seat([regionInactive], [who.id], { active: false })

    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    const [mail] = mailTo(who.email)
    const inEmail = await clubIdsInMail(mail)
    const page = await invoke(regionGet, { as: who.id })
    expect(page.status).toBe(200)
    const onPage = (await page.json<{ clubs: Array<{ id: string }> }>()).clubs.map((c) => c.id).sort()
    expect(inEmail).toEqual(onPage)
    expect(inEmail).toEqual([a1, a2, b1, added].sort())
    expect(mailTo(who.email)).toHaveLength(1)
  })

  it('an LCA admin who holds a seat is emailed the clubs the seat keeps, as the seat\'s other holder is, and not every club My region shows an admin', async () => {
    const own = await holder('Player Two')
    const admin = await seedMember({ role: 'lca_admin', fullName: 'Player Nine', email: `admin-${next()}@example.org` })
    await seat([own.region], [admin])
    const elsewhere = await club(`Example Region ${next()}`, 'Example Rooks Club')
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    const sentToAdmin = emailOutbox.filter((e) => /^admin-/.test(e.to))
    expect(sentToAdmin).toHaveLength(1)
    const inEmail = await clubIdsInMail(sentToAdmin[0])
    expect(inEmail).toEqual([own.clubId])
    // My region shows an admin every club; the email keeps to the seat's.
    const page = await invoke(regionGet, { as: admin })
    expect(page.status).toBe(200)
    const onPage = (await page.json<{ clubs: Array<{ id: string }> }>()).clubs.map((c) => c.id)
    expect(onPage).toContain(own.clubId)
    expect(onPage).toContain(elsewhere)
    expect(await clubIdsInMail(mailTo(own.email)[0])).toEqual([own.clubId])
  })

  it('an LCA admin whose seat keeps no club gets none, as any seat that keeps no club', async () => {
    await club(`Example Region ${next()}`, 'Example Rooks Club')
    const admin = await seedMember({ role: 'lca_admin', fullName: 'Player Nine', email: `admin-${next()}@example.org` })
    await seat([`Example Region ${next()}`], [admin])
    const answer = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(answer.stopped).toBe('nobody')
    expect(emailOutbox.filter((e) => /^admin-/.test(e.to))).toHaveLength(0)
  })
})

describe('(b) the do-not-send gate is read once for a run', () => {
  it('with the engine\'s rules off no mail table is read, and an address on the list is mailed as today', async () => {
    const one = await holder('Player One')
    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'General')`).bind(one.email).run()
    const { db, ran } = countingDb()
    const answer = await runMonthlyCheck(keyed(db), DEC_7_8AM, false, FAST)
    expect(answer.sent).toBe(1)
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
  })

  it('with the rules on, ten people are checked in one read, an address on the list gets none, and its mark is kept', async () => {
    flags.listsOn = true
    const people = []
    for (let i = 0; i < 10; i++) people.push(await holder(`Player ${i + 1}`))
    const blocked = people[3]
    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'General')`).bind(blocked.email).run()
    const { db, ran } = countingDb()
    const answer = await runMonthlyCheck(keyed(db), DEC_7_8AM, false, FAST)
    expect(answer).toMatchObject({ people: 10, sent: 9, notSent: 1, notReached: 0 })
    expect(mailTo(blocked.email)).toHaveLength(0)
    for (const who of people.filter((p) => p !== blocked)) expect(mailTo(who.email), who.email).toHaveLength(1)
    expect(ran.filter((r) => /\bmail_do_not_send\b/.test(r.sql))).toHaveLength(1)
    // A refusal that will never change is not tried again that month.
    expect((await markRows()).map((r) => r.member_id).sort()).toEqual(people.map((p) => p.id).sort())
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-07T14:05:00Z'), false, FAST)).stopped).toBe('nobody')
  })

  it('a press with the rules on reads the gate once too, and the same address is refused', async () => {
    flags.listsOn = true
    const one = await holder('Player One')
    const two = await holder('Player Two')
    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'General')`).bind(two.email).run()
    const { db, ran } = countingDb()
    const answer = await runMonthlyCheck(keyed(db), DEC_3, true, FAST)
    expect(answer).toMatchObject({ people: 2, sent: 1, notSent: 1 })
    expect(mailTo(one.email)).toHaveLength(1)
    expect(mailTo(two.email)).toHaveLength(0)
    expect(ran.filter((r) => /\bmail_do_not_send\b/.test(r.sql))).toHaveLength(1)
    expect(ran.filter((r) => /club_check_marks/.test(r.sql))).toEqual([])
  })
})

describe('(c) the middle of a run, and the Central day', () => {
  it('a send worth another try ends the run, gives its mark back, leaves the rest unclaimed, and the next run sends all three', async () => {
    const first = await holder('Player A')
    const second = await holder('Player B')
    const third = await holder('Player C')
    emailBehavior.succeed = false
    emailBehavior.status = 500
    emailBehavior.failFor = [first.email]
    const run = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(run).toMatchObject({ people: 3, sent: 0, notSent: 1, notReached: 2 })
    expect(await markRows()).toEqual([])
    expect(emailOutbox).toHaveLength(0)
    const row = await env.DB.prepare('SELECT outcome, detail FROM automation_runs WHERE job = ?').bind('club_monthly_check').first<{ outcome: string; detail: string }>()
    expect(row).toEqual({ outcome: 'failed', detail: 'December 2026: 0 sent, 1 not sent, 2 left for the next run' })
    emailBehavior.succeed = true
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-07T14:05:00Z'), false, FAST)).sent).toBe(3)
    for (const who of [first, second, third]) expect(mailTo(who.email), who.email).toHaveLength(1)
    expect(await markRows()).toHaveLength(3)
  })

  it('a press that meets a send worth another try ends there, counts the rest as not reached, and touches no mark', async () => {
    const people = [await holder('Player A'), await holder('Player B'), await holder('Player C')]
    emailBehavior.succeed = false
    emailBehavior.status = 500
    emailBehavior.failFor = [people[0].email]
    const { db, ran } = countingDb()
    const answer = await runMonthlyCheck(keyed(db), DEC_3, true, FAST)
    expect(answer).toMatchObject({ people: 3, sent: 0, notSent: 1, notReached: 2 })
    expect(ran.filter((r) => /club_check_marks/.test(r.sql))).toEqual([])
    expect(await markRows()).toEqual([])
  })

  it('a press counts a person with no address as not sent and sends the others, in numbers only', async () => {
    const region = `Example Region ${next()}`
    await club(region)
    const good = await person('Player One')
    const bad = await person('Player Two', { email: `walk-in-${next()}` })
    await seat([region], [good.id, bad.id])
    const answer = await runMonthlyCheck(keyed(), DEC_3, true, FAST)
    expect(answer).toMatchObject({ people: 2, sent: 1, notSent: 1, notReached: 0 })
    expect(emailOutbox.map((e) => e.to)).toEqual([good.email])
    const detail = await env.DB.prepare('SELECT detail FROM automation_runs WHERE job = ?').bind('club_monthly_check').first<string>('detail')
    expect(detail).toBe('December 2026, manual: 1 sent, 1 not sent, 0 not reached')
  })

  it('the mark\'s month is the first Monday\'s Central day, to the last minute of it', async () => {
    const who = await holder()
    // Mon, Dec 7, 2026 at 11:59 PM Central is Tue, Dec 8 at 5:59 AM UTC: still the Monday, still due, marked 2026-12-07.
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-08T05:59:00Z'), false, FAST)).sent).toBe(1)
    expect(await markRows()).toEqual([{ member_id: who.id, month: '2026-12-07' }])
    // Tue, Dec 8 at 12:00 AM Central: no longer the day, nothing is tried, nothing is queried.
    const { db, ran } = countingDb()
    expect((await runMonthlyCheck(keyed(db), new Date('2026-12-08T06:00:00Z'), false, FAST)).stopped).toBe('not_due')
    expect(ran).toEqual([])
    // Mon, Jan 4, 2027 at 11:59 PM Central Standard Time is Tue, Jan 5 at 5:59 AM UTC.
    expect((await runMonthlyCheck(keyed(), new Date('2027-01-05T05:59:00Z'), false, FAST)).sent).toBe(1)
    expect((await markRows()).map((r) => r.month)).toEqual(['2026-12-07', '2027-01-04'])
    expect(mailTo(who.email)).toHaveLength(2)
  })
})

describe('(d) the email\'s words from what a club writes', () => {
  it('markup in a club\'s name and statement is drawn as text, and a club with no statement draws no empty word', async () => {
    const region = `Example Region ${next()}`
    await club(region, 'Example <Chess> & Club', 'Meets <b>Tuesdays</b> & Fridays.')
    await club(region, 'Example Knights Club', null)
    const who = await person('Player One')
    await seat([region], [who.id])
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    const [mail] = mailTo(who.email)
    expect(mail.html).not.toContain('<b>Tuesdays')
    expect(mail.html).not.toContain('Example <Chess>')
    expect(mail.html).toContain('Example &lt;Chess&gt; &amp; Club')
    expect(mail.text).toContain('Example <Chess> & Club')
    for (const words of [mail.html, mail.text!]) {
      expect(words).toContain('Example Knights Club')
      expect(words).not.toMatch(/\bnull\b|\bundefined\b/)
    }
  })
})

describe('(e) the button: no sign-in, a wrong role, no second factor, a bad body', () => {
  it('no sign-in gets 401 and no count; a wrong role gets 403 whether it asks or presses, whatever the body, and never the numbers', async () => {
    const one = await holder('Player One')
    const rep = await seedMember({ role: 'club_rep', clubId: one.clubId })
    const officer = await seedMember({ role: 'lca_officer' })
    const observer = await seedMember({ role: 'lca_observer' })
    const auditor = await seedMember({ role: 'lca_auditor' })
    const guest = await seedMember({ role: 'guest' })
    const withKey = { SIGNING_SECRET: KEY }
    for (const body of [{ send: false }, { send: true }, { nonsense: 1 }]) {
      const nobody = await invoke(checkPost, { method: 'POST', body, env: withKey })
      expect(nobody.status, JSON.stringify(body)).toBe(401)
      expect(JSON.stringify(await nobody.json())).not.toMatch(/people|sent|month/)
      for (const who of [await seedMember(), rep, one.id, officer, observer, auditor, guest]) {
        const refused = await invoke(checkPost, { method: 'POST', as: who, body, env: withKey })
        expect(refused.status, `${who} ${JSON.stringify(body)}`).toBe(403)
        expect(JSON.stringify(await refused.json())).not.toMatch(/people|notSent|notReached/)
      }
    }
    expect(emailOutbox).toHaveLength(0)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM automation_runs').first('n')).toBe(0)
  })

  it('an LCA admin without the second factor is refused in words when asking as when pressing, and nothing is sent', async () => {
    await holder()
    const admin = await seedAdmin()
    for (const send of [false, true]) {
      const refused = await invoke(checkPost, { method: 'POST', as: admin, aal: 'aal1', body: { send }, env: { SIGNING_SECRET: KEY } })
      expect(refused.status).toBe(403)
      expect(await refused.json()).toEqual({
        error: 'Two-factor authentication is required for admin access. Set it up in your account security settings.',
        mfaRequired: true,
      })
    }
    expect(emailOutbox).toHaveLength(0)
  })

  it('an admin\'s body must be {send: boolean}: nothing else is sent or counted', async () => {
    await holder()
    const admin = await seedAdmin()
    for (const body of [{}, { send: 'yes' }, { send: 1 }, { send: null }, []]) {
      const refused = await invoke(checkPost, { method: 'POST', as: admin, body, env: { SIGNING_SECRET: KEY } })
      expect(refused.status, JSON.stringify(body)).toBe(400)
    }
    expect((await invoke(checkPost, { method: 'POST', as: admin, rawBody: 'not json', headers: { 'Content-Type': 'application/json' }, env: { SIGNING_SECRET: KEY } })).status).toBe(400)
    expect(emailOutbox).toHaveLength(0)
  })

  it('an admin who asks is told how many it goes to and nothing is sent or written', async () => {
    await holder('Player One')
    await holder('Player Two')
    const admin = await seedAdmin()
    const asked = await invoke(checkPost, { method: 'POST', as: admin, body: { send: false }, env: { SIGNING_SECRET: KEY } })
    expect(await asked.json()).toMatchObject({ people: 2, sent: 0, notSent: 0, notReached: 0 })
    expect(emailOutbox).toHaveLength(0)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM automation_runs').first('n')).toBe(0)
    expect(await markRows()).toEqual([])
  })
})

describe('(f) the link read as someone who wants in would read it', () => {
  const CHECK_TOKEN_PARTS = (token: string) => token.split('.').filter((part) => part.length >= 8)

  async function linked(opts: { active?: boolean } = {}) {
    const region = `Example Region ${next()}`
    const clubId = await club(region)
    const who = await person('Player One')
    const seatId = await seat([region], [who.id], { active: opts.active })
    const token = await signToken(KEY, CONFIRM_PURPOSE, { club: clubId, member: who.id }, LINK_TTL_SECONDS)
    return { clubId, memberId: who.id, seatId, region, token }
  }
  const call = (handler: typeof linkGet, token: string, over: Record<string, unknown> = { SIGNING_SECRET: KEY }, extra: { body?: unknown; rawBody?: string } = {}) =>
    invoke(handler, {
      method: handler === linkPost ? 'POST' : 'GET',
      params: { token },
      path: `/api/clubs/confirm/${token}`,
      body: handler === linkPost && extra.rawBody === undefined ? (extra.body ?? {}) : undefined,
      rawBody: extra.rawBody,
      env: over,
    })

  it('the token is in no log line and no answer, whatever the answer is', async () => {
    const good = await linked()
    const seatEnded = await linked()
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?").bind(seatEnded.seatId).run()
    const memberGone = await linked()
    await env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberGone.memberId).run()
    const clubGone = await linked()
    await env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubGone.clubId).run()
    const expired = await signToken(KEY, CONFIRM_PURPOSE, { club: good.clubId, member: good.memberId }, LINK_TTL_SECONDS, new Date(Date.now() - (LINK_TTL_SECONDS + 5) * 1000))
    const wrongPurpose = await signToken(KEY, 'waitlist:claim', { club: good.clubId, member: good.memberId }, LINK_TTL_SECONDS)
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ['good', good.token, { SIGNING_SECRET: KEY }],
      ['seat ended', seatEnded.token, { SIGNING_SECRET: KEY }],
      ['member gone', memberGone.token, { SIGNING_SECRET: KEY }],
      ['club gone', clubGone.token, { SIGNING_SECRET: KEY }],
      ['expired', expired, { SIGNING_SECRET: KEY }],
      ['wrong purpose', wrongPurpose, { SIGNING_SECRET: KEY }],
      ['cut short', good.token.slice(0, -5), { SIGNING_SECRET: KEY }],
      ['no key', good.token, { SIGNING_SECRET: undefined }],
    ]
    const logged = capture()
    const answers: string[] = []
    for (const [name, token, over] of cases) {
      for (const handler of [linkGet, linkPost]) {
        const result = await call(handler, token, over)
        answers.push(`${name} ${result.status} ${JSON.stringify(await result.json())} ${[...result.response.headers].map(([k, v]) => `${k}=${v}`).join(';')}`)
      }
    }
    for (const [, token] of cases) {
      for (const part of [token, ...CHECK_TOKEN_PARTS(token)]) {
        for (const text of [...logged, ...answers]) expect(text, part.slice(0, 12)).not.toContain(part)
      }
    }
    const rows = JSON.stringify((await env.DB.prepare('SELECT * FROM automation_runs').all()).results)
    for (const [, token] of cases) expect(rows).not.toContain(token)
  })

  it('a link that is not good answers a club that exists and one that does not with the same status, words and headers', async () => {
    const real = await linked()
    const forgeries = (clubId: string) => Promise.all([
      signToken('example-made-up-key-of-someone-else-0009', CONFIRM_PURPOSE, { club: clubId, member: real.memberId }, LINK_TTL_SECONDS),
      signToken(KEY, 'waitlist:claim', { club: clubId, member: real.memberId }, LINK_TTL_SECONDS),
    ])
    const [forgedReal, purposeReal] = await forgeries(real.clubId)
    const [forgedNone, purposeNone] = await forgeries('example-no-such-club')
    const shape = async (handler: typeof linkGet, token: string) => {
      const result = await call(handler, token)
      return { status: result.status, body: await result.json(), headers: [...result.response.headers].sort() }
    }
    for (const handler of [linkGet, linkPost]) {
      expect(await shape(handler, forgedReal)).toEqual(await shape(handler, forgedNone))
      expect(await shape(handler, purposeReal)).toEqual(await shape(handler, purposeNone))
      expect(await shape(handler, forgedReal)).toEqual(await shape(handler, purposeReal))
    }
  })

  it('a POST makes the same change as the button on a club\'s card: the same columns, and the same person', async () => {
    const region = `Example Region ${next()}`
    const byButton = await club(region, 'Example Chess Club')
    const byLink = await club(region, 'Example Chess Club')
    const who = await person('Player One')
    await seat([region], [who.id])
    const snapshot = (id: string) => env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(id).first<Record<string, unknown>>()
    const changed = (before: Record<string, unknown>, after: Record<string, unknown>) =>
      Object.keys(after).filter((k) => before[k] !== after[k]).sort()
    const buttonBefore = (await snapshot(byButton))!
    const linkBefore = (await snapshot(byLink))!
    const pressed = await invoke(buttonConfirm, { method: 'POST', as: who.id, params: { id: byButton }, body: {} })
    expect(pressed.status).toBe(200)
    const token = await signToken(KEY, CONFIRM_PURPOSE, { club: byLink, member: who.id }, LINK_TTL_SECONDS)
    expect((await call(linkPost, token)).status).toBe(200)
    const buttonAfter = (await snapshot(byButton))!
    const linkAfter = (await snapshot(byLink))!
    expect(changed(buttonBefore, buttonAfter)).toEqual(['confirmed_by', 'last_confirmed_at'])
    expect(changed(linkBefore, linkAfter)).toEqual(changed(buttonBefore, buttonAfter))
    expect(linkAfter.confirmed_by).toBe(buttonAfter.confirmed_by)
    expect(linkAfter.confirmed_by).toBe(who.id)
  })

  it('a seat that has been made inactive since the email is refused, and the club is left as it was', async () => {
    const { clubId, seatId, token } = await linked()
    expect((await call(linkGet, token)).status).toBe(200)
    await env.DB.prepare('UPDATE board_members SET is_active = 0 WHERE id = ?').bind(seatId).run()
    const before = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()
    for (const handler of [linkGet, linkPost]) {
      const result = await call(handler, token)
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: 'Your seat no longer covers this club.' })
    }
    expect(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()).toEqual(before)
  })

  it('a region added to the seat since the email brings its club into reach of a link made for it', async () => {
    const { seatId, memberId } = await linked()
    const addedRegion = `Example Region ${next()}`
    const addedClub = await club(addedRegion, 'Example Knights Club')
    const token = await signToken(KEY, CONFIRM_PURPOSE, { club: addedClub, member: memberId }, LINK_TTL_SECONDS)
    expect((await call(linkPost, token)).status).toBe(403)
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seatId, addedRegion).run()
    expect((await call(linkPost, token)).status).toBe(200)
  })

  it('a body that is not JSON is refused and the club is left as it was', async () => {
    const { clubId, token } = await linked()
    const before = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()
    for (const rawBody of ['not json', '']) {
      expect((await call(linkPost, token, { SIGNING_SECRET: KEY }, { rawBody })).status, JSON.stringify(rawBody)).toBe(400)
    }
    expect(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()).toEqual(before)
  })

  it('a club or a person named in the body is never read: the link alone decides who is stamped and which club', async () => {
    const { clubId, memberId, region, token } = await linked()
    const other = await club(region, 'Example Knights Club')
    const bystander = await seedMember({ fullName: 'Player Two' })
    const otherBefore = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(other).first()
    const result = await call(linkPost, token, { SIGNING_SECRET: KEY }, { body: { club: other, clubId: other, id: other, confirmedBy: bystander, member: bystander, memberId: bystander } })
    expect(result.status).toBe(200)
    expect(await env.DB.prepare('SELECT confirmed_by FROM clubs WHERE id = ?').bind(clubId).first('confirmed_by')).toBe(memberId)
    expect(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(other).first()).toEqual(otherBefore)
  })

  it('a link for a person and a club the claim names reads only those two: a claim with another shape is not a link', async () => {
    const { clubId, memberId } = await linked()
    const shapes: Array<Record<string, unknown>> = [{ club: clubId }, { member: memberId }, { club: '', member: memberId }, { club: clubId, member: '' }, { club: 7, member: memberId }]
    for (const claim of shapes) {
      const token = await signToken(KEY, CONFIRM_PURPOSE, claim as never, LINK_TTL_SECONDS)
      for (const handler of [linkGet, linkPost]) expect((await call(handler, token)).status, JSON.stringify(claim)).toBe(400)
    }
  })
})

describe('(g) the mark table', () => {
  it('holds a member and a month and nothing else, and its key refuses the second mark', async () => {
    const columns = (await env.DB.prepare("SELECT name, pk FROM pragma_table_info('club_check_marks') ORDER BY cid").all<{ name: string; pk: number }>()).results
    expect(columns).toEqual([{ name: 'member_id', pk: 1 }, { name: 'month', pk: 2 }])
    const who = await seedMember()
    await env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?)').bind(who, '2026-12-07').run()
    await expect(env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?)').bind(who, '2026-12-07').run()).rejects.toThrow()
    const second = await env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(who, '2026-12-07').run()
    expect(second.meta.changes).toBe(0)
    const nextMonth = await env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(who, '2027-01-04').run()
    expect(nextMonth.meta.changes).toBe(1)
  })

  it('refuses a mark for a person who is not a member', async () => {
    await expect(env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?)').bind('example-no-such-member', '2026-12-07').run()).rejects.toThrow()
  })
})
