// test/integration/newsletter-page-send.test.ts
//
// WS16 part two, page step 6, the send half: the real Send on the
// newsletter's own page, POST /api/admin/mail/newsletter/issue/send, through
// the real handler, the real guard (requireListMailer) and the real batch
// (createLetterCampaign in functions/utils/mail/lists.ts), on the D1
// database every integration test builds from the migrations. MAIL_PAGE_ON,
// MAIL_PAGE_SEND_ON, MAIL_LISTS_ON and the module's other constants are read
// through getters on the mocked functions/utils/mail/switches, set before
// every case. Nothing here reaches an outside service: the harness answers
// the sign-in service and stands in for the mail service.
//
// - (a) who may send: the fifteen people of the saved templates' sweep and
//   one more, an LCA Observer without the President seat who has a second
//   factor; the four the tab lets in send, the rest get the tab's own
//   answer, byte for byte, with nothing written.
// - (b) switched off, by MAIL_PAGE_SEND_ON or by MAIL_PAGE_ON: 404 to
//   everyone, before the session, the body or the database is read.
// - (c) while the site sends through Resend: WAITS_FOR_SES's 409, nothing
//   written.
// - (d) no link key: today's 503.
// - (e) the letter: another list's or a made-up id, 404; one written to, set
//   aside or sent since it was read, SEND_CHANGED's 409 with who and when;
//   bodies that name no letter, the contract's words.
// - (f) a letter with no subject, no words, neither, or a starter's headings
//   left as they were: the SEND_NO_* words; one too long as drawn: 413 with
//   how much, and no contact written.
// - (g) nobody on the list: NOBODY_ON_THE_LIST. (h) a send from the tab still
//   sending: ALREADY_SENDING, the letter row as before.
// - (i) races: two presses at one version, in one tab or two; a save and a
//   send, both orders; a fresh start and a send; the tab's send and the
//   page's; a forced same millisecond, and with the suffix held equal the
//   second batch throws and writes nothing. Each ends with at most one send
//   and the marked letters agreeing with it.
// - (k) the audit row: the campaign, the count and the list, no address.
// - (l) the refusals in the handler's order, each met in turn, then the send.
// - (j) the mark and the copy: the letter marked with the send and its
//   version moved by one, its writer and time untouched; the campaign holds
//   the stored subject and words, and its look in filter_json; it counts the
//   audience as the tab's send does; a later save gets the 'sent' 409, the
//   page opens on no letter, and the last newsletters list it once, sending.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSubject } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { SEND_CHANGED } from '../../domain/mail/newsletterWords'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestGet as issueGet, onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestOptions as sendOptions, onRequestPost as sendPost } from '../../functions/api/admin/mail/newsletter/issue/send'
import { onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../functions/api/admin/mail/newsletter/issues'
import { SENT_SINCE_READ, starterLetter } from '../../functions/utils/mail/issues'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createLetterCampaign, createListCampaign } from '../../functions/utils/mail/lists'
import {
  ALREADY_SENDING,
  LINK_KEY_MISSING,
  NOBODY_ON_THE_LIST,
  SEND_NO_SUBJECT,
  SEND_NO_SUBJECT_OR_WORDS,
  SEND_NO_WORDS,
  WAITS_FOR_SES,
} from '../../functions/utils/mail/newsletterAnswers'
import type { Env } from '../../functions/types'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { seedAdmin, seedMember, seedPresident, seedSeat } from './factories'
import { emailOutbox, invoke, resetHarness, type InvokeOptions } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ pageOn: true, sendOn: true, listsOn: true, sender: 'ses', plan: 'free', complaintStops: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
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

type Row = Record<string, unknown>

const MONTH = 'December 2026'
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'
const NOT_FOUND = { error: 'Not found' }

let seq = 0
const address = (name: string) => `${name}-${++seq}@page-send.test.lca`

