// test/integration/club-reports-edges.test.ts
//
// The edges of Suggest an update (WS09 step 28) that the other two files of
// its integration tests do not walk: the caps at their exact edge, the six
// fixed keys, what a request cannot choose, the words of the keeper's email
// as a mailbox gets them, the keeper's endpoint with the public door shut,
// a replayed press, and the age of an open suggestion across midnight and
// the two changes of the clock in America/Chicago, with a stamp that cannot
// be read and ties. Each case sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself
// through a getter on a mock of their module, and MAIL_LISTS_ON and
// MAIL_SENDER through getters on a mock of the mail switches, as the sibling
// files do; no case reads a shipped value of any switch. Every club, person
// and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import {
  SUGGESTION_CHOICES, SUGGESTION_FIELD_WORDS, SUGGESTION_LIMITS, ageWords, openSuggestionsWords,
} from '../../domain/clubs/suggestion'
import { wholeDaysSince } from '../../domain/clubs/regionCards'
import { REPLY_MESSAGE_LIMIT } from '../../domain/clubs/replyMessage'
import { onRequestPost as suggestPost } from '../../functions/api/clubs/[id]/reports'
import { ALREADY_HANDLED, onRequestPost as resolvePost } from '../../functions/api/admin/clubs/[id]/reports/[reportId]'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { REPLIES_AN_HOUR, REPLY_BUSY, REPLY_LIMIT_ROUTE } from '../../functions/api/clubs/reply/[token]'
import { ADDRESS_HEADER, limit } from '../../functions/utils/rateLimit'
import { seedMember } from './factories'
import { emailOutbox, expectContract, invoke, resetHarness } from './harness'

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

const KEYED = {
  SIGNING_SECRET: 'example-made-up-signing-key-for-suggestion-edges',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-edges',
}

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

beforeEach(() => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = false
  flags.listsOn = false
  flags.sender = 'resend'
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Made { id: string; slug: string; name: string; region: string; holder: string; rep: string; repEmail: string }

/** A club in a region of its own, with a rep of its own and one holder of the region's seat. */
async function makeClub(): Promise<Made> {
  const m = mark()
  const club = { id: `club-${m}`, slug: `example-knights-club-${m}`, name: `Example Knights Club ${m}`, region: `Example Region ${m}` }
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, 'Tuesdays at 7:00 PM')`,
  ).bind(club.id, club.name, club.slug, club.region).run()
  const holder = await seedMember({ fullName: `Example Rep ${m}`, email: `rep-${m}@example.org` })
  const seat = `seat-${m}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, club.region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, holder).run()
  const repEmail = `club-rep-${m}@example.org`
  const rep = await seedMember({ fullName: `Example Club Rep ${m}`, email: repEmail, role: 'club_rep', clubId: club.id })
  return { ...club, holder, rep, repEmail }
}

const suggest = (slug: string, body: unknown) =>
  invoke(suggestPost, {
    method: 'POST', params: { id: slug }, body, env: KEYED, path: `/api/clubs/${slug}/reports`, headers: { [ADDRESS_HEADER]: place() },
  })

const send = (over: Record<string, unknown> = {}) => {
  const m = mark()
  return { field: 'venue', message: `Player One ${m} says the club moved to the Example Library.`, email: `player-${m}@example.org`, token: 'example-made-up-token', ...over }
}

interface Row { id: number; field: string; message: string; reporter_email: string | null; status: string; region: string | null }
const rowsOf = async (clubId: string) =>
  (await env.DB.prepare('SELECT id, field, message, reporter_email, status, region FROM club_reports WHERE club_id = ? ORDER BY id').bind(clubId).all<Row>()).results

const resolve = (club: Made, reportId: number | string, body: unknown, as: string, aal: 'aal1' | 'aal2' = 'aal1') =>
  invoke(resolvePost, {
    method: 'POST', as, aal, params: { id: club.id, reportId: String(reportId) }, body, env: KEYED, path: `/api/admin/clubs/${club.id}/reports/${reportId}`,
    headers: { [ADDRESS_HEADER]: place() },
  })

const region = (as: string) => invoke(regionGet, { as, aal: 'aal1', path: '/api/workspace/region' })
const openItemsOf = async (as: string, clubId: string) =>
  (await (await region(as)).json<{ clubs: Array<{ id: string; openItems: Array<{ id: number; ageDays: number }> }> }>()).clubs.find((c) => c.id === clubId)?.openItems

