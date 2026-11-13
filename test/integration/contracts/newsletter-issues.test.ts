// test/integration/contracts/newsletter-issues.test.ts
//
// The newsletter's own page's four methods (WS16 part two, page step 3), each
// to its contracts in domain/contracts/newsletter.ts, on the database every
// integration test runs on:
// - GET /api/admin/mail/newsletter/issue, with no open letter and with one;
// - PUT /api/admin/mail/newsletter/issue, its body read through its request
//   contract, its 200, its 409 for an old version, and its refusals;
// - POST /api/admin/mail/newsletter/issue/start, its 201 and its 409;
// - GET /api/admin/mail/newsletter/issues, with a letter set aside, a sent
//   letter and a send from the plain tab.
// Every refusal answers the shared error bodies, the 409 its own. MAIL_PAGE_ON
// and MAIL_LISTS_ON are read through getters on the mocked switches module,
// set before every case, with the module's other constants set beside them.
// Every name and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema, newsletterIssueRefusedSchema } from '../../../domain/contracts'
import { NEWSLETTER_LIST_ID } from '../../../domain/mail/lists'
import { onRequestGet as issueGet, onRequestPut as issuePut } from '../../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as startPost } from '../../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../../functions/api/admin/mail/newsletter/issues'
import { seedAdmin, seedMember } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ pageOn: true, listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
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

const read = contracts['admin/mail/newsletter/issue'].GET
const save = contracts['admin/mail/newsletter/issue'].PUT
const start = contracts['admin/mail/newsletter/issue/start'].POST
const last = contracts['admin/mail/newsletter/issues'].GET

const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'
const SAVE = { id: null, version: 0, monthLabel: 'December 2026', subject: 'Sample subject one', preheader: 'Sample preview line', bodyHtml: LETTER }

/** The database, with `between` run before its first batch: another person's write landing between a start's read and its write. */
function landsFirst(between: D1PreparedStatement): D1Database {
  let landed = false
  return {
    prepare: (sql: string) => env.DB.prepare(sql),
    batch: async (statements: D1PreparedStatement[]) => {
      if (!landed) {
        landed = true
        await between.run()
      }
      return env.DB.batch(statements)
    },
    exec: (sql: string) => env.DB.exec(sql),
    dump: () => env.DB.dump(),
  } as unknown as D1Database
}

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns']) await env.DB.prepare(`DELETE FROM ${table}`).run()
})

describe('GET /api/admin/mail/newsletter/issue', () => {
  it('answers to its contract with no open letter, and with one', async () => {
    const admin = await seedAdmin()
    const none = await expectContract(await invoke(issueGet, { as: admin }), read.response)
    expect(none).toEqual({ issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null })
    await invoke(issuePut, { as: admin, method: 'PUT', body: SAVE })
    const open = await expectContract(await invoke(issueGet, { as: admin }), read.response)
    expect(open.state).toBe('draft')
    expect(open.issue).toMatchObject({ version: 1, bodyHtml: LETTER, preheader: 'Sample preview line' })
    expect(read.response.safeParse({ ...open, state: 'sent' }).success).toBe(false)
  })

  it('answers 404 with the error body while MAIL_PAGE_ON is unset', async () => {
    flags.pageOn = false
    const res = await invoke(issueGet, { as: await seedAdmin() })
    expect(res.status).toBe(404)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not found' })
  })
})

describe('PUT /api/admin/mail/newsletter/issue', () => {
  it('takes a body its request contract accepts, a key beside the six passing through, and answers its 200 to its contract', async () => {
    const admin = await seedAdmin()
    const body = { ...SAVE, from: 'the page' }
    expect(save.request.safeParse(body).success).toBe(true)
    const res = await invoke(issuePut, { as: admin, method: 'PUT', body })
    expect(res.status).toBe(200)
    const saved = await expectContract(res, save.response)
    expect(saved).toMatchObject({ version: 1, bodyHtml: null })
    const cleaned = await expectContract(await invoke(issuePut, { as: admin, method: 'PUT', body: { ...SAVE, id: saved.id, version: 1, bodyHtml: `${LETTER}<script>alert(1)</script>` } }), save.response)
    expect(cleaned).toMatchObject({ version: 2, bodyHtml: LETTER })
  })

  it('answers an old version with its 409 body, naming who saved and when', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const saved = await (await invoke(issuePut, { as: one, method: 'PUT', body: SAVE })).json<{ id: string }>()
    await invoke(issuePut, { as: two, method: 'PUT', body: { ...SAVE, id: saved.id, version: 1 } })
    const res = await invoke(issuePut, { as: one, method: 'PUT', body: { ...SAVE, id: saved.id, version: 1 } })
    expect(res.status).toBe(409)
    const refused = await expectContract(res, newsletterIssueRefusedSchema)
    expect(refused).toMatchObject({ reason: 'changed', changedBy: 'Player Two' })
  })

  it('answers a body that is not valid with the field errors, and a letter it refuses or cannot find with the error body', async () => {
    const admin = await seedAdmin()
    const invalid = { ...SAVE, subject: 'Sample\nsubject' }
    expect(save.request.safeParse(invalid).success).toBe(false)
    const res = await invoke(issuePut, { as: admin, method: 'PUT', body: invalid })
    expect(res.status).toBe(400)
    expect(Object.keys((await expectContract(res, fieldErrorBodySchema)).fields)).toEqual(['subject'])
    for (const [body, status] of [[{ ...SAVE, bodyHtml: '<p>Sample</p><textarea>' }, 400], [{ ...SAVE, bodyHtml: `<p>${'a'.repeat(80_000)}</p>` }, 413], [{ ...SAVE, id: 'issue-nowhere', version: 1 }, 404]] as const) {
      const refused = await invoke(issuePut, { as: admin, method: 'PUT', body })
      expect(refused.status).toBe(status)
      await expectContract(refused, errorBodySchema)
    }
  })
})

