// test/integration/approval-edges.test.ts
//
// The edges of the approval wait (WS09 step 18), POST
// /api/admin/tournaments/[id]/approval, that the endpoint's main cases in
// test/integration/club-events.test.ts leave to this file. Every club,
// person, address and event is made up; mail is read from the test outbox
// and REGION_EVENTS_ON, false in the tree, through a getter on its own
// module.
// - the note: exactly 500 characters goes through whole, and one of white
//   space around 500 is trimmed first;
// - stale or blank stored times read as not set, as mayList reads them;
// - submit on an approved event is 409 for the people who may submit it and
//   403 for the people who may not, so the state is not told to them;
// - a replayed move changes nothing, sends nothing and writes no row;
// - presses at once, of every pairing, leave one winner's row and mail and
//   an event in a state the moves could have left it in;
// - the LCA admins by D22's one rule: each address once whatever its case,
//   none without an "@", none at all, and a send that fails for one of them;
// - the other grants (a President, an observer, a director by role, another
//   region's representative) are refused approve and ask for changes;
// - the constant is read at each call;
// - OPTIONS answers 204 with the constant unset, reading nothing;
// - an event with no club, and a two day event, as the emails name them;
// - the public list shows the event once it is approved and not before.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ALREADY_APPROVED,
  APPROVAL_CLOSED,
  EMAIL_WORDS,
  NOT_IN_REVIEW,
  onRequestOptions,
  onRequestPost as approval,
} from '../../functions/api/admin/tournaments/[id]/approval'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { NO_CLUB } from '../../functions/utils/clubs/emails'
import { lcaAdminAddresses } from '../../functions/utils/events/publishedReview'
import { APPROVAL_NOTE_MAX } from '../../domain/contracts/events'
import { seedAdmin, seedClub, seedMember, seedPresident, seedTournament, seedTournamentDirector } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { countingDb, noWaits } from './mailRuns'

const flags = vi.hoisted(() => ({ regionOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.regionOn = true
  noWaits()
})
afterEach(() => {
  flags.regionOn = false
  vi.restoreAllMocks()
})

const REGION = 'Example Bayou Region'
const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
/** An en dash or an em dash, written by code so that this file holds neither. */
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
let seq = 0

async function regionalSeat(memberId: string, region: string = REGION): Promise<void> {
  const seat = `seat-edge-${++seq}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, memberId).run()
}

/** A representative's draft for a club in the region, marked for approval, with the people who may and may not move it. */
async function world(over: { clubless?: boolean; name?: string; date?: string; endDate?: string | null } = {}) {
  const club = await seedClub({ name: `Example Chess Club ${++seq}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
  const representative = await seedMember({ fullName: 'Player One', email: `player.one.${seq}@example.org` })
  await regionalSeat(representative)
  const admin = await seedAdmin()
  const draft = await seedTournament({
    name: over.name ?? `Example Winter Open ${seq}`,
    date: over.date ?? '2026-12-12',
    clubId: over.clubless ? null : club,
    createdBy: representative,
    entryFee: 0,
    sections: [{ name: 'Open', entryFee: 0 }],
    isVisible: false,
  })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, end_date = ? WHERE id = ?').bind(over.endDate ?? null, draft).run()
  return { club, representative, admin, draft }
}

const move = (as: string | undefined, id: string, body: unknown, extra: { aal?: 'aal1' | 'aal2'; env?: Record<string, unknown> } = {}) =>
  invoke(approval, { method: 'POST', as, params: { id }, body, ...extra })
const submit = (as: string | undefined, id: string) => move(as, id, { action: 'submit' })
const approve = (as: string | undefined, id: string) => move(as, id, { action: 'approve' })
const ask = (as: string | undefined, id: string, note = 'Example note') => move(as, id, { action: 'ask_changes', note })

const waitOf = (id: string) => env.DB.prepare('SELECT approval_requested_at, approved_at, approved_by, is_visible, needs_lca_approval FROM tournaments WHERE id = ?').bind(id).first<{
  approval_requested_at: string | null; approved_at: string | null; approved_by: string | null; is_visible: number; needs_lca_approval: number
}>()
const actionsAbout = async (id: string) => (await env.DB.prepare("SELECT action FROM admin_audit_log WHERE action LIKE 'tournament_%' AND json_extract(detail, '$.tournament_id') = ? ORDER BY rowid").bind(id).all<{ action: string }>()).results.map((r) => r.action)
const answerWords = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ email: string }>()).email