/** The address of the words in a plain-language check: no long dash of either kind, in any part a mailbox gets. */
const NO_LONG_DASH = /[\u2013\u2014]/

describe('the caps, at their exact edge', () => {
  it('takes words of exactly 2,000 characters and refuses 2,001 beside the field, saving nothing for the refusal', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const edge = 'x'.repeat(SUGGESTION_LIMITS.message)
    expect((await suggest(club.slug, send({ message: edge }))).status).toBe(200)
    const over = await suggest(club.slug, send({ message: `${edge}x` }))
    expect(over.status).toBe(400)
    expect((await over.json<{ fields: Record<string, string> }>()).fields).toEqual({ message: SUGGESTION_FIELD_WORDS.messageLong })
    const rows = await rowsOf(club.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].message).toBe(edge)
  })

  it('takes an address of exactly 254 characters and refuses 255 beside the field', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const address = (tail: number) => `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(tail)}.org`
    expect(address(57)).toHaveLength(SUGGESTION_LIMITS.email)
    expect((await suggest(club.slug, send({ email: address(57) }))).status).toBe(200)
    const over = await suggest(club.slug, send({ email: address(58) }))
    expect(over.status).toBe(400)
    expect((await over.json<{ fields: Record<string, string> }>()).fields).toEqual({ email: SUGGESTION_FIELD_WORDS.emailLong })
    expect(await rowsOf(club.id)).toHaveLength(1)
  })

  it('trims the words, and keeps an address of only spaces as no address at all', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await suggest(club.slug, send({ message: '  Meets on Tuesdays now.  ', email: '   ' }))).status).toBe(200)
    const [row] = await rowsOf(club.id)
    expect(row.message).toBe('Meets on Tuesdays now.')
    expect(row.reporter_email).toBeNull()
    // The same for an address with spaces round it: stored plain.
    expect((await suggest(club.slug, send({ email: '  player-spaced@example.org ' }))).status).toBe(200)
    expect((await rowsOf(club.id))[1].reporter_email).toBe('player-spaced@example.org')
  })

  it('refuses an address that breaks a line, or names two people', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    for (const email of ['player@example.org\nBcc: other@example.org', 'one@example.org, two@example.org', 'player@example']) {
      const result = await suggest(club.slug, send({ email }))
      expect(result.status, email).toBe(400)
      expect((await result.json<{ fields: Record<string, string> }>()).fields).toEqual({ email: SUGGESTION_FIELD_WORDS.emailForm })
    }
    expect(await rowsOf(club.id)).toEqual([])
  })
})

describe('the six choices are stored as fixed keys', () => {
  it('stores each choice by its short key, never by the words of its label, and refuses a label sent as the key', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    for (const choice of SUGGESTION_CHOICES) expect((await suggest(club.slug, send({ field: choice.key }))).status, choice.key).toBe(200)
    const rows = await rowsOf(club.id)
    expect(rows.map((r) => r.field)).toEqual(['meets', 'venue', 'cost', 'contact', 'closed', 'other'])
    for (const choice of SUGGESTION_CHOICES) {
      const result = await suggest(club.slug, send({ field: choice.label }))
      expect(result.status, choice.label).toBe(400)
      expect((await result.json<{ fields: Record<string, string> }>()).fields).toEqual({ field: SUGGESTION_FIELD_WORDS.fieldMissing })
    }
    expect(await rowsOf(club.id)).toHaveLength(6)
  })

  it('records the club\'s region as it is at that moment, and a later change of the club does not rewrite the row', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await suggest(club.slug, send())).status).toBe(200)
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind('Example Region Elsewhere', club.id).run()
    expect((await rowsOf(club.id))[0].region).toBe(club.region)
  })

  it('goes by the club\'s id as well as by its slug', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await suggest(club.id, send())).status).toBe(200)
    expect((await suggest(club.slug, send())).status).toBe(200)
    expect(await rowsOf(club.id)).toHaveLength(2)
  })
})

