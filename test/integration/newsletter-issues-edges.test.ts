// test/integration/newsletter-issues-edges.test.ts
//
// The edges of the newsletter's own page (WS16 part two, page step 3), through
// the real handlers, the real guard and the real cleaner, on the D1 database
// every integration test builds from the migrations. It sits beside
// newsletter-issues.test.ts and adds what that file does not hold:
// - (a) a body or a source with keys beside the ones the contracts name is
//   read for those and no other: nothing a page sends moves a column it does
//   not own, a mark of a test among them;
// - (b) replays and stale reads: the same save twice, the same start twice, a
//   page that read a letter another person has since started over, a start
//   refused without setting the open letter aside, two starts at once, a
//   start whose letter is sent between its read and its write, many saves of
//   one version at once, and a 404, never an unhandled error, were a write's
//   own read ever to find no open letter;
// - (c) a letter made by hand to get live markup into the table: what is
//   stored holds only the cleaner's own tags, and what the cleaner refuses is
//   refused with nothing written; and a "<" kept as a word is never read as a
//   tag, by the cleaner or by the rule that finds a starter nobody wrote in;
// - (d) who is named when the person is gone, and the times as stored, across
//   midnight and the two Central time changes of a year, in order and
//   unmoved, with ties in a fixed order;
// - (e) each kind of person against a letter that holds words: nothing of it
//   is read and nothing of it is changed;
// - (f) the plain-language rules over the words of every refusal the methods
//   give.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newsletterIssueRefusedSchema, REQUEST_ID_MAX } from '../../domain/contracts/newsletter'
import { defaultSubject, LETTER_MAX_BYTES, STARTER_IDS } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as issueGet, onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../functions/api/admin/mail/newsletter/issues'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import {
  CHANGED_SINCE_READ,
  CHANGED_WHILE_STARTING,
  LETTER_INPUT_MAX_BYTES,
  SENT_SINCE_READ,
  SENT_WHILE_STARTING,
  SET_ASIDE_SINCE_READ,
  SOURCE_NOT_CLEAN,
  SOURCE_STARTS_SMALL,
  SOURCE_TOO_LONG,
  starterLetter,
} from '../../functions/utils/mail/issues'
import { cleanLetterHtml } from '../../functions/utils/mail/letterClean'
import { seedAdmin, seedMember, seedSeat } from './factories'
import { emailOutbox, expectContract, invoke, resetHarness, type InvokeOptions } from './harness'

const flags = vi.hoisted(() => ({ pageOn: true, listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_PAGE_ON() {
      return flags.pageOn
    },
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

type Row = Record<string, unknown>

/** The name US Chess no longer goes by, written in two pieces so this file never holds it whole. */
const OLD_NAME = new RegExp(`${'US'}${'CF'}`, 'i')

const MONTH = 'December 2026'
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'
const OTHER_LIST = 'lca-tournaments'

const saveBody = (over: Partial<{ id: string | null; version: number; monthLabel: string; subject: string; preheader: string; bodyHtml: string }> & Row = {}) => ({
  id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: LETTER, ...over,
})
const save = (as: string | undefined, over: Parameters<typeof saveBody>[0] = {}, opts: InvokeOptions = {}) =>
  invoke(issuePut, { method: 'PUT', as, body: saveBody(over), ...opts })
const start = (as: string | undefined, from: unknown, monthLabel: string = MONTH, extra: Row = {}, opts: InvokeOptions = {}) =>
  invoke(startPost, { method: 'POST', as, body: { from, monthLabel, ...extra }, ...opts })

const rows = async () => (await env.DB.prepare('SELECT * FROM newsletter_issues ORDER BY rowid').all<Row>()).results
const rowOf = async (id: string) => (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(id).first<Row>())!
const openRows = async () => (await rows()).filter((r) => r.campaign_id === null && r.set_aside_at === null)

async function seedSend(opts: { id: string; listId?: string | null; body?: string; by?: string | null; at?: string; status?: string; total?: number; subject?: string }) {
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, created_at, list_id)
     VALUES (?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)`,
  ).bind(
    opts.id, opts.subject ?? 'Sample newsletter one', opts.body ?? '<p>Sample words sent from the plain tab.</p>', opts.total ?? 3, opts.total ?? 3,
    opts.status ?? 'completed', opts.by ?? null, opts.at ?? '2026-11-02 15:00:00', opts.listId === undefined ? NEWSLETTER_LIST_ID : opts.listId,
  ).run()
}

async function seedLetter(opts: { id: string; listId?: string; body?: string; by?: string | null; month?: string; subject?: string; campaignId?: string | null; setAsideAt?: string | null; updatedAt?: string; version?: number }) {
  await env.DB.prepare(
    `INSERT INTO newsletter_issues (id, list_id, month_label, subject, body_html, version, created_by, updated_by, updated_at, campaign_id, set_aside_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    opts.id, opts.listId ?? NEWSLETTER_LIST_ID, opts.month ?? 'November 2026', opts.subject ?? 'Sample subject one', opts.body ?? LETTER, opts.version ?? 1,
    opts.by ?? null, opts.by ?? null, opts.updatedAt ?? '2026-11-01 15:00:00', opts.campaignId ?? null, opts.setAsideAt ?? null,
  ).run()
}

const counts = async () => {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
    members: await count('SELECT COUNT(*) AS n FROM members'),
    sent: emailOutbox.length,
  }
}

/**
 * A database that runs `hook` after each read of the open letter by a start and before that read answers, so that what
 * the hook does lands between the start's read and its write.
 */
function heldReadDb(hook: () => Promise<unknown>) {
  const real = new WeakMap<object, D1PreparedStatement>()
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const wrapped = {
      bind: (...values: unknown[]) => wrap(statement.bind(...values), sql),
      first: async (column?: string) => {
        const answer = column === undefined ? await statement.first() : await statement.first(column)
        if (/FROM newsletter_issues i LEFT JOIN members m/.test(sql)) await hook()
        return answer
      },
      run: () => statement.run(),
      all: () => statement.all(),
      raw: (options?: { columnNames?: boolean }) => statement.raw(options as { columnNames: true }),
    }
    real.set(wrapped, statement)
    return wrapped as unknown as D1PreparedStatement
  }
  return {
    prepare: (sql: string) => wrap(env.DB.prepare(sql), sql),
    batch: (statements: D1PreparedStatement[]) => env.DB.batch(statements.map((s) => real.get(s) ?? s)),
    exec: (sql: string) => env.DB.exec(sql),
    dump: () => env.DB.dump(),
  } as unknown as D1Database
}