describe('POST /api/admin/mail/newsletter/issue/start', () => {
  it('takes a body its request contract accepts and answers its 201 to its contract', async () => {
    const admin = await seedAdmin()
    for (const from of ['blank', 'monthly', 'results-and-thanks', 'short-notice'] as const) {
      const body = { from, monthLabel: 'January 2027', page: 'the page' }
      expect(start.request.safeParse(body).success, from).toBe(true)
      const res = await invoke(startPost, { as: admin, method: 'POST', body })
      expect(res.status, from).toBe(201)
      const started = await expectContract(res, start.response)
      expect(started.state, from).toBe('draft')
      expect(started.issue?.monthLabel, from).toBe('January 2027')
    }
    expect(start.request.safeParse({ from: { issueId: 'a', campaignId: 'b' }, monthLabel: '' }).success).toBe(false)
  })

  it('answers a start that wrote nothing with its 409 body, naming who and when, for a letter saved and for one sent as it started', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const body = { from: 'monthly', monthLabel: 'January 2027' }
    const made = await (await invoke(startPost, { as: one, method: 'POST', body: { from: 'blank', monthLabel: 'January 2027' } })).json<{ issue: { id: string } }>()
    await env.DB.prepare(
      `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, status, created_by, list_id, created_at)
       VALUES ('campaign-one', 'Sample newsletter one', '', '{}', 3, 'sending', ?1, ?2, '2026-11-13 16:05:00')`,
    ).bind(two, NEWSLETTER_LIST_ID).run()
    const landings = [
      ['changed', env.DB.prepare(`UPDATE newsletter_issues SET version = version + 1, updated_by = ?2, updated_at = '2026-11-13 16:00:00' WHERE id = ?1`).bind(made.issue.id, two), '2026-11-13 16:00:00'],
      ['sent', env.DB.prepare(`UPDATE newsletter_issues SET campaign_id = 'campaign-one' WHERE id = ?1`).bind(made.issue.id), '2026-11-13 16:05:00'],
    ] as const
    for (const [reason, between, at] of landings) {
      const res = await invoke(startPost, { as: one, method: 'POST', body, env: { DB: landsFirst(between) } })
      expect(res.status, reason).toBe(409)
      expect(await expectContract(res, newsletterIssueRefusedSchema), reason).toMatchObject({ reason, changedBy: 'Player Two', changedAt: at })
    }
  })

  it('answers a source that is not the newsletter\'s with the error body', async () => {
    const res = await invoke(startPost, { as: await seedAdmin(), method: 'POST', body: { from: { campaignId: 'campaign-nowhere' }, monthLabel: '' } })
    expect(res.status).toBe(404)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not found' })
  })
})

describe('GET /api/admin/mail/newsletter/issues', () => {
  it('answers to its contract with a letter set aside, a sent letter and a send from the plain tab', async () => {
    const admin = await seedAdmin()
    await env.DB.prepare(
      `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, status, created_by, list_id, created_at)
       VALUES ('campaign-one', 'Sample newsletter one', '<p>Sample words.</p>', '{}', 3, 'completed', ?1, ?2, '2026-11-02 15:00:00'),
              ('campaign-two', 'Sample newsletter two', '<p>Sample words.</p>', '{}', 4, 'sending', ?1, ?2, '2026-11-04 15:00:00')`,
    ).bind(admin, NEWSLETTER_LIST_ID).run()
    await env.DB.prepare(
      `INSERT INTO newsletter_issues (id, list_id, month_label, subject, body_html, created_by, updated_by, campaign_id, set_aside_at)
       VALUES ('issue-sent', ?2, 'November 2026', 'Sample newsletter two', ?3, ?1, ?1, 'campaign-two', NULL),
              ('issue-aside', ?2, 'December 2026', 'Sample subject one', ?3, ?1, ?1, NULL, '2026-11-05 15:00:00')`,
    ).bind(admin, NEWSLETTER_LIST_ID, LETTER).run()
    const res = await invoke(issuesGet, { as: admin })
    expect(res.status).toBe(200)
    const body = await expectContract(res, last.response)
    expect(body.issues.map((i) => [i.issueId, i.campaignId, i.state])).toEqual([
      ['issue-aside', null, 'set_aside'], ['issue-sent', 'campaign-two', 'sending'], [null, 'campaign-one', 'completed'],
    ])
    expect(last.response.safeParse({ issues: [{ ...body.issues[0], bodyHtml: LETTER }] }).success).toBe(false)
  })

  it('answers 404 with the error body while MAIL_PAGE_ON is unset', async () => {
    flags.pageOn = false
    const res = await invoke(issuesGet, { as: await seedAdmin() })
    expect(res.status).toBe(404)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not found' })
  })
})