describe('what a request cannot choose', () => {
  it('drops a recipient, a copy, a subject, a reply-to or a link in the body: the email goes to the keeper alone, with fixed subject and link', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const result = await suggest(club.slug, send({
      to: 'stranger@example.org', cc: 'stranger@example.org', bcc: 'stranger@example.org', subject: 'Chosen by the visitor',
      replyTo: 'stranger@example.org', link: 'https://example.org/elsewhere', kind: 'new_club', status: 'applied', region: 'Example Region Chosen', clubId: 'club-other',
    }))
    expect(result.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.repEmail])
    const [mail] = emailOutbox
    expect(mail.subject).toBe(`A suggestion for ${club.name}'s listing on the LCA website`)
    const everything = `${mail.subject}${mail.html}${mail.text}${JSON.stringify(mail.headers ?? {})}${mail.from}`
    expect(everything).not.toContain('stranger@example.org')
    expect(everything).not.toContain('example.org/elsewhere')
    expect(everything).not.toContain('Chosen by the visitor')
    const [row] = await rowsOf(club.id)
    expect(row).toMatchObject({ status: 'open', region: club.region })
    const kind = await env.DB.prepare('SELECT kind, club_id, region FROM club_reports WHERE id = ?').bind(row.id).first<{ kind: string; club_id: string; region: string }>()
    expect(kind).toEqual({ kind: 'suggestion', club_id: club.id, region: club.region })
  })

  it('does not mail the address the visitor typed even when it is a keeper\'s own, and goes on to the next keeper', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const holderEmail = (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(club.holder).first<{ email: string }>())!.email
    expect((await suggest(club.slug, send({ email: club.repEmail.toUpperCase() }))).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([holderEmail])
    expect(emailOutbox[0].text).not.toContain('has no representative')
    // Saved all the same, so it shows in My region.
    expect(await rowsOf(club.id)).toHaveLength(1)
    flags.keepersOn = true
    expect((await openItemsOf(club.holder, club.id))).toHaveLength(1)
  })
})

describe('the keeper\'s email, as a mailbox gets it', () => {
  it('escapes the visitor\'s words in the HTML part, writes them as typed in the plain part, and keeps them out of the subject', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const words = 'Meets at <b>7:00 PM</b> now & "quoted" <script>alert(1)</script>'
    expect((await suggest(club.slug, send({ message: words, email: undefined }))).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.text).toContain(words)
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<b>7:00 PM</b>')
    expect(mail.html).toContain('&lt;b&gt;7:00 PM&lt;/b&gt;')
    expect(mail.html).toContain('&amp;')
    expect(mail.subject).not.toContain('7:00 PM')
  })

  it('has no long dash, no US Chess misnamed and no number written with a point-five, and ends on the line about replies', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await suggest(club.slug, send({ field: 'cost' }))).status).toBe(200)
    const [mail] = emailOutbox
    const plain = mail.text ?? ''
    expect(plain).not.toMatch(NO_LONG_DASH)
    expect(plain).not.toContain('US' + 'CF')
    expect(plain).not.toMatch(/\d\.5\b/)
    expect(plain.trimEnd().split('\n').at(-1)).toBe('A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.')
    expect(plain).toContain('What changed: Cost or who it\'s for')
    // The link is the site's own host, never one from the request.
    const link = plain.split('\n').find((line) => line.startsWith('Open the suggestion: '))!
    expect(link).toMatch(/^Open the suggestion: https:\/\/www\.louisianachess\.org\/my\/club\/example-knights-club-/)
  })

  it('sends one email to each keeper of a kind, and the visitor\'s address is in none of its headers', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const words = send()
    expect((await suggest(club.slug, words)).status).toBe(200)
    expect(emailOutbox).toHaveLength(1)
    for (const mail of emailOutbox) {
      expect(JSON.stringify(mail.headers ?? {})).not.toContain(words.email)
      expect(mail.from).not.toContain(words.email)
      expect(mail.to).not.toContain(words.email)
    }
  })
})