describe('the note', () => {
  it('takes exactly 500 characters, whole, and no more', async () => {
    const { draft, representative, admin } = await world()
    expect((await submit(representative, draft)).status).toBe(200)
    emailOutbox.length = 0
    const note = `${'é'.repeat(APPROVAL_NOTE_MAX - 1)}.`
    expect(note).toHaveLength(500)
    const res = await ask(admin, draft, note)
    expect(res.status).toBe(200)
    expect(emailOutbox).toHaveLength(1)
    expect(emailOutbox[0].text).toContain(note)
    expect(emailOutbox[0].html).toContain(note)
    expect(await waitOf(draft)).toMatchObject({ approval_requested_at: null })
  })

  it('trims white space around a note before it counts, so 500 characters with padding goes through and 501 does not', async () => {
    const { draft, representative, admin } = await world()
    expect((await submit(representative, draft)).status).toBe(200)
    const body = 'x'.repeat(500)
    const refused = await ask(admin, draft, `  ${body}x  `)
    expect(refused.status).toBe(400)
    expect(await waitOf(draft)).toMatchObject({ approval_requested_at: expect.stringMatching(STAMP) })
    const ok = await ask(admin, draft, `\n  ${body}  \t`)
    expect(ok.status).toBe(200)
    expect(emailOutbox.at(-1)?.text).toContain(`\n${body}\n`)
  })

  it('refuses a note that is not text, and an action with a note it does not take, before any state is read', async () => {
    const { draft, representative, admin } = await world()
    expect((await submit(representative, draft)).status).toBe(200)
    const before = await waitOf(draft)
    for (const body of [
      { action: 'ask_changes', note: 12 },
      { action: 'ask_changes', note: null },
      { action: 'ask_changes', note: ['Example note'] },
      { action: 'approve', note: 'Example note' },
      { action: 'submit', note: '' },
    ]) {
      const { db, ran } = countingDb()
      const res = await move(admin, draft, body, { env: { DB: db } })
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(ran.some((r) => /tournaments/.test(r.sql) && /UPDATE|INSERT/.test(r.sql)), JSON.stringify(body)).toBe(false)
    }
    expect(await waitOf(draft)).toEqual(before)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
  })
})

describe('stored times that are empty or blank', () => {
  it.each([
    ['empty', ''],
    ['spaces', '   '],
  ])('read as not set when they are %s: the event is a draft, submit goes through, and approve lists it', async (_, blank) => {
    const { draft, representative, admin } = await world()
    await env.DB.prepare('UPDATE tournaments SET approved_at = ?, approval_requested_at = ? WHERE id = ?').bind(blank, blank, draft).run()
    const submitted = await submit(representative, draft)
    expect(submitted.status).toBe(200)
    expect(await submitted.json()).toMatchObject({ approved_at: null, approval_requested_at: expect.stringMatching(STAMP), email: EMAIL_WORDS.reviewSent })
    await env.DB.prepare('UPDATE tournaments SET approved_at = ? WHERE id = ?').bind(blank, draft).run()
    const approved = await approve(admin, draft)
    expect(approved.status).toBe(200)
    expect(await approved.json()).toMatchObject({ approved_at: expect.stringMatching(STAMP), approved_by: admin })
    expect(await waitOf(draft)).toMatchObject({ is_visible: 1, approved_by: admin })
  })

  it('answers a blank request as a draft on ask for changes, 409 in words, and a blank approved_at as unapproved on a real request', async () => {
    const { draft, representative, admin } = await world()
    await env.DB.prepare("UPDATE tournaments SET approval_requested_at = '  ' WHERE id = ?").bind(draft).run()
    const refused = await ask(admin, draft)
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: NOT_IN_REVIEW })
    expect((await submit(representative, draft)).status).toBe(200)
    await env.DB.prepare("UPDATE tournaments SET approved_at = '' WHERE id = ?").bind(draft).run()
    expect((await ask(admin, draft)).status).toBe(200)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted', 'tournament_changes_asked'])
  })
})