/** A letter saved through the page's own save, as the page saves one. */
async function saved(as: string, over: Partial<{ subject: string; preheader: string; bodyHtml: string }> = {}): Promise<{ id: string; version: number }> {
  const body = { id: null, version: 0, monthLabel: MONTH, subject: 'Sample subject one', preheader: 'Sample preview line', bodyHtml: LETTER, ...over }
  const res = await invoke(issuePut, { method: 'PUT', as, body })
  expect(res.status, JSON.stringify(await res.json())).toBe(200)
  const answer = await res.json<{ id: string; version: number }>()
  return { id: answer.id, version: answer.version }
}

/** The page's body: the letter by its id and the version read, and nothing else. */
const named = (letter: { id: string; version: number }) => ({ issueId: letter.id, version: letter.version })

const sendOf = (as: string | undefined, body: unknown, opts: InvokeOptions = {}) => invoke(sendPost, { method: 'POST', ...(as ? { as } : {}), body, ...opts })

/** Every table a refused send must leave as it was. */
async function tables() {
  const all = async (sql: string) => JSON.stringify((await env.DB.prepare(sql).all<Row>()).results)
  return {
    letters: await all('SELECT * FROM newsletter_issues ORDER BY rowid'),
    campaigns: await all('SELECT * FROM email_campaigns ORDER BY rowid'),
    recipients: await all('SELECT * FROM email_campaign_recipients ORDER BY rowid'),
    contacts: await all('SELECT * FROM mail_contacts ORDER BY rowid'),
    audit: await all('SELECT * FROM admin_audit_log ORDER BY rowid'),
    sent: emailOutbox.length,
  }
}

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.sendOn = true
  flags.listsOn = true
  flags.sender = 'ses'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('(a) who may send', () => {
  it('lets in exactly the people who may send the newsletter, and refuses everyone else as the tab does, byte for byte, writing nothing', async () => {
    const person = (fullName: string, role = 'member') => seedMember({ fullName, email: address('person'), role })
    const writer = await seedAdmin()
    const seated = await person('Player Three')
    const seatedOfficer = await person('Player Four', 'lca_officer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [seated, seatedOfficer])
    const president = await person('Player Ten', 'lca_observer')
    await seedPresident(president)
    const people = [
      ['nobody signed in', undefined, 'aal2'],
      ['an LCA Observer without the President seat', await person('Player Eleven', 'lca_observer'), 'aal1'],
      ['an LCA Observer without the President seat, with a second factor', await person('Player Twelve', 'lca_observer'), 'aal2'],
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
      const letter = await saved(writer)
      const before = await tables()
      const res = await sendOf(as, named(letter), { aal })
      if (plain.status === 200) {
        expect(res.status, who).toBe(201)
        answered.push(who)
        await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed'`).run()
      } else {
        expect(res.status, who).toBe(plain.status)
        expect(await res.response.clone().text(), who).toBe(await plain.response.clone().text())
        expect(await tables(), who).toEqual(before)
      }
      await env.DB.prepare('DELETE FROM newsletter_issues WHERE campaign_id IS NULL').run()
    }
    expect(answered).toEqual([
      'an LCA admin with a second factor', 'the president', 'the media manager with a second factor', 'an officer who holds the seat, with a second factor',
    ])
  })
})

describe('(b) switched off', () => {
  for (const off of ['MAIL_PAGE_SEND_ON', 'MAIL_PAGE_ON'] as const) {
    it(`answers 404 to everyone with ${off} unset, before the session, the body or the database is read`, async () => {
      const admin = await seedAdmin()
      const letter = await saved(admin)
      if (off === 'MAIL_PAGE_SEND_ON') flags.sendOn = false
      else flags.pageOn = false
      const before = await tables()
      const counting = countingDb()
      for (const as of [admin, undefined]) {
        for (const body of [named(letter), 'not json {']) {
          const res = await sendOf(as, body, { env: { DB: counting.db } as Partial<Env> })
          expect(res.status).toBe(404)
          expect(JSON.stringify(await res.json())).toBe(JSON.stringify(NOT_FOUND))
        }
      }
      expect(counting.ran).toEqual([])
      expect(await tables()).toEqual(before)
      expect((await invoke(sendOptions, { method: 'OPTIONS' })).status).toBe(204)
    })
  }
})

describe('(c) and (d): the sender and the link key', () => {
  it('answers WAITS_FOR_SES\'s 409 while the site sends through Resend, with every table as before', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    flags.sender = 'resend'
    const before = await tables()
    const res = await sendOf(admin, named(letter))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: WAITS_FOR_SES })
    expect(await tables()).toEqual(before)
  })

  it('answers today\'s 503 with no link key, with every table as before', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const before = await tables()
    const res = await sendOf(admin, named(letter), { env: { MAIL_LINK_SECRET: '' } })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: LINK_KEY_MISSING })
    expect(await tables()).toEqual(before)
  })
})