/**
 * A database that holds each start's read of the open letter until `parties` of them have made it, so that all of them
 * read the letter as it stood before any of them wrote: a real race, which two requests sent together do not always make.
 */
function meetingDb(parties: number) {
  let arrived = 0
  let release: () => void = () => {}
  const together = new Promise<void>((resolve) => { release = resolve })
  return heldReadDb(async () => {
    arrived += 1
    if (arrived >= parties) release()
    await together
  })
}

/** A database on which `between`, run once, lands after a start has read the open letter and before it writes. */
function betweenDb(between: () => Promise<unknown>) {
  let landed = false
  return heldReadDb(async () => {
    if (landed) return
    landed = true
    await between()
  })
}

/** A send's mark on a letter, as page step 6's send will write it: the letter is no longer the open one. */
const markSent = (issueId: string, campaignId: string) => () =>
  env.DB.prepare('UPDATE newsletter_issues SET campaign_id = ?2 WHERE id = ?1').bind(issueId, campaignId).run()

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) keys beside the contract\'s own are read for nothing', () => {
  const REACH: Row = {
    testedAt: '2026-11-13 12:00:00', tested_at: '2026-11-13 12:00:00', tested: true,
    campaignId: 'campaign-sample-one', campaign_id: 'campaign-sample-one', setAsideAt: '2026-11-13 12:00:00', set_aside_at: '2026-11-13 12:00:00',
    listId: OTHER_LIST, list_id: OTHER_LIST, createdBy: 'member-nobody', created_by: 'member-nobody', updatedBy: 'member-nobody', updated_by: 'member-nobody',
    sendAt: '2026-12-01 15:00:00', send_at: '2026-12-01 15:00:00', scheduledBy: 'member-nobody', scheduled_at: '2026-12-01 15:00:00',
    linkCheck: 'ok', heldReason: 'x', pinnedAt: '2026-11-13 12:00:00', pinnedName: 'Member One', createdAt: '2000-01-01 00:00:00', updatedAt: '2000-01-01 00:00:00',
  }

  it('moves no column the save does not own, on the first save and on a later one', async () => {
    const admin = await seedAdmin()
    const first = await save(admin, { ...REACH })
    expect(first.status).toBe(200)
    const { id } = await first.json<{ id: string }>()
    const stored = await rowOf(id)
    expect(stored).toMatchObject({
      list_id: NEWSLETTER_LIST_ID, created_by: admin, updated_by: admin, version: 1, campaign_id: null, set_aside_at: null,
      send_at: null, scheduled_by: null, scheduled_at: null, link_check: null, held_reason: null, pinned_at: null, pinned_name: null,
    })
    expect(stored.created_at).not.toBe('2000-01-01 00:00:00')
    const later = await save(admin, { id, version: 1, bodyHtml: `${LETTER}<p>More sample words.</p>`, ...REACH })
    expect(later.status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ list_id: NEWSLETTER_LIST_ID, version: 2, campaign_id: null, set_aside_at: null, send_at: null, link_check: null, pinned_name: null, created_by: admin })
    expect(await rows()).toHaveLength(1)
    expect(JSON.stringify(await rows())).not.toContain('campaign-sample-one')
  })

  it('puts the letter on the newsletter whatever list a start names, and takes a past letter by its own id alone', async () => {
    const admin = await seedAdmin()
    await seedLetter({ id: 'issue-other-list', listId: OTHER_LIST, setAsideAt: '2026-11-03 15:00:00' })
    const res = await start(admin, 'blank', MONTH, { listId: OTHER_LIST, list_id: OTHER_LIST, testedAt: '2026-11-13 12:00:00' })
    expect(res.status).toBe(201)
    const made = (await openRows())[0]
    expect(made).toMatchObject({ list_id: NEWSLETTER_LIST_ID, created_by: admin, version: 1 })
    expect(made.send_at ?? null).toBeNull()
    // A source that names a list beside its id is still the id's own: the other list's letter is not found.
    const hunt = await start(admin, { issueId: 'issue-other-list', listId: OTHER_LIST })
    expect(hunt.status).toBe(404)
    expect((await rowOf('issue-other-list')).set_aside_at).toBe('2026-11-03 15:00:00')
  })
})