describe('submit on an approved event', () => {
  it('is 409 in words for the drafter and an LCA admin, with no row and no email', async () => {
    const { draft, representative, admin } = await world()
    expect((await approve(admin, draft)).status).toBe(200)
    const before = await waitOf(draft)
    emailOutbox.length = 0
    for (const as of [representative, admin]) {
      const res = await submit(as, draft)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: ALREADY_APPROVED })
    }
    expect(await waitOf(draft)).toEqual(before)
    expect(emailOutbox).toEqual([])
    expect(await actionsAbout(draft)).toEqual(['tournament_approved'])
  })

  it('is 403 for a person who may not submit, as on a draft, so the event\'s state is not told to them', async () => {
    const { draft, club, admin } = await world()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const outsider = await seedMember()
    const director = await seedMember()
    await seedTournamentDirector(draft, director)
    expect((await approve(admin, draft)).status).toBe(200)
    for (const as of [rep, outsider, director]) {
      const approvedRes = await submit(as, draft)
      expect(approvedRes.status).toBe(403)
      expect(await approvedRes.json()).toEqual({ error: 'Forbidden' })
    }
  })
})

describe('a move said twice', () => {
  it('a second ask for changes is 409, with no second email and no second row', async () => {
    const { draft, representative, admin } = await world()
    expect((await submit(representative, draft)).status).toBe(200)
    expect((await ask(admin, draft)).status).toBe(200)
    const sent = emailOutbox.length
    const before = await waitOf(draft)
    const again = await ask(admin, draft)
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: NOT_IN_REVIEW })
    expect(emailOutbox).toHaveLength(sent)
    expect(await waitOf(draft)).toEqual(before)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted', 'tournament_changes_asked'])
  })

  it('a second submit by an LCA admin while in review is as the drafter\'s: nothing changes, nothing is sent, and the words say so', async () => {
    const { draft, representative, admin } = await world()
    expect((await submit(representative, draft)).status).toBe(200)
    const before = await waitOf(draft)
    const sent = emailOutbox.length
    const again = await submit(admin, draft)
    expect(again.status).toBe(200)
    expect(await answerWords(again)).toBe(EMAIL_WORDS.alreadyInReview)
    expect(await waitOf(draft)).toEqual(before)
    expect(emailOutbox).toHaveLength(sent)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
  })
})