describe('(j) the mark and the copy', () => {
  it('marks the letter with the send, moves its version by one, and copies the stored letter into the campaign with its look', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Five', email: address('reader') })
    const letter = await saved(admin)
    const stored = (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(letter.id).first<Row>())!
    const res = await sendOf(admin, named(letter))
    expect(res.status, JSON.stringify(await res.json())).toBe(201)
    const body = await res.json<{ campaignId: string; totalRecipients: number; status: string }>()
    expect(body.status).toBe('sending')
    expect(body.campaignId).toMatch(/^campaign-[0-9a-z]+-[0-9a-f]{8}$/)
    const after = (await env.DB.prepare('SELECT * FROM newsletter_issues WHERE id = ?').bind(letter.id).first<Row>())!
    expect(after.campaign_id).toBe(body.campaignId)
    expect(after.version).toBe(letter.version + 1)
    expect(after.updated_by).toBe(stored.updated_by)
    expect(after.updated_at).toBe(stored.updated_at)
    const campaign = (await env.DB.prepare('SELECT * FROM email_campaigns WHERE id = ?').bind(body.campaignId).first<Row>())!
    expect(campaign.subject).toBe(stored.subject)
    expect(campaign.body_html).toBe(stored.body_html)
    expect(campaign.total_recipients).toBe(body.totalRecipients)
    expect(body.totalRecipients).toBeGreaterThanOrEqual(1)
    expect(Object.keys(JSON.parse(String(campaign.filter_json))).sort()).toEqual(['linkCheck', 'list', 'look', 'month', 'preheader'])
    expect(JSON.parse(String(campaign.filter_json))).toMatchObject({ list: 'lca-newsletter', look: 'navy', month: MONTH, preheader: 'Sample preview line' })
  })

  it('counts the audience as the tab\'s send does, and leaves the sent letter to the list of last newsletters alone', async () => {
    const admin = await seedAdmin()
    for (const name of ['reader', 'reader', 'reader']) await seedMember({ fullName: 'Player Six', email: address(name) })
    const letter = await saved(admin)
    const res = await sendOf(admin, named(letter))
    expect(res.status).toBe(201)
    const body = await res.json<{ campaignId: string; totalRecipients: number }>()

    const later = await invoke(issuePut, { method: 'PUT', as: admin, body: { id: letter.id, version: letter.version + 1, monthLabel: MONTH, subject: 'Sample subject one', preheader: '', bodyHtml: LETTER } })
    expect(later.status).toBe(409)
    expect(await later.json()).toMatchObject({ error: SENT_SINCE_READ })

    const open = await invoke(issueGet, { method: 'GET', as: admin })
    expect(open.status).toBe(200)
    expect(await open.json()).toMatchObject({ issue: null, state: 'none' })

    const listed = await invoke(issuesGet, { method: 'GET', as: admin })
    expect(listed.status).toBe(200)
    const { issues } = await listed.json<{ issues: Array<{ issueId: string | null; campaignId: string | null; state: string }> }>()
    const mine = issues.filter((row) => row.campaignId === body.campaignId)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ issueId: letter.id, state: 'sending' })

    await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed' WHERE id = ?`).bind(body.campaignId).run()
    const tab = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, subject: 'Sample subject one', bodyHtml: LETTER, createdBy: admin, linkCheck: await linkKeyCheck((env as unknown as Env).MAIL_LINK_SECRET as string) })
    expect(tab?.totalRecipients).toBe(body.totalRecipients)
  })
})