describe('(b) replays, stale reads and races', () => {
  it('answers the same save sent twice with the second one refused as an old version, naming the sender themselves, and moves the version once', async () => {
    const admin = await seedAdmin()
    const first = await (await save(admin)).json<{ id: string }>()
    const body = { id: first.id, version: 1, bodyHtml: `${LETTER}<p>Replayed sample words.</p>` }
    expect((await save(admin, body)).status).toBe(200)
    const stored = await rowOf(first.id)
    const replay = await save(admin, body)
    expect(replay.status).toBe(409)
    expect(await replay.json()).toMatchObject({ error: CHANGED_SINCE_READ, reason: 'changed', changedAt: stored.updated_at })
    expect(await rowOf(first.id)).toEqual(stored)
    expect(stored.version).toBe(2)
  })

  it('answers a first save sent twice as one letter and a refusal, never two letters', async () => {
    const admin = await seedAdmin()
    expect((await save(admin)).status).toBe(200)
    const replay = await save(admin)
    expect(replay.status).toBe(409)
    expect(await rows()).toHaveLength(1)
  })

  it('answers a first save, from a page that read no letter, with the open letter\'s writer when a letter is already open', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const other = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(writer, { bodyHtml: `${LETTER}<p>Player One's sample words.</p>` })).json<{ id: string }>()
    const res = await save(other, { bodyHtml: `${LETTER}<p>Player Two's sample words.</p>` })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ reason: 'changed', changedBy: 'Player One' })
    expect((await rowOf(made.id)).body_html).toContain("Player One's")
    expect(JSON.stringify(await rows())).not.toContain("Player Two's")
  })

  it('refuses a page that read an empty letter another person then started over in place, and loses nothing of the new words', async () => {
    const reader = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const starter = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const empty = await (await start(reader, 'blank')).json<{ issue: { id: string; version: number } }>()
    const started = await start(starter, 'monthly', 'January 2027')
    expect(started.status).toBe(201)
    const stored = await rowOf(empty.issue.id)
    expect(stored.version).toBe(empty.issue.version + 1)
    const stale = await save(reader, { id: empty.issue.id, version: empty.issue.version, bodyHtml: '<p>Player One\'s stale words.</p>' })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ reason: 'changed', changedBy: 'Player Two', changedAt: stored.updated_at })
    expect(await rowOf(empty.issue.id)).toEqual(stored)
    expect(await rows()).toHaveLength(1)
  })

  it('keeps one open letter when the same start is sent twice: the starter nobody wrote in is reused in place, its version moved, nothing set aside', async () => {
    const admin = await seedAdmin()
    const first = await (await start(admin, 'monthly', 'January 2027')).json<{ issue: { id: string; version: number } }>()
    const second = await start(admin, 'monthly', 'January 2027')
    expect(second.status).toBe(201)
    const second_ = await second.json<{ issue: { id: string; version: number } }>()
    expect(second_.issue).toMatchObject({ id: first.issue.id, version: first.issue.version + 1 })
    expect(await rows()).toHaveLength(1)
    expect((await openRows()).map((r) => r.id)).toEqual([first.issue.id])
    expect((await rowOf(first.issue.id)).set_aside_at).toBeNull()
  })

  it('starts from the open letter\'s own words when it is named as the source: the open one is set aside and the new one holds a copy', async () => {
    const admin = await seedAdmin()
    const made = await (await save(admin, { bodyHtml: `${LETTER}<p>Sample words to copy.</p>` })).json<{ id: string }>()
    const res = await start(admin, { issueId: made.id }, 'January 2027')
    expect(res.status).toBe(201)
    const copy = await res.json<{ issue: { id: string; bodyHtml: string; monthLabel: string } }>()
    expect(copy.issue.id).not.toBe(made.id)
    expect(copy.issue.bodyHtml).toBe(`${LETTER}<p>Sample words to copy.</p>`)
    expect(copy.issue.monthLabel).toBe('January 2027')
    expect((await rowOf(made.id)).set_aside_at).not.toBeNull()
    expect((await rowOf(made.id)).body_html).toBe(`${LETTER}<p>Sample words to copy.</p>`)
  })

  it('starts from a letter that was sent, leaving it and its send as they were', async () => {
    const admin = await seedAdmin()
    await seedSend({ id: 'campaign-sample-one', by: admin })
    await seedLetter({ id: 'issue-sent', campaignId: 'campaign-sample-one', body: '<h2>Sample sent heading</h2><p>Sample sent words.</p>', by: admin })
    const before = await rowOf('issue-sent')
    const res = await start(admin, { issueId: 'issue-sent' })
    expect(res.status).toBe(201)
    expect((await res.json<{ issue: { bodyHtml: string } }>()).issue.bodyHtml).toBe('<h2>Sample sent heading</h2><p>Sample sent words.</p>')
    expect(await rowOf('issue-sent')).toEqual(before)
    expect(await openRows()).toHaveLength(1)
  })

  it('refuses a source the cleaner will not keep, one too long and one starting small, without setting the open letter aside', async () => {
    const admin = await seedAdmin()
    const made = await (await save(admin, { bodyHtml: `${LETTER}<p>Sample words that must stay open.</p>` })).json<{ id: string }>()
    await seedLetter({ id: 'issue-unclean', body: '<p>Sample</p><textarea>', setAsideAt: '2026-11-03 15:00:00' })
    await seedLetter({ id: 'issue-small', body: '<h3>Sample smaller heading</h3><p>x</p>', setAsideAt: '2026-11-03 15:00:00' })
    await seedLetter({ id: 'issue-long', body: `<p>${'a'.repeat(LETTER_INPUT_MAX_BYTES + 1)}</p>`, setAsideAt: '2026-11-03 15:00:00' })
    await seedSend({ id: 'campaign-long', body: `<p>${'é'.repeat(LETTER_INPUT_MAX_BYTES / 2)}</p>` })
    const before = await rows()
    for (const [from, status, words] of [
      [{ issueId: 'issue-unclean' }, 400, SOURCE_NOT_CLEAN],
      [{ issueId: 'issue-small' }, 400, SOURCE_STARTS_SMALL],
      [{ issueId: 'issue-long' }, 413, SOURCE_TOO_LONG],
      [{ campaignId: 'campaign-long' }, 413, SOURCE_TOO_LONG],
    ] as const) {
      const res = await start(admin, from)
      expect(res.status, JSON.stringify(from)).toBe(status)
      expect(await res.json(), JSON.stringify(from)).toEqual({ error: words })
    }
    expect(await rows()).toEqual(before)
    expect((await rowOf(made.id)).set_aside_at).toBeNull()
  })

  it('refuses a start whose cleaned source is over the cap, writing nothing', async () => {
    const admin = await seedAdmin()
    // A letter of open list items stays under the input bound and grows past the cap once the cleaner closes each.
    await seedLetter({ id: 'issue-grows', body: `<ul>${'<li>'.repeat(10)}</ul>`.repeat(1_000), setAsideAt: '2026-11-03 15:00:00' })
    const cleaned = await cleanLetterHtml(`<ul>${'<li>'.repeat(10)}</ul>`.repeat(1_000))
    expect(new TextEncoder().encode(cleaned!).byteLength).toBeGreaterThan(LETTER_MAX_BYTES)
    const before = await rows()
    const res = await start(admin, { issueId: 'issue-grows' })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: SOURCE_TOO_LONG })
    expect(await rows()).toEqual(before)
  })

  it('makes one letter from two starts that both read an empty list, and refuses the other with the winner\'s name', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    for (let round = 0; round < 4; round += 1) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const db = meetingDb(2)
      const [a, b] = await Promise.all([start(one, 'monthly', 'January 2027', {}, { env: { DB: db } }), start(two, 'results-and-thanks', 'February 2027', {}, { env: { DB: db } })])
      expect([a.status, b.status].sort(), `round ${round}`).toEqual([201, 409])
      const lost = a.status === 409 ? a : b
      const body = await lost.json<{ error: string; reason: string; changedBy: string | null }>()
      expect(body.error).toBe(CHANGED_WHILE_STARTING)
      expect(body.reason).toBe('changed')
      expect(['Player One', 'Player Two']).toContain(body.changedBy)
      expect(await rows(), `round ${round}`).toHaveLength(1)
    }
  })

  it('sets the open letter aside once when two starts both read it: the words are kept once, one new letter is open, the other start is refused', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    for (let round = 0; round < 4; round += 1) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const words = `${LETTER}<p>Sample words of round ${round}.</p>`
      const made = await (await save(one, { bodyHtml: words })).json<{ id: string }>()
      const db = meetingDb(2)
      const [a, b] = await Promise.all([start(one, 'monthly', MONTH, {}, { env: { DB: db } }), start(two, 'blank', MONTH, {}, { env: { DB: db } })])
      expect([a.status, b.status].sort(), `round ${round}`).toEqual([201, 409])
      const all = await rows()
      expect(all, `round ${round}`).toHaveLength(2)
      expect(await openRows(), `round ${round}`).toHaveLength(1)
      expect((await rowOf(made.id)).body_html).toBe(words)
      expect((await rowOf(made.id)).set_aside_at).not.toBeNull()
    }
  })

  it('refuses a start whose empty open letter was sent between its read and its write, naming who sent it and when, and writes nothing', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const empty = await (await start(one, 'blank')).json<{ issue: { id: string } }>()
    await seedSend({ id: 'campaign-sample-one', by: two, at: '2026-11-13 16:05:00', status: 'sending', body: '' })
    const res = await start(one, 'monthly', 'January 2027', {}, { env: { DB: betweenDb(markSent(empty.issue.id, 'campaign-sample-one')) } })
    expect(res.status).toBe(409)
    expect(await expectContract(res, newsletterIssueRefusedSchema)).toEqual({ error: SENT_WHILE_STARTING, reason: 'sent', changedBy: 'Player Two', changedAt: '2026-11-13 16:05:00' })
    // Nothing was written: the letter is as the send left it, not reused, and no other letter was made.
    expect(await rows()).toEqual([expect.objectContaining({ id: empty.issue.id, version: 1, body_html: '', month_label: MONTH, campaign_id: 'campaign-sample-one', set_aside_at: null })])
    // The words say to try again, and trying again starts the next letter.
    expect((await start(one, 'monthly', 'January 2027')).status).toBe(201)
    expect(await openRows()).toHaveLength(1)
    expect(await rows()).toHaveLength(2)
  })

  it('refuses a start whose open letter, holding words, was sent between its read and its write: it is not set aside and no new letter is made', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const words = `${LETTER}<p>Sample words that went out.</p>`
    const made = await (await save(one, { bodyHtml: words })).json<{ id: string }>()
    await seedSend({ id: 'campaign-sample-one', by: two, at: '2026-11-13 16:05:00', status: 'sending', body: words })
    const res = await start(one, 'monthly', 'January 2027', {}, { env: { DB: betweenDb(markSent(made.id, 'campaign-sample-one')) } })
    expect(res.status).toBe(409)
    expect(await expectContract(res, newsletterIssueRefusedSchema)).toEqual({ error: SENT_WHILE_STARTING, reason: 'sent', changedBy: 'Player Two', changedAt: '2026-11-13 16:05:00' })
    expect(await rows()).toEqual([expect.objectContaining({ id: made.id, version: 1, body_html: words, campaign_id: 'campaign-sample-one', set_aside_at: null })])
  })

  it('answers 404, never an unhandled error, were a write\'s own read ever to find no open letter, which its one transaction rules out', async () => {
    const admin = await seedAdmin()
    // A database whose batches answer each read with no rows, which D1 never does after the batch's own write.
    const emptied = {
      prepare: (sql: string) => env.DB.prepare(sql),
      batch: async (statements: D1PreparedStatement[]) => (await env.DB.batch(statements)).map((result) => ({ ...result, results: [] })),
      exec: (sql: string) => env.DB.exec(sql),
      dump: () => env.DB.dump(),
    } as unknown as D1Database
    const opts: InvokeOptions = { env: { DB: emptied } }
    expect((await save(admin, {}, opts)).status, 'a first save').toBe(404)
    expect((await start(admin, 'monthly', MONTH, {}, opts)).status, 'a start over a letter that holds words').toBe(404)
    await env.DB.prepare('DELETE FROM newsletter_issues').run()
    expect((await start(admin, 'blank', MONTH, {}, opts)).status, 'a start with no letter').toBe(404)
    expect((await start(admin, 'monthly', MONTH, {}, opts)).status, 'a start over an empty letter').toBe(404)
  })

  it('takes exactly one of five saves of one version at once, moving the version by exactly one', async () => {
    const people = await Promise.all(['One', 'Two', 'Three', 'Four', 'Five'].map((n) => seedMember({ fullName: `Player ${n}`, role: 'lca_admin' })))
    const made = await (await save(people[0])).json<{ id: string }>()
    const answers = await Promise.all(people.map((as, i) => save(as, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>Sample words ${i}.</p>` })))
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409, 409, 409, 409])
    const stored = await rowOf(made.id)
    expect(stored.version).toBe(2)
    const winner = answers.findIndex((a) => a.status === 200)
    expect(stored.body_html).toBe(`${LETTER}<p>Sample words ${winner}.</p>`)
    expect(stored.updated_by).toBe(people[winner])
  })

  it('answers a version that is huge as an old version or a refused body, never an unhandled error', async () => {
    const admin = await seedAdmin()
    const made = await (await save(admin)).json<{ id: string }>()
    for (const version of [Number.MAX_SAFE_INTEGER, 2 ** 53, 1e21, 2 ** 31, 2 ** 32 + 1]) {
      const res = await save(admin, { id: made.id, version })
      expect([400, 409], String(version)).toContain(res.status)
    }
    expect((await rowOf(made.id)).version).toBe(1)
  })

  it('refuses a subject of a hundred thousand characters in words at its own field, before anything else is read', async () => {
    const admin = await seedAdmin()
    const res = await save(admin, { subject: 's'.repeat(100_000) })
    expect(res.status).toBe(400)
    expect(Object.keys((await res.json<{ fields: Row }>()).fields)).toEqual(['subject'])
    expect(await rows()).toEqual([])
  })

  it('refuses an id of 3,000,000 characters in its field\'s own words, on a save and on a start from a letter or a send, never with an unhandled error, writing nothing', async () => {
    const admin = await seedAdmin()
    expect((await save(admin)).status).toBe(200)
    const before = await rows()
    const id = 'i'.repeat(3_000_000)
    const choose = 'Choose a blank letter, a starter, a past letter or a past newsletter.'
    const answers = [
      ['a save', await save(admin, { id, version: 1 }), { id: 'Name the letter you read, or none for a new one.' }],
      ['a start from a past letter', await start(admin, { issueId: id }), { from: choose }],
      ['a start from a send', await start(admin, { campaignId: id }), { from: choose }],
    ] as const
    for (const [what, res, fields] of answers) {
      expect(res.status, what).toBe(400)
      expect(await res.json(), what).toEqual({ error: 'Some fields are missing or not valid.', fields })
    }
    expect(await rows()).toEqual(before)
  })

  it('answers 404 for an id of REQUEST_ID_MAX characters that names no letter or send, on a save and on a start', async () => {
    const admin = await seedAdmin()
    const id = 'i'.repeat(REQUEST_ID_MAX)
    for (const res of [await save(admin, { id, version: 1 }), await start(admin, { issueId: id }), await start(admin, { campaignId: id })]) {
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
    expect(await rows()).toEqual([])
  })

  it('keeps the month as written, collapsed only in the subject a start makes from it, and an empty month gives the bare subject', async () => {
    const admin = await seedAdmin()
    const spaced = await (await start(admin, 'blank', 'January    2027')).json<{ issue: { monthLabel: string; subject: string } }>()
    expect(spaced.issue.monthLabel).toBe('January    2027')
    expect(spaced.issue.subject).toBe(defaultSubject('January 2027'))
    const none = await (await start(admin, 'blank', '')).json<{ issue: { monthLabel: string; subject: string; id: string } }>()
    expect(none.issue.monthLabel).toBe('')
    expect(none.issue.subject).toBe('LCA Newsletter')
    expect(await rows()).toHaveLength(1)
  })

  it('names the new open letter on a read at once after a start, and no longer names the one set aside', async () => {
    const admin = await seedAdmin()
    const made = await (await save(admin, { bodyHtml: `${LETTER}<p>Sample words.</p>` })).json<{ id: string }>()
    const started = await (await start(admin, 'monthly', 'January 2027')).json<{ issue: { id: string } }>()
    const read = await (await invoke(issueGet, { as: admin })).json<{ issue: { id: string; monthLabel: string }; state: string }>()
    expect(read.issue.id).toBe(started.issue.id)
    expect(read.issue.id).not.toBe(made.id)
    expect(read.state).toBe('draft')
  })
})

describe('(c) a letter made by hand to get live markup into the table', () => {
  const HOSTILE = [
    '<svg><style><img src=x onerror=alert(1)></style></svg><p>Sample</p>',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<p><a href="&#x6A;avascript:alert(1)">Sample link</a></p>',
    '<p><a href="java&#9;script:alert(1)">Sample link</a></p>',
    '<!--<img src=x onerror=alert(1)>--><p>Sample</p>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">Sample</p></noscript>',
    '<p>Sample</p><iframe src="https://example.org"></iframe><object data="x"></object><embed src="x">',
    '<p style="background:url(javascript:alert(1))">Sample</p><form action="https://example.org"><input name="a"></form>',
    '<p onmouseover=alert(1)>Sample</p><base href="https://example.org/"><meta http-equiv="refresh" content="0">',
    '<h2>Sample</h2><a href="HTTPS://example.org/path?a=1&amp;b=2" onclick="x">Sample link</a>',
    '<p>Sample</p><details open ontoggle=alert(1)><summary>x</summary></details>',
    '<p>Sample <b>bold</b> <i>italic</i> <u>under</u> <font color=red>coloured</font></p>',
  ]
  const KEPT = new Set(['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'hr', 'a'])

  it('stores for each one the cleaner\'s own output or refuses it with nothing written, holding only kept tags and no attribute but a link\'s address', async () => {
    const admin = await seedAdmin()
    let stored = 0
    for (const input of HOSTILE) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const cleaned = await cleanLetterHtml(input)
      const res = await save(admin, { bodyHtml: input })
      if (cleaned === null || cleaned.startsWith('<h3>')) {
        expect(res.status, input).toBe(400)
        expect(await rows(), input).toEqual([])
        continue
      }
      expect(res.status, input).toBe(200)
      stored += 1
      const body = (await rowOf((await res.json<{ id: string }>()).id)).body_html as string
      expect(body, input).toBe(cleaned)
      for (const [, closing, tag, attrs] of body.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>/g)) {
        expect(KEPT.has(tag.toLowerCase()), `${input} -> ${tag}`).toBe(true)
        if (closing) expect(attrs.trim(), input).toBe('')
        else if (tag === 'a') expect(attrs, input).toMatch(/^ href="(?:https?:\/\/|mailto:)[^"<>` ]*"$/i)
        else if (tag === 'ol') expect(attrs, input).toMatch(/^(?: start="\d+")?$/)
        else expect(attrs, input).toBe('')
      }
      for (const live of ['onerror', 'onclick', 'onmouseover', 'ontoggle', 'javascript:', '<img', '<svg', '<style', '<iframe', '<form', '<meta', '<base']) {
        expect(body.toLowerCase(), `${input} -> ${live}`).not.toContain(live)
      }
      // The read gives the same letter back, and cleaning it again changes nothing.
      const read = await (await invoke(issueGet, { as: admin })).json<{ issue: { bodyHtml: string } }>()
      expect(read.issue.bodyHtml).toBe(body)
      expect(await cleanLetterHtml(body)).toBe(body)
    }
    expect(stored).toBeGreaterThan(0)
  })

  it('does not let a letter that closes the page\'s own markup, or one that opens a comment, reach the stored words as markup', async () => {
    const admin = await seedAdmin()
    for (const input of ['<p>Sample</p></div></body></html><script>alert(1)</script>', '<p>Sample</p><!-- never closed', '<p>Sample</p><![CDATA[x]]>']) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const res = await save(admin, { bodyHtml: input })
      expect([200, 400], input).toContain(res.status)
      const stored = JSON.stringify(await rows())
      for (const live of ['<script', '</div', '</body', '</html', '<!--', '<![']) expect(stored, `${input} -> ${live}`).not.toContain(live)
    }
  })

  it('keeps a "<" that is a word as a word, so the words of a letter never become a tag when it is read again', async () => {
    const admin = await seedAdmin()
    const res = await save(admin, { bodyHtml: '<p>Sample 1 < 2 and 3 > 2 and &lt;b&gt;words&lt;/b&gt;</p>' })
    expect(res.status).toBe(200)
    const body = (await openRowsBody()) as string
    expect(body).not.toMatch(/<b>/)
    expect(await cleanLetterHtml(body)).toBe(body)
  })

  it('counts a "<" typed just before a line break in a starter as words, so the next start sets the letter aside, lists it and keeps it whole', async () => {
    const admin = await seedAdmin()
    const monthly = starterLetter('monthly')
    const letters = [
      ['between two parts', monthly.replace('<h2>Results</h2>', '<<br>p><<br>/p><h2>Results</h2>')],
      ['at the end of a heading', monthly.replace('<h2>Results</h2>', '<h2>Results<<br>p><<br>/p></h2>')],
      ['with spaces between the pieces', monthly.replace('<h2>Results</h2>', '<<br>p> <<br>/p> <h2>Results</h2>')],
      ['a first heading written as words', monthly.replace('<h2>A note from the president</h2>', '<<br>h2>A note from the president<<br>/h2>')],
      ['alone', '<<br>p><<br>/p>'],
    ] as const
    for (const [what, bodyHtml] of letters) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const made = await (await start(admin, 'monthly')).json<{ issue: { id: string; version: number } }>()
      expect((await save(admin, { id: made.issue.id, version: made.issue.version, bodyHtml })).status, what).toBe(200)
      // Each "<" starts no tag, so the cleaner keeps the letter as it was sent.
      expect((await rowOf(made.issue.id)).body_html, what).toBe(bodyHtml)
      const res = await start(admin, 'results-and-thanks')
      expect(res.status, what).toBe(201)
      expect((await res.json<{ issue: { id: string } }>()).issue.id, what).not.toBe(made.issue.id)
      const aside = await rowOf(made.issue.id)
      expect(aside.set_aside_at, what).not.toBeNull()
      expect(aside.body_html, what).toBe(bodyHtml)
      expect(await rows(), what).toHaveLength(2)
      expect((await (await invoke(issuesGet, { as: admin })).json<{ issues: Row[] }>()).issues, what).toMatchObject([{ issueId: made.issue.id, state: 'set_aside' }])
    }
  })

  it('stores no control character in a plain field, by any route: a field that holds one is refused whole', async () => {
    const admin = await seedAdmin()
    for (const field of ['monthLabel', 'subject', 'preheader'] as const) {
      for (const code of [0x00, 0x09, 0x0a, 0x0d, 0x0b, 0x0c, 0x1b, 0x7f, 0x85, 0x2028, 0x2029]) {
        const res = await save(admin, { [field]: `Sample${String.fromCharCode(code)}words` })
        expect(res.status, `${field} U+${code.toString(16)}`).toBe(400)
      }
    }
    expect(await rows()).toEqual([])
  })
})

