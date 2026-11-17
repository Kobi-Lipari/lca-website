// test/integration/club-check-emails.test.ts
//
// The monthly check (WS09 step 14): runMonthlyCheck in
// functions/utils/clubs/monthlyCheck.ts on D1 built from the migrations, and
// the LCA admin's button, POST /api/admin/clubs/monthly-check, through the
// real handler. CLUB_KEEPERS_ON is set through a getter on the mocked
// module; the signing key is made up and written here. Each case passes its
// own now, and every seat, club, person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_JOB, LINK_TTL_SECONDS, MARKS_MISSING_LOG, PRESS_SENDS, TIMED_SENDS, runMonthlyCheck, type MonthlyCheckEnv,
} from '../../functions/utils/clubs/monthlyCheck'
import { CHECK_CLOSED, CHECK_NO_KEY, onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { readToken } from '../../functions/utils/tokens'
import { checkMonthKey } from '../../domain/clubs/monthlyCheck'
import { seedAdmin, seedClub, seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ keepersOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

/** A made-up key, long enough to sign with, used nowhere else. */
const KEY = 'example-made-up-signing-key-for-the-check-0001'
const keyed = (db: D1Database = env.DB): MonthlyCheckEnv => ({ ...(env as unknown as MonthlyCheckEnv), DB: db, SIGNING_SECRET: KEY })
const FAST = { pauseMs: 0 }

/** First Mondays and the times around their 8:00 AM, Central, in UTC. */
const DEC_7_8AM = new Date('2026-12-07T14:00:00Z')
const DEC_3 = new Date('2026-12-03T18:00:00Z')

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`

/** A person with a made-up name and address at example.org. */
async function person(name = 'Player One', extra: { role?: string; email?: string } = {}): Promise<{ id: string; email: string }> {
  const n = next()
  const email = extra.email ?? `player-${n}@example.org`
  const id = await seedMember({ fullName: name, email, role: extra.role })
  return { id, email }
}

/** A club in a made-up region of its own, or the region given. */
async function club(region: string, name = 'Example Chess Club'): Promise<string> {
  const id = await seedClub({ name, city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, how_we_meet_text = \'Tuesdays at 7:00 PM.\' WHERE id = ?').bind(region, id).run()
  return id
}

/** A regional seat over the regions given, held by the people given. */
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

/** One holder of a seat over a region of their own with one club in it. */
async function holder(name = 'Player One') {
  const region = `Example Region ${next()}`
  const clubId = await club(region)
  const who = await person(name)
  await seat([region], [who.id])
  return { ...who, region, clubId }
}

const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)
const runRows = async () => (await env.DB.prepare('SELECT outcome, sent_count, failed_count, detail FROM automation_runs WHERE job = ? ORDER BY id').bind(CHECK_JOB)
  .all<{ outcome: string; sent_count: number | null; failed_count: number | null; detail: string | null }>()).results
const markCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM club_check_marks').first<{ n: number }>())!.n
/** The Still accurate links in an email's text, by the token each carries. */
const tokensIn = (text: string | undefined) => [...(text ?? '').matchAll(/Still accurate: \S+\/clubs\/confirm\/(\S+)/g)].map((m) => decodeURIComponent(m[1]))

beforeEach(async () => {
  resetHarness()
  flags.keepersOn = true
  await env.DB.batch([
    env.DB.prepare('DELETE FROM board_seat_assignments'),
    env.DB.prepare('DELETE FROM club_check_marks'),
    env.DB.prepare('DELETE FROM automation_runs'),
  ])
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('the monthly check reaches each representative once', () => {
  it('one email per representative, listing only their clubs', async () => {
    const one = await holder('Player One')
    const two = await holder('Player Two')
    const elsewhere = await club(`Example Region ${next()}`, 'Example Rooks Club')
    const answer = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(answer).toMatchObject({ stopped: null, month: 'December 2026', people: 2, sent: 2, notSent: 0, notReached: 0 })
    for (const who of [one, two]) {
      const mail = mailTo(who.email)
      expect(mail, who.email).toHaveLength(1)
      expect(mail[0].subject).toBe('Your region\'s clubs: still accurate?')
      const tokens = tokensIn(mail[0].text)
      expect(tokens).toHaveLength(1)
      const read = await readToken({ current: KEY }, 'club_confirm', tokens[0], DEC_7_8AM)
      expect(read).toEqual({ ok: true, claim: { club: who.clubId, member: who.id } })
      expect(mail[0].text).toContain(`Update: https://www.louisianachess.org/workspace/region/clubs/${who.clubId}`)
      expect(mail[0].html).not.toContain(elsewhere)
    }
    expect(emailOutbox).toHaveLength(2)
  })

  it('a person with two seats gets one email listing both seats\' clubs once each', async () => {
    const both = `Example Region ${next()}`
    const other = `Example Region ${next()}`
    const shared = await club(both, 'Example Chess Club')
    const second = await club(other, 'Example Knights Club')
    const who = await person('Player Three')
    await seat([both], [who.id])
    await seat([both, other], [who.id])
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    const mail = mailTo(who.email)
    expect(mail).toHaveLength(1)
    const claims = await Promise.all(tokensIn(mail[0].text).map((t) => readToken({ current: KEY }, 'club_confirm', t, DEC_7_8AM)))
    expect(claims.map((c) => (c.ok ? c.claim.club : null)).sort()).toEqual([shared, second].sort())
    expect(mail[0].text!.match(/Example Chess Club/g)).toHaveLength(1)
  })

  it('due at 8:00 AM Central on the first Monday, in summer and in winter', async () => {
    const who = await holder()
    // Winter: Mon, Jan 4, 2027, Central Standard Time, UTC less six hours.
    expect((await runMonthlyCheck(keyed(), new Date('2027-01-04T13:59:00Z'), false, FAST)).stopped).toBe('not_due')
    expect((await runMonthlyCheck(keyed(), new Date('2027-01-04T14:00:00Z'), false, FAST)).sent).toBe(1)
    // Summer: Mon, Jul 5, 2027, Central Daylight Time, UTC less five hours.
    expect((await runMonthlyCheck(keyed(), new Date('2027-07-05T12:59:00Z'), false, FAST)).stopped).toBe('not_due')
    expect((await runMonthlyCheck(keyed(), new Date('2027-07-05T13:00:00Z'), false, FAST)).sent).toBe(1)
    // Mon, Nov 2, 2026, the day after the clocks go back.
    expect((await runMonthlyCheck(keyed(), new Date('2026-11-02T13:59:00Z'), false, FAST)).stopped).toBe('not_due')
    expect((await runMonthlyCheck(keyed(), new Date('2026-11-02T14:00:00Z'), false, FAST)).sent).toBe(1)
    expect(mailTo(who.email)).toHaveLength(3)
    const marks = await env.DB.prepare('SELECT month FROM club_check_marks WHERE member_id = ? ORDER BY month').bind(who.id).all<{ month: string }>()
    expect(marks.results.map((r) => r.month)).toEqual(['2026-11-02', '2027-01-04', '2027-07-05'])
  })

  it('the timed run does not send twice on a first Monday', async () => {
    const who = await holder()
    expect((await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)).sent).toBe(1)
    const later = await runMonthlyCheck(keyed(), new Date('2026-12-07T14:05:00Z'), false, FAST)
    expect(later).toMatchObject({ stopped: 'nobody', sent: 0 })
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-08T05:59:00Z'), false, FAST)).stopped).toBe('nobody')
    expect(mailTo(who.email)).toHaveLength(1)
    // Only the run that sent wrote a row; the later ones found nobody left and wrote none.
    expect(await runRows()).toEqual([{ outcome: 'ok', sent_count: 1, failed_count: 0, detail: 'December 2026: 1 sent, 0 not sent, 0 left for the next run' }])
  })

  it('an open seat gets none', async () => {
    const region = `Example Region ${next()}`
    await club(region)
    await seat([region], [])
    const ended = await person('Player Four')
    await seat([region], [ended.id], { ended: true })
    const inactive = await person('Player Five')
    await seat([region], [inactive.id], { active: false })
    const noClub = await person('Player Six')
    await seat([`Example Region ${next()}`], [noClub.id])
    const guest = await person('Player Seven', { role: 'guest' })
    await seat([region], [guest.id])
    const noAddress = await person('Player Eight', { email: `walk-in-${next()}` })
    await seat([region], [noAddress.id])
    const answer = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(answer).toMatchObject({ people: 1, sent: 0, notSent: 1 })
    expect(emailOutbox).toHaveLength(0)
    expect((await runRows())[0]).toMatchObject({ outcome: 'failed', sent_count: 0, failed_count: 1, detail: 'December 2026: 0 sent, 1 not sent, 0 left for the next run' })
  })

  it('a timed run that is not due, or with the constant unset, or with no secret, writes no automation_runs row and makes no query', async () => {
    await holder()
    const cases: Array<[string, () => void, Date, Partial<MonthlyCheckEnv>]> = [
      ['not due', () => {}, new Date('2026-12-08T14:00:00Z'), {}],
      ['the second Monday', () => {}, new Date('2026-12-14T14:00:00Z'), {}],
      ['the constant unset', () => { flags.keepersOn = false }, DEC_7_8AM, {}],
      ['no secret', () => {}, DEC_7_8AM, { SIGNING_SECRET: undefined }],
      ['a secret too short', () => {}, DEC_7_8AM, { SIGNING_SECRET: 'example-short-key' }],
    ]
    for (const [name, set, now, over] of cases) {
      flags.keepersOn = true
      set()
      const { db, ran } = countingDb()
      const answer = await runMonthlyCheck({ ...keyed(db), ...over }, now, false, FAST)
      expect(answer.sent, name).toBe(0)
      expect(ran, name).toEqual([])
    }
    expect(await runRows()).toEqual([])
    expect(await markCount()).toBe(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('a switch turned on after the first Monday sends nothing until the next one', async () => {
    const who = await holder()
    for (const at of ['2026-12-08T14:00:00Z', '2026-12-10T18:00:00Z', '2026-12-14T14:00:00Z', '2027-01-04T13:59:00Z']) {
      expect((await runMonthlyCheck(keyed(), new Date(at), false, FAST)).stopped, at).toBe('not_due')
    }
    expect(emailOutbox).toHaveLength(0)
    expect((await runMonthlyCheck(keyed(), new Date('2027-01-04T14:00:00Z'), false, FAST)).sent).toBe(1)
    expect(mailTo(who.email)).toHaveLength(1)
  })

  it('an admin\'s press before the first Monday does not stop Monday\'s send', async () => {
    const one = await holder('Player One')
    const two = await holder('Player Two')
    const pressed = await runMonthlyCheck(keyed(), DEC_3, true, FAST)
    expect(pressed).toMatchObject({ stopped: null, people: 2, sent: 2 })
    expect(await markCount()).toBe(0)
    // A press's copy says who sent it, and does not say it comes on the first Monday.
    for (const mail of emailOutbox) {
      for (const words of [mail.text!, mail.html]) {
        expect(words).toContain('You get this because you are a regional representative. An LCA admin sent this one by hand.')
        expect(words).not.toContain('first Monday')
      }
    }
    expect((await runRows())[0].detail).toBe('December 2026, manual: 2 sent, 0 not sent, 0 not reached')
    // A press on the first Monday itself, before the timed run, writes no mark either.
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-07T13:30:00Z'), true, FAST)).sent).toBe(2)
    const monday = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(monday).toMatchObject({ people: 2, sent: 2 })
    for (const who of [one, two]) expect(mailTo(who.email), who.email).toHaveLength(3)
    expect(await markCount()).toBe(2)
  })
})

describe('the mark: claimed before the send, given back only when another try is worth it', () => {
  it('two timed calls at once send one email to each person', async () => {
    const people = [await holder('Player One'), await holder('Player Two'), await holder('Player Three')]
    const [a, b] = await Promise.all([runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST), runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)])
    expect(a.sent + b.sent).toBe(3)
    for (const who of people) expect(mailTo(who.email), who.email).toHaveLength(1)
    expect(await markCount()).toBe(3)
  })

  it('a person another run claims between this run\'s read of the marks and its own claim gets no second email', async () => {
    const one = await holder('Player One')
    const two = await holder('Player Two')
    // The other run's claim of Player One, played once this run has read the month's marks and before it claims.
    let played = false
    const between = countingDb({
      afterAll: async (sql) => {
        if (played || !sql.includes('FROM club_check_marks')) return
        played = true
        await env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?)').bind(one.id, checkMonthKey(DEC_7_8AM)).run()
      },
    })
    const answer = await runMonthlyCheck(keyed(between.db), DEC_7_8AM, false, FAST)
    expect(played).toBe(true)
    expect(answer).toMatchObject({ people: 1, sent: 1, notSent: 0 })
    expect(mailTo(one.email)).toHaveLength(0)
    expect(mailTo(two.email)).toHaveLength(1)
    expect(await markCount()).toBe(2)
  })

  it('a send worth another try gives the mark back and the next call sends', async () => {
    const who = await holder()
    emailBehavior.succeed = false
    emailBehavior.status = 503
    emailBehavior.failFor = [who.email]
    const first = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(first).toMatchObject({ sent: 0, notSent: 1 })
    expect(await markCount()).toBe(0)
    emailBehavior.succeed = true
    const second = await runMonthlyCheck(keyed(), new Date('2026-12-07T14:05:00Z'), false, FAST)
    expect(second).toMatchObject({ sent: 1 })
    expect(mailTo(who.email)).toHaveLength(1)
    expect(await markCount()).toBe(1)
  })

  it('one that will never go is not tried again that month', async () => {
    const who = await holder()
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [who.email]
    expect(await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)).toMatchObject({ sent: 0, notSent: 1 })
    expect(await markCount()).toBe(1)
    emailBehavior.succeed = true
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-07T14:05:00Z'), false, FAST)).stopped).toBe('nobody')
    expect(mailTo(who.email)).toHaveLength(0)
  })

  it('more than ten people: ten, then the rest, nobody twice', async () => {
    const people = []
    for (let i = 0; i < TIMED_SENDS + 3; i++) people.push(await holder(`Player ${i + 1}`))
    const first = await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(first).toMatchObject({ people: 13, sent: 10, notReached: 3 })
    const second = await runMonthlyCheck(keyed(), new Date('2026-12-07T14:05:00Z'), false, FAST)
    expect(second).toMatchObject({ people: 3, sent: 3, notReached: 0 })
    expect((await runMonthlyCheck(keyed(), new Date('2026-12-07T14:10:00Z'), false, FAST)).stopped).toBe('nobody')
    for (const who of people) expect(mailTo(who.email), who.email).toHaveLength(1)
    expect((await runRows()).map((r) => r.detail)).toEqual([
      'December 2026: 10 sent, 0 not sent, 3 left for the next run',
      'December 2026: 3 sent, 0 not sent, 0 left for the next run',
    ])
  })

  it('the mark table missing: a timed call sends nothing and logs one line, and the button still sends', async () => {
    const who = await holder()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const missing = countingDb({ refuse: 'club_check_marks' })
    const timed = await runMonthlyCheck(keyed(missing.db), DEC_7_8AM, false, FAST)
    expect(timed).toMatchObject({ stopped: 'marks_missing', sent: 0 })
    expect(warn.mock.calls).toEqual([[MARKS_MISSING_LOG]])
    expect(missing.ran.map((r) => r.sql)).toEqual(['SELECT member_id FROM club_check_marks WHERE month = ?'])
    expect(emailOutbox).toHaveLength(0)
    const pressed = await runMonthlyCheck(keyed(countingDb({ refuse: 'club_check_marks' }).db), DEC_7_8AM, true, FAST)
    expect(pressed.sent).toBe(1)
    expect(mailTo(who.email)).toHaveLength(1)
  })

  it('automation_runs missing: the check still sends and the marks still hold', async () => {
    const who = await holder()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const missing = countingDb({ refuse: 'automation_runs' })
    expect((await runMonthlyCheck(keyed(missing.db), DEC_7_8AM, false, FAST)).sent).toBe(1)
    expect(await markCount()).toBe(1)
    expect((await runMonthlyCheck(keyed(missing.db), new Date('2026-12-07T14:05:00Z'), false, FAST)).stopped).toBe('nobody')
    expect(mailTo(who.email)).toHaveLength(1)
  })
})

