// test/integration/newsletter-issues.test.ts
//
// The newsletter's own page, page step 3 of WS16 part two: where a letter
// lives while it is written, through the real handlers, the real guard
// (requireListMailer) and the real cleaner (cleanLetterHtml), on the D1
// database every integration test builds from the migrations, 0061 among
// them. MAIL_PAGE_ON, MAIL_LISTS_ON and the module's other constants are read
// through getters on the mocked functions/utils/mail/switches, set before
// every case. Nothing here reaches an outside service: the harness answers
// the sign-in service, and nothing is sent.
//
// - (a) With MAIL_PAGE_ON unset each of the four methods answers 404 before
//   it reads the request, the session or the database: no statement, no
//   sign-in call, and a body that is not JSON is not read.
// - (b) Who may: each method lets in exactly the people requireListMailer
//   lets send the newsletter, answering everyone else as part one's GET
//   /api/admin/mail/newsletter answers them, byte for byte, writing nothing.
// - (c) Saving: the stored letter is the cleaner's own output, never the
//   input; each refusal in words, in the order of the checks, with nothing
//   written; an old version, a letter sent or set aside meanwhile, and two
//   first saves at once are answered with who and when, losing nothing; the
//   table holds no mark of a test; a save writes nothing else.
// - (d) Starting: a blank letter and LCA's starters, a past letter and a
//   newsletter sent from the plain tab, cleaned as copied; the open letter
//   set aside when it holds words, reused when it holds none, a starter
//   nobody wrote in, or a copy of one, among them; another list's letter or
//   send not found; no row ever deleted; a start against a save.
// - (e) The last letters: sent letters, letters set aside and plain sends,
//   newest first, at most 20, without their words or any reader's address.
// - (f) Closing an account whose holder wrote a letter.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { letterParts, LETTER_MAX_BYTES, STARTER_IDS, STARTERS, defaultSubject } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as newsletterGet } from '../../functions/api/admin/mail/newsletter'
import { onRequestGet as issueGet, onRequestOptions as issueOptions, onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestOptions as startOptions, onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet, onRequestOptions as issuesOptions } from '../../functions/api/admin/mail/newsletter/issues'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR } from '../../functions/utils/auth'
import {
  CHANGED_SINCE_READ,
  CHANGED_WHILE_STARTING,
  LETTER_INPUT_MAX_BYTES,
  LETTER_NOT_CLEAN,
  LETTER_STARTS_SMALL,
  LETTER_TOO_LONG,
  SENT_SINCE_READ,
  SET_ASIDE_SINCE_READ,
  SOURCE_NOT_CLEAN,
  holdsWords,
  starterLetter,
} from '../../functions/utils/mail/issues'
import { cleanLetterHtml } from '../../functions/utils/mail/letterClean'
import { seedAdmin, seedMember, seedSeat } from './factories'
import { emailOutbox, fetchCount, invoke, resetHarness, type InvokeOptions } from './harness'
import { countingDb } from './mailRuns'

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

type Handler = Parameters<typeof invoke>[0]
type Row = Record<string, unknown>

const MONTH = 'December 2026'
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'
const OTHER_LIST = 'lca-tournaments'

let seq = 0
const address = (name: string) => `${name}-${++seq}@issues.test.lca`
const person = (fullName: string, role = 'member') => seedMember({ fullName, email: address('person'), role })

/** A save's body: the letter read (id null for none), its version, and the four fields, each as a page would send them. */
const saveBody = (over: Partial<{ id: string | null; version: number; monthLabel: string; subject: string; preheader: string; bodyHtml: string }> = {}) => ({
  id: null, version: 0, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: LETTER, ...over,
})
const save = (as: string, over: Parameters<typeof saveBody>[0] = {}, opts: InvokeOptions = {}) =>
  invoke(issuePut, { method: 'PUT', as, body: saveBody(over), ...opts })
const start = (as: string, from: unknown, monthLabel = MONTH, opts: InvokeOptions = {}) =>
  invoke(startPost, { method: 'POST', as, body: { from, monthLabel }, ...opts })

const rows = async () => (await env.DB.prepare('SELECT * FROM newsletter_issues ORDER BY rowid').all<Row>()).results
const rowOf = async (id: string) => (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(id).first<Row>())!
const openRows = async () => (await rows()).filter((r) => r.campaign_id === null && r.set_aside_at === null)
const nameOf = async (id: string) => (await env.DB.prepare('SELECT full_name FROM members WHERE id = ?').bind(id).first<{ full_name: string }>())!.full_name

/** Every other table a save or a start could write, counted, and the outbox. */
async function traces() {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    recipients: await count('SELECT COUNT(*) AS n FROM email_campaign_recipients'),
    contacts: await count('SELECT COUNT(*) AS n FROM mail_contacts'),
    choices: await count('SELECT COUNT(*) AS n FROM mail_list_choices'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
    members: await count('SELECT COUNT(*) AS n FROM members'),
    sent: emailOutbox.length,
  }
}

/** A send on a list as the plain tab makes one: a campaign row with its words, its sender, its count and its time. */
async function seedSend(opts: { id: string; listId?: string | null; body?: string; by?: string | null; at?: string; status?: string; total?: number; subject?: string }) {
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, created_at, list_id)
     VALUES (?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)`,
  ).bind(
    opts.id, opts.subject ?? 'Sample newsletter one', opts.body ?? '<p>Sample words sent from the plain tab.</p>', opts.total ?? 3, opts.total ?? 3,
    opts.status ?? 'completed', opts.by ?? null, opts.at ?? '2026-11-02 15:00:00', opts.listId === undefined ? NEWSLETTER_LIST_ID : opts.listId,
  ).run()
}

/** A letter written straight into the table, for the states the page's own methods cannot reach yet. */
async function seedLetter(opts: { id: string; listId?: string; body?: string; by?: string | null; month?: string; subject?: string; campaignId?: string | null; setAsideAt?: string | null; updatedAt?: string; version?: number }) {
  await env.DB.prepare(
    `INSERT INTO newsletter_issues (id, list_id, month_label, subject, body_html, version, created_by, updated_by, updated_at, campaign_id, set_aside_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    opts.id, opts.listId ?? NEWSLETTER_LIST_ID, opts.month ?? 'November 2026', opts.subject ?? 'Sample subject one', opts.body ?? LETTER, opts.version ?? 1,
    opts.by ?? null, opts.by ?? null, opts.updatedAt ?? '2026-11-01 15:00:00', opts.campaignId ?? null, opts.setAsideAt ?? null,
  ).run()
}

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

