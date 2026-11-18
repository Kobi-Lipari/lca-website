// test/integration/newsletter-chooser-roundtrip.test.ts
//
// What the newsletter page's chooser depends on from the server (WS16 part two,
// page step 5, second part), through the real handlers, the real guard and the
// real cleaner, on the D1 database every integration test builds from the
// migrations. The page adds no endpoint; it calls the two the page's earlier
// steps built, and this file holds them to the order the chooser calls them in:
// - (a) nothing is lost, as one round trip: words saved, a new letter started
//   over them, the old letter listed under "Your last newsletters", the other
//   person's next save refused as a letter set aside, and the old letter used
//   from that list, with its words back; and a letter that holds no words
//   replaced with nothing left behind;
// - (b) a past send used from the list, and the list's rows each usable by the
//   id the row carries;
// - (c) the rule for a letter that holds words, the one the page's question and
//   cue ask (useIssue.ts, held equal to the server's function by
//   test/unit/admin-newsletter-chooser.test.tsx), held to what the handler
//   does with each letter the unit test lists: set aside when it holds words,
//   reused in place when it holds none;
// - (d) who may use the round trip: a person the guard refuses is answered
//   alike by the list and the start, with none of the words in the answer.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSubject } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../functions/api/admin/mail/newsletter/issues'
import { SET_ASIDE_SINCE_READ, starterLetter } from '../../functions/utils/mail/issues'
import { seedAdmin, seedMember } from './factories'
import { invoke, resetHarness, type InvokeOptions } from './harness'

const flags = vi.hoisted(() => ({ pageOn: true, listsOn: true }))
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
  }
})

type Row = Record<string, unknown>
interface Listed { issueId: string | null; campaignId: string | null; monthLabel: string; subject: string; state: string; at: string; by: string | null; totalRecipients: number | null }

const MONTH = 'December 2026'
const WORDS = '<h2>Sample heading one</h2><p>Sample words to keep.</p>'

const saveBody = (over: Partial<{ id: string | null; version: number; monthLabel: string; subject: string; preheader: string; bodyHtml: string }> = {}) => ({
  id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: WORDS, ...over,
})
const save = (as: string | undefined, over: Parameters<typeof saveBody>[0] = {}, opts: InvokeOptions = {}) =>
  invoke(issuePut, { method: 'PUT', as, body: saveBody(over), ...opts })
const start = (as: string | undefined, from: unknown, monthLabel = MONTH) => invoke(startPost, { method: 'POST', as, body: { from, monthLabel } })
const listed = async (as: string) => (await (await invoke(issuesGet, { as })).json<{ issues: Listed[] }>()).issues

const rows = async () => (await env.DB.prepare('SELECT * FROM newsletter_issues ORDER BY rowid').all<Row>()).results
const rowOf = async (id: string) => (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(id).first<Row>())!
const openRows = async () => (await rows()).filter((r) => r.campaign_id === null && r.set_aside_at === null)