describe('presses at once', () => {
  it('two submits, the drafter\'s and an LCA admin\'s: one goes through, the LCA admins are emailed once each, and one row is written', async () => {
    const { draft, representative, admin } = await world()
    const answers = await Promise.all([submit(representative, draft), submit(admin, draft)])
    expect(answers.map((a) => a.status)).toEqual([200, 200])
    const words = (await Promise.all(answers.map(answerWords))).sort()
    expect(words).toEqual([EMAIL_WORDS.alreadyInReview, EMAIL_WORDS.reviewSent].sort())
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([...(await lcaAdminAddresses(env.DB))].sort())
  })

  it('two asks for changes: one goes through and the other is 409, so one row and one email', async () => {
    const { draft, representative, admin } = await world()
    const second = await seedAdmin()
    expect((await submit(representative, draft)).status).toBe(200)
    const sent = emailOutbox.length
    const answers = await Promise.all([ask(admin, draft, 'First note.'), ask(second, draft, 'Second note.')])
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409])
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted', 'tournament_changes_asked'])
    expect(emailOutbox).toHaveLength(sent + 1)
    expect(await waitOf(draft)).toMatchObject({ approval_requested_at: null, approved_at: null })
  })

  it.each([
    ['approve and ask for changes', 'approve', 'ask'],
    ['ask for changes and approve', 'ask', 'approve'],
  ])('%s, from in review: each press that went through left one row and one email, and the event stands as the presses left it', async (_, first, secondMove) => {
    const { draft, representative, admin } = await world()
    const other = await seedAdmin()
    expect((await submit(representative, draft)).status).toBe(200)
    emailOutbox.length = 0
    const run = (name: string, as: string) => (name === 'approve' ? approve(as, draft) : ask(as, draft))
    const answers = await Promise.all([run(first, admin), run(secondMove, other)])
    const statuses = answers.map((a) => a.status)
    expect(statuses.every((s) => s === 200 || s === 409), statuses.join()).toBe(true)
    const wentThrough = (name: string) => statuses[name === first ? 0 : 1] === 200
    const rows = await actionsAbout(draft)
    expect(rows.filter((r) => r === 'tournament_approved')).toHaveLength(wentThrough('approve') ? 1 : 0)
    expect(rows.filter((r) => r === 'tournament_changes_asked')).toHaveLength(wentThrough('ask') ? 1 : 0)
    expect(emailOutbox).toHaveLength(statuses.filter((s) => s === 200).length)
    // Approve always goes through from a draft or in review: the event ends approved and listed.
    if (wentThrough('approve')) expect(await waitOf(draft)).toMatchObject({ is_visible: 1, approved_by: expect.stringMatching(/^mem-/) })
    else expect(await waitOf(draft)).toMatchObject({ is_visible: 0, approved_at: null })
  })

  it('a submit and an approve at once never leave a request on an approved event without its row, and send one email per move that went through', async () => {
    const { draft, representative, admin } = await world()
    emailOutbox.length = 0
    const answers = await Promise.all([submit(representative, draft), approve(admin, draft)])
    const statuses = answers.map((a) => a.status)
    expect(statuses[1]).toBe(200)
    expect([200, 409]).toContain(statuses[0])
    const rows = await actionsAbout(draft)
    expect(rows.filter((r) => r === 'tournament_approved')).toHaveLength(1)
    expect(rows.filter((r) => r === 'tournament_submitted')).toHaveLength(statuses[0] === 200 ? 1 : 0)
    expect(await waitOf(draft)).toMatchObject({ is_visible: 1, approved_by: admin })
  })
})

describe('the LCA admins a submit writes to', () => {
  it('writes to each address once whatever its case, to none without an "@", and in the one order D22\'s notice uses', async () => {
    const { draft, representative } = await world()
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE role = 'lca_admin'").run()
    await seedMember({ role: 'lca_admin', email: 'Admin.One@Example.org' })
    await seedMember({ role: 'lca_admin', email: 'admin.one@example.org' })
    await seedMember({ role: 'lca_admin', email: 'admin.two@example.org' })
    await seedMember({ role: 'lca_admin', email: 'no address on file' })
    await seedMember({ role: 'lca_observer', email: 'observer@example.org' })
    const res = await submit(representative, draft)
    expect(res.status).toBe(200)
    expect(await answerWords(res)).toBe(EMAIL_WORDS.reviewSent)
    expect(emailOutbox.map((e) => e.to)).toEqual(await lcaAdminAddresses(env.DB))
    expect(emailOutbox.map((e) => e.to.toLowerCase()).sort()).toEqual(['admin.one@example.org', 'admin.two@example.org'])
  })

  it('with no LCA admin to write to, makes the move and says in words that no email was sent', async () => {
    const { draft, representative } = await world()
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE role = 'lca_admin'").run()
    const res = await submit(representative, draft)
    expect(res.status).toBe(200)
    expect(await answerWords(res)).toBe(EMAIL_WORDS.reviewNoAdmin)
    expect(emailOutbox).toEqual([])
    expect((await waitOf(draft))?.approval_requested_at).toMatch(STAMP)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
  })

  it('when the send fails for one of two LCA admins, makes the move, mails the other, and says the email did not reach every one', async () => {
    const { draft, representative } = await world()
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE role = 'lca_admin'").run()
    await seedMember({ role: 'lca_admin', email: 'admin.one@example.org' })
    await seedMember({ role: 'lca_admin', email: 'admin.two@example.org' })
    emailBehavior.succeed = false
    emailBehavior.failFor = ['admin.one@example.org']
    const res = await submit(representative, draft)
    expect(res.status).toBe(200)
    expect(await answerWords(res)).toBe(EMAIL_WORDS.reviewPartly)
    expect(emailOutbox.map((e) => e.to)).toEqual(['admin.two@example.org'])
    expect((await waitOf(draft))?.approval_requested_at).toMatch(STAMP)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
  })
})