const openRowsBody = async () => (await openRows())[0]?.body_html

describe('(d) who is named when the person is gone, and the times as stored', () => {
  it('names nobody for a sent letter whose send was made by an account that is gone or never named, with the send\'s own time', async () => {
    const writer = await seedAdmin()
    await seedSend({ id: 'campaign-sample-one', by: null, at: '2026-11-13 16:05:00' })
    await seedLetter({ id: 'issue-sent', campaignId: 'campaign-sample-one', by: writer })
    const res = await save(writer, { id: 'issue-sent', version: 1 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SENT_SINCE_READ, reason: 'sent', changedBy: null, changedAt: '2026-11-13 16:05:00' })
  })

  it('names nobody for a letter set aside by an account that was closed since, and still gives when', async () => {
    const admin = await seedAdmin()
    const leaver = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const writer = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(writer)).json<{ id: string }>()
    expect((await start(leaver, 'monthly')).status).toBe(201)
    const aside = await rowOf(made.id)
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaver } })).status).toBe(200)
    const res = await save(writer, { id: made.id, version: 1 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SET_ASIDE_SINCE_READ, reason: 'set_aside', changedBy: null, changedAt: aside.set_aside_at })
    const last = (await (await invoke(issuesGet, { as: admin })).json<{ issues: Array<{ by: string | null; state: string }> }>()).issues
    expect(last).toMatchObject([{ state: 'set_aside', by: null }])
  })

  it('names nobody for a letter last saved by an account that was closed, in both the read and the refusal of an old version', async () => {
    const admin = await seedAdmin()
    const leaver = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const reader = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(reader)).json<{ id: string }>()
    expect((await save(leaver, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>Sample words from a person who left.</p>` })).status).toBe(200)
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaver } })).status).toBe(200)
    const stale = await save(reader, { id: made.id, version: 1 })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ reason: 'changed', changedBy: null })
    expect(await (await invoke(issueGet, { as: admin })).json()).toMatchObject({ lastSavedBy: null, issue: { bodyHtml: `${LETTER}<p>Sample words from a person who left.</p>` } })
  })

  it('gives the times as stored, in the database\'s form, unmoved, across midnight, a year\'s end and both Central time changes, newest first', async () => {
    const admin = await seedAdmin()
    // Stored times are UTC. 2026-11-01 06:30 and 07:30 are both 1:30 AM in Chicago (the clocks went back at 7:00 AM UTC);
    // 2027-03-14 07:59 and 08:00 are the minute before and after the clocks went forward.
    const at = [
      '2026-10-31 23:59:59', '2026-11-01 00:00:00', '2026-11-01 06:30:00', '2026-11-01 07:30:00', '2026-12-31 23:59:59', '2027-01-01 00:00:00',
      '2027-03-14 07:59:59', '2027-03-14 08:00:00',
    ]
    for (const [i, time] of at.entries()) await seedLetter({ id: `issue-${i}`, setAsideAt: time, by: admin })
    const body = await (await invoke(issuesGet, { as: admin })).json<{ issues: Array<{ at: string; issueId: string }> }>()
    expect(body.issues.map((i) => i.at)).toEqual([...at].reverse())
    for (const issue of body.issues) expect(issue.at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    // A letter read back gives its last saved time as stored too.
    await env.DB.prepare('DELETE FROM newsletter_issues').run()
    await seedLetter({ id: 'issue-open', updatedAt: '2026-11-01 06:30:00', by: admin })
    expect(await (await invoke(issueGet, { as: admin })).json()).toMatchObject({ lastSavedAt: '2026-11-01 06:30:00', issue: { updatedAt: '2026-11-01 06:30:00' } })
  })

  it('orders letters and sends with one time in a fixed order, the same on every read, and none left out', async () => {
    const admin = await seedAdmin()
    const at = '2026-11-10 15:00:00'
    await seedSend({ id: 'campaign-tie-one', at, by: admin, subject: 'Sample tie one' })
    await seedSend({ id: 'campaign-tie-two', at, by: admin, subject: 'Sample tie two' })
    await seedLetter({ id: 'issue-tie-one', setAsideAt: at, by: admin, subject: 'Sample tie three' })
    await seedLetter({ id: 'issue-tie-two', setAsideAt: at, by: admin, subject: 'Sample tie four' })
    const read = async () => (await (await invoke(issuesGet, { as: admin })).json<{ issues: Array<{ subject: string }> }>()).issues.map((i) => i.subject)
    const first = await read()
    expect(first).toHaveLength(4)
    expect(new Set(first)).toEqual(new Set(['Sample tie one', 'Sample tie two', 'Sample tie three', 'Sample tie four']))
    for (let i = 0; i < 3; i += 1) expect(await read()).toEqual(first)
    // Of two of one kind the one made later comes first.
    expect(first.indexOf('Sample tie two')).toBeLessThan(first.indexOf('Sample tie one'))
    expect(first.indexOf('Sample tie four')).toBeLessThan(first.indexOf('Sample tie three'))
  })

  it('gives a send in progress and a failed send their own word, a count of none for a send that reached nobody, and a letter sent once however many times it is listed', async () => {
    const admin = await seedAdmin()
    await seedSend({ id: 'campaign-sending', status: 'sending', total: 0, at: '2026-11-12 15:00:00', by: admin })
    await seedSend({ id: 'campaign-failed', status: 'failed', total: 7, at: '2026-11-11 15:00:00', by: admin })
    await seedSend({ id: 'campaign-page', at: '2026-11-10 15:00:00', by: admin })
    await seedLetter({ id: 'issue-page', campaignId: 'campaign-page', by: admin })
    const issues = (await (await invoke(issuesGet, { as: admin })).json<{ issues: Row[] }>()).issues
    expect(issues.map((i) => [i.campaignId, i.state, i.totalRecipients])).toEqual([
      ['campaign-sending', 'sending', 0], ['campaign-failed', 'failed', 7], ['campaign-page', 'completed', 3],
    ])
    expect(issues.filter((i) => i.campaignId === 'campaign-page')).toHaveLength(1)
  })
})

describe('(e) each kind of person against a letter that holds words', () => {
  const SECRET = 'Sample words that only a sender may read'

  it('shows nothing of the letter to anyone the guard refuses, and lets none of them change it, start over it or list it', async () => {
    const admin = await seedAdmin()
    const made = await (await save(admin, { bodyHtml: `${LETTER}<p>${SECRET}.</p>`, preheader: 'Sample private preview' })).json<{ id: string }>()
    await seedSend({ id: 'campaign-sample-one', by: admin, subject: 'Sample private subject' })
    const seated = await seedMember({ fullName: 'Player Three', role: 'lca_officer' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [seated])
    const refused: Array<[string, string | undefined, InvokeOptions['aal']]> = [
      ['nobody', undefined, 'aal2'],
      ['a plain member', await seedMember({ fullName: 'Player Four', role: 'member' }), 'aal2'],
      ['an officer', await seedMember({ fullName: 'Player Five', role: 'lca_officer' }), 'aal2'],
      ['a club rep', await seedMember({ fullName: 'Player Six', role: 'club_rep' }), 'aal2'],
      ['a tournament director', await seedMember({ fullName: 'Player Seven', role: 'tournament_director' }), 'aal2'],
      ['an auditor', await seedMember({ fullName: 'Player Eight', role: 'lca_auditor' }), 'aal2'],
      ['the admin without a second factor', admin, 'aal1'],
      ['the seat holder without a second factor', seated, 'aal1'],
    ]
    const before = { rows: await rows(), counts: await counts() }
    for (const [who, as, aal] of refused) {
      const answers = [
        await invoke(issueGet, { as, aal }),
        await invoke(issuePut, { method: 'PUT', as, aal, body: saveBody({ id: made.id, version: 1, bodyHtml: '<p>Sample intrusion.</p>' }) }),
        await invoke(startPost, { method: 'POST', as, aal, body: { from: 'monthly', monthLabel: MONTH } }),
        await invoke(issuesGet, { as, aal }),
      ]
      for (const res of answers) {
        expect([401, 403], who).toContain(res.status)
        const text = await res.response.clone().text()
        for (const leaked of [SECRET, 'Sample private', 'Sample heading one', made.id, 'campaign-sample-one']) expect(text, `${who}: ${leaked}`).not.toContain(leaked)
      }
    }
    expect({ rows: await rows(), counts: await counts() }).toEqual(before)
  })

  it('lets the people the guard admits do all four, and writes no audit row and sends nothing by any of them', async () => {
    const admin = await seedAdmin()
    const president = await seedMember({ fullName: 'Player Nine', role: 'lca_observer' })
    const auditBefore = (await counts()).audit
    for (const as of [admin, president]) {
      const opts: InvokeOptions = { aal: as === admin ? 'aal2' : 'aal1' }
      const made = await invoke(issuePut, { method: 'PUT', as, ...opts, body: saveBody({ id: null }) })
      expect([200, 409]).toContain(made.status)
      expect((await invoke(issueGet, { as, ...opts })).status).toBe(200)
      expect((await invoke(startPost, { method: 'POST', as, ...opts, body: { from: 'monthly', monthLabel: MONTH } })).status).toBe(201)
      expect((await invoke(issuesGet, { as, ...opts })).status).toBe(200)
    }
    expect((await counts()).audit).toBe(auditBefore)
    expect(emailOutbox).toEqual([])
  })

  it('has no starter the page can start from that writes an address or a postal line into the letter', async () => {
    const admin = await seedAdmin()
    for (const id of STARTER_IDS) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const body = await (await start(admin, id)).json<{ issue: { bodyHtml: string } }>()
      expect(body.issue.bodyHtml, id).not.toMatch(/\b(?:street|avenue|p\.?o\.? box|suite)\b|\b\d{5}(?:-\d{4})?\b/i)
    }
  })
})

describe('(f) plain language over the words of every refusal', () => {
  it('holds no dash, no old name for US Chess, no 24-hour time and no hidden character in any refusal\'s words, on any of the methods', async () => {
    const admin = await seedAdmin()
    const other = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const words: string[] = []
    const collect = async (res: { status: number; response: Response }) => {
      const body = (await res.response.clone().json()) as { error?: string; fields?: Record<string, string> }
      if (body.error) words.push(body.error)
      if (body.fields) words.push(...Object.values(body.fields))
    }
    const made = await (await save(admin)).json<{ id: string }>()
    await save(other, { id: made.id, version: 1 })
    await collect(await save(admin, { id: made.id, version: 1 }))
    await collect(await save(admin, { id: made.id, version: 2, bodyHtml: '<p>Sample</p><textarea>' }))
    await collect(await save(admin, { id: made.id, version: 2, bodyHtml: '<h3>Sample</h3>' }))
    await collect(await save(admin, { id: made.id, version: 2, bodyHtml: `<p>${'a'.repeat(LETTER_INPUT_MAX_BYTES)}</p>` }))
    await collect(await save(admin, { id: made.id, version: 2, subject: 'a\nb', monthLabel: 'm'.repeat(41), preheader: 'p'.repeat(151) }))
    await collect(await save(admin, { id: 'issue-nowhere', version: 1 }))
    await collect(await start(admin, 'a-starter-nobody-wrote'))
    await seedLetter({ id: 'issue-unclean', body: '<p>Sample</p><textarea>', setAsideAt: '2026-11-03 15:00:00' })
    await collect(await start(admin, { issueId: 'issue-unclean' }))
    await collect(await start(admin, { issueId: 'issue-nowhere' }))
    await seedSend({ id: 'campaign-sample-one', by: other })
    await seedLetter({ id: 'issue-sent', campaignId: 'campaign-sample-one', by: other })
    await collect(await save(admin, { id: 'issue-sent', version: 1 }))
    await collect(await invoke(issueGet, { as: undefined }))
    expect(words.length).toBeGreaterThanOrEqual(10)
    for (const text of words) {
      expect(text, text).not.toMatch(/[‒-―−]/)
      expect(text, text).not.toMatch(/ - | -- /)
      expect(text, text).not.toMatch(OLD_NAME)
      expect(text, text).not.toMatch(/\b\d{1,2}:\d{2}\b/)
      // eslint-disable-next-line no-control-regex
      expect(text, text).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
    }
  })
})
