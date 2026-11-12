// test/integration/ses-events-edges.test.ts
//
// WS16 step 8, the edges of POST /api/mail/ses-events that test/integration/
// ses-events.test.ts leaves between its cases: the methods the address
// answers at all, two copies of one notification handled at the same moment,
// an address already on the do-not-send list for another reason, what a
// bounce's kind is allowed to store, an event naming more addresses than
// mail can have, a report's mark at the instants America/Chicago changes its
// clock and at its midnight (the mark is written as a time in UTC, as the
// gate compares it), a report time the site cannot read, a list tag that is
// not a list, the main mailer a report was not pressed on, an unsubscribe
// confirmation that is not signed, and a copy of one bounce sent under
// another message id. Every message is signed by test/integration/helpers/
// sns.ts under a key made for the run; nothing skips the check. The
// switches are read through getters on the mocked functions/utils/mail/
// switches, mocked over the real module, so no value the code ships with
// decides a case. Every name and address is plainly made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import * as receiver from '../../functions/api/mail/ses-events'
import { RECEIVER_LOG, onRequestPost } from '../../functions/api/mail/ses-events'
import { openGate } from '../../functions/utils/mail/gate'
import { MOST_ADDRESSES } from '../../functions/utils/mail/sesEvents'
import type { SnsMessage } from '../../functions/utils/mail/sns'
import { seedMailContact } from './factories'
import { fetchCount, invoke, resetHarness, snsBehavior, snsConfirmations } from './harness'
import { makeSigner, reportedTags, sesBounce, sesComplaint, snsRequest, type MessageParts, type SnsSigner } from './helpers/sns'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true, complaintStops: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return 'resend'
    },
    get WORKERS_PLAN() {
      return 'free'
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const SUBJECT = 'Amazon SES Email Event Notification'
const CLUB_LIST = 'club-example'
let signer: SnsSigner
let seq = 0
/** An address of the harness's own kind, which every list may send to. */
const listAddress = (name: string) => `${name}-${++seq}@ses-events-edges.test.lca`
/** An address at a documentation name, which event mail reaches. */
const eventAddress = (name: string) => `${name}-${++seq}@example.org`

const notify = (event: unknown, parts: MessageParts = {}, version: '1' | '2' = '2') => signer.sign({ Subject: SUBJECT, Message: JSON.stringify(event), ...parts }, version)
const post = (message: SnsMessage, opts: { env?: Record<string, unknown>; headers?: Record<string, string> } = {}) =>
  invoke(onRequestPost, { ...snsRequest(message, opts.headers), env: opts.env })

const all = async (sql: string) => (await env.DB.prepare(sql).all()).results
async function tables() {
  return {
    doNotSend: await all('SELECT address, reason, detail, created_at FROM mail_do_not_send ORDER BY address'),
    contacts: await all('SELECT id, address, optional_off_at, complained_at, created_at FROM mail_contacts ORDER BY address'),
    choices: await all('SELECT contact_id, list_id, choice, source, updated_at FROM mail_list_choices ORDER BY contact_id, list_id'),
    lists: await all('SELECT id, kind, name, main_mailer, club_id, created_at FROM mail_lists ORDER BY id'),
  }
}

const contactOf = (address: string) =>
  env.DB.prepare('SELECT id, address, optional_off_at, complained_at FROM mail_contacts WHERE address = ?').bind(address)
    .first<{ id: string; address: string; optional_off_at: string | null; complained_at: string | null }>()

const choicesOf = async (address: string) =>
  (await env.DB.prepare(`SELECT ch.list_id, ch.choice, ch.source FROM mail_list_choices ch JOIN mail_contacts c ON c.id = ch.contact_id WHERE c.address = ? ORDER BY ch.list_id`)
    .bind(address).all<{ list_id: string; choice: string; source: string }>()).results

async function gateSays(address: string, kind: 'event' | 'optional', listId?: string) {
  return (await openGate(env.DB, [address], listId)).refusal(address, kind, listId)
}

function captureLogs(): string[] {
  const lines: string[] = []
  for (const method of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    })
  }
  return lines
}

const stored = (iso: string) => iso.slice(0, 19).replace('T', ' ')