describe('the keeper\'s endpoint with the public door shut', () => {
  it('answers a keeper of the club while CLUB_PAGES_ON is unset and CLUB_KEEPERS_ON is set, and the public door stays closed', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await suggest(club.slug, send())).status).toBe(200)
    const [row] = await rowsOf(club.id)
    flags.pagesOn = false
    flags.keepersOn = true
    const closed = await suggest(club.slug, send())
    expect(closed.status).toBe(403)
    expect(await rowsOf(club.id)).toHaveLength(1)
    const result = await resolve(club, row.id, { action: 'dismiss' }, club.rep)
    expect(result.status).toBe(200)
    expect(await expectContract(result, contracts['admin/clubs/[id]/reports/[reportId]'].POST.response)).toEqual({ id: row.id, status: 'dismissed' })
  })

  it('refuses an action it does not know, and the keeper\'s words past their cap, in words, changing nothing', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    expect((await suggest(club.slug, send())).status).toBe(200)
    const [row] = await rowsOf(club.id)
    for (const body of [{ action: 'delete' }, {}, { action: 'answer', message: 'y'.repeat(REPLY_MESSAGE_LIMIT + 1) }, { action: 'answer' }]) {
      const result = await resolve(club, row.id, body, club.rep)
      expect(result.status, JSON.stringify(body).slice(0, 40)).toBe(400)
      expect(typeof (await result.json<{ error: string }>()).error).toBe('string')
    }
    expect((await rowsOf(club.id))[0]).toMatchObject({ status: 'open' })
    expect((await rowsOf(club.id))[0].reporter_email).not.toBeNull()
  })

  it('a replayed answer is told it was already handled, sends no second email and writes no second audit entry', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    const words = send()
    expect((await suggest(club.slug, words)).status).toBe(200)
    const [row] = await rowsOf(club.id)
    emailOutbox.length = 0
    const first = await resolve(club, row.id, { action: 'answer', message: 'Example reply from the club.' }, club.rep)
    expect(first.status).toBe(200)
    const replay = await resolve(club, row.id, { action: 'answer', message: 'Example reply from the club.' }, club.rep)
    expect(replay.status).toBe(409)
    expect(await replay.json()).toEqual({ error: ALREADY_HANDLED })
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email])
    const audits = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_suggestion_resolved' AND target_label = ?`).bind(club.name).first<{ n: number }>()
    expect(audits!.n).toBe(1)
  })

  it('counts a reply with Reply through LCA\'s own ten an hour, after the press holds the row, and puts the row back when over', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    const words = send()
    expect((await suggest(club.slug, words)).status).toBe(200)
    expect((await suggest(club.slug, send())).status).toBe(200)
    const [row, other] = await rowsOf(club.id)
    // Two presses at once on one row: one is sent, the other is told it was already handled and uses none of the count.
    const raced = await Promise.all([1, 2].map(() => resolve(club, other.id, { action: 'answer', message: 'Example reply.' }, club.rep)))
    expect(raced.map((r) => r.status).sort()).toEqual([200, 409])
    // Eight replies through Reply through LCA by the same person make nine; the tenth is this door's, the eleventh is refused.
    const asReply = new Request('https://example.org/api/clubs/reply/example')
    for (let i = 0; i < REPLIES_AN_HOUR - 2; i++) {
      expect((await limit({ ...env, ...KEYED }, asReply, REPLY_LIMIT_ROUTE, { perHour: REPLIES_AN_HOUR, key: club.rep })).ok).toBe(true)
    }
    emailOutbox.length = 0
    expect((await resolve(club, row.id, { action: 'answer', message: 'Example reply from the club.' }, club.rep)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email])
    expect((await limit({ ...env, ...KEYED }, asReply, REPLY_LIMIT_ROUTE, { perHour: REPLIES_AN_HOUR, key: club.rep })).ok).toBe(false)
    // A third suggestion: its answer is refused in step 27's words, sends nothing and leaves the row open with its address.
    const third = send()
    expect((await suggest(club.slug, third)).status).toBe(200)
    const open = (await rowsOf(club.id)).find((r) => r.status === 'open')!
    emailOutbox.length = 0
    const busy = await resolve(club, open.id, { action: 'answer', message: 'Example reply from the club.' }, club.rep)
    expect(busy.status).toBe(429)
    expect(await busy.json()).toEqual({ error: REPLY_BUSY })
    expect(emailOutbox).toEqual([])
    expect((await rowsOf(club.id)).find((r) => r.id === open.id)).toMatchObject({ status: 'open', reporter_email: third.email })
    // Another keeper is counted apart.
    expect((await resolve(club, open.id, { action: 'answer', message: 'Example reply from the region.' }, club.holder)).status).toBe(200)
  })

  it('puts the row back, open with its address, when the count itself fails once the press holds the row, and writes no audit entry', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    const words = send()
    expect((await suggest(club.slug, words)).status).toBe(200)
    const [row] = await rowsOf(club.id)
    emailOutbox.length = 0
    // A made-up fault of the database at the one moment the limiter counts: every insert into its table is refused.
    await env.DB.prepare(
      "CREATE TRIGGER example_count_fault BEFORE INSERT ON rate_limits BEGIN SELECT RAISE(ABORT, 'example fault of the count'); END",
    ).run()
    try {
      await expect(resolve(club, row.id, { action: 'answer', message: 'Example reply from the club.' }, club.rep)).rejects.toThrow(/example fault of the count/)
    } finally {
      await env.DB.prepare('DROP TRIGGER example_count_fault').run()
    }
    expect(emailOutbox).toEqual([])
    expect((await rowsOf(club.id))[0]).toMatchObject({ id: row.id, status: 'open', reporter_email: words.email })
    const stamps = await env.DB.prepare('SELECT resolved_by, resolved_at FROM club_reports WHERE id = ?').bind(row.id)
      .first<{ resolved_by: string | null; resolved_at: string | null }>()
    expect(stamps).toEqual({ resolved_by: null, resolved_at: null })
    const audits = () => env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_suggestion_resolved' AND target_label = ?`).bind(club.name).first<{ n: number }>()
    expect((await audits())!.n).toBe(0)
    // With the fault gone the same keeper answers it.
    expect((await resolve(club, row.id, { action: 'answer', message: 'Example reply from the club.' }, club.rep)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email])
    expect((await audits())!.n).toBe(1)
  })

  it('escapes the keeper\'s reply in the HTML part, keeps the reply free of the keeper\'s address, and has no long dash', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    const words = send()
    expect((await suggest(club.slug, words)).status).toBe(200)
    const [row] = await rowsOf(club.id)
    emailOutbox.length = 0
    const reply = 'We meet at <i>7:00 PM</i> & the venue is the Example Library.'
    expect((await resolve(club, row.id, { action: 'answer', message: reply }, club.rep)).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.to).toBe(words.email)
    expect(mail.text).toContain(reply)
    expect(mail.html).not.toContain('<i>7:00 PM</i>')
    expect(mail.html).toContain('&lt;i&gt;7:00 PM&lt;/i&gt;')
    expect(`${mail.subject}${mail.html}${mail.text}`).not.toMatch(NO_LONG_DASH)
    expect(`${mail.subject}${mail.html}${mail.text}${mail.from}`).not.toContain(club.repEmail)
  })
})