describe('the other grants are refused approve and ask for changes', () => {
  it.each(['the President', 'an observer', 'a director by role', 'another region\'s representative', 'a club rep of another club'])('%s gets 403 on both, and nothing changes', async (who) => {
    const { draft, representative } = await world()
    let as: string
    if (who === 'the President') {
      as = await seedMember({ role: 'lca_observer' })
      await seedPresident(as)
    } else if (who === 'an observer') as = await seedMember({ role: 'lca_observer' })
    else if (who === 'a director by role') as = await seedMember({ role: 'tournament_director' })
    else if (who === 'another region\'s representative') {
      as = await seedMember()
      await regionalSeat(as, 'Example Far Region')
    } else {
      const otherClub = await seedClub({ name: 'Example Rooks Club' })
      as = await seedMember({ role: 'club_rep', clubId: otherClub })
    }
    expect((await submit(representative, draft)).status).toBe(200)
    const before = await waitOf(draft)
    const sent = emailOutbox.length
    for (const res of [await approve(as, draft), await ask(as, draft)]) {
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
    }
    expect(await waitOf(draft)).toEqual(before)
    expect(emailOutbox).toHaveLength(sent)
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
  })

  it('refuses the same person submit when they are not the drafter: the President and an observer', async () => {
    const { draft } = await world()
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const observer = await seedMember({ role: 'lca_observer' })
    for (const as of [president, observer]) expect((await submit(as, draft)).status).toBe(403)
    expect(await waitOf(draft)).toMatchObject({ approval_requested_at: null })
  })
})

describe('the constant, read at each call', () => {
  it('answers 403 when it is unset, 200 when it is set, and 403 again when it is unset again, on the one event', async () => {
    const { draft, representative } = await world()
    flags.regionOn = false
    const closed = await submit(representative, draft)
    expect(closed.status).toBe(403)
    expect(await closed.json()).toEqual({ error: APPROVAL_CLOSED })
    flags.regionOn = true
    expect((await submit(representative, draft)).status).toBe(200)
    flags.regionOn = false
    const closedAgain = await approve(representative, draft)
    expect(closedAgain.status).toBe(403)
    expect(await closedAgain.json()).toEqual({ error: APPROVAL_CLOSED })
    expect(await actionsAbout(draft)).toEqual(['tournament_submitted'])
  })

  it('reads no table at all while unset, signed out, for an event that does not exist', async () => {
    flags.regionOn = false
    const { db, ran } = countingDb()
    const res = await move(undefined, 'no-such-event', { action: 'approve' }, { env: { DB: db } })
    expect(res.status).toBe(403)
    expect(ran).toEqual([])
  })

  it('answers OPTIONS 204 with the constant unset, reading nothing and sending nothing', async () => {
    flags.regionOn = false
    const { db, ran } = countingDb()
    const res = await invoke(onRequestOptions, { method: 'OPTIONS', env: { DB: db } })
    expect(res.status).toBe(204)
    expect(await res.response.text()).toBe('')
    expect(ran).toEqual([])
    expect(emailOutbox).toEqual([])
  })
})