describe('the email', () => {
  it('lists only the clubs that person\'s seats keep, each link reading back to that club and that member, with a weekday, 8:00 AM and no long dash', async () => {
    const who = await holder('Player One')
    const second = await club(who.region, 'Example Knights Club')
    await club(`Example Region ${next()}`, 'Example Rooks Club')
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    const [mail] = mailTo(who.email)
    for (const words of [mail.text!, mail.html]) {
      expect(words).toContain('Hi Player,')
      expect(words).toContain('Still accurate works without logging in for 30 days, until Wed, Jan 6, 2027.')
      expect(words).toContain('You get this because you are a regional representative. It comes on the first Monday of each month at 8:00 AM.')
      expect(words).toContain('Tuesdays at 7:00 PM.')
      expect(words).not.toMatch(/Example Rooks Club|unsubscribe/i)
      expect(words).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    }
    const tokens = tokensIn(mail.text)
    expect(tokens).toHaveLength(2)
    const claims = await Promise.all(tokens.map((t) => readToken({ current: KEY }, 'club_confirm', t, DEC_7_8AM)))
    expect(claims.map((c) => (c.ok ? c.claim : null))).toEqual(expect.arrayContaining([{ club: who.clubId, member: who.id }, { club: second, member: who.id }]))
    for (const t of tokens) {
      expect(mail.html).toContain(`/clubs/confirm/${t}`)
      // 30 days, and not a second more.
      expect(await readToken({ current: KEY }, 'club_confirm', t, new Date(DEC_7_8AM.getTime() + LINK_TTL_SECONDS * 1000 - 1000))).toMatchObject({ ok: true })
      expect(await readToken({ current: KEY }, 'club_confirm', t, new Date(DEC_7_8AM.getTime() + LINK_TTL_SECONDS * 1000))).toEqual({ ok: false, reason: 'expired' })
    }
  })

  it('puts the token in no log line and no row', async () => {
    const who = await holder()
    emailBehavior.succeed = false
    emailBehavior.status = 422
    const logged: string[] = []
    for (const level of ['log', 'warn', 'error', 'info'] as const) vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(' ')) })
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    emailBehavior.succeed = true
    await runMonthlyCheck(keyed(), new Date('2027-01-04T14:00:00Z'), true, FAST)
    const [mail] = mailTo(who.email)
    const [token] = tokensIn(mail.text)
    expect(token.length).toBeGreaterThan(24)
    const runs = JSON.stringify((await env.DB.prepare('SELECT * FROM automation_runs').all()).results)
    const marks = JSON.stringify((await env.DB.prepare('SELECT * FROM club_check_marks').all()).results)
    for (const text of [...logged, runs, marks]) {
      expect(text).not.toContain(token)
      expect(text).not.toContain(token.split('.')[2])
      expect(text).not.toContain(who.email)
    }
    // The run record names no person; the mark holds the member's id and the month, and nothing more.
    expect(runs).not.toContain(who.id)
    expect(marks).toBe(JSON.stringify([{ member_id: who.id, month: '2026-12-07' }]))
  })
})