/** The four methods, each with a body it would take, and the three OPTIONS answers. */
const METHODS: ReadonlyArray<readonly [string, Handler, InvokeOptions]> = [
  ['GET /api/admin/mail/newsletter/issue', issueGet, {}],
  ['PUT /api/admin/mail/newsletter/issue', issuePut, { method: 'PUT', body: saveBody() }],
  ['POST /api/admin/mail/newsletter/issue/start', startPost, { method: 'POST', body: { from: 'blank', monthLabel: MONTH } }],
  ['GET /api/admin/mail/newsletter/issues', issuesGet, {}],
]

describe('(a) with MAIL_PAGE_ON unset', () => {
  it('answers 404 { error: \'Not found\' } on each method, to everyone, reading no statement, making no sign-in call and writing nothing', async () => {
    flags.pageOn = false
    const admin = await seedAdmin()
    const president = await person('Player One', 'lca_observer')
    const holder = await person('Player Two')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const before = { rows: await rows(), traces: await traces() }
    for (const listsOn of [true, false]) {
      flags.listsOn = listsOn
      for (const [name, handler, options] of METHODS) {
        for (const as of [undefined, admin, president, holder]) {
          for (const aal of ['aal2', 'aal1'] as const) {
            const counting = countingDb()
            const calls = fetchCount
            const res = await invoke(handler, { ...options, as, aal, env: { DB: counting.db } })
            const where = `${name}, ${as ?? 'signed out'}, ${aal}, lists ${listsOn}`
            expect(res.status, where).toBe(404)
            expect(await res.response.clone().text(), where).toBe(JSON.stringify({ error: 'Not found' }))
            expect(counting.ran, where).toEqual([])
            expect(fetchCount, where).toBe(calls)
          }
        }
      }
    }
    expect({ rows: await rows(), traces: await traces() }).toEqual(before)
  })

  it('does not read the body: one that is not JSON, and one too long to clean, are answered 404 the same', async () => {
    flags.pageOn = false
    const admin = await seedAdmin()
    for (const handler of [issuePut, startPost]) {
      for (const rawBody of ['not json {', 'x'.repeat(LETTER_INPUT_MAX_BYTES + 10)]) {
        const res = await invoke(handler, { method: handler === issuePut ? 'PUT' : 'POST', as: admin, rawBody, headers: { 'Content-Type': 'application/json' } })
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: 'Not found' })
      }
    }
  })

  it('reads no statement even against a database 0061 has not reached', async () => {
    flags.pageOn = false
    const admin = await seedAdmin()
    for (const [name, handler, options] of METHODS) {
      const counting = countingDb({ refuse: 'newsletter_issues' })
      const res = await invoke(handler, { ...options, as: admin, env: { DB: counting.db } })
      expect(res.status, name).toBe(404)
      expect(counting.ran, name).toEqual([])
    }
  })

  it('answers OPTIONS as its neighbours do, with or without the switch', async () => {
    for (const pageOn of [false, true]) {
      flags.pageOn = pageOn
      for (const handler of [issueOptions, startOptions, issuesOptions]) {
        const res = await invoke(handler, { method: 'OPTIONS' })
        expect(res.status).toBe(204)
      }
    }
  })
})