beforeAll(async () => {
  signer = await makeSigner()
})

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.complaintStops = true
  snsBehavior.certificate = signer.pem
  for (const table of ['mail_list_choices', 'mail_contacts', 'mail_do_not_send']) await env.DB.prepare(`DELETE FROM ${table}`).run()
  await env.DB.prepare('DELETE FROM mail_lists WHERE id NOT IN (?, ?)').bind(NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID).run()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the methods the address answers', () => {
  it('has a handler for POST and for OPTIONS and none for any method that could read or change a row another way', () => {
    const handlers = Object.keys(receiver).filter((name) => /^onRequest/.test(name)).sort()
    expect(handlers).toEqual(['onRequestOptions', 'onRequestPost'])
  })

  it('answers a signed-in session no differently from a stranger: the same 400 for a forgery, whatever the caller holds', async () => {
    const forged = await signer.forge({ Message: JSON.stringify(sesBounce([eventAddress('dead')])) })
    const bare = await post(forged)
    const cookie = await post(forged, { headers: { Cookie: 'session=sample-session', Authorization: 'Bearer sample-token' } })
    expect([bare.status, cookie.status]).toEqual([400, 400])
    expect(await cookie.json()).toEqual(await bare.json())
    expect((await tables()).doNotSend).toEqual([])
  })
})