describe('the admin\'s button: POST /api/admin/clubs/monthly-check', () => {
  it('an admin\'s button sends it and others get 403', async () => {
    const one = await holder('Player One')
    const officer = await seedMember({ role: 'lca_officer' })
    const rep = await seedMember({ role: 'club_rep', clubId: one.clubId })
    for (const who of [await seedMember(), rep, one.id, officer]) {
      const refused = await invoke(checkPost, { method: 'POST', as: who, body: { send: true } })
      expect(refused.status, who).toBe(403)
      expect(await refused.json(), who).toEqual({ error: 'Forbidden' })
    }
    const admin = await seedAdmin()
    const noFactor = await invoke(checkPost, { method: 'POST', as: admin, aal: 'aal1', body: { send: true } })
    expect(noFactor.status).toBe(403)
    expect((await noFactor.json<{ error: string }>()).error).toBe('Two-factor authentication is required for admin access. Set it up in your account security settings.')
    expect(emailOutbox).toHaveLength(0)
    expect(await runRows()).toEqual([])

    const asked = await invoke(checkPost, { method: 'POST', as: admin, body: { send: false }, env: { SIGNING_SECRET: KEY } })
    expect(asked.status).toBe(200)
    expect(await asked.json()).toMatchObject({ people: 1, sent: 0, notSent: 0, notReached: 0 })
    expect(emailOutbox).toHaveLength(0)

    const sent = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(sent.status).toBe(200)
    expect(await sent.json()).toMatchObject({ people: 1, sent: 1, notSent: 0, notReached: 0 })
    expect(mailTo(one.email)).toHaveLength(1)
    expect((await runRows())[0].detail).toMatch(/^[A-Z][a-z]+ \d{4}, manual: 1 sent, 0 not sent, 0 not reached$/)
    expect(await markCount()).toBe(0)
    // Monday's timed send still goes to everyone.
    expect((await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)).sent).toBe(1)
    expect(mailTo(one.email)).toHaveLength(2)
  })

  it('an admin\'s press with no secret answers why and sends nothing', async () => {
    await holder()
    const admin = await seedAdmin()
    for (const secret of [undefined, 'example-short-key']) {
      const result = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: secret } })
      expect(result.status).toBe(503)
      expect(await result.json()).toEqual({ error: CHECK_NO_KEY })
    }
    expect(emailOutbox).toHaveLength(0)
    expect(await runRows()).toEqual([])
  })

  it('with the constant unset everyone is refused in words before any sign-in or query', async () => {
    flags.keepersOn = false
    const admin = await seedAdmin()
    const { db, ran } = countingDb()
    for (const who of [undefined, admin]) {
      const result = await invoke(checkPost, { method: 'POST', as: who, body: { send: true }, env: { DB: db, SIGNING_SECRET: KEY } })
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: CHECK_CLOSED })
    }
    expect(ran).toEqual([])
    expect(emailOutbox).toHaveLength(0)
  })

  it('a press reaches at most the bound and says in numbers how many it did not reach', async () => {
    const region = `Example Region ${next()}`
    await club(region)
    const holders = []
    for (let i = 0; i < PRESS_SENDS + 2; i++) holders.push((await person(`Player ${i + 1}`)).id)
    await seat([region], holders)
    const answer = await runMonthlyCheck(keyed(), DEC_3, true, FAST)
    expect(answer).toMatchObject({ people: PRESS_SENDS + 2, sent: PRESS_SENDS, notSent: 0, notReached: 2 })
    expect(emailOutbox).toHaveLength(PRESS_SENDS)
    expect((await runRows())[0]).toMatchObject({ outcome: 'partial', detail: `December 2026, manual: ${PRESS_SENDS} sent, 0 not sent, 2 not reached` })
  })
})

describe('the mark table and the member delete', () => {
  it('the member delete takes a member\'s marks with the member, and answers as on the base without the table', async () => {
    const admin = await seedAdmin()
    const who = await holder()
    const other = await holder('Player Two')
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, FAST)
    expect(await markCount()).toBe(2)
    const deleted = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: who.id } })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ success: true, authDeleted: false })
    expect((await env.DB.prepare('SELECT member_id FROM club_check_marks').all<{ member_id: string }>()).results).toEqual([{ member_id: other.id }])
    // A database before 0069: no table, and the delete answers as it did.
    await env.DB.prepare('DROP TABLE club_check_marks').run()
    try {
      const before = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: other.id } })
      expect(before.status).toBe(200)
      expect(await before.json()).toEqual({ success: true, authDeleted: false })
      expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(other.id).first()).toBeNull()
    } finally {
      await env.DB.prepare('CREATE TABLE club_check_marks (member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, month TEXT NOT NULL, PRIMARY KEY (member_id, month))').run()
    }
  })
})