async function seedSend(opts: { id: string; body: string; by?: string | null; at?: string; total?: number; subject?: string }) {
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, created_at, list_id)
     VALUES (?, ?, ?, '{}', ?, ?, 'completed', ?, ?, ?)`,
  ).bind(opts.id, opts.subject ?? 'Sample plain subject', opts.body, opts.total ?? 3, opts.total ?? 3, opts.by ?? null, opts.at ?? '2026-11-02 15:00:00', NEWSLETTER_LIST_ID).run()
}

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) nothing is lost: the whole round trip', () => {
  it('keeps the old letter\'s words under the last newsletters, tells the other person at their next save, and brings the words back from the list', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const starter = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(writer, { preheader: 'Sample preview line' })).json<{ id: string; version: number }>()
    expect(await listed(starter)).toEqual([])

    // The chooser's "Use this" on Monthly newsletter, from the other person's page.
    const monthly = await start(starter, 'monthly', 'January 2027')
    expect(monthly.status).toBe(201)
    const fresh = await monthly.json<{ issue: { id: string; bodyHtml: string; monthLabel: string } }>()
    expect(fresh.issue).toMatchObject({ bodyHtml: starterLetter('monthly'), monthLabel: 'January 2027' })
    expect(fresh.issue.id).not.toBe(made.id)

    // The next time the chooser opens, the old letter is the one row, with who set it aside and the day it was.
    const aside = await rowOf(made.id)
    const rowsNow = await listed(starter)
    expect(rowsNow).toEqual([
      { issueId: made.id, campaignId: null, monthLabel: MONTH, subject: defaultSubject(MONTH), state: 'set_aside', at: aside.set_aside_at, by: 'Player Two', totalRecipients: null },
    ])
    // The open letter is never among them.
    expect(rowsNow.map((r) => r.issueId)).not.toContain(fresh.issue.id)

    // The writer's next save is refused as a letter set aside, naming who and when, and writes nothing.
    const late = await save(writer, { id: made.id, version: made.version, bodyHtml: `${WORDS}<p>Sample words typed meanwhile.</p>` })
    expect(late.status).toBe(409)
    expect(await late.json()).toEqual({ error: SET_ASIDE_SINCE_READ, reason: 'set_aside', changedBy: 'Player Two', changedAt: aside.set_aside_at })
    expect(await rowOf(made.id)).toEqual(aside)

    // "Use this" on that row, with the Monthly newsletter nobody wrote in as the open letter: it is replaced in place, the words are back.
    const back = await start(writer, { issueId: rowsNow[0].issueId }, 'January 2027')
    expect(back.status).toBe(201)
    const restored = await back.json<{ issue: { id: string; bodyHtml: string; preheader: string; version: number } }>()
    expect(restored.issue.bodyHtml).toBe(WORDS)
    expect(restored.issue.id).toBe(fresh.issue.id)
    expect(restored.issue.version).toBeGreaterThan(1)
    // No row of nothing is left behind: the old letter and the open one are all there is, and the old letter is as it was.
    expect(await rows()).toHaveLength(2)
    expect((await openRows()).map((r) => r.id)).toEqual([fresh.issue.id])
    expect(await rowOf(made.id)).toEqual(aside)
    expect(await listed(writer)).toEqual(rowsNow)

    // The restored letter holds words, so starting again sets it aside too, and both are under the last newsletters, newest first.
    const blank = await start(writer, 'blank', 'January 2027')
    expect(blank.status).toBe(201)
    expect(await rows()).toHaveLength(3)
    const both = await listed(writer)
    expect(both).toHaveLength(2)
    expect(both.map((r) => r.issueId)).toEqual([fresh.issue.id, made.id])
  })

  it('replaces a letter that holds no words in place, with no row left under the last newsletters', async () => {
    const admin = await seedAdmin()
    const first = await (await start(admin, 'blank', MONTH)).json<{ issue: { id: string } }>()
    for (const from of ['monthly', 'short-notice', 'results-and-thanks', 'blank'] as const) {
      const res = await start(admin, from, 'January 2027')
      expect(res.status, from).toBe(201)
      expect((await res.json<{ issue: { id: string } }>()).issue.id, from).toBe(first.issue.id)
    }
    expect(await rows()).toHaveLength(1)
    expect(await listed(admin)).toEqual([])
  })
})

describe('(b) a past send and each row, used by the id it carries', () => {
  it('starts from a send of the plain tab by the id its row gives, cleaning its words, and leaves the send as it was', async () => {
    const admin = await seedAdmin()
    await seedSend({ id: 'campaign-sample-one', body: '<p style="color:red">Sample <b>plain</b> words.</p>', by: admin, at: '2026-11-10 15:00:00', total: 12, subject: 'Sample plain subject' })
    const [only] = await listed(admin)
    expect(only).toEqual({ issueId: null, campaignId: 'campaign-sample-one', monthLabel: '', subject: 'Sample plain subject', state: 'completed', at: '2026-11-10 15:00:00', by: expect.any(String), totalRecipients: 12 })
    const before = await env.DB.prepare('SELECT * FROM email_campaigns WHERE id = ?').bind('campaign-sample-one').first<Row>()
    const res = await start(admin, { campaignId: only.campaignId }, MONTH)
    expect(res.status).toBe(201)
    expect((await res.json<{ issue: { bodyHtml: string; monthLabel: string } }>()).issue).toMatchObject({ bodyHtml: '<p>Sample plain words.</p>', monthLabel: MONTH })
    expect(await env.DB.prepare('SELECT * FROM email_campaigns WHERE id = ?').bind('campaign-sample-one').first<Row>()).toEqual(before)
    // A row is a choice by one id alone: the letter's, or the send's.
    for (const row of await listed(admin)) expect([row.issueId, row.campaignId].filter((id) => id !== null)).toHaveLength(1)
  })
})

describe('(c) the rule for a letter that holds words, as the handler applies it', () => {
  // The letters of test/unit/admin-newsletter-chooser.test.tsx's list, each with whether the page's rule says it holds words.
  const drafts: Array<[string, Partial<ReturnType<typeof saveBody>>, boolean]> = [
    ['no words', { bodyHtml: '' }, false],
    ['an empty paragraph', { bodyHtml: '<p></p>' }, false],
    ['spaces around the month\'s own subject, a space as the preview line and a no-break space', { subject: ` ${defaultSubject(MONTH)} `, preheader: '  ', bodyHtml: '<p>&nbsp;</p>' }, false],
    ['another month with its own subject', { monthLabel: 'January 2027', subject: defaultSubject('January 2027'), bodyHtml: '' }, false],
    ['a subject of its own', { subject: 'Sample subject of its own', bodyHtml: '' }, true],
    ['an inbox preview line', { preheader: 'Sample preview line', bodyHtml: '' }, true],
    ['a word in the letter', { bodyHtml: '<p>Sample</p>' }, true],
    ['a heading of its own', { bodyHtml: '<h2>Sample heading one</h2><p></p>' }, true],
    ['a "<" kept as a word', { bodyHtml: '<p>&lt; 2</p>' }, true],
    ['the month changed with the old month\'s subject', { monthLabel: 'January 2027', bodyHtml: '' }, true],
    ['the monthly starter untouched', { bodyHtml: starterLetter('monthly') }, false],
    ['the results starter untouched', { bodyHtml: starterLetter('results-and-thanks') }, false],
    ['the short notice starter untouched', { bodyHtml: starterLetter('short-notice') }, false],
    ['the monthly starter with each empty part as the editor writes it', { bodyHtml: starterLetter('monthly').replaceAll('<p></p>', '<p><br></p>') }, false],
    ['the monthly starter with a space between each empty part and the next heading', { bodyHtml: starterLetter('monthly').replaceAll('</p><h2>', '</p> <h2>') }, false],
    ['the monthly starter with a word under a heading', { bodyHtml: starterLetter('monthly').replace('<h2>Coming up</h2><p></p>', '<h2>Coming up</h2><p>Sample</p>') }, true],
    ['the monthly starter with a heading reworded', { bodyHtml: starterLetter('monthly').replace('<h2>Results</h2>', '<h2>Sample heading one</h2>') }, true],
  ]

  it('sets each letter aside when the page\'s rule says it holds words, and reuses each in place when it says none', async () => {
    const admin = await seedAdmin()
    for (const [what, over, holds] of drafts) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const saved = await save(admin, over)
      expect(saved.status, what).toBe(200)
      const made = await saved.json<{ id: string }>()
      const res = await start(admin, 'blank', MONTH)
      expect(res.status, what).toBe(201)
      const started = await res.json<{ issue: { id: string } }>()
      if (holds) {
        expect((await rowOf(made.id)).set_aside_at, what).not.toBeNull()
        expect(started.issue.id, what).not.toBe(made.id)
        expect(await rows(), what).toHaveLength(2)
        expect((await listed(admin)).map((r) => r.issueId), what).toEqual([made.id])
      } else {
        expect((await rowOf(made.id)).set_aside_at, what).toBeNull()
        expect(started.issue.id, what).toBe(made.id)
        expect(await rows(), what).toHaveLength(1)
        expect(await listed(admin), what).toEqual([])
      }
    }
  })
})

describe('(d) who may use the round trip', () => {
  it('answers a person the guard refuses alike on the list and on a start from a row, with none of the words in the answer', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const made = await (await save(writer, { preheader: 'Sample preview line' })).json<{ id: string }>()
    expect((await start(writer, 'blank')).status).toBe(201)
    const before = await rows()
    for (const [who, as] of [
      ['nobody signed in', undefined],
      ['a plain member', await seedMember({ fullName: 'Player Three', role: 'member' })],
      ['a club rep', await seedMember({ fullName: 'Player Four', role: 'club_rep' })],
      ['a tournament director', await seedMember({ fullName: 'Player Five', role: 'tournament_director' })],
    ] as const) {
      const list = await invoke(issuesGet, { as })
      const use = await start(as, { issueId: made.id })
      expect([401, 403], who).toContain(list.status)
      expect(use.status, who).toBe(list.status)
      for (const answer of [list, use]) {
        const text = await answer.response.clone().text()
        expect(text, who).not.toContain('Sample words to keep')
        expect(text, who).not.toContain('Sample preview line')
        expect(text, who).not.toContain(made.id)
      }
    }
    expect(await rows()).toEqual(before)
  })
})