/** Writes a saved letter's stored subject and words straight into its row, as no save would, keeping its version. */
async function stored(letter: { id: string }, subject: string, bodyHtml: string) {
  await env.DB.prepare('UPDATE newsletter_issues SET subject = ?, body_html = ? WHERE id = ?').bind(subject, bodyHtml, letter.id).run()
}

describe('(f) what a letter needs before Send', () => {
  const cases: Array<[string, string, string, string]> = [
    ['no subject', '', LETTER, SEND_NO_SUBJECT],
    ['no words', 'Sample subject one', '<p></p>', SEND_NO_WORDS],
    ['neither', '  ', '<p> </p>', SEND_NO_SUBJECT_OR_WORDS],
    ['an untouched starter', 'Sample subject one', starterLetter('monthly'), SEND_NO_WORDS],
  ]
  for (const [what, subject, bodyHtml, words] of cases) {
    it(`refuses a letter with ${what}, with every table as before`, async () => {
      const admin = await seedAdmin()
      await seedMember({ fullName: 'Player Seven', email: address('reader') })
      const letter = await saved(admin)
      await stored(letter, subject, bodyHtml)
      const before = await tables()
      const res = await sendOf(admin, named(letter))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: words })
      expect(await tables()).toEqual(before)
    })
  }

  it('refuses a letter too long as drawn with 413 and the words of how much, writing no contact', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Seven', email: address('reader') })
    const letter = await saved(admin)
    await stored(letter, 'Sample subject one', `<p>${'Example words for a sample letter. '.repeat(3200)}</p>`)
    const before = await tables()
    const res = await sendOf(admin, named(letter))
    expect(res.status).toBe(413)
    const { error } = await res.json<{ error: string }>()
    expect(error).toMatch(/^This email is too long: it is about [0-9,]+ characters over what Gmail shows whole\. Make the letter shorter, then send it\.$/)
    expect(await tables()).toEqual(before)
  })
})

describe('(g) and (h): the list', () => {
  it('answers NOBODY_ON_THE_LIST when nobody would get the newsletter, with every table as before', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired'`).run()
    const before = await tables()
    const res = await sendOf(admin, named(letter))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: NOBODY_ON_THE_LIST })
    expect(await tables()).toEqual(before)
  })

  it('answers ALREADY_SENDING while a send from the tab is sending, with the letter row as before', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eight', email: address('reader') })
    const letter = await saved(admin)
    const tab = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, subject: 'Sample subject two', bodyHtml: LETTER, createdBy: admin, linkCheck: await linkKeyCheck((env as unknown as Env).MAIL_LINK_SECRET as string) })
    expect(tab).not.toBeNull()
    const before = await tables()
    const res = await sendOf(admin, named(letter))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: ALREADY_SENDING })
    expect(await tables()).toEqual(before)
  })
})