describe('two copies of one notification at the same moment', () => {
  it('leaves one bounce row, with the earlier copy\'s row and time, when five copies are posted together', async () => {
    const address = eventAddress('dead')
    const message = await notify(sesBounce([address]))
    const answers = await Promise.all(Array.from({ length: 5 }, () => post(message)))
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200, 200])
    const { doNotSend, contacts, choices } = await tables()
    expect(doNotSend).toHaveLength(1)
    expect(doNotSend[0]).toMatchObject({ address, reason: 'bounce', detail: 'General' })
    expect([contacts, choices]).toEqual([[], []])
  })

  it('leaves one contact, one choice and one mark when five copies of a spam report are posted together', async () => {
    const address = listAddress('reader')
    const at = new Date(Date.now() - 10 * 60_000).toISOString()
    const message = await notify(sesComplaint([address], { timestamp: at, tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    const answers = await Promise.all(Array.from({ length: 5 }, () => post(message)))
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200, 200])
    const { contacts, choices, doNotSend } = await tables()
    expect(contacts).toHaveLength(1)
    expect(choices).toEqual([expect.objectContaining({ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' })])
    expect((contacts[0] as { complained_at: string }).complained_at).toBe(stored(at))
    expect(doNotSend).toEqual([])
  })

  it('makes one contact for an address that two different reports name at the same moment, each on its own list', async () => {
    const address = listAddress('reader')
    const one = await notify(sesComplaint([address], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    const two = await notify(sesComplaint([address], { tags: reportedTags({ kind: 'optional', list: TOURNAMENTS_LIST_ID }) }))
    const answers = await Promise.all([post(one), post(two), post(one), post(two)])
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200])
    expect(await all(`SELECT COUNT(*) AS n FROM mail_contacts WHERE address = '${address}'`)).toEqual([{ n: 1 }])
    expect(await choicesOf(address)).toEqual([
      { list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' },
      { list_id: TOURNAMENTS_LIST_ID, choice: 'out', source: 'complaint' },
    ])
  })

  it('writes the same rows for a copy of one bounce signed again under another message id, so nothing rests on the id', async () => {
    const address = eventAddress('dead')
    const event = sesBounce([address])
    expect((await post(await notify(event, { MessageId: '00000000-0000-4000-8000-0000000000a1' }))).status).toBe(200)
    await env.DB.prepare('UPDATE mail_do_not_send SET created_at = ?').bind('2026-11-01 10:00:00').run()
    expect((await post(await notify(event, { MessageId: '00000000-0000-4000-8000-0000000000a2' }))).status).toBe(200)
    expect(await tables().then((t) => t.doNotSend)).toEqual([{ address, reason: 'bounce', detail: 'General', created_at: '2026-11-01 10:00:00' }])
  })
})

describe('an address already on the do-not-send list', () => {
  it('keeps an LCA admin\'s row as it was, its reason, detail and time, when a bounce names the address', async () => {
    const address = eventAddress('held')
    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail, created_at) VALUES (?, 'admin', 'Sample note from an officer', '2026-10-01 09:00:00')`).bind(address).run()
    expect((await post(await notify(sesBounce([address])))).status).toBe(200)
    expect((await tables()).doNotSend).toEqual([{ address, reason: 'admin', detail: 'Sample note from an officer', created_at: '2026-10-01 09:00:00' }])
  })

  it('stops the mail of every kind to a bounced address, optional as well as event, and a spam report on it makes no do-not-send row', async () => {
    const dead = listAddress('dead')
    expect((await post(await notify(sesBounce([dead])))).status).toBe(200)
    expect(await gateSays(dead, 'event')).toBe('do_not_send')
    expect(await gateSays(dead, 'optional', NEWSLETTER_LIST_ID)).toBe('do_not_send')
    expect(await gateSays(dead, 'optional', TOURNAMENTS_LIST_ID)).toBe('do_not_send')
    const reader = listAddress('reader')
    expect((await post(await notify(sesComplaint([reader], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })))).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([dead])
  })
})

describe('what a bounce is allowed to store', () => {
  it('stores the bounce\'s kind only when it is a word of letters, and null for anything else, or for none', async () => {
    const cases: Array<[string | undefined, string | null]> = [
      ['NoEmail', 'NoEmail'], ['General', 'General'], ['Suppressed', 'Suppressed'],
      ['General; contact victim@example.org', null], ['x'.repeat(65), null], ['', null], ['Gen\neral', null], [undefined, null],
    ]
    for (const [subType, expected] of cases) {
      const address = eventAddress('dead')
      const event = sesBounce([address])
      if (subType === undefined) delete (event.bounce as { bounceSubType?: string }).bounceSubType
      else event.bounce.bounceSubType = subType
      expect((await post(await notify(event))).status, String(subType)).toBe(200)
      const row = (await tables()).doNotSend.find((r) => r.address === address) as { reason: string; detail: string | null } | undefined
      expect([row?.reason, row?.detail], String(subType)).toEqual(['bounce', expected])
    }
  })

  it('writes nothing for a bounce that names no address, an empty list, or a list that is not one', async () => {
    const counted = countingDb()
    for (const bouncedRecipients of [[], undefined, null, 'dead@example.org', { emailAddress: 'dead@example.org' }, [{}], [{ emailAddress: 7 }], [null]]) {
      const event = sesBounce([eventAddress('dead')])
      ;(event.bounce as { bouncedRecipients?: unknown }).bouncedRecipients = bouncedRecipients
      expect((await post(await notify(event), { env: { DB: counted.db } })).status, JSON.stringify(bouncedRecipients)).toBe(200)
    }
    expect(counted.ran).toEqual([])
    expect((await tables()).doNotSend).toEqual([])
  })

  it('writes nothing for a spam report that names no address', async () => {
    const counted = countingDb()
    for (const complainedRecipients of [[], undefined, 'dead@example.org', [{}], [{ emailAddress: null }]]) {
      const event = sesComplaint([listAddress('reader')], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })
      ;(event.complaint as { complainedRecipients?: unknown }).complainedRecipients = complainedRecipients
      expect((await post(await notify(event), { env: { DB: counted.db } })).status).toBe(200)
    }
    expect(counted.ran).toEqual([])
    expect(await tables().then((t) => t.contacts)).toEqual([])
  })

  it(`reads no more than ${MOST_ADDRESSES} addresses of one event, the first ${MOST_ADDRESSES}`, async () => {
    const names = Array.from({ length: MOST_ADDRESSES + 10 }, (_, i) => `bulk-${i}-${++seq}@example.org`)
    expect((await post(await notify(sesBounce(names)))).status).toBe(200)
    const written = (await tables()).doNotSend.map((r) => r.address).sort()
    expect(written).toEqual(names.slice(0, MOST_ADDRESSES).sort())
  })
})

describe('the mark at the instants America/Chicago changes its clock', () => {
  // The mark is a time in UTC, as datetime('now') writes one and as the gate compares it, so the local clock's
  // changes (the fall back on Sunday, November 1, 2026 and the spring forward on Sunday, March 8, 2026) and
  // Chicago's midnight move it by nothing: each instant is written as the same wall time in UTC.
  const instants = [
    '2026-11-01T06:59:59.999Z', // one millisecond before the clocks fall back in Chicago
    '2026-11-01T07:00:00.000Z', // the hour that repeats begins its second pass
    '2026-11-02T05:59:59Z', // the last second before Chicago's midnight on Monday, November 2, 2026
    '2026-11-02T06:00:00Z', // Chicago's midnight, Monday, November 2, 2026
    '2026-03-08T07:59:59Z', // the last second before the clocks spring forward in Chicago
    '2026-03-08T08:00:00Z',
    '2025-12-31T23:59:59Z', // the last second of a year in UTC
  ]

  it('writes each report instant as the same wall time in UTC, the fraction cut and never rounded up', async () => {
    for (const timestamp of instants) {
      const address = listAddress('reader')
      expect((await post(await notify(sesComplaint([address], { timestamp, tags: reportedTags({ kind: 'event' }) })))).status, timestamp).toBe(200)
      // Only the notification's own age is limited, so a report time well before it is written as it is.
      expect((await contactOf(address))!.complained_at, timestamp).toBe(`${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`)
    }
  })

  it('orders two reports across the fall back by the instant and not by the wall time Chicago shows twice', async () => {
    const address = listAddress('reader')
    // 1:30 AM in Chicago happens twice on Sunday, November 1, 2026: at 6:30 AM UTC (CDT) and at 7:30 AM UTC (CST).
    const second = await notify(sesComplaint([address], { timestamp: '2026-11-01T07:30:00Z', tags: reportedTags({ kind: 'event' }) }))
    const first = await notify(sesComplaint([address], { timestamp: '2026-11-01T06:30:00Z', tags: reportedTags({ kind: 'event' }) }))
    expect((await post(second)).status).toBe(200)
    expect((await post(first)).status).toBe(200)
    expect((await contactOf(address))!.complained_at).toBe('2026-11-01 07:30:00')
  })

  it('reads a report time that is not in Amazon\'s form, an offset form among them, as no time of its own: the mark takes the notification\'s own time', async () => {
    const at = new Date(Date.now() - 5 * 60_000).toISOString()
    for (const timestamp of ['2026-11-01T01:30:00-05:00', '2026-11-01 01:30:00', 'yesterday', '', '1778547845678']) {
      const address = listAddress('reader')
      expect((await post(await notify(sesComplaint([address], { timestamp, tags: reportedTags({ kind: 'event' }) }), { Timestamp: at }))).status, timestamp).toBe(200)
      expect((await contactOf(address))!.complained_at, timestamp).toBe(stored(at))
    }
  })

  it('never writes a mark later than the notification that carries it: a report time a day ahead is cut to the notification\'s own', async () => {
    const address = listAddress('reader')
    const at = new Date(Date.now() - 2 * 60_000).toISOString()
    const ahead = new Date(Date.now() + 24 * 3_600_000).toISOString()
    expect((await post(await notify(sesComplaint([address], { timestamp: ahead, tags: reportedTags({ kind: 'event' }) }), { Timestamp: at })) ).status).toBe(200)
    expect((await contactOf(address))!.complained_at).toBe(stored(at))
  })

  it('takes a notification whose Timestamp has a fraction of nine digits, and one at midnight Chicago time, as fresh', async () => {
    const now = new Date()
    const ninePlaces = `${now.toISOString().slice(0, 19)}.${String(now.getUTCMilliseconds()).padStart(3, '0')}123456Z`
    const address = eventAddress('dead')
    expect((await post(await notify(sesBounce([address]), { Timestamp: ninePlaces }))).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([address])
  })
})

describe('a list tag that is not a list, and the main mailer a report was not pressed on', () => {
  it('reads only the tag\'s first value, and writes no list choice for a tag that is not a list name, with the mark still written', async () => {
    const tagsOf = (value: unknown) => ({ ...reportedTags({ kind: 'optional' }), list: value as string[] })
    const tags: unknown[] = [[], [''], [7], [null], 'lca-newsletter', { 0: 'lca-newsletter' }, [`${NEWSLETTER_LIST_ID} `], [NEWSLETTER_LIST_ID.toUpperCase()]]
    for (const value of tags) {
      const address = listAddress('reader')
      const res = await post(await notify(sesComplaint([address], { tags: tagsOf(value) })))
      expect(res.status, JSON.stringify(value)).toBe(200)
      expect(await choicesOf(address), JSON.stringify(value)).toEqual([])
      expect((await contactOf(address))!.complained_at, JSON.stringify(value)).not.toBeNull()
    }
    // The first value counts and a second never does.
    const address = listAddress('reader')
    expect((await post(await notify(sesComplaint([address], { tags: { ...reportedTags({ kind: 'optional' }), list: [NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID] } })))).status).toBe(200)
    expect(await choicesOf(address)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
  })

  it('leaves a report with no tags at all to the mark alone, and makes no choice for a message with no mail tags object', async () => {
    const address = listAddress('reader')
    const event = sesComplaint([address])
    delete (event.mail as { tags?: unknown }).tags
    expect((await post(await notify(event))).status).toBe(200)
    expect(await choicesOf(address)).toEqual([])
    expect((await contactOf(address))!.complained_at).not.toBeNull()
  })

  it('stops the list the report was pressed on and no other main mailer: the tournament list is kept, with the mark set, and a list that is not a main mailer is stopped', async () => {
    await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer, club_id) VALUES (?, 'club', 'Example Chess Club news', 0, NULL)`).bind(CLUB_LIST).run()
    const person = listAddress('member')
    expect((await post(await notify(sesComplaint([person], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })))).status).toBe(200)
    expect(await gateSays(person, 'optional', NEWSLETTER_LIST_ID)).toBe('opted_out')
    expect(await gateSays(person, 'optional', TOURNAMENTS_LIST_ID)).toBeNull()
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBe('opted_out')
    expect(await gateSays(person, 'event')).toBeNull()
    expect(await choicesOf(person)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
  })

  it('turns an earlier \'in\' on the list it was pressed on to \'out\' from the report, the contact kept, and leaves the same person\'s \'in\' on another list as it was', async () => {
    const person = listAddress('member')
    const id = await seedMailContact({
      address: person,
      // The 'in' on the newsletter an hour before the report, which a report turns out only when it is the newer.
      choices: {
        [NEWSLETTER_LIST_ID]: { choice: 'in', source: 'preferences', at: stored(new Date(Date.now() - 60 * 60_000).toISOString()) },
        [TOURNAMENTS_LIST_ID]: { choice: 'in', source: 'preferences' },
      },
    })
    expect((await post(await notify(sesComplaint([person], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })))).status).toBe(200)
    expect((await contactOf(person))!.id).toBe(id)
    expect(await choicesOf(person)).toEqual([
      { list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' },
      { list_id: TOURNAMENTS_LIST_ID, choice: 'in', source: 'preferences' },
    ])
    expect(await gateSays(person, 'optional', TOURNAMENTS_LIST_ID)).toBeNull()
  })

  it('writes nothing for a person who already stopped the list themselves, with the mark moving only later, never the choice\'s source', async () => {
    const person = listAddress('member')
    await seedMailContact({ address: person, complainedAt: '2026-11-05 10:00:00', choices: { [NEWSLETTER_LIST_ID]: { choice: 'out', source: 'preferences', at: '2026-11-04 10:00:00' } } })
    const older = new Date(Date.UTC(2026, 10, 4, 12, 0, 0)).toISOString()
    // Older than the mark already held: the mark stays; and the choice stays the person's own.
    expect((await post(await notify(sesComplaint([person], { timestamp: older, tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })))).status).toBe(200)
    expect((await contactOf(person))!.complained_at).toBe('2026-11-05 10:00:00')
    expect(await all(`SELECT updated_at FROM mail_list_choices WHERE list_id = '${NEWSLETTER_LIST_ID}'`)).toEqual([{ updated_at: '2026-11-04 10:00:00' }])
    expect(await choicesOf(person)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'preferences' }])
  })
})

describe('an unsubscribe confirmation that is not the topic\'s', () => {
  it('answers 400 to one signed by another key, or naming another topic, with no warning line and nothing written', async () => {
    const lines = captureLogs()
    const counted = countingDb()
    const forged = await signer.forge({ Type: 'UnsubscribeConfirmation' })
    expect((await post(forged, { env: { DB: counted.db } })).status).toBe(400)
    const other = await signer.sign({ Type: 'UnsubscribeConfirmation', TopicArn: 'arn:aws:sns:us-east-1:000000000000:another-topic' })
    expect((await post(other, { env: { DB: counted.db } })).status).toBe(400)
    expect(lines.filter((l) => l === RECEIVER_LOG.unsubscribed)).toEqual([])
    expect(counted.ran).toEqual([])
    expect(snsConfirmations).toEqual([])
  })

  it('does not fetch a confirmation\'s SubscribeURL when the confirmation is forged, though the URL is SNS\'s own', async () => {
    const forged = await signer.forge({ Type: 'SubscriptionConfirmation' })
    expect((await post(forged)).status).toBe(400)
    expect(snsConfirmations).toEqual([])
    // The one fetch made is the certificate's, from SNS's own host.
    expect(fetchCount).toBe(1)
  })
})