describe('(b) who may: the people requireListMailer lets send the newsletter, and nobody else', () => {
  /** Everyone the guard tells apart, each with the assurance level of their session. */
  async function people() {
    const seated = await person('Player Three')
    const seatedOfficer = await person('Player Four', 'lca_officer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [seated, seatedOfficer])
    return [
      ['nobody signed in', undefined, 'aal2'],
      ['a plain member', await person('Player Five'), 'aal2'],
      ['an officer without the seat', await person('Player Six', 'lca_officer'), 'aal2'],
      ['a club rep', await person('Player Seven', 'club_rep'), 'aal2'],
      ['a tournament director', await person('Player Eight', 'tournament_director'), 'aal2'],
      ['an LCA auditor', await person('Player Nine', 'lca_auditor'), 'aal2'],
      ['an LCA admin without a second factor', await seedAdmin(), 'aal1'],
      ['the media manager without a second factor', seated, 'aal1'],
      ['an officer who holds the seat, without a second factor', seatedOfficer, 'aal1'],
      ['an LCA admin with a second factor', await seedAdmin(), 'aal2'],
      ['the president', await person('Player Ten', 'lca_observer'), 'aal1'],
      ['the media manager with a second factor', seated, 'aal2'],
      ['an officer who holds the seat, with a second factor', seatedOfficer, 'aal2'],
    ] as const
  }

  it('answers each person on each method as part one\'s newsletter answers them: refused alike, byte for byte, or let in', async () => {
    const answered: string[] = []
    for (const [who, as, aal] of await people()) {
      const plain = await invoke(newsletterGet, { as, aal })
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const before = { rows: await rows(), traces: await traces() }
      for (const [name, handler, options] of METHODS) {
        const res = await invoke(handler, { ...options, as, aal })
        if (plain.status === 200) {
          expect([200, 201], `${who}: ${name}`).toContain(res.status)
          answered.push(who)
        } else {
          expect(res.status, `${who}: ${name}`).toBe(plain.status)
          expect(await res.response.clone().text(), `${who}: ${name}`).toBe(await plain.response.clone().text())
        }
      }
      if (plain.status !== 200) expect({ rows: await rows(), traces: await traces() }, who).toEqual(before)
    }
    expect([...new Set(answered)]).toEqual([
      'an LCA admin with a second factor', 'the president', 'the media manager with a second factor', 'an officer who holds the seat, with a second factor',
    ])
  })

  it('gives the refusals their own words: 401 signed out, LIST_MAILERS_ONLY, and the second factor\'s 403 with mfaRequired', async () => {
    const list = await people()
    const answer = async (who: string) => {
      const found = list.find(([w]) => w === who)!
      const res = await invoke(issueGet, { as: found[1], aal: found[2] })
      return { status: res.status, body: await res.json() }
    }
    expect(await answer('nobody signed in')).toEqual({ status: 401, body: { error: 'Unauthorized' } })
    for (const who of ['a plain member', 'an officer without the seat', 'a club rep', 'a tournament director', 'an LCA auditor']) {
      expect(await answer(who), who).toEqual({ status: 403, body: { error: LIST_MAILERS_ONLY } })
    }
    for (const who of ['the media manager without a second factor', 'an officer who holds the seat, without a second factor']) {
      expect(await answer(who), who).toEqual({ status: 403, body: { error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true } })
    }
    expect((await answer('an LCA admin without a second factor')).body.mfaRequired).toBe(true)
  })

  it('refuses the media manager, an officer who holds the seat among them, with the guard\'s own words while MAIL_LISTS_ON is unset', async () => {
    flags.listsOn = false
    const holder = await person('Player Three', 'lca_officer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const admin = await seedAdmin()
    for (const [name, handler, options] of METHODS) {
      const res = await invoke(handler, { ...options, as: holder })
      expect(res.status, name).toBe(403)
      expect(await res.json(), name).toEqual({ error: 'Group email is limited to admins and the LCA Observer' })
      expect([200, 201], name).toContain((await invoke(handler, { ...options, as: admin })).status)
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
    }
  })
})

describe('(c) saving', () => {
  it('makes the open letter on the first save, at version 1, and reads it back with who saved it and when', async () => {
    const admin = await seedAdmin()
    expect(await (await invoke(issueGet, { as: admin })).json()).toEqual({ issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null })
    const res = await save(admin, { preheader: 'Sample preview line' })
    expect(res.status).toBe(200)
    const saved = await res.json<{ id: string; version: number; savedAt: string; bodyHtml: string | null }>()
    expect(saved.version).toBe(1)
    expect(saved.bodyHtml).toBeNull()
    const row = await rowOf(saved.id)
    expect(row).toMatchObject({ list_id: NEWSLETTER_LIST_ID, month_label: MONTH, subject: defaultSubject(MONTH), preheader: 'Sample preview line', body_html: LETTER, version: 1, created_by: admin, updated_by: admin })
    expect(saved.savedAt).toBe(row.updated_at)
    const read = await (await invoke(issueGet, { as: admin })).json<Row>()
    expect(read).toEqual({
      issue: { id: saved.id, version: 1, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: 'Sample preview line', bodyHtml: LETTER, createdAt: row.created_at, updatedAt: row.updated_at },
      state: 'draft', lastSavedBy: await nameOf(admin), lastSavedAt: row.updated_at,
    })
  })

  it('stores the cleaner\'s own output, never the input, and gives it back only when the cleaner changed what was sent', async () => {
    const admin = await seedAdmin()
    const input = '<h2 class="x" onclick="alert(1)">Sample heading one</h2><p>Example <b>words</b> <img src=x onerror=alert(1)><a href="javascript:alert(1)">here</a> and <a href="https://example.org" target="_blank" rel="noopener">there</a>.</p><script>alert(1)</script><textarea><img src=x onerror=alert(1)></textarea>'
    const cleaned = await cleanLetterHtml(input)
    expect(cleaned).not.toBeNull()
    expect(cleaned).not.toBe(input)
    const res = await save(admin, { bodyHtml: input })
    expect(res.status).toBe(200)
    const saved = await res.json<{ id: string; version: number; bodyHtml: string | null }>()
    expect(saved.bodyHtml).toBe(cleaned)
    const stored = (await rowOf(saved.id)).body_html as string
    expect(stored).toBe(cleaned)
    expect(stored).toBe('<h2>Sample heading one</h2><p>Example words here and <a href="https://example.org">there</a>.</p>')
    for (const live of ['onclick', 'onerror', 'javascript:', '<script', '<img', '<textarea', 'target=', 'rel=', 'class=']) expect(stored, live).not.toContain(live)
    // Saved again as it is stored, the letter comes back as null: the page holds what is kept.
    const again = await save(admin, { id: saved.id, version: saved.version, bodyHtml: stored })
    expect(again.status).toBe(200)
    expect((await again.json<{ bodyHtml: string | null; version: number }>())).toMatchObject({ bodyHtml: null, version: 2 })
  })

  it('moves the version by one at each save, names who saved it last, and keeps who started it', async () => {
    const admin = await seedAdmin()
    const president = await person('Player One', 'lca_observer')
    const first = await (await save(admin)).json<{ id: string; version: number }>()
    const second = await save(president, { id: first.id, version: 1, bodyHtml: `${LETTER}<p>More sample words.</p>` }, { aal: 'aal1' })
    expect(second.status).toBe(200)
    expect((await second.json<{ version: number }>()).version).toBe(2)
    expect(await rowOf(first.id)).toMatchObject({ version: 2, created_by: admin, updated_by: president, body_html: `${LETTER}<p>More sample words.</p>` })
    expect((await (await invoke(issueGet, { as: admin })).json<{ lastSavedBy: string }>()).lastSavedBy).toBe('Player One')
  })

  it('trims the three plain fields, and lets each be empty while the letter is written', async () => {
    const admin = await seedAdmin()
    const saved = await (await save(admin, { monthLabel: '  December 2026 ', subject: ' Sample subject one  ', preheader: '  ' })).json<{ id: string }>()
    expect(await rowOf(saved.id)).toMatchObject({ month_label: 'December 2026', subject: 'Sample subject one', preheader: '' })
    const empty = await (await save(admin, { id: saved.id, version: 1, monthLabel: '', subject: '', preheader: '', bodyHtml: '' })).json<{ version: number }>()
    expect(empty.version).toBe(2)
    expect(await rowOf(saved.id)).toMatchObject({ month_label: '', subject: '', preheader: '', body_html: '' })
  })

  it('refuses in words, with nothing written, a line break or any other control character in a plain field, and a field over its limit', async () => {
    const admin = await seedAdmin()
    const saved = await (await save(admin)).json<{ id: string }>()
    const before = await rows()
    const refusals: Array<[string, Record<string, string>, string]> = [
      ['subject', { subject: 'Sample subject\r\nBcc: someone@example.org' }, 'Write the subject on one line, with no line break, tab or other hidden character.'],
      ['subject', { subject: 'Sample\tsubject' }, 'Write the subject on one line, with no line break, tab or other hidden character.'],
      ['subject', { subject: `Sample${String.fromCharCode(0)}subject` }, 'Write the subject on one line, with no line break, tab or other hidden character.'],
      ['subject', { subject: `Sample${String.fromCharCode(0x85)}subject` }, 'Write the subject on one line, with no line break, tab or other hidden character.'],
      ['subject', { subject: `Sample${String.fromCharCode(0x2028)}subject` }, 'Write the subject on one line, with no line break, tab or other hidden character.'],
      ['monthLabel', { monthLabel: 'December\n2026' }, 'Write the month on one line, with no line break, tab or other hidden character.'],
      ['preheader', { preheader: `Sample${String.fromCharCode(0x7f)}line` }, 'Write the inbox preview line on one line, with no line break, tab or other hidden character.'],
      ['subject', { subject: 's'.repeat(201) }, 'Keep the subject to 200 characters.'],
      ['monthLabel', { monthLabel: 'm'.repeat(41) }, 'Keep the month to 40 characters.'],
      ['preheader', { preheader: 'p'.repeat(151) }, 'Keep the inbox preview line to 150 characters.'],
    ]
    for (const [field, over, words] of refusals) {
      const res = await save(admin, { id: saved.id, version: 1, ...over })
      expect(res.status, JSON.stringify(over)).toBe(400)
      expect(await res.json(), JSON.stringify(over)).toEqual({ error: 'Some fields are missing or not valid.', fields: { [field]: words } })
    }
    // At their limits the three pass.
    const ok = await save(admin, { id: saved.id, version: 1, subject: 's'.repeat(200), monthLabel: 'm'.repeat(40), preheader: 'p'.repeat(150) })
    expect(ok.status).toBe(200)
    expect((await rows()).map((r) => r.id)).toEqual(before.map((r) => r.id))
  })

  it('refuses a letter over 240,000 bytes before cleaning it, so the bound answers even a letter the cleaner would refuse', async () => {
    const admin = await seedAdmin()
    expect(LETTER_INPUT_MAX_BYTES).toBe(3 * LETTER_MAX_BYTES)
    const before = { rows: await rows(), traces: await traces() }
    // An "é" is two bytes, so this letter is under the bound in characters and over it in bytes.
    const wide = `<p>${'é'.repeat(120_000)}</p>`
    expect(wide.length).toBeLessThan(LETTER_INPUT_MAX_BYTES)
    for (const bodyHtml of [wide, `<p>${'a'.repeat(LETTER_INPUT_MAX_BYTES)}</p><textarea>`]) {
      const res = await save(admin, { bodyHtml })
      expect(res.status).toBe(413)
      expect(await res.json()).toEqual({ error: LETTER_TOO_LONG })
    }
    expect({ rows: await rows(), traces: await traces() }).toEqual(before)
  })

  it('refuses in words a letter the cleaner answers null for, with nothing written', async () => {
    const admin = await seedAdmin()
    const before = { rows: await rows(), traces: await traces() }
    for (const bodyHtml of ['<p>Sample</p><textarea>', '<p>Sample</p><plaintext><p>more', '<p>Sample</p></div>', '<p>Sample</p><', '<p>Sample <a href="https://example.org']) {
      expect(await cleanLetterHtml(bodyHtml), bodyHtml).toBeNull()
      const res = await save(admin, { bodyHtml })
      expect(res.status, bodyHtml).toBe(400)
      expect(await res.json(), bodyHtml).toEqual({ error: LETTER_NOT_CLEAN })
    }
    expect({ rows: await rows(), traces: await traces() }).toEqual(before)
  })

  it('holds the cleaned letter to LETTER_MAX_BYTES, one that cleaning makes longer among them', async () => {
    const admin = await seedAdmin()
    const at = (bytes: number) => `<p>${'a'.repeat(bytes - '<p></p>'.length)}</p>`
    const atCap = await save(admin, { bodyHtml: at(LETTER_MAX_BYTES) })
    expect(atCap.status).toBe(200)
    const { id } = await atCap.json<{ id: string }>()
    const over = await save(admin, { id, version: 1, bodyHtml: at(LETTER_MAX_BYTES + 1) })
    expect(over.status).toBe(413)
    expect(await over.json()).toEqual({ error: LETTER_TOO_LONG })
    // Under the cap as sent, over it once each list item left open is closed: 49 bytes a list, 99 once cleaned.
    const growing = `<ul>${'<li>'.repeat(10)}</ul>`.repeat(1_000)
    expect(new TextEncoder().encode(growing).byteLength).toBeLessThan(LETTER_MAX_BYTES)
    const cleaned = await cleanLetterHtml(growing)
    expect(cleaned).not.toBeNull()
    expect(new TextEncoder().encode(cleaned!).byteLength).toBeGreaterThan(LETTER_MAX_BYTES)
    const grown = await save(admin, { id, version: 1, bodyHtml: growing })
    expect(grown.status).toBe(413)
    expect(await grown.json()).toEqual({ error: LETTER_TOO_LONG })
    expect((await rowOf(id)).version).toBe(1)
  })

  it('refuses a letter whose first heading is a smaller one, and keeps one that starts with a main heading or with words', async () => {
    const admin = await seedAdmin()
    for (const bodyHtml of ['<h3>Sample smaller heading</h3><h2>Sample heading one</h2>', '<p>Sample words</p><h3>Sample smaller heading</h3>', '<h4>Sample heading four</h4><p>words</p>', '<h3></h3><p>x</p>']) {
      const res = await save(admin, { bodyHtml })
      expect(res.status, bodyHtml).toBe(400)
      expect(await res.json(), bodyHtml).toEqual({ error: LETTER_STARTS_SMALL })
    }
    expect(await rows()).toEqual([])
    for (const bodyHtml of ['<h2>Sample heading one</h2><h3>Sample smaller heading</h3>', '<p>Sample words and no heading</p>', '<h1>Sample heading one</h1><h4>Sample smaller heading</h4>']) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      expect((await save(admin, { bodyHtml })).status, bodyHtml).toBe(200)
    }
  })

  it('refuses an old version with 409, the other person\'s name and the time, and writes nothing, so nothing is lost', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(one)).json<{ id: string }>()
    const theirs = `${LETTER}<p>Player Two's sample words.</p>`
    expect((await save(two, { id: made.id, version: 1, bodyHtml: theirs })).status).toBe(200)
    const stored = await rowOf(made.id)
    const res = await save(one, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>Player One's later sample words.</p>` })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: CHANGED_SINCE_READ, reason: 'changed', changedBy: 'Player Two', changedAt: stored.updated_at })
    expect(await rowOf(made.id)).toEqual(stored)
    expect(JSON.stringify(await rows())).not.toContain('later sample words')
    // A version from the future is refused the same way.
    expect((await save(one, { id: made.id, version: 9 })).status).toBe(409)
  })

  it('refuses a save to a letter sent meanwhile, naming who sent it and when, and one set aside meanwhile, naming who set it aside and when', async () => {
    const sender = await seedMember({ fullName: 'Player Three', role: 'lca_admin' })
    const writer = await seedAdmin()
    await seedSend({ id: 'campaign-sample-one', by: sender, at: '2026-11-13 16:05:00' })
    await seedLetter({ id: 'issue-sent', campaignId: 'campaign-sample-one', by: writer })
    const sent = await save(writer, { id: 'issue-sent', version: 1 })
    expect(sent.status).toBe(409)
    expect(await sent.json()).toEqual({ error: SENT_SINCE_READ, reason: 'sent', changedBy: 'Player Three', changedAt: '2026-11-13 16:05:00' })

    const made = await (await save(writer)).json<{ id: string }>()
    const starter = await seedMember({ fullName: 'Player Four', role: 'lca_admin' })
    expect((await start(starter, 'monthly')).status).toBe(201)
    const aside = await rowOf(made.id)
    expect(aside.set_aside_at).not.toBeNull()
    const res = await save(writer, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>Sample words written meanwhile.</p>` })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SET_ASIDE_SINCE_READ, reason: 'set_aside', changedBy: 'Player Four', changedAt: aside.set_aside_at })
    expect(await rowOf(made.id)).toEqual(aside)
    expect((await rowOf('issue-sent')).version).toBe(1)
  })

  it('answers a letter that is not the newsletter\'s, or none at all, as not found, with nothing written', async () => {
    const admin = await seedAdmin()
    await seedLetter({ id: 'issue-other-list', listId: OTHER_LIST })
    const other = await save(admin, { id: 'issue-other-list', version: 1 })
    const none = await save(admin, { id: 'issue-nowhere', version: 1 })
    for (const res of [other, none]) {
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
    expect((await rowOf('issue-other-list')).version).toBe(1)
  })

  it('makes one letter from two first saves at once: the other is answered as an old version, with the winner\'s name and time', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    for (let round = 0; round < 4; round += 1) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const [a, b] = await Promise.all([save(one, { bodyHtml: `${LETTER}<p>Sample words one.</p>` }), save(two, { bodyHtml: `${LETTER}<p>Sample words two.</p>` })])
      expect([a.status, b.status].sort()).toEqual([200, 409])
      const [won, lost] = a.status === 200 ? [a, b] : [b, a]
      const winner = await rowOf((await won.json<{ id: string }>()).id)
      expect(await rows()).toHaveLength(1)
      expect(await lost.json()).toEqual({ error: CHANGED_SINCE_READ, reason: 'changed', changedBy: await nameOf(winner.created_by as string), changedAt: winner.updated_at })
    }
  })

  it('takes one of two saves of the same version at once, and answers the other 409 with nothing written', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(one)).json<{ id: string }>()
    const [a, b] = await Promise.all([
      save(one, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>Sample words one.</p>` }),
      save(two, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>Sample words two.</p>` }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const row = await rowOf(made.id)
    expect(row.version).toBe(2)
    expect(row.body_html).toBe(a.status === 200 ? `${LETTER}<p>Sample words one.</p>` : `${LETTER}<p>Sample words two.</p>`)
  })

  it('holds no mark of a test: the table\'s columns are the twenty named, none of them a test\'s, and a save writes no other table', async () => {
    const admin = await seedAdmin()
    const columns = (await env.DB.prepare(`SELECT name FROM pragma_table_info('newsletter_issues')`).all<{ name: string }>()).results.map((c) => c.name)
    expect(columns).toEqual([
      'id', 'list_id', 'month_label', 'subject', 'preheader', 'body_html', 'version', 'created_by', 'created_at', 'updated_by', 'updated_at',
      'campaign_id', 'set_aside_at', 'send_at', 'scheduled_by', 'scheduled_at', 'link_check', 'held_reason', 'pinned_at', 'pinned_name',
    ])
    expect(columns.filter((c) => /test/i.test(c))).toEqual([])
    const before = await traces()
    const made = await (await save(admin)).json<{ id: string }>()
    await save(admin, { id: made.id, version: 1, bodyHtml: `${LETTER}<p>More sample words.</p>` })
    expect(await traces()).toEqual(before)
    const row = await rowOf(made.id)
    for (const column of ['campaign_id', 'set_aside_at', 'send_at', 'scheduled_by', 'scheduled_at', 'link_check', 'held_reason', 'pinned_at', 'pinned_name']) expect(row[column], column).toBeNull()
  })

  it('refuses a body its contract does not take with the field errors, before cleaning anything', async () => {
    const admin = await seedAdmin()
    for (const [body, field] of [
      [{ ...saveBody(), bodyHtml: 3 }, 'bodyHtml'], [{ ...saveBody(), version: -1 }, 'version'], [{ ...saveBody(), version: 1.5 }, 'version'],
      [{ ...saveBody(), id: 7 }, 'id'], [{ ...saveBody(), subject: 3 }, 'subject'],
    ] as const) {
      const res = await invoke(issuePut, { method: 'PUT', as: admin, body })
      expect(res.status).toBe(400)
      expect(Object.keys((await res.json<{ fields: Record<string, string> }>()).fields)).toEqual([field])
    }
    expect(await rows()).toEqual([])
  })
})

describe('(d) starting a letter', () => {
  it('starts a blank letter with no open letter: its month, that month\'s subject, an empty preview line and no words', async () => {
    const admin = await seedAdmin()
    const res = await start(admin, 'blank', ' January 2027 ')
    expect(res.status).toBe(201)
    const body = await res.json<{ issue: Row; state: string; lastSavedBy: string }>()
    expect(body.state).toBe('draft')
    expect(body.issue).toMatchObject({ version: 1, monthLabel: 'January 2027', subject: defaultSubject('January 2027'), preheader: '', bodyHtml: '' })
    expect(body.lastSavedBy).toBe(await nameOf(admin))
    expect(await rows()).toHaveLength(1)
  })

  it('starts from each of LCA\'s starters: its headings as the letter\'s parts, each over an empty paragraph, as the cleaner keeps them', async () => {
    const admin = await seedAdmin()
    for (const id of STARTER_IDS) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const body = await (await start(admin, id)).json<{ issue: { bodyHtml: string } }>()
      const expected = STARTERS[id].headings.map((h) => `<h2>${h}</h2><p></p>`).join('')
      expect(body.issue.bodyHtml, id).toBe(expected)
      expect(await cleanLetterHtml(expected), id).toBe(expected)
      expect(letterParts(body.issue.bodyHtml).map((p) => p.title), id).toEqual([...STARTERS[id].headings])
    }
  })

  it('sets the open letter aside when it holds words, keeping them, with who did it and when, and deletes nothing', async () => {
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const starter = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    const made = await (await save(writer, { bodyHtml: `${LETTER}<p>Sample words to keep.</p>`, preheader: 'Sample preview line' })).json<{ id: string }>()
    const res = await start(starter, 'monthly', 'January 2027')
    expect(res.status).toBe(201)
    const started = await res.json<{ issue: { id: string; bodyHtml: string } }>()
    expect(started.issue.id).not.toBe(made.id)
    const old = await rowOf(made.id)
    expect(old).toMatchObject({ body_html: `${LETTER}<p>Sample words to keep.</p>`, preheader: 'Sample preview line', version: 2, created_by: writer, updated_by: starter, campaign_id: null })
    expect(old.set_aside_at).toBe(old.updated_at)
    expect(await rows()).toHaveLength(2)
    expect((await openRows()).map((r) => r.id)).toEqual([started.issue.id])
  })

  it('counts a heading, a preview line or a subject of its own as words, and reuses in place an open letter that holds none', async () => {
    const admin = await seedAdmin()
    const empty = await (await start(admin, 'blank')).json<{ issue: { id: string } }>()
    const reused = await start(admin, 'results-and-thanks', 'January 2027')
    expect(reused.status).toBe(201)
    const body = await reused.json<{ issue: { id: string; version: number; monthLabel: string; subject: string; bodyHtml: string } }>()
    expect(body.issue).toMatchObject({ id: empty.issue.id, version: 2, monthLabel: 'January 2027', subject: defaultSubject('January 2027'), bodyHtml: starterBody('results-and-thanks') })
    expect(await rows()).toHaveLength(1)
    // A letter whose only words are its subject, its preview line, one heading or a "<" and a figure is kept when a new one starts.
    for (const over of [{ subject: 'Sample subject of its own', bodyHtml: '' }, { preheader: 'Sample preview line', bodyHtml: '' }, { bodyHtml: '<h2>Sample heading one</h2>' }, { bodyHtml: '<p>< 2</p>' }]) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const made = await (await save(admin, over)).json<{ id: string }>()
      expect((await start(admin, 'blank')).status).toBe(201)
      expect((await rowOf(made.id)).set_aside_at, JSON.stringify(over)).not.toBeNull()
      expect(await rows()).toHaveLength(2)
    }
    // Spaces, empty paragraphs, a line and the month's own subject are not words.
    await env.DB.prepare('DELETE FROM newsletter_issues').run()
    const blankish = await (await save(admin, { bodyHtml: '<p>&nbsp; </p><p></p><hr><h2></h2>', subject: defaultSubject(MONTH), preheader: ' ' })).json<{ id: string }>()
    expect((await start(admin, 'blank')).status).toBe(201)
    expect(await rows()).toHaveLength(1)
    expect((await rowOf(blankish.id)).set_aside_at).toBeNull()
  })

  it('reuses a starter nobody wrote in: "monthly", then "results-and-thanks" with nothing typed, leaves one row, the same id, its version moved, nothing set aside and no last letter', async () => {
    const admin = await seedAdmin()
    const first = await (await start(admin, 'monthly')).json<{ issue: { id: string; version: number } }>()
    const res = await start(admin, 'results-and-thanks', 'January 2027')
    expect(res.status).toBe(201)
    const second = await res.json<{ issue: Row }>()
    expect(second.issue).toMatchObject({
      id: first.issue.id, version: first.issue.version + 1, monthLabel: 'January 2027', subject: defaultSubject('January 2027'), bodyHtml: starterBody('results-and-thanks'),
    })
    expect(await rows()).toEqual([expect.objectContaining({ id: first.issue.id, set_aside_at: null, campaign_id: null })])
    expect(await (await invoke(issuesGet, { as: admin })).json()).toEqual({ issues: [] })
  })

  it('sets aside, lists and keeps a starter someone wrote in: a word under one heading, a heading removed, a heading reworded, the subject alone, a preview line alone', async () => {
    const admin = await seedAdmin()
    const monthly = starterBody('monthly')
    const writes: Array<[string, Parameters<typeof saveBody>[0]]> = [
      ['a word under one heading', { bodyHtml: monthly.replace('<h2>Coming up</h2><p></p>', '<h2>Coming up</h2><p>Sample</p>') }],
      ['one heading removed', { bodyHtml: monthly.replace('<h2>Scholastic</h2><p></p>', '') }],
      ['one heading reworded', { bodyHtml: monthly.replace('<h2>Coming up</h2>', '<h2>Sample heading one</h2>') }],
      ['only the subject changed', { bodyHtml: monthly, subject: 'Sample subject one' }],
      ['only a preview line added', { bodyHtml: monthly, preheader: 'Sample preview line' }],
    ]
    for (const [what, over] of writes) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const made = await (await start(admin, 'monthly')).json<{ issue: { id: string; version: number } }>()
      expect((await save(admin, { id: made.issue.id, version: made.issue.version, ...over })).status, what).toBe(200)
      const written = await rowOf(made.issue.id)
      expect((await start(admin, 'monthly')).status, what).toBe(201)
      const aside = await rowOf(made.issue.id)
      expect(aside.set_aside_at, what).not.toBeNull()
      expect(aside, what).toMatchObject({ body_html: written.body_html, subject: written.subject, preheader: written.preheader })
      expect(await rows(), what).toHaveLength(2)
      const last = (await (await invoke(issuesGet, { as: admin })).json<{ issues: Row[] }>()).issues
      expect(last, what).toMatchObject([{ issueId: made.issue.id, state: 'set_aside' }])
    }
  })

  it('still reuses an untouched starter saved back in an editor\'s own form: each empty part written as "<p><br></p>", with spaces between two tags', async () => {
    const admin = await seedAdmin()
    const made = await (await start(admin, 'monthly')).json<{ issue: { id: string; version: number } }>()
    const editorForm = STARTERS.monthly.headings.map((h) => `<h2>${h}</h2> <p><br></p>`).join('\n')
    // The cleaner keeps this form as it is, so it is what the save stores.
    expect(await cleanLetterHtml(editorForm)).toBe(editorForm)
    expect((await save(admin, { id: made.issue.id, version: made.issue.version, bodyHtml: editorForm })).status).toBe(200)
    expect((await rowOf(made.issue.id)).body_html).toBe(editorForm)
    const res = await start(admin, 'results-and-thanks')
    expect(res.status).toBe(201)
    expect((await res.json<{ issue: { id: string } }>()).issue.id).toBe(made.issue.id)
    expect(await rows()).toEqual([expect.objectContaining({ id: made.issue.id, set_aside_at: null, body_html: starterBody('results-and-thanks') })])
  })

  it('stores each starter as starterLetter writes it and the cleaner keeps it, the letter holdsWords knows, so starting it again reuses the row', async () => {
    const admin = await seedAdmin()
    for (const id of STARTER_IDS) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const made = await (await start(admin, id)).json<{ issue: { id: string } }>()
      const row = await rowOf(made.issue.id)
      expect(row.body_html, id).toBe(starterLetter(id))
      expect(await cleanLetterHtml(starterLetter(id)), id).toBe(starterLetter(id))
      const letter = { monthLabel: String(row.month_label), subject: String(row.subject), preheader: String(row.preheader), bodyHtml: String(row.body_html) }
      expect(holdsWords(letter), id).toBe(false)
      expect((await (await start(admin, id)).json<{ issue: { id: string } }>()).issue.id, id).toBe(made.issue.id)
      expect(await rows(), id).toHaveLength(1)
    }
  })

  it('starts from a past letter of the newsletter, and from a newsletter sent from the plain tab, cleaning the words as they are copied', async () => {
    const admin = await seedAdmin()
    await seedLetter({ id: 'issue-past', body: '<h2>Sample heading one</h2><p>Sample past words.</p>', setAsideAt: '2026-11-03 15:00:00' })
    const fromLetter = await (await start(admin, { issueId: 'issue-past' })).json<{ issue: { id: string; bodyHtml: string } }>()
    expect(fromLetter.issue.bodyHtml).toBe('<h2>Sample heading one</h2><p>Sample past words.</p>')
    expect((await rowOf('issue-past')).set_aside_at).toBe('2026-11-03 15:00:00')

    const plainWords = '<p style="color:red" onclick="alert(1)">Sample <b>plain</b> words.</p><img src=x onerror=alert(1)><h1>Sample heading</h1>'
    await seedSend({ id: 'campaign-plain', body: plainWords })
    const res = await start(admin, { campaignId: 'campaign-plain' })
    expect(res.status).toBe(201)
    const fromSend = await res.json<{ issue: { bodyHtml: string } }>()
    expect(fromSend.issue.bodyHtml).toBe(await cleanLetterHtml(plainWords))
    expect(fromSend.issue.bodyHtml).toBe('<p>Sample plain words.</p><h2>Sample heading</h2>')
    // The first letter, which held words, was set aside, and nothing is deleted.
    expect((await rowOf(fromLetter.issue.id)).set_aside_at).not.toBeNull()
    expect(await rows()).toHaveLength(3)
  })

  it('reuses a copy whose words are a starter\'s headings untouched, as it reuses that starter, and keeps its source as it was: a past letter set aside for its subject alone, and a plain send of those headings', async () => {
    const admin = await seedAdmin()
    await seedLetter({ id: 'issue-past-starter', body: starterLetter('monthly'), subject: 'Sample subject one', setAsideAt: '2026-11-03 15:00:00' })
    await seedSend({ id: 'campaign-headings', body: '<h2>Results and thanks</h2>' })
    const send = () => env.DB.prepare('SELECT * FROM email_campaigns WHERE id = ?').bind('campaign-headings').first<Row>()
    const sources = { letter: await rowOf('issue-past-starter'), send: await send() }
    for (const from of [{ issueId: 'issue-past-starter' }, { campaignId: 'campaign-headings' }]) {
      const what = JSON.stringify(from)
      const copy = await (await start(admin, from)).json<{ issue: { id: string; version: number; bodyHtml: string } }>()
      expect(holdsWords({ monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: copy.issue.bodyHtml }), what).toBe(false)
      const res = await start(admin, 'monthly')
      expect(res.status, what).toBe(201)
      expect((await res.json<{ issue: Row }>()).issue, what).toMatchObject({ id: copy.issue.id, version: copy.issue.version + 1 })
      expect(await openRows(), what).toHaveLength(1)
      expect(await rows(), what).toHaveLength(2)
    }
    // Nothing is lost: each source is as it was, and listed.
    expect(await rowOf('issue-past-starter')).toEqual(sources.letter)
    expect(await send()).toEqual(sources.send)
    const last = (await (await invoke(issuesGet, { as: admin })).json<{ issues: Row[] }>()).issues
    expect(last).toMatchObject([{ issueId: 'issue-past-starter', state: 'set_aside' }, { issueId: null, campaignId: 'campaign-headings' }])
  })

  it('refuses in words a send whose words the cleaner cannot make clean, or that starts with a smaller heading, writing nothing', async () => {
    const admin = await seedAdmin()
    await seedSend({ id: 'campaign-unclean', body: '<p>Sample words</p><textarea>' })
    await seedSend({ id: 'campaign-small', body: '<h3>Sample smaller heading</h3><p>x</p>' })
    const before = { rows: await rows(), traces: await traces() }
    const unclean = await start(admin, { campaignId: 'campaign-unclean' })
    expect(unclean.status).toBe(400)
    expect(await unclean.json()).toEqual({ error: SOURCE_NOT_CLEAN })
    expect((await start(admin, { campaignId: 'campaign-small' })).status).toBe(400)
    expect({ rows: await rows(), traces: await traces() }).toEqual(before)
  })

  it('answers a letter or a send of another list, or none, as not found, alike, without saying whether it exists elsewhere', async () => {
    const admin = await seedAdmin()
    await seedLetter({ id: 'issue-other', listId: OTHER_LIST, setAsideAt: '2026-11-03 15:00:00' })
    await seedSend({ id: 'campaign-other', listId: OTHER_LIST })
    await seedSend({ id: 'campaign-group', listId: null })
    const answers = []
    for (const from of [{ issueId: 'issue-other' }, { issueId: 'issue-nowhere' }, { campaignId: 'campaign-other' }, { campaignId: 'campaign-group' }, { campaignId: 'campaign-nowhere' }]) {
      const res = await start(admin, from)
      answers.push([res.status, await res.response.clone().text()])
    }
    expect(new Set(answers.map((a) => JSON.stringify(a)))).toEqual(new Set([JSON.stringify([404, JSON.stringify({ error: 'Not found' })])]))
    expect((await rows()).map((r) => r.id)).toEqual(['issue-other'])
  })

  it('refuses a source its contract does not read, two sources at once among them, with the field errors', async () => {
    const admin = await seedAdmin()
    for (const from of ['a-starter-nobody-wrote', { issueId: 'x', campaignId: 'y' }, { issueId: '' }, 3, null]) {
      const res = await start(admin, from)
      expect(res.status, JSON.stringify(from)).toBe(400)
      // The source's own field, or the one inside it that is wrong, as an empty past letter's id is.
      const fields = Object.keys((await res.json<{ fields: Record<string, string> }>()).fields)
      expect(fields, JSON.stringify(from)).toHaveLength(1)
      expect(fields[0], JSON.stringify(from)).toMatch(/^from(?:\.issueId)?$/)
    }
    expect((await start(admin, 'blank', 'December\n2026')).status).toBe(400)
    expect(await rows()).toEqual([])
  })

  it('never loses words when a save and a start meet, and leaves one open letter, whichever lands first', async () => {
    const one = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const two = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    for (let round = 0; round < 6; round += 1) {
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const made = await (await save(one, { bodyHtml: `${LETTER}<p>Sample words before.</p>` })).json<{ id: string }>()
      const later = `${LETTER}<p>Sample words of round ${round}.</p>`
      const [saved, started] = await Promise.all([save(one, { id: made.id, version: 1, bodyHtml: later }), start(two, round % 2 ? 'monthly' : 'blank')])
      expect([200, 409], 'the save').toContain(saved.status)
      expect([201, 409], 'the start').toContain(started.status)
      const all = await rows()
      expect(await openRows(), `round ${round}`).toHaveLength(1)
      const words = all.map((r) => r.body_html)
      if (saved.status === 200) expect(words, `round ${round}`).toContain(later)
      else expect(words, `round ${round}`).toContain(`${LETTER}<p>Sample words before.</p>`)
      if (started.status === 409) expect((await started.json<{ error: string }>()).error).toBe(CHANGED_WHILE_STARTING)
      expect(all.length).toBeGreaterThanOrEqual(1)
    }
  })
})

/** A starter's letter as the start writes it. */
const starterBody = (id: (typeof STARTER_IDS)[number]) => STARTERS[id].headings.map((h) => `<h2>${h}</h2><p></p>`).join('')

describe('(e) the last letters', () => {
  it('answers an empty list with nothing written yet', async () => {
    expect(await (await invoke(issuesGet, { as: await seedAdmin() })).json()).toEqual({ issues: [] })
  })

  it('gives sent letters, letters set aside and plain sends, newest first, each named, without words or any reader\'s address', async () => {
    const sender = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const writer = await seedMember({ fullName: 'Player Two', role: 'lca_admin' })
    await seedSend({ id: 'campaign-from-page', by: sender, at: '2026-11-10 15:00:00', total: 155, subject: 'LCA Newsletter · November 2026' })
    await seedLetter({ id: 'issue-sent', campaignId: 'campaign-from-page', month: 'November 2026', by: writer })
    await seedLetter({ id: 'issue-aside', month: 'December 2026', subject: 'Sample subject two', by: writer, setAsideAt: '2026-11-12 15:00:00' })
    await seedSend({ id: 'campaign-plain', by: sender, at: '2026-11-11 15:00:00', status: 'failed', total: 2, subject: 'Sample plain send' })
    await seedSend({ id: 'campaign-other-list', listId: OTHER_LIST, at: '2026-11-12 18:00:00' })
    await seedSend({ id: 'campaign-group-email', listId: null, at: '2026-11-12 19:00:00' })
    await env.DB.prepare(`INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email) VALUES ('rcpt-sample', 'campaign-plain', NULL, 'reader.one@example.org')`).run()
    await seedLetter({ id: 'issue-open', month: 'January 2027', by: writer, updatedAt: '2026-11-13 15:00:00' })

    const res = await invoke(issuesGet, { as: sender })
    expect(res.status).toBe(200)
    const body = await res.json<{ issues: Row[] }>()
    expect(body.issues).toEqual([
      { issueId: 'issue-aside', campaignId: null, monthLabel: 'December 2026', subject: 'Sample subject two', state: 'set_aside', at: '2026-11-12 15:00:00', by: 'Player Two', totalRecipients: null },
      { issueId: null, campaignId: 'campaign-plain', monthLabel: '', subject: 'Sample plain send', state: 'failed', at: '2026-11-11 15:00:00', by: 'Player One', totalRecipients: 2 },
      { issueId: 'issue-sent', campaignId: 'campaign-from-page', monthLabel: 'November 2026', subject: 'LCA Newsletter · November 2026', state: 'completed', at: '2026-11-10 15:00:00', by: 'Player One', totalRecipients: 155 },
    ])
    const text = await res.response.clone().text()
    for (const absent of ['Example words', 'Sample words sent', 'reader.one@example.org', 'issue-open', 'campaign-other-list', 'campaign-group-email']) expect(text, absent).not.toContain(absent)
  })

  it('gives at most 20, the newest', async () => {
    const admin = await seedAdmin()
    for (let i = 0; i < 25; i += 1) {
      const at = `2026-10-${String(i + 1).padStart(2, '0')} 15:00:00`
      if (i % 2) await seedSend({ id: `campaign-${i}`, at, by: admin })
      else await seedLetter({ id: `issue-${i}`, setAsideAt: at, by: admin })
    }
    const body = await (await invoke(issuesGet, { as: admin })).json<{ issues: Array<{ at: string }> }>()
    expect(body.issues).toHaveLength(20)
    expect(body.issues.map((i) => i.at)).toEqual(Array.from({ length: 20 }, (_, i) => `2026-10-${String(25 - i).padStart(2, '0')} 15:00:00`))
  })
})

describe('(f) closing an account whose holder wrote a letter', () => {
  it('still deletes the account, and the letter keeps its words with no name where the person was', async () => {
    const admin = await seedAdmin()
    const writer = await seedMember({ fullName: 'Player One', role: 'lca_admin' })
    const made = await (await save(writer)).json<{ id: string }>()
    await seedLetter({ id: 'issue-aside-by-writer', by: writer, setAsideAt: '2026-11-03 15:00:00' })
    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: writer } })
    expect(res.status).toBe(200)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE id = ?').bind(writer).first<{ n: number }>()).toEqual({ n: 0 })
    const kept = await rowOf(made.id)
    expect(kept).toMatchObject({ body_html: LETTER, created_by: null, updated_by: null, version: 1 })
    expect((await rowOf('issue-aside-by-writer')).created_by).toBeNull()
    expect(await (await invoke(issueGet, { as: admin })).json()).toMatchObject({ state: 'draft', lastSavedBy: null })
    expect((await (await invoke(issuesGet, { as: admin })).json<{ issues: Array<{ by: string | null }> }>()).issues.map((i) => i.by)).toEqual([null])
  })
})