describe('(i) races', () => {
  /** How the race ended: the sends made and the letters marked, which must agree, and never more than one. */
  async function ending() {
    const campaigns = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM email_campaigns`).first<{ n: number }>())!.n
    const marked = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM newsletter_issues WHERE campaign_id IS NOT NULL`).first<{ n: number }>())!.n
    expect(marked).toBe(campaigns)
    expect(campaigns).toBeLessThanOrEqual(1)
    return campaigns
  }
  const SENT_LOSER = [SEND_CHANGED, ALREADY_SENDING]

  it('makes one send of two presses at the same version, in one tab or in two, and a clear 409 for the other', async () => {
    const admin = await seedAdmin()
    const other = await seedAdmin()
    await seedMember({ fullName: 'Player Eleven', email: address('reader') })
    for (const [first, second] of [[admin, admin], [admin, other]]) {
      await env.DB.prepare('DELETE FROM email_campaign_recipients').run()
      await env.DB.prepare('DELETE FROM email_campaigns').run()
      await env.DB.prepare('DELETE FROM newsletter_issues').run()
      const letter = await saved(admin)
      const answers = await Promise.all([sendOf(first, named(letter)), sendOf(second, named(letter))])
      const statuses = answers.map((res) => res.status).sort()
      expect(statuses).toEqual([201, 409])
      const loser = answers.find((res) => res.status === 409)!
      expect(SENT_LOSER).toContain((await loser.json<{ error: string }>()).error)
      expect(await ending()).toBe(1)
    }
  })

  for (const order of ['the send first', 'the save first'] as const) {
    it(`lets a save and a send at the same version end with one of them, ${order}`, async () => {
      const admin = await seedAdmin()
      await seedMember({ fullName: 'Player Eleven', email: address('reader') })
      const letter = await saved(admin)
      const send = () => sendOf(admin, named(letter))
      const save = () => invoke(issuePut, { method: 'PUT', as: admin, body: { id: letter.id, version: letter.version, monthLabel: MONTH, subject: 'Sample subject three', preheader: '', bodyHtml: LETTER } })
      const [a, b] = order === 'the send first' ? await Promise.all([send(), save()]) : await Promise.all([save(), send()])
      const [sent, kept] = order === 'the send first' ? [a, b] : [b, a]
      const made = await ending()
      if (sent.status === 201) {
        expect(made).toBe(1)
        expect(kept.status).toBe(409)
        expect(await kept.json()).toMatchObject({ error: SENT_SINCE_READ })
      } else {
        expect(made).toBe(0)
        expect(kept.status).toBe(200)
        expect(sent.status).toBe(409)
        expect(await sent.json()).toMatchObject({ error: SEND_CHANGED, reason: 'changed' })
      }
    })
  }

  it('lets a fresh start and a send end with at most one send and every marked letter its own', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eleven', email: address('reader') })
    const letter = await saved(admin)
    const [sent, started] = await Promise.all([
      sendOf(admin, named(letter)),
      invoke(startPost, { method: 'POST', as: admin, body: { from: 'monthly', monthLabel: MONTH } }),
    ])
    expect([201, 409]).toContain(sent.status)
    expect([201, 409]).toContain(started.status)
    expect(await ending()).toBe(sent.status === 201 ? 1 : 0)
  })

  it('lets the tab\'s send and the page\'s end with one send on the list', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eleven', email: address('reader') })
    const letter = await saved(admin)
    const [page, tab] = await Promise.all([
      sendOf(admin, named(letter)),
      invoke(newsletterPost, { method: 'POST', as: admin, body: { subject: 'Sample subject two', bodyHtml: '<p>Example words for a sample newsletter.</p>' } }),
    ])
    const sending = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM email_campaigns WHERE status = 'sending'`).first<{ n: number }>())!.n
    expect(sending).toBe(1)
    expect([page.status, tab.status].filter((status) => status === 409)).toHaveLength(1)
    const marked = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM newsletter_issues WHERE campaign_id IS NOT NULL`).first<{ n: number }>())!.n
    expect(marked).toBe(page.status === 201 ? 1 : 0)
  })

  it('makes one send in a forced same millisecond, and with the suffix held equal too the second batch throws and writes nothing', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eleven', email: address('reader') })
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 3, 15, 0, 0))
    try {
      const letter = await saved(admin)
      const answers = await Promise.all([sendOf(admin, named(letter)), sendOf(admin, named(letter))])
      expect(answers.map((res) => res.status).sort()).toEqual([201, 409])
      expect(await ending()).toBe(1)

      await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed'`).run()
      const next = await saved(admin, { subject: 'Sample subject four' })
      const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint8Array) => array.fill(7)) as typeof crypto.getRandomValues)
      try {
        const args = { listId: NEWSLETTER_LIST_ID, issueId: next.id, version: next.version, createdBy: admin, linkCheck: await linkKeyCheck((env as unknown as Env).MAIL_LINK_SECRET as string) }
        const made = await createLetterCampaign(env.DB, args)
        expect('made' in made).toBe(true)
        const before = await tables()
        await expect(createLetterCampaign(env.DB, args)).rejects.toThrow()
        expect(await tables()).toEqual(before)
        const row = (await env.DB.prepare('SELECT version, campaign_id FROM newsletter_issues WHERE id = ?').bind(next.id).first<Row>())!
        expect(row).toEqual({ version: next.version + 1, campaign_id: 'made' in made ? made.made.campaignId : null })
      } finally {
        random.mockRestore()
      }
    } finally {
      now.mockRestore()
    }
  })
})

