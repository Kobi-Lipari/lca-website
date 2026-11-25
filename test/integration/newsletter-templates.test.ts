// test/integration/newsletter-templates.test.ts
//
// Saved templates on the newsletter's own page, on the D1 database every
// integration test builds from the migrations. A saved template is a row of
// newsletter_issues of its own (migration 0061, no new migration): a copy of a
// letter's words, set aside from the start, with pinned_at and pinned_name set,
// so it is never the open letter and never sent. It shows while pinned_at is
// set; Remove clears pinned_at and keeps its name and words, and no row is
// deleted. Everyone who may open the page sees and uses the same ones.
// - (a) the storage: a save and its copy, the open letter left as it was, the
//   name's refusals, the limit, rename, remove, a start from a saved template,
//   and the last newsletters without template rows.
// - (b) who may: GET, POST, PUT and DELETE .../templates answer 404 before the
//   session while MAIL_PAGE_ON is unset, and let in exactly the people
//   requireListMailer lets send the newsletter, refusing everyone else as part
//   one's newsletter does, byte for byte, with no row written.
// - (c) the endpoint: a save from the open letter and from a past newsletter,
//   the name's refusals, the limit, rename, remove, a start from a saved
//   template, the last newsletters without template rows, and another writer
//   seeing the same list.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LETTER_MAX_BYTES, defaultSubject } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as newsletterGet } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../functions/api/admin/mail/newsletter/issues'
import {
  onRequestDelete as templatesDelete,
  onRequestGet as templatesGet,
  onRequestOptions as templatesOptions,
  onRequestPost as templatesPost,
  onRequestPut as templatesPut,
} from '../../functions/api/admin/mail/newsletter/templates'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import {
  TEMPLATE_CHANGED,
  TEMPLATES_MAX,
  TEMPLATE_EMPTY,
  TEMPLATES_FULL,
  lastIssues,
  listTemplates,
  removeTemplate,
  renameTemplate,
  saveIssue,
  saveTemplate,
  startIssue,
  templateNameTaken,
} from '../../functions/utils/mail/issues'
import { seedAdmin, seedMember, seedPresident, seedSeat } from './factories'
import { fetchCount, invoke, resetHarness, type InvokeOptions } from './harness'
import { countingDb } from './mailRuns'

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

type Handler = Parameters<typeof invoke>[0]
type Row = Record<string, unknown>

const MONTH = 'December 2026'
const WORDS = '<h2>Sample heading one</h2><p>Sample words to keep.</p>'
const db = () => env.DB

const rows = async () => (await env.DB.prepare('SELECT * FROM newsletter_issues ORDER BY rowid').all<Row>()).results
const rowOf = async (id: string) => (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(id).first<Row>())!

/** The open letter, saved with the sample words. */
async function openLetter(by: string, bodyHtml = WORDS) {
  const saved = await saveIssue(db(), { listId: NEWSLETTER_LIST_ID, id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: 'Sample preview line', bodyHtml, by })
  if (!('saved' in saved)) throw new Error('the open letter was not saved')
  return saved.saved
}

