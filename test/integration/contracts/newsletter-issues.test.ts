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
//   letter and a send from the plain tab;
// - since page step 6, POST /api/admin/mail/newsletter/test's second form, a
//   test of the stored letter, its body read through the endpoint's request
//   contract beside today's form, its 200, its 409 and its refusals;
// - GET, POST, PUT and DELETE /api/admin/mail/newsletter/templates, the saved
//   templates: the list, a save's 201, a rename's 200, a remove's 200, the
//   409 of a write that lost to another, and the refusals;
// - POST /api/admin/mail/newsletter/issue/send, the page's real Send: its
//   request contract, its 201, its 409 for an old version, and its refusals.
// Every refusal answers the shared error bodies, the 409 its own. MAIL_PAGE_ON,
// MAIL_PAGE_SEND_ON and MAIL_LISTS_ON are read through getters on the mocked switches module,
// set before every case, with the module's other constants set beside them.
// Every name and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema, newsletterIssueRefusedSchema, newsletterTemplateChangedSchema } from '../../../domain/contracts'
import { NEWSLETTER_LIST_ID } from '../../../domain/mail/lists'
import { SEND_CHANGED } from '../../../domain/mail/newsletterWords'
import { onRequestGet as issueGet, onRequestPut as issuePut } from '../../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as sendPost } from '../../../functions/api/admin/mail/newsletter/issue/send'
import { onRequestPost as startPost } from '../../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../../functions/api/admin/mail/newsletter/issues'
import {
  onRequestDelete as templatesDelete,
  onRequestGet as templatesGet,
  onRequestPost as templatesPost,
  onRequestPut as templatesPut,
} from '../../../functions/api/admin/mail/newsletter/templates'
import { onRequestPost as testPost } from '../../../functions/api/admin/mail/newsletter/test'
import { seedAdmin, seedMember } from '../factories'
import { emailOutbox, expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ pageOn: true, sendOn: true, listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_PAGE_ON() {
      return flags.pageOn
    },
    get MAIL_PAGE_SEND_ON() {
      return flags.sendOn
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
const test = contracts['admin/mail/newsletter/test'].POST
const send = contracts['admin/mail/newsletter/issue/send'].POST
const templateList = contracts['admin/mail/newsletter/templates'].GET
const templateSave = contracts['admin/mail/newsletter/templates'].POST
const templateRename = contracts['admin/mail/newsletter/templates'].PUT
const templateRemove = contracts['admin/mail/newsletter/templates'].DELETE

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
  flags.sendOn = true
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

describe('POST /api/admin/mail/newsletter/test, the test of the stored letter (page step 6)', () => {
  it('takes either form through its request contract, and answers the letter form\'s 200 to its contract, with the address it went to', async () => {
    const admin = await seedAdmin()
    const saved = await (await invoke(issuePut, { as: admin, method: 'PUT', body: SAVE })).json<{ id: string; version: number }>()
    const body = { issueId: saved.id, version: saved.version, from: 'the page' }
    expect(test.request.safeParse(body).success).toBe(true)
    expect(test.request.safeParse({ to: 'contract.tester@newsletter.test.lca', subject: 'Sample newsletter one', bodyHtml: '<p>Sample words.</p>' }).success).toBe(true)
    for (const bad of [{ issueId: '', version: 1 }, { issueId: saved.id, version: 0 }, { issueId: saved.id }]) expect(test.request.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    const res = await invoke(testPost, { as: admin, method: 'POST', body })
    expect(res.status).toBe(200)
    const sent = await expectContract(res, test.response)
    expect(sent).toEqual({ sent: true, to: emailOutbox[0].to })
    expect(test.response.safeParse({ sent: true, to: 'x', words: 'y' }).success).toBe(false)
  })

  it('answers a letter changed since its version with the save\'s 409 body, and every other refusal with the shared error bodies', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const saved = await (await invoke(issuePut, { as: one, method: 'PUT', body: SAVE })).json<{ id: string; version: number }>()
    await invoke(issuePut, { as: two, method: 'PUT', body: { ...SAVE, id: saved.id, version: saved.version } })
    const stale = await invoke(testPost, { as: one, method: 'POST', body: { issueId: saved.id, version: saved.version } })
    expect(stale.status).toBe(409)
    expect(await expectContract(stale, newsletterIssueRefusedSchema)).toMatchObject({ reason: 'changed', changedBy: 'Player Two' })
    const field = await invoke(testPost, { as: one, method: 'POST', body: { issueId: saved.id, version: 0 } })
    expect(field.status).toBe(400)
    expect(Object.keys((await expectContract(field, fieldErrorBodySchema)).fields)).toEqual(['version'])
    for (const [body, status, env] of [
      [{ issueId: 'issue-nowhere', version: 1 }, 404, undefined],
      [{ issueId: saved.id, version: saved.version + 1 }, 503, { MAIL_LINK_SECRET: '' }],
    ] as const) {
      const refused = await invoke(testPost, { as: one, method: 'POST', body, ...(env ? { env } : {}) })
      expect(refused.status).toBe(status)
      await expectContract(refused, errorBodySchema)
    }
    expect(emailOutbox).toEqual([])
  })
})

describe('POST /api/admin/mail/newsletter/issue/send, the page\'s real Send', () => {
  it('takes the stored letter by id and version through its request contract, and nothing typed is needed', () => {
    expect(send.request.safeParse({ issueId: 'a'.repeat(32), version: 1 }).success).toBe(true)
    expect(send.request.safeParse({ issueId: 'a'.repeat(32), version: 3, subject: 'Sample subject one', bodyHtml: '<p>Sample words.</p>', to: 'someone@newsletter.test.lca' }).success).toBe(true)
    const words = (value: unknown) => {
      const result = send.request.safeParse(value)
      return result.success ? null : result.error.issues.map((i) => i.message)
    }
    expect(words({ issueId: '', version: 1 })).toEqual(['Name the letter to send.'])
    expect(words({ issueId: 'a'.repeat(65), version: 1 })).toEqual(['Name the letter to send.'])
    expect(words({ version: 1 })).toEqual(['Name the letter to send.'])
    expect(words({ issueId: 'a'.repeat(32), version: 0 })).toEqual(['Give the version of the letter you read.'])
    expect(words({ issueId: 'a'.repeat(32), version: 1.5 })).toEqual(['Give the version of the letter you read.'])
    expect(words({ issueId: 'a'.repeat(32) })).toEqual(['Give the version of the letter you read.'])
  })

  it('answers a send started in the newsletter send\'s own 201 body, and a refused letter in the save\'s 409 body', () => {
    expect(send.response.safeParse({ campaignId: 'campaign-mabc1234-0a1b2c3d', totalRecipients: 155, status: 'sending' }).success).toBe(true)
    expect(send.response.safeParse({ campaignId: 'campaign-mabc1234-0a1b2c3d', totalRecipients: 155, status: 'sending', issueId: 'x' }).success).toBe(false)
    expect(send.response.safeParse({ campaignId: 'campaign-mabc1234-0a1b2c3d', totalRecipients: 155, status: 'sent' }).success).toBe(false)
    expect(newsletterIssueRefusedSchema.safeParse({
      reason: 'changed',
      error: 'Nothing was sent: someone else has changed, replaced or sent this letter.',
      changedBy: 'Player Two',
      changedAt: '2026-11-24 12:00:00',
    }).success).toBe(true)
  })

  it('answers its 201 to its contract, a letter changed since its version with the save\'s 409 body, and every other refusal with the shared error bodies', async () => {
    flags.sender = 'ses'
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const saved = await (await invoke(issuePut, { as: one, method: 'PUT', body: SAVE })).json<{ id: string; version: number }>()
    await invoke(issuePut, { as: two, method: 'PUT', body: { ...SAVE, id: saved.id, version: saved.version } })
    const stale = await invoke(sendPost, { as: one, method: 'POST', body: { issueId: saved.id, version: saved.version } })
    expect(stale.status).toBe(409)
    expect(await expectContract(stale, newsletterIssueRefusedSchema)).toMatchObject({ error: SEND_CHANGED, reason: 'changed', changedBy: 'Player Two' })
    const field = await invoke(sendPost, { as: one, method: 'POST', body: { issueId: saved.id, version: 0 } })
    expect(field.status).toBe(400)
    expect(Object.keys((await expectContract(field, fieldErrorBodySchema)).fields)).toEqual(['version'])
    for (const [body, status, env] of [
      [{ issueId: 'issue-nowhere', version: 1 }, 404, undefined],
      [{ issueId: saved.id, version: saved.version + 1 }, 503, { MAIL_LINK_SECRET: '' }],
    ] as const) {
      const refused = await invoke(sendPost, { as: one, method: 'POST', body, ...(env ? { env } : {}) })
      expect(refused.status).toBe(status)
      await expectContract(refused, errorBodySchema)
    }
    flags.sender = 'resend'
    const waits = await invoke(sendPost, { as: one, method: 'POST', body: { issueId: saved.id, version: saved.version + 1 } })
    expect(waits.status).toBe(409)
    await expectContract(waits, errorBodySchema)
    flags.sender = 'ses'
    const made = await invoke(sendPost, { as: one, method: 'POST', body: { issueId: saved.id, version: saved.version + 1 } })
    expect(made.status).toBe(201)
    expect(await expectContract(made, send.response)).toMatchObject({ status: 'sending' })
    expect(emailOutbox).toEqual([])
  })

  it('answers 404 with the error body while MAIL_PAGE_SEND_ON is unset', async () => {
    flags.sendOn = false
    const admin = await seedAdmin()
    const res = await invoke(sendPost, { as: admin, method: 'POST', body: { issueId: 'issue-nowhere', version: 1 } })
    expect(res.status).toBe(404)
    await expectContract(res, errorBodySchema)
  })
})

describe('GET, POST, PUT and DELETE /api/admin/mail/newsletter/templates', () => {
  it('takes each body its request contract accepts and answers the list, the save, the rename and the remove to their contracts', async () => {
    const admin = await seedAdmin()
    const empty = await expectContract(await invoke(templatesGet, { as: admin }), templateList.response)
    expect(empty).toEqual({ templates: [] })

    const body = { name: 'Sample monthly', bodyHtml: LETTER, page: 'the page' }
    expect(templateSave.request.safeParse(body).success).toBe(true)
    const res = await invoke(templatesPost, { as: admin, method: 'POST', body })
    expect(res.status).toBe(201)
    const { template } = await expectContract(res, templateSave.response)
    expect(template).toMatchObject({ name: 'Sample monthly', version: 1 })
    expect(templateSave.response.safeParse({ template: { ...template, bodyHtml: LETTER } }).success).toBe(false)
    for (const bad of [{ name: 'Sample' }, { name: 'Sample', bodyHtml: LETTER, from: { issueId: 'a' } }, { name: 'Sample', from: { issueId: 'a', campaignId: 'b' } }, { name: 'Sample\nname', bodyHtml: LETTER }]) {
      expect(templateSave.request.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }

    const listed = await expectContract(await invoke(templatesGet, { as: admin }), templateList.response)
    expect(listed.templates).toEqual([template])

    const rename = { id: template.id, version: 1, name: 'Sample renamed' }
    expect(templateRename.request.safeParse(rename).success).toBe(true)
    const renamed = await expectContract(await invoke(templatesPut, { as: admin, method: 'PUT', body: rename }), templateRename.response)
    expect(renamed.template).toMatchObject({ name: 'Sample renamed', version: 2 })

    const remove = { id: template.id, version: 2 }
    expect(templateRemove.request.safeParse(remove).success).toBe(true)
    expect(templateRemove.request.safeParse({ id: template.id }).success).toBe(false)
    const removed = await invoke(templatesDelete, { as: admin, method: 'DELETE', body: remove })
    expect(removed.status).toBe(200)
    expect(await expectContract(removed, templateRemove.response)).toEqual({ removed: true })
  })

  it('answers a write that lost to another with its 409 body, and the refusals with the shared error bodies', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const { template } = await (await invoke(templatesPost, { as: one, method: 'POST', body: { name: 'Sample one', bodyHtml: LETTER } })).json<{ template: { id: string } }>()
    await invoke(templatesPut, { as: two, method: 'PUT', body: { id: template.id, version: 1, name: 'Sample two' } })
    const stale = await invoke(templatesDelete, { as: one, method: 'DELETE', body: { id: template.id, version: 1 } })
    expect(stale.status).toBe(409)
    expect(await expectContract(stale, newsletterTemplateChangedSchema)).toMatchObject({ changedBy: 'Player Two' })

    const field = await invoke(templatesPost, { as: one, method: 'POST', body: { name: '', bodyHtml: LETTER } })
    expect(field.status).toBe(400)
    expect(Object.keys((await expectContract(field, fieldErrorBodySchema)).fields)).toEqual(['name'])
    for (const [handler, method, body, status] of [
      [templatesPost, 'POST', { name: 'Sample two', bodyHtml: LETTER }, 409],
      [templatesPost, 'POST', { name: 'Sample empty', bodyHtml: '<p></p>' }, 400],
      [templatesPost, 'POST', { name: 'Sample long', bodyHtml: `<p>${'a'.repeat(80_000)}</p>` }, 413],
      [templatesPost, 'POST', { name: 'Sample nowhere', from: { campaignId: 'campaign-nowhere' } }, 404],
      [templatesPut, 'PUT', { id: 'template-nowhere', version: 1, name: 'Sample' }, 404],
    ] as const) {
      const refused = await invoke(handler, { as: one, method, body })
      expect(refused.status, JSON.stringify(body).slice(0, 80)).toBe(status)
      await expectContract(refused, errorBodySchema)
    }
  })

  it('answers 404 with the error body while MAIL_PAGE_ON is unset', async () => {
    flags.pageOn = false
    const res = await invoke(templatesGet, { as: await seedAdmin() })
    expect(res.status).toBe(404)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not found' })
  })
})