describe('(k) the audit row', () => {
  it('records the send with the campaign, the count and the list, and no address', async () => {
    await env.DB.prepare('DELETE FROM admin_audit_log').run()
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Nine', email: address('reader') })
    const letter = await saved(admin)
    const res = await sendOf(admin, named(letter))
    expect(res.status).toBe(201)
    const body = await res.json<{ campaignId: string; totalRecipients: number }>()
    const { results } = await env.DB.prepare(`SELECT * FROM admin_audit_log WHERE action = 'group_email_sent'`).all<Row>()
    expect(results).toHaveLength(1)
    expect(results[0]!.actor_id).toBe(admin)
    expect(results[0]!.target_label).toBe('Sample subject one')
    expect(JSON.parse(String(results[0]!.detail))).toEqual({ campaign_id: body.campaignId, recipients: body.totalRecipients, list: NEWSLETTER_LIST_ID })
    expect(String(results[0]!.detail)).not.toContain('@')
  })
})

describe('(l) the order of the refusals', () => {
  it('answers each refusal in turn, each only once the one before it is met', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    const long = `<p>${'Example words for a sample letter. '.repeat(3200)}</p>`
    await stored(letter, '', long)
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired' WHERE id <> ?`).bind(admin).run()
    const answer = async (as: string | undefined, body: unknown, opts: InvokeOptions = {}) => {
      const res = await sendOf(as, body, opts)
      return [res.status, await res.json<{ error?: unknown }>()] as const
    }
    flags.sendOn = false
    flags.sender = 'resend'
    const noKey = { env: { MAIL_LINK_SECRET: '' } }
    expect(await answer(undefined, 'not json {', noKey)).toEqual([404, NOT_FOUND])
    flags.sendOn = true
    expect((await answer(undefined, 'not json {', noKey))[0]).toBe(401)
    expect((await answer(admin, 'not json {', noKey))[0]).toBe(400)
    expect(await answer(admin, { issueId: 'issue-made-up', version: 1 }, noKey)).toEqual([409, { error: WAITS_FOR_SES }])
    flags.sender = 'ses'
    expect(await answer(admin, { issueId: 'issue-made-up', version: 1 }, noKey)).toEqual([503, { error: LINK_KEY_MISSING }])
    expect(await answer(admin, { issueId: 'issue-made-up', version: 1 })).toEqual([404, NOT_FOUND])
    expect(await answer(admin, named(letter))).toEqual([400, { error: SEND_NO_SUBJECT }])
    await stored(letter, 'Sample subject one', long)
    expect((await answer(admin, named(letter)))[0]).toBe(413)
    await stored(letter, 'Sample subject one', LETTER)
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired'`).run()
    expect(await answer(admin, named(letter))).toEqual([400, { error: NOBODY_ON_THE_LIST }])
    await seedMember({ fullName: 'Player Ten', email: address('reader') })
    const tab = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, subject: 'Sample subject two', bodyHtml: LETTER, createdBy: admin, linkCheck: await linkKeyCheck((env as unknown as Env).MAIL_LINK_SECRET as string) })
    expect(await answer(admin, named(letter))).toEqual([409, { error: ALREADY_SENDING }])
    await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed' WHERE id = ?`).bind(tab!.campaignId).run()
    expect((await answer(admin, named(letter)))[0]).toBe(201)
  })
})