const save = (by: string, name: string, from: Parameters<typeof saveTemplate>[1]['from'] = { bodyHtml: WORDS }) =>
  saveTemplate(db(), { listId: NEWSLETTER_LIST_ID, name, from, by })

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) the storage of a saved template', () => {
  it('saves a copy of the words under its name, set aside from the start, and leaves the open letter exactly as it was', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const open = await openLetter(writer)
    const before = await rowOf(open.id)

    const result = await save(writer, '  Sample monthly  ', { bodyHtml: '<p style="color:red">Sample <b>kept</b> words.</p>' })
    expect('saved' in result).toBe(true)
    if (!('saved' in result)) return
    const row = await rowOf(result.saved.id)
    expect(row).toMatchObject({
      list_id: NEWSLETTER_LIST_ID, month_label: '', subject: '', preheader: '', body_html: '<p>Sample kept words.</p>',
      campaign_id: null, pinned_name: 'Sample monthly', created_by: writer, version: 1,
    })
    expect(row.set_aside_at).not.toBeNull()
    expect(row.pinned_at).not.toBeNull()
    expect(result.saved).toEqual({ id: row.id, name: 'Sample monthly', savedAt: row.pinned_at, by: 'Player', version: 1 })
    expect(await rowOf(open.id)).toEqual(before)
  })

  it('refuses a letter with no words, a name another shown template has, in any case, and the one past the limit, writing nothing', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    expect(await save(writer, 'Sample empty', { bodyHtml: '<h2></h2><p>&nbsp;</p>' })).toEqual({ refused: { status: 400, error: TEMPLATE_EMPTY } })
    expect(await save(writer, 'Sample one')).toHaveProperty('saved')
    expect(await save(writer, 'sample ONE')).toEqual({ refused: { status: 409, error: templateNameTaken('Sample one') } })
    expect(templateNameTaken('Sample one')).toBe('A template is already called Sample one. Choose another name.')
    for (let n = 2; n <= TEMPLATES_MAX; n += 1) expect(await save(writer, `Sample ${n}`), String(n)).toHaveProperty('saved')
    expect(await rows()).toHaveLength(TEMPLATES_MAX)
    expect(await save(writer, 'Sample one more')).toEqual({ refused: { status: 409, error: TEMPLATES_FULL } })
    expect(await rows()).toHaveLength(TEMPLATES_MAX)
  })

  it('holds the words to the save\'s size limits', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const long = `<p>${'Sample '.repeat(Math.ceil(LETTER_MAX_BYTES / 7) + 10)}</p>`
    const result = await save(writer, 'Sample long', { bodyHtml: long })
    expect(result).toEqual({ refused: { status: 413, error: expect.any(String) } })
    expect(await rows()).toHaveLength(0)
  })

  it('saves a past newsletter as a template by its row\'s id, and the open letter and that newsletter stay as they were', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const first = await openLetter(writer)
    const started = await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: 'monthly', monthLabel: 'January 2027', by: writer })
    expect(started).toHaveProperty('started')
    const aside = await rowOf(first.id)
    const result = await save(writer, 'Sample from the past', { issueId: first.id })
    expect(result).toHaveProperty('saved')
    if (!('saved' in result)) return
    expect((await rowOf(result.saved.id)).body_html).toBe(WORDS)
    expect(await rowOf(first.id)).toEqual(aside)
    expect(await save(writer, 'Sample nowhere', { issueId: 'not-a-letter' })).toEqual({ notFound: true })
  })

  it('saves a plain send of the list as a template by its id, and the send stays as it was; an unknown send is not found', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    await env.DB.prepare(
      `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, created_at, list_id)
       VALUES (?, 'Sample plain subject', ?, '{}', 3, 3, 'completed', NULL, '2026-11-02 15:00:00', ?)`,
    ).bind('send-sample-one', WORDS, NEWSLETTER_LIST_ID).run()
    const before = await env.DB.prepare('SELECT * FROM email_campaigns WHERE id = ?').bind('send-sample-one').first<Row>()
    const result = await save(writer, 'Sample from a send', { campaignId: 'send-sample-one' })
    expect(result).toHaveProperty('saved')
    if (!('saved' in result)) return
    const row = await rowOf(result.saved.id)
    expect(row.body_html).toBe(WORDS)
    expect(row.campaign_id).toBeNull()
    expect(await env.DB.prepare('SELECT * FROM email_campaigns WHERE id = ?').bind('send-sample-one').first<Row>()).toEqual(before)
    expect(await save(writer, 'Sample nowhere', { campaignId: 'not-a-send' })).toEqual({ notFound: true })
  })

  it('lists the shown templates newest first, for every writer alike, and never among the last newsletters', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_observer' })
    await openLetter(one)
    const a = await save(one, 'Sample first')
    const b = await save(two, 'Sample second')
    if (!('saved' in a) || !('saved' in b)) throw new Error('not saved')
    await env.DB.prepare(`UPDATE newsletter_issues SET pinned_at = '2026-11-20 10:00:00' WHERE id = ?`).bind(a.saved.id).run()
    const listed = await listTemplates(db(), NEWSLETTER_LIST_ID)
    expect(listed.map((t) => [t.name, t.by])).toEqual([['Sample second', 'Player'], ['Sample first', 'Player']])
    expect(await lastIssues(db(), NEWSLETTER_LIST_ID)).toEqual([])
  })

  it('renames and removes at the version read, keeps a removed one\'s words, and lists it nowhere after', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const saved = await save(writer, 'Sample old name')
    if (!('saved' in saved)) throw new Error('not saved')
    const { id } = saved.saved
    await save(writer, 'Sample other')

    expect(await renameTemplate(db(), { listId: NEWSLETTER_LIST_ID, id, version: 1, name: 'sample OTHER', by: writer })).toEqual({ refused: { status: 409, error: templateNameTaken('Sample other') } })
    const renamed = await renameTemplate(db(), { listId: NEWSLETTER_LIST_ID, id, version: 1, name: ' Sample new name ', by: writer })
    expect(renamed).toMatchObject({ saved: { id, name: 'Sample new name', version: 2 } })
    expect(await renameTemplate(db(), { listId: NEWSLETTER_LIST_ID, id, version: 1, name: 'Sample late', by: writer })).toMatchObject({ changed: { changedBy: 'Player One' } })

    expect(await removeTemplate(db(), { listId: NEWSLETTER_LIST_ID, id, version: 1, by: writer })).toMatchObject({ changed: {} })
    expect(await removeTemplate(db(), { listId: NEWSLETTER_LIST_ID, id, version: 2, by: writer })).toEqual({ removed: true })
    const row = await rowOf(id)
    expect(row).toMatchObject({ pinned_at: null, pinned_name: 'Sample new name', body_html: WORDS })
    expect((await listTemplates(db(), NEWSLETTER_LIST_ID)).map((t) => t.name)).toEqual(['Sample other'])
    expect(await lastIssues(db(), NEWSLETTER_LIST_ID)).toEqual([])
    expect(await removeTemplate(db(), { listId: NEWSLETTER_LIST_ID, id, version: 3, by: writer })).toEqual({ notFound: true })
  })

  it('starts a letter from a shown template, its words copied and the template left as it was; a removed one is not found', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const saved = await save(writer, 'Sample start')
    if (!('saved' in saved)) throw new Error('not saved')
    const before = await rowOf(saved.saved.id)
    const started = await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: { templateId: saved.saved.id }, monthLabel: MONTH, by: writer })
    expect(started).toMatchObject({ started: { letter: { bodyHtml: WORDS, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '' } } })
    expect(await rowOf(saved.saved.id)).toEqual(before)
    await removeTemplate(db(), { listId: NEWSLETTER_LIST_ID, id: saved.saved.id, version: 1, by: writer })
    expect(await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: { templateId: saved.saved.id }, monthLabel: MONTH, by: writer })).toEqual({ notFound: true })
    // A template's id is not a past letter's either.
    expect(await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: { issueId: saved.saved.id }, monthLabel: MONTH, by: writer })).toEqual({ notFound: true })
  })
})