describe('who sees the open items', () => {
  it('another region\'s representative is not shown this club\'s suggestions, and a signed-out caller gets 401 with none', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    const other = await makeClub()
    expect((await suggest(club.slug, send())).status).toBe(200)
    expect(await openItemsOf(other.holder, club.id)).toBeUndefined()
    expect((await openItemsOf(other.holder, other.id))).toEqual([])
    expect((await openItemsOf(club.holder, club.id))).toHaveLength(1)
    const signedOut = await invoke(regionGet, { path: '/api/workspace/region' })
    expect(signedOut.status).toBe(401)
    expect(JSON.stringify(await signedOut.json())).not.toContain('suggestion')
  })

  it('leaves out a resolved suggestion, a suggestion of another club and a row of another kind', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub()
    const other = await makeClub()
    expect((await suggest(club.slug, send())).status).toBe(200)
    expect((await suggest(other.slug, send())).status).toBe(200)
    await env.DB.prepare(`INSERT INTO club_reports (club_id, kind, message, region) VALUES (NULL, 'new_club', 'Example new club.', ?)`).bind(club.region).run()
    await env.DB.prepare(`INSERT INTO club_reports (club_id, kind, field, message, status) VALUES (?, 'suggestion', 'meets', 'Example old one.', 'dismissed')`).bind(club.id).run()
    const items = await openItemsOf(club.holder, club.id)
    expect(items).toHaveLength(1)
  })
})