describe('(e) the letter', () => {
  it('answers 404 for a made-up id and for another list\'s letter', async () => {
    const admin = await seedAdmin()
    await env.DB.prepare(
      `INSERT INTO newsletter_issues (id, list_id, month_label, subject, body_html, version) VALUES ('issue-other-list', 'sample-other-list', ?, 'Sample subject one', ?, 1)`,
    ).bind(MONTH, LETTER).run()
    for (const issueId of ['issue-made-up', 'issue-other-list']) {
      const res = await sendOf(admin, { issueId, version: 1 })
      expect(res.status, issueId).toBe(404)
      expect(await res.json()).toEqual(NOT_FOUND)
    }
  })

  it('answers SEND_CHANGED\'s 409 with the saver\'s name and time for a version lost to a later save', async () => {
    const admin = await seedAdmin()
    const writer = await seedMember({ fullName: 'Player Two', email: address('writer'), role: 'lca_admin' })
    const first = await saved(admin)
    const again = await invoke(issuePut, { method: 'PUT', as: writer, body: { id: first.id, version: first.version, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: LETTER } })
    expect(again.status).toBe(200)
    const before = await tables()
    const res = await sendOf(admin, named(first))
    expect(res.status).toBe(409)
    const body = await res.json<{ error: string; reason: string; changedBy: string | null; changedAt: string }>()
    expect(body.error).toBe(SEND_CHANGED)
    expect(body.reason).toBe('changed')
    expect(body.changedBy).toBe('Player Two')
    expect(typeof body.changedAt).toBe('string')
    expect(await tables()).toEqual(before)
  })

  it('answers SEND_CHANGED\'s 409 as \'set_aside\' for a letter set aside, and as \'sent\' with the sender and the send\'s time for one sent', async () => {
    const admin = await seedAdmin()
    const sender = await seedMember({ fullName: 'Player Three', email: address('sender'), role: 'lca_admin' })
    const aside = await saved(admin)
    await env.DB.prepare(`UPDATE newsletter_issues SET set_aside_at = '2026-11-03 15:00:00' WHERE id = ?`).bind(aside.id).run()
    const res = await sendOf(admin, named(aside))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: SEND_CHANGED, reason: 'set_aside', changedAt: '2026-11-03 15:00:00' })

    const sent = await saved(admin, { subject: 'Sample subject two' })
    await env.DB.prepare(
      `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, created_at, list_id)
       VALUES ('campaign-sample-sent', 'Sample subject two', '<p>Sample words.</p>', '{}', 3, 3, 'completed', ?, '2026-11-02 15:00:00', 'lca-newsletter')`,
    ).bind(sender).run()
    await env.DB.prepare(`UPDATE newsletter_issues SET campaign_id = 'campaign-sample-sent' WHERE id = ?`).bind(sent.id).run()
    const before = await tables()
    const again = await sendOf(admin, named(sent))
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: SEND_CHANGED, reason: 'sent', changedBy: 'Player Three', changedAt: '2026-11-02 15:00:00' })
    expect(await tables()).toEqual(before)
  })

  it('answers the contract\'s words for bodies that name no letter or no version', async () => {
    const admin = await seedAdmin()
    const no = await sendOf(admin, { version: 1 })
    expect(no.status).toBe(400)
    expect(JSON.stringify(await no.json())).toContain('Name the letter to send.')
    const noVersion = await sendOf(admin, { issueId: 'issue-made-up' })
    expect(noVersion.status).toBe(400)
    expect(JSON.stringify(await noVersion.json())).toContain('Give the version of the letter you read.')
  })
})