describe('what the emails name', () => {
  it('names an event with no club as one line of words, for an LCA admin who submits it', async () => {
    const { draft, admin } = await world({ clubless: true })
    const res = await submit(admin, draft)
    expect(res.status).toBe(200)
    expect(emailOutbox.length).toBeGreaterThan(0)
    for (const mail of emailOutbox) {
      expect(mail.text).toContain(`Club: ${NO_CLUB}`)
      expect(mail.html).toContain(NO_CLUB)
    }
  })

  it('refuses a drafter submit on an event with no club, since no seat keeps a club it does not have', async () => {
    const { draft, representative } = await world({ clubless: true })
    const res = await submit(representative, draft)
    expect(res.status).toBe(403)
    expect(await waitOf(draft)).toMatchObject({ approval_requested_at: null })
  })

  it.each([
    ['a two day event over the clocks going back in America/Chicago', '2026-10-31', '2026-11-01', 'Sat, Oct 31 to Sun, Nov 1, 2026'],
    ['an event on the day the clocks go forward, end date null', '2026-03-08', null, 'Sun, Mar 8, 2026'],
    ['a two day event across a year', '2026-12-31', '2027-01-01', 'Thu, Dec 31, 2026 to Fri, Jan 1, 2027'],
  ])('writes %s with a weekday on each date, in the subject and both parts of all three emails', async (_, date, endDate, words) => {
    const { draft, representative, admin } = await world({ date, endDate })
    expect((await submit(representative, draft)).status).toBe(200)
    expect((await ask(admin, draft)).status).toBe(200)
    expect((await approve(admin, draft)).status).toBe(200)
    const drafter = (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(representative).first<{ email: string }>())!.email
    const toDrafter = emailOutbox.filter((e) => e.to === drafter)
    expect(toDrafter).toHaveLength(2)
    expect(emailOutbox.length).toBeGreaterThan(2)
    for (const mail of emailOutbox) {
      expect(mail.html).toContain(words)
      expect(mail.text).toContain(words)
      expect(mail.html + mail.text + mail.subject).not.toMatch(LONG_DASH)
    }
    expect(emailOutbox.find((e) => e.subject.startsWith('For LCA review'))?.subject).toBe(`For LCA review: ${(await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(draft).first<{ name: string }>())!.name} (${words})`)
  })

  it('draws an event name that holds markup or a line break as text, and its subject on one line', async () => {
    const { draft, representative } = await world({ name: '<b>Example</b> Open\nSecond line' })
    expect((await submit(representative, draft)).status).toBe(200)
    for (const mail of emailOutbox) {
      expect(mail.html).not.toContain('<b>Example</b>')
      expect(mail.html).toContain('&lt;b&gt;Example&lt;/b&gt;')
      expect(mail.subject).not.toMatch(/[\r\n]/)
    }
  })
})

describe('the public list', () => {
  const listed = async (id: string) => (await (await invoke(tournamentsGet, {})).json<{ tournaments: Array<{ id: string }> }>()).tournaments.some((t) => t.id === id)

  it('shows the event once an LCA admin has approved it and not before, and not after ask for changes', async () => {
    const { draft, representative, admin } = await world()
    expect(await listed(draft)).toBe(false)
    expect((await submit(representative, draft)).status).toBe(200)
    expect(await listed(draft)).toBe(false)
    expect((await ask(admin, draft)).status).toBe(200)
    expect(await listed(draft)).toBe(false)
    expect((await approve(admin, draft)).status).toBe(200)
    expect(await listed(draft)).toBe(true)
  })
})