describe('the age of an open suggestion, by whole days of 24 hours', () => {
  /** An open suggestion stored with the stamp, and the days My region reads with the clock at `now`. */
  async function ageAt(created: string, now: string): Promise<number> {
    flags.keepersOn = true
    const club = await makeClub()
    await env.DB.prepare(`INSERT INTO club_reports (club_id, kind, field, message, region, created_at) VALUES (?, 'suggestion', 'meets', 'Example words.', ?, ?)`)
      .bind(club.id, club.region, created).run()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
    try {
      const items = await openItemsOf(club.holder, club.id)
      expect(items).toHaveLength(1)
      return items![0].ageDays
    } finally {
      vi.useRealTimers()
    }
  }

  it('does not turn over at midnight in Chicago: 11:59 PM on Monday, November 23, 2026 is still today at 12:01 AM on Tuesday', async () => {
    // 11:59 PM CST is 05:59 UTC, and 12:01 AM CST is 06:01 UTC.
    expect(await ageAt('2026-11-24 05:59:00', '2026-11-24T06:01:00Z')).toBe(0)
    expect(await ageAt('2026-11-24 05:59:00', '2026-11-25T05:58:59Z')).toBe(0)
    expect(await ageAt('2026-11-24 05:59:00', '2026-11-25T05:59:00Z')).toBe(1)
  })

  it('counts 24-hour days across the fall change of the clock, Sunday, November 1, 2026', async () => {
    // Saturday, October 31 at 2:00 PM CDT is 19:00 UTC; the clocks go back at 7:00 UTC on Sunday.
    expect(await ageAt('2026-10-31 19:00:00', '2026-11-01T18:59:00Z')).toBe(0)
    expect(await ageAt('2026-10-31 19:00:00', '2026-11-01T19:00:00Z')).toBe(1)
    expect(await ageAt('2026-10-31 19:00:00', '2026-11-02T18:59:00Z')).toBe(1)
    expect(await ageAt('2026-10-31 19:00:00', '2026-11-02T19:00:00Z')).toBe(2)
  })

  it('counts 24-hour days across the spring change of the clock, Sunday, March 8, 2026', async () => {
    // Saturday, March 7 at 2:00 PM CST is 20:00 UTC; the clocks go forward at 8:00 UTC on Sunday.
    expect(await ageAt('2026-03-07 20:00:00', '2026-03-08T19:59:00Z')).toBe(0)
    expect(await ageAt('2026-03-07 20:00:00', '2026-03-08T20:00:00Z')).toBe(1)
  })

  it('reads a stamp in the future, or one that cannot be read, as 0 days, and an old one in whole days', async () => {
    expect(await ageAt('2026-12-30 12:00:00', '2026-11-25T12:00:00Z')).toBe(0)
    expect(await ageAt('not a stamp', '2026-11-25T12:00:00Z')).toBe(0)
    expect(await ageAt('2026-02-25 12:00:00', '2026-11-25T12:00:00Z')).toBe(273)
  })

  it('keeps ties in the order they came: the oldest first, and the lower id first when the stamps are the same', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const insert = (stamp: string, words: string) =>
      env.DB.prepare(`INSERT INTO club_reports (club_id, kind, field, message, region, created_at) VALUES (?, 'suggestion', 'meets', ?, ?, ?) RETURNING id`)
        .bind(club.id, words, club.region, stamp).first<{ id: number }>()
    const tieA = await insert('2026-11-20 12:00:00', 'Example tie A.')
    const tieB = await insert('2026-11-20 12:00:00', 'Example tie B.')
    const oldest = await insert('2026-11-10 12:00:00', 'Example oldest.')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'))
    const items = await openItemsOf(club.holder, club.id)
    expect(items!.map((i) => [i.id, i.ageDays])).toEqual([[oldest!.id, 15], [tieA!.id, 5], [tieB!.id, 5]])
  })
})

describe('the words of an age, and of a card\'s line', () => {
  it('says less than a day ago, 1 day ago and days ago, and the card\'s line by the count and the oldest', () => {
    expect(ageWords(0)).toBe('less than a day ago')
    expect(ageWords(-3)).toBe('less than a day ago')
    expect(ageWords(1)).toBe('1 day ago')
    expect(ageWords(9)).toBe('9 days ago')
    expect(openSuggestionsWords(1, 9)).toBe('1 suggestion · 9 days')
    expect(openSuggestionsWords(2, 1)).toBe('2 suggestions · 1 day')
    expect(openSuggestionsWords(3, 0)).toBe('3 suggestions · less than a day')
    expect(wholeDaysSince(null, Date.now())).toBe(0)
    expect(wholeDaysSince(undefined, Date.now())).toBe(0)
  })
})