let seq = 0
const person = (fullName: string, role = 'member') => seedMember({ fullName, email: `person-${++seq}@templates.test.lca`, role })

/** The four methods, each with a body it would take. */
const METHODS: ReadonlyArray<readonly [string, Handler, InvokeOptions]> = [
  ['GET .../templates', templatesGet, {}],
  ['POST .../templates', templatesPost, { method: 'POST', body: { name: 'Sample guard', bodyHtml: WORDS } }],
  ['PUT .../templates', templatesPut, { method: 'PUT', body: { id: 'sample-id', version: 1, name: 'Sample guard' } }],
  ['DELETE .../templates', templatesDelete, { method: 'DELETE', body: { id: 'sample-id', version: 1 } }],
]

describe('(b) who may use the saved templates', () => {
  it('answers 404 on each method while MAIL_PAGE_ON is unset, to everyone, reading no statement and making no sign-in call', async () => {
    flags.pageOn = false
    const admin = await seedAdmin()
    const president = await person('Player One', 'lca_observer')
    for (const [name, handler, options] of METHODS) {
      for (const as of [undefined, admin, president]) {
        const counting = countingDb()
        const calls = fetchCount
        const res = await invoke(handler, { ...options, as, env: { DB: counting.db } })
        expect(res.status, name).toBe(404)
        expect(await res.response.clone().text(), name).toBe(JSON.stringify({ error: 'Not found' }))
        expect(counting.ran, name).toEqual([])
        expect(fetchCount, name).toBe(calls)
      }
      if (handler !== templatesGet) {
        const raw = await invoke(handler, { ...options, body: undefined, as: admin, rawBody: 'not json {', headers: { 'Content-Type': 'application/json' } })
        expect(raw.status, name).toBe(404)
      }
    }
    expect(await rows()).toEqual([])
  })

  it('answers OPTIONS as its neighbours do, with or without the switch', async () => {
    for (const pageOn of [false, true]) {
      flags.pageOn = pageOn
      expect((await invoke(templatesOptions, { method: 'OPTIONS' })).status).toBe(204)
    }
  })

  it('lets in exactly the people who may send the newsletter, and refuses everyone else as part one\'s newsletter does, byte for byte, writing nothing', async () => {
    const seated = await person('Player Three')
    const seatedOfficer = await person('Player Four', 'lca_officer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [seated, seatedOfficer])
    const president = await person('Player Ten', 'lca_observer')
    await seedPresident(president)
    const people = [
      ['nobody signed in', undefined, 'aal2'],
      ['an LCA Observer without the President seat', await person('Player Eleven', 'lca_observer'), 'aal1'],
      ['the president without a second factor', president, 'aal1'],
      ['a plain member', await person('Player Five'), 'aal2'],
      ['an officer without the seat', await person('Player Six', 'lca_officer'), 'aal2'],
      ['a club rep', await person('Player Seven', 'club_rep'), 'aal2'],
      ['a tournament director', await person('Player Eight', 'tournament_director'), 'aal2'],
      ['an LCA auditor', await person('Player Nine', 'lca_auditor'), 'aal2'],
      ['an LCA admin without a second factor', await seedAdmin(), 'aal1'],
      ['the media manager without a second factor', seated, 'aal1'],
      ['an officer who holds the seat, without a second factor', seatedOfficer, 'aal1'],
      ['an LCA admin with a second factor', await seedAdmin(), 'aal2'],
      ['the president', president, 'aal2'],
      ['the media manager with a second factor', seated, 'aal2'],
      ['an officer who holds the seat, with a second factor', seatedOfficer, 'aal2'],
    ] as const
    const answered: string[] = []
    for (const [who, as, aal] of people) {
      const plain = await invoke(newsletterGet, { as, aal })
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      for (const [name, handler, options] of METHODS) {
        const res = await invoke(handler, { ...options, as, aal })
        if (plain.status === 200) {
          // The rename and remove of an id nobody saved are not found; the guard let them in.
          expect([200, 201, 404], `${who}: ${name}`).toContain(res.status)
          answered.push(who)
        } else {
          expect(res.status, `${who}: ${name}`).toBe(plain.status)
          expect(await res.response.clone().text(), `${who}: ${name}`).toBe(await plain.response.clone().text())
        }
      }
      if (plain.status !== 200) expect(await rows(), who).toEqual([])
    }
    expect([...new Set(answered)]).toEqual([
      'an LCA admin with a second factor', 'the president', 'the media manager with a second factor', 'an officer who holds the seat, with a second factor',
    ])
  })
})

describe('(c) the endpoint', () => {
  type Listed = { templates: Array<{ id: string; name: string; savedAt: string; by: string | null; version: number }> }
  const post = (as: string, body: unknown) => invoke(templatesPost, { method: 'POST', as, body })
  const list = async (as: string) => (await (await invoke(templatesGet, { as })).json<Listed>()).templates

  it('saves a copy of the open letter\'s words and of a past newsletter\'s, and every writer sees the same list', async () => {
    const one = await seedAdmin()
    const two = await person('Player Two', 'lca_observer')
    await seedPresident(two)
    const open = await openLetter(one)
    const before = await rowOf(open.id)

    const res = await post(one, { name: ' Sample monthly ', bodyHtml: '<p onclick="x()">Sample words.</p>' })
    expect(res.status).toBe(201)
    const { template } = await res.json<{ template: Listed['templates'][number] }>()
    expect(template).toMatchObject({ name: 'Sample monthly', version: 1 })
    expect((await rowOf(template.id)).body_html).toBe('<p>Sample words.</p>')
    expect(await rowOf(open.id)).toEqual(before)

    await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: 'blank', monthLabel: 'January 2027', by: one })
    const past = await post(two, { name: 'Sample past', from: { issueId: open.id } })
    expect(past.status).toBe(201)
    expect((await post(two, { name: 'Sample nowhere', from: { issueId: 'not-a-letter' } })).status).toBe(404)

    expect((await list(one)).map((t) => t.name)).toEqual(['Sample past', 'Sample monthly'])
    expect(await list(two)).toEqual(await list(one))
  })

  it('refuses in words a missing or long name, a taken one, no words, both sources at once, and the 41st, writing nothing', async () => {
    const admin = await seedAdmin()
    const refusal = async (body: unknown) => {
      const res = await post(admin, body)
      return { status: res.status, error: (await res.json<{ error: string }>()).error }
    }
    const fieldRefusal = async (body: unknown) => {
      const res = await post(admin, body)
      return { status: res.status, body: await res.json() }
    }
    const field = (words: string) => ({ status: 400, body: { error: 'Some fields are missing or not valid.', fields: { name: words } } })
    expect(await fieldRefusal({ name: '   ', bodyHtml: WORDS })).toEqual(field('Write a name for the template.'))
    expect(await fieldRefusal({ name: 'x'.repeat(61), bodyHtml: WORDS })).toEqual(field('Keep the template\'s name to 60 characters.'))
    expect(await refusal({ name: 'Sample', bodyHtml: '<p></p>' })).toEqual({ status: 400, error: TEMPLATE_EMPTY })
    expect((await refusal({ name: 'Sample', bodyHtml: WORDS, from: { issueId: 'a' } })).status).toBe(400)
    expect(await rows()).toEqual([])
    expect((await post(admin, { name: 'Sample one', bodyHtml: WORDS })).status).toBe(201)
    expect(await refusal({ name: 'SAMPLE one', bodyHtml: WORDS })).toEqual({ status: 409, error: templateNameTaken('Sample one') })
    for (let n = 2; n <= TEMPLATES_MAX; n += 1) await save(admin, `Sample ${n}`)
    expect(await refusal({ name: 'Sample more', bodyHtml: WORDS })).toEqual({ status: 409, error: TEMPLATES_FULL })
    expect(await rows()).toHaveLength(TEMPLATES_MAX)
  })

  it('renames and removes at the version read, answering a stale version with who and when, and a removed one no more', async () => {
    const admin = await seedAdmin()
    const saved = await save(admin, 'Sample old')
    if (!('saved' in saved)) throw new Error('not saved')
    const { id } = saved.saved
    await save(admin, 'Sample other')

    const renamed = await invoke(templatesPut, { method: 'PUT', as: admin, body: { id, version: 1, name: 'Sample new' } })
    expect(renamed.status).toBe(200)
    expect(await renamed.json()).toMatchObject({ template: { id, name: 'Sample new', version: 2 } })
    const taken = await invoke(templatesPut, { method: 'PUT', as: admin, body: { id, version: 2, name: 'sample other' } })
    expect([taken.status, (await taken.json<{ error: string }>()).error]).toEqual([409, templateNameTaken('Sample other')])
    const stale = await invoke(templatesDelete, { method: 'DELETE', as: admin, body: { id, version: 1 } })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: TEMPLATE_CHANGED, changedBy: expect.any(String), changedAt: expect.any(String) })

    const removed = await invoke(templatesDelete, { method: 'DELETE', as: admin, body: { id, version: 2 } })
    expect([removed.status, await removed.json()]).toEqual([200, { removed: true }])
    expect((await list(admin)).map((t) => t.name)).toEqual(['Sample other'])
    expect((await invoke(templatesDelete, { method: 'DELETE', as: admin, body: { id, version: 3 } })).status).toBe(404)
    expect((await invoke(templatesPut, { method: 'PUT', as: admin, body: { id, version: 3, name: 'Sample back' } })).status).toBe(404)
  })

  it('starts a letter from a saved template through issue/start, and the last newsletters never list a template', async () => {
    const admin = await seedAdmin()
    const saved = await save(admin, 'Sample start')
    if (!('saved' in saved)) throw new Error('not saved')
    const res = await invoke(startPost, { method: 'POST', as: admin, body: { from: { templateId: saved.saved.id }, monthLabel: MONTH } })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ issue: { bodyHtml: WORDS, monthLabel: MONTH }, state: 'draft' })
    const last = async () => (await (await invoke(issuesGet, { as: admin })).json<{ issues: unknown[] }>()).issues
    expect(await last()).toEqual([])
    await removeTemplate(db(), { listId: NEWSLETTER_LIST_ID, id: saved.saved.id, version: 1, by: admin })
    expect(await last()).toEqual([])
    const gone = await invoke(startPost, { method: 'POST', as: admin, body: { from: { templateId: saved.saved.id }, monthLabel: MONTH } })
    expect(gone.status).toBe(404)
  })

  it('takes hidden marks out of a name and joins its accents, so names a person reads alike are one, and marks alone are no name', async () => {
    const admin = await seedAdmin()
    const field = (words: string) => ({ error: 'Some fields are missing or not valid.', fields: { name: words } })
    expect((await post(admin, { name: 'Sample', bodyHtml: WORDS })).status).toBe(201)
    for (const name of ['Sample\u200B', '\u200BSample', 'Sam\u00ADple', 'Sample\u2060', '\uFEFFSample', 'Sample\u200E', '\u200FSample', 'Sample\u200C']) {
      const res = await post(admin, { name, bodyHtml: WORDS })
      expect([JSON.stringify(name), res.status, (await res.json<{ error: string }>()).error]).toEqual([JSON.stringify(name), 409, templateNameTaken('Sample')])
    }
    for (const name of ['\u200B', '\u00AD', ' \u2060 ', '\u200D', '\u200E', '\u061C', '\u180E', '\u115F', '\u3164', '\u2800']) {
      const res = await post(admin, { name, bodyHtml: WORDS })
      expect([JSON.stringify(name), res.status, await res.json()]).toEqual([JSON.stringify(name), 400, field('Write a name for the template.')])
    }
    const composed = await post(admin, { name: 'Cafe\u0301 night', bodyHtml: WORDS })
    expect(composed.status).toBe(201)
    expect((await composed.json<{ template: { name: string } }>()).template.name).toBe('Caf\u00E9 night')
    expect((await post(admin, { name: 'Caf\u00E9 night', bodyHtml: WORDS })).status).toBe(409)
    expect((await list(admin)).map((t) => t.name)).toEqual(['Caf\u00E9 night', 'Sample'])
  })

  it('keeps every template door off rows that are not templates: the open letter, a set aside letter and a sent one', async () => {
    const admin = await seedAdmin()
    const aside = await openLetter(admin)
    await startIssue(db(), { listId: NEWSLETTER_LIST_ID, from: 'blank', monthLabel: 'January 2027', by: admin })
    await env.DB.prepare(
      `INSERT INTO newsletter_issues (id, list_id, month_label, subject, body_html, campaign_id)
       VALUES ('sent-sample-one', ?1, 'November 2026', 'Sample sent subject', ?2, 'send-sample-two')`,
    ).bind(NEWSLETTER_LIST_ID, WORDS).run()
    const template = await save(admin, 'Sample kept')
    if (!('saved' in template)) throw new Error('not saved')
    const before = await rows()
    const open = before.find((row) => row.campaign_id === null && row.set_aside_at === null)!
    expect([open.id, before.find((row) => row.id === aside.id)!.set_aside_at]).not.toContain(null)
    for (const row of [open, await rowOf(aside.id), await rowOf('sent-sample-one')]) {
      const which = { id: row.id, version: row.version }
      expect((await invoke(templatesPut, { method: 'PUT', as: admin, body: { ...which, name: 'Sample taken over' } })).status).toBe(404)
      expect((await invoke(templatesDelete, { method: 'DELETE', as: admin, body: which })).status).toBe(404)
      expect((await invoke(startPost, { method: 'POST', as: admin, body: { from: { templateId: row.id }, monthLabel: MONTH } })).status).toBe(404)
    }
    expect((await post(admin, { name: 'Sample twice', from: { issueId: template.saved.id } })).status).toBe(404)
    expect(await rows()).toEqual(before)
  })
})
