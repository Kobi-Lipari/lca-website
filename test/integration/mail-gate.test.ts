// test/integration/mail-gate.test.ts
//
// The do-not-send gate of WS16 step 2 on every send path, through the real
// handlers, the real seam and the daily-emails worker's own scheduled
// handler, on the D1 database every integration test builds from the
// migrations, 0060 among them. MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN and
// COMPLAINT_STOPS_OTHER_SENDERS are read through getters on the mocked
// functions/utils/mail/switches, set before every case, so one file runs
// each case with the engine's rules off and on and no shipped value decides
// one. Nothing here reaches an outside service: the harness answers Resend,
// US Chess, Stripe and the sign-in service.
//
// - (a) With the rules off a row on the do-not-send list changes nothing,
//   and nothing reads the mail tables.
// - (b) With the rules on an address on the list gets no registration
//   confirmation, support reply, waitlist offer, announce email (counted in
//   failed), registration-open notice or reminder from the daily run, whose
//   rows are marked so no later run tries them; a send whose answer is lost
//   after the service took it stays marked, so it is never sent twice; and
//   Group email's batch reads one gate and writes the seam's words.
// - (c) A walk-in placeholder is never mailed, even from the reminders'
//   queries that have no walk-in filter.
// - (d) An 'out' choice, a stop-all mark and a spam report's mark stop no
//   event or account mail, while list mail is held to every choice.
// - (e) A loop reads its gate in one query for each 90 addresses.
// - (f) With the rules on and no row anywhere, every kind of email
//   test/integration/emails.test.ts sends still arrives.
// - (g) The daily run on the free plan's budget sends its reminders first,
//   25 at most, gives the rating lookups what is left, and stays under 50
//   outside calls and 50 queries. It takes the reminders whose queries name
//   one day before the registration-open reminders, so the next day's run
//   sends the registration-open rows the cap left, and the week-before rows
//   past the cap, whose day has gone, are not read again (a follow-up for
//   WS16 step 4 in REDESIGN_STATUS.md).
// - (h) A call the runtime refuses for the limit gives its claim back, ends
//   the phase, and the next day's run sends that registration-open reminder.
// - (i) Two notice loops over the same rows, or a loop and the daily run,
//   send each notice once.
// - (j) A gate that cannot be read lets event mail through, with one log
//   line that names no address, and holds list mail back.
// - (k) With the rules off the daily run keeps today's order and today's
//   marks.
//
// Since WS16 step 3 every list message here carries the one-click headers
// list mail must carry, and list mail the gate lets through waits for
// Amazon SES while Resend sends, so where these cases once saw it sent they
// see it wait, and the outbox stays empty of it.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM } from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestPost as ticketReply } from '../../functions/api/admin/support/[id]'
import { onRequestPost as announcePost } from '../../functions/api/admin/tournaments/[id]/announce'
import { onRequestPatch as registrationStatusPatch } from '../../functions/api/admin/tournaments/[id]/registration'
import { onRequestPost as waitlistPost } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { onRequestPost as contactPost } from '../../functions/api/contact'
import { onRequestPost as childrenPost } from '../../functions/api/me/children'
import { onRequestPost as registrationPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPost as webhookPost } from '../../functions/api/stripe/webhook'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { processCampaign } from '../../functions/utils/admin/campaigns'
import { GATE_UNREAD_LOG } from '../../functions/utils/mail/gate'
import { deliver, GATE_UNREAD_WORDS, REFUSAL_WORDS, TOO_MANY_OUTSIDE_CALLS, WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'
import { notifyRegistrationOpen } from '../../functions/utils/registration/registrationOpenNotify'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'
import {
  emailBehavior, emailOutbox, fetchCount, flushWaitUntil, invoke, resetHarness, signStripePayload, stripeSessions, uscfBehavior,
} from './harness'
import {
  bell, bindings, countingDb, dayFromToday, dueToday, holdClock, mailTo, message, nextSeq, noLongerReceives, ONE_CLICK_HEADERS, rated, recordHosts, reminderRow,
  runDaily,
} from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: false, sender: 'resend', plan: 'free', complaintStops: true }))
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
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const subjectsTo = (address: string) => mailTo(address).map((e) => e.subject).sort()

/** How many first attendee reminders the event has on record for the member: the row is the reminder's mark. */
const attendeeSent = (tournamentId: string, memberId: string) =>
  env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_attendee_reminders WHERE tournament_id = ? AND member_id = ? AND reminder_number = 1')
    .bind(tournamentId, memberId).first<{ n: number }>().then((r) => r?.n ?? 0)

beforeEach(async () => {
  resetHarness()
  flags.listsOn = false
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  // Each case starts with no reminder due anywhere and nothing in the mail tables but the two lists of 0060.
  for (const table of ['tournament_attendee_reminders', 'tournament_reminders', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
  await env.DB.prepare(`DELETE FROM mail_lists WHERE id NOT IN ('lca-newsletter', 'lca-tournaments')`).run()
  await env.DB.prepare(`UPDATE tournaments SET reminder_1_enabled = 0, reminder_2_enabled = 0, registration_status = 'closed'`).run()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('(a) with the engine\'s rules off', () => {
  it('a row on the do-not-send list changes nothing: the registration confirmation goes as today, and no statement reads a mail table', async () => {
    await noLongerReceives('free.player@example.org')
    const memberId = await seedMember({ email: 'free.player@example.org' })
    const tournamentId = await seedTournament({ name: 'Free Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    const { db, ran } = countingDb()
    const res = await invoke(registrationPost, { method: 'POST', as: memberId, body: { tournamentId, section: 'Open' }, env: { DB: db } })
    expect(res.status).toBe(201)
    expect(subjectsTo('free.player@example.org')).toEqual(['You\'re registered: Free Swiss'])
    expect(ran.length).toBeGreaterThan(0)
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
  })

  it('the daily run mails an address on the list as today, and reads no mail table', async () => {
    await noLongerReceives('still.mailed@example.org')
    await dueToday(['still.mailed@example.org'])
    const { db, ran } = countingDb()
    await runDaily(db)
    expect(mailTo('still.mailed@example.org')).toHaveLength(3)
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
  })
})

describe('(b) with the rules on, an address on the do-not-send list', () => {
  beforeEach(async () => {
    flags.listsOn = true
    await noLongerReceives('gone@example.org')
  })

  it('gets no registration confirmation, while the entry stands and the other entrant is confirmed; the log names the refusal, not the address', async () => {
    const warn = vi.spyOn(console, 'warn')
    const tournamentId = await seedTournament({ name: 'Free Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    for (const address of ['gone@example.org', 'here@example.org']) {
      const res = await invoke(registrationPost, { method: 'POST', as: await seedMember({ email: address }), body: { tournamentId, section: 'Open' } })
      expect(res.status, address).toBe(201)
    }
    expect(mailTo('gone@example.org')).toEqual([])
    expect(subjectsTo('here@example.org')).toEqual(['You\'re registered: Free Swiss'])
    expect(warn.mock.calls).toContainEqual([REFUSAL_WORDS.do_not_send])
    expect(JSON.stringify(warn.mock.calls)).not.toContain('gone@example.org')
  })

  it('gets no support reply, while the staff are told of the ticket', async () => {
    const created = await invoke(supportPost, { method: 'POST', body: { name: 'Gone Visitor', email: 'gone@example.org', subject: 'Parking', body: 'Where do we park?' } })
    expect(created.status).toBe(201)
    const { ticketId } = await created.json<{ ticketId: string }>()
    const reply = await invoke(ticketReply, { method: 'POST', as: await seedAdmin(), params: { id: ticketId }, body: { body: 'Use the north lot.' } })
    expect(reply.status).toBe(201)
    expect(mailTo('gone@example.org')).toEqual([])
    expect(emailOutbox.map((e) => e.subject)).toContainEqual(expect.stringMatching(/^Parking \(from Gone Visitor\)/))
  })

  it('gets no waitlist offer, while the other waitlisted player does', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ name: 'Paid Swiss', maxPlayers: 2, sections: [{ name: 'Open', entryFee: 20 }] })
    for (const address of ['gone@example.org', 'here@example.org']) {
      const registrationId = await seedRegistration({ tournamentId, memberId: await seedMember({ email: address }), paymentStatus: 'pending' })
      await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(registrationId).run()
      const offered = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId } })
      expect(offered.status, address).toBe(200)
    }
    expect(mailTo('gone@example.org')).toEqual([])
    expect(subjectsTo('here@example.org')).toEqual(['A spot opened: Paid Swiss'])
  })

  it('gets no announce email and is counted in failed, with no call to the mail service for it', async () => {
    const tournamentId = await seedTournament({ name: 'Bayou Open' })
    for (const address of ['gone@example.org', 'here@example.org']) await seedRegistration({ tournamentId, memberId: await seedMember({ email: address }) })
    const admin = await seedAdmin()
    const hosts = recordHosts()
    try {
      const res = await invoke(announcePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' } })
      expect(await res.json()).toEqual({ sent: 1, failed: 1, total: 2 })
    } finally {
      hosts.stop()
    }
    expect(emailOutbox.map((e) => e.to)).toEqual(['here@example.org'])
    // One call to the mail service, for the entrant who got the email: none was made for the refused one.
    expect(hosts.hosts.filter((h) => h === 'api.resend.com')).toHaveLength(1)
  })

  it('gets no registration-open notice, and its row is marked so the morning run does not try it either', async () => {
    const tournamentId = await seedTournament({ name: 'Bayou Open', registrationStatus: 'draft' })
    const goneRow = await bell(tournamentId, await seedMember({ email: 'gone@example.org' }), 'gone@example.org')
    const hereRow = await bell(tournamentId, await seedMember({ email: 'here@example.org' }), 'here@example.org')
    const res = await invoke(registrationStatusPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: tournamentId }, body: { registration_status: 'open' } })
    expect(res.status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox.map((e) => e.to)).toEqual(['here@example.org'])
    for (const id of [goneRow, hereRow]) {
      const row = await reminderRow(id)
      expect(row?.sent_registration_open, id).toBe(1)
      expect(row?.registration_opened_notified_at, id).not.toBeNull()
    }
    await runDaily()
    expect(emailOutbox.map((e) => e.to)).toEqual(['here@example.org'])
  })

  it('gets none of the daily run\'s three reminders, and its rows are marked so no later run tries them', async () => {
    const { open, soon, entered, rows } = await dueToday(['gone@example.org', 'here@example.org'])
    await runDaily()
    expect(mailTo('gone@example.org')).toEqual([])
    const name = async (id: string) => (await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(id).first<{ name: string }>())!.name
    // In the order subjectsTo sorts them: the week-before, the registration-open and the attendee reminder.
    expect(subjectsTo('here@example.org')).toEqual([
      `One week to go: ${await name(soon)}`,
      `Registration is open: ${await name(open)}`,
      expect.stringMatching(/^See you .* at Crescent Swiss/),
    ])
    const gone = rows['gone@example.org']
    expect(await reminderRow(gone.open)).toMatchObject({ sent_registration_open: 1 })
    expect(await reminderRow(gone.soon)).toMatchObject({ sent_week_before: 1 })
    expect(await attendeeSent(entered, gone.member)).toBe(1)
    await runDaily()
    expect(emailOutbox).toHaveLength(3)
  })

  it('a send whose answer is lost after the service took it stays marked, so the next run sends nothing twice', async () => {
    const { entered, rows } = await dueToday(['lost.answer@example.org'])
    emailBehavior.loseAnswer = 3
    await runDaily()
    expect(mailTo('lost.answer@example.org')).toHaveLength(3)
    expect(emailBehavior.loseAnswer).toBe(0)
    const lost = rows['lost.answer@example.org']
    expect(await reminderRow(lost.open)).toMatchObject({ sent_registration_open: 1 })
    expect(await reminderRow(lost.soon)).toMatchObject({ sent_week_before: 1 })
    expect(await attendeeSent(entered, lost.member)).toBe(1)
    await runDaily()
    expect(mailTo('lost.answer@example.org')).toHaveLength(3)
  })

  it('Group email\'s batch reads one gate for its recipients, and the refused one is written off in the seam\'s words', async () => {
    const id = `campaign-${nextSeq()}`
    await env.DB.prepare(`INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients) VALUES (?, 'Fall news', '<p>Hi</p>', '{}', 2)`).bind(id).run()
    for (const address of ['gone@example.org', 'here@example.org']) {
      await env.DB.prepare(`INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email) VALUES (?, ?, NULL, ?)`).bind(`${id}-${address}`, id, address).run()
    }
    const { db, ran } = countingDb()
    expect(await processCampaign({ ...bindings, DB: db } as never, id)).toEqual({ sent: 1, failed: 1, remaining: 0, done: true })
    expect(emailOutbox.map((e) => e.to)).toEqual(['here@example.org'])
    expect(ran.filter((r) => r.sql.includes('mail_do_not_send')).map((r) => r.binds)).toEqual([2])
    const refused = await env.DB.prepare('SELECT status, error, attempts FROM email_campaign_recipients WHERE id = ?').bind(`${id}-gone@example.org`).first()
    expect(refused).toEqual({ status: 'failed', error: REFUSAL_WORDS.do_not_send, attempts: 1 })
  })
})

describe('(c) a walk-in placeholder', () => {
  it('is never mailed with the rules on, even from the two reminder queries that have no walk-in filter, and its rows are marked', async () => {
    flags.listsOn = true
    const placeholder = `guest-${nextSeq()}@walkin.lca.invalid`
    const guestId = await seedMember({ email: placeholder, role: 'guest' })
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const soon = await seedTournament({ registrationStatus: 'closed', date: dayFromToday(7) })
    const openRow = await bell(open, guestId, placeholder)
    const soonRow = await bell(soon, guestId, placeholder, { registrationOpen: 1 })
    await runDaily()
    expect(emailOutbox.filter((e) => e.to.endsWith('.invalid'))).toEqual([])
    expect(await reminderRow(openRow)).toMatchObject({ sent_registration_open: 1 })
    expect(await reminderRow(soonRow)).toMatchObject({ sent_week_before: 1 })

    const draft = await seedTournament({ name: 'Walk-in Blitz', registrationStatus: 'draft' })
    await bell(draft, guestId, placeholder)
    await notifyRegistrationOpen(bindings as never, draft, 'Walk-in Blitz')
    expect(emailOutbox).toEqual([])
  })
})

describe('(d) a person\'s choices', () => {
  /** A contact for the address, with its marks, and its choice on the newsletter. */
  async function contact(address: string, marks: { optionalOff?: boolean; complained?: boolean; newsletter?: 'in' | 'out' }) {
    const id = `${nextSeq()}`.padStart(32, '0')
    await env.DB.prepare(
      `INSERT INTO mail_contacts (id, address, optional_off_at, complained_at) VALUES (?, ?, CASE WHEN ? THEN datetime('now') END, CASE WHEN ? THEN datetime('now', '-1 day') END)`,
    ).bind(id, address, marks.optionalOff ? 1 : 0, marks.complained ? 1 : 0).run()
    if (marks.newsletter) {
      await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, ?, ?, 'link')`).bind(id, NEWSLETTER_LIST_ID, marks.newsletter).run()
    }
    return id
  }

  it('stop no event or account mail with the rules on: an \'out\' on the newsletter, a stop-all mark and a spam report\'s mark', async () => {
    flags.listsOn = true
    await contact('kim.parent@test.lca', { optionalOff: true, complained: true, newsletter: 'out' })
    const tournamentId = await seedTournament({ name: 'Free Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    const res = await invoke(registrationPost, { method: 'POST', as: await seedMember({ email: 'kim.parent@test.lca' }), body: { tournamentId, section: 'Open' } })
    expect(res.status).toBe(201)
    await dueToday(['kim.parent@test.lca'])
    await runDaily()
    expect(mailTo('kim.parent@test.lca')).toHaveLength(4)
    // A test send is never refused for a choice either.
    expect(await deliver(bindings as never, message('kim.parent@test.lca', { kind: 'test' }))).toEqual({ ok: true })
  })

  it('hold list mail, whatever the constants say: an \'out\' on the list and a stop-all mark stop it, and the do-not-send list too', async () => {
    await contact('out@test.lca', { newsletter: 'out' })
    await contact('stopped@test.lca', { optionalOff: true })
    await noLongerReceives('dead@test.lca')
    const list = (to: string) => message(to, { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS })
    for (const listsOn of [false, true]) {
      flags.listsOn = listsOn
      expect(await deliver(bindings as never, list('out@test.lca'))).toEqual({ ok: false, refused: 'opted_out', error: REFUSAL_WORDS.opted_out })
      expect(await deliver(bindings as never, list('stopped@test.lca'))).toEqual({ ok: false, refused: 'opted_out', error: REFUSAL_WORDS.opted_out })
      expect(await deliver(bindings as never, list('dead@test.lca'))).toEqual({ ok: false, refused: 'do_not_send', error: REFUSAL_WORDS.do_not_send })
      // What the gate lets through waits for Amazon SES while Resend sends (WS16 step 3), so nothing reaches the outbox.
      expect(await deliver(bindings as never, list('reader@test.lca'))).toEqual({ ok: false, waitForSes: true, error: WAIT_FOR_SES_WORDS })
    }
    expect(emailOutbox).toEqual([])
  })

  it('hold list mail and test sends to the names no list sends to, while event mail still reaches them', async () => {
    flags.listsOn = true
    for (const to of ['pat.member@example.org', DEFAULT_FROM, 'walk-in@walkin.lca.invalid']) {
      for (const kind of ['optional', 'test'] as const) {
        const result = await deliver(bindings as never, message(to, kind === 'optional' ? { kind, listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS } : { kind }))
        expect(result, `${kind} to ${to}`).toEqual({ ok: false, refused: 'not_sendable', error: REFUSAL_WORDS.not_sendable })
      }
    }
    expect(await deliver(bindings as never, message('pat.member@example.org'))).toEqual({ ok: true })
    expect(emailOutbox.map((e) => e.to)).toEqual(['pat.member@example.org'])
  })

  it('let a spam report stop only the lists that are not main mailers, while the setting holds and until the person turns the list back on', async () => {
    flags.listsOn = true
    await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer) VALUES ('club-example', 'club', 'Example Chess Club news', 0)`).run()
    const reporter = await contact('reporter@test.lca', { complained: true })
    const club = message('reporter@test.lca', { kind: 'optional', listId: 'club-example', headers: ONE_CLICK_HEADERS })
    const newsletter = message('reporter@test.lca', { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS })
    // Since WS16 step 3 what the gate lets through waits for Amazon SES while Resend sends, so a pass reads waitForSes.
    const passed = { ok: false, waitForSes: true, error: WAIT_FOR_SES_WORDS }
    expect(await deliver(bindings as never, club)).toMatchObject({ ok: false, refused: 'opted_out' })
    expect(await deliver(bindings as never, newsletter)).toEqual(passed)
    flags.complaintStops = false
    expect(await deliver(bindings as never, club)).toEqual(passed)
    flags.complaintStops = true
    await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, 'club-example', 'in', 'preferences')`).bind(reporter).run()
    expect(await deliver(bindings as never, club)).toEqual(passed)
    expect(emailOutbox).toEqual([])
  })
})

describe('(e) one query for each 90 addresses', () => {
  it('a daily phase over 120 rows reads its gate in two queries, of 90 and 30 addresses, counted on the database the run is given', async () => {
    flags.listsOn = true
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    for (let i = 0; i < 120; i++) {
      const address = `bell${i}@example.org`
      await bell(open, await seedMember({ email: address }), address)
    }
    const { db, ran } = countingDb()
    await runDaily(db)
    expect(ran.filter((r) => r.sql.includes('mail_do_not_send')).map((r) => r.binds)).toEqual([90, 30])
    // The free plan's budget sends 25 of them today.
    expect(emailOutbox).toHaveLength(25)
  })

  it('the director\'s announce reads its gate once for all its entrants, counted on the database invoke is given', async () => {
    flags.listsOn = true
    const tournamentId = await seedTournament({ name: 'Bayou Open' })
    for (let i = 0; i < 3; i++) await seedRegistration({ tournamentId, memberId: await seedMember({ email: `entrant${i}@example.org` }) })
    const { db, ran } = countingDb()
    const res = await invoke(announcePost, { method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' }, env: { DB: db } })
    expect(await res.json()).toEqual({ sent: 3, failed: 0, total: 3 })
    expect(ran.filter((r) => r.sql.includes('mail_do_not_send')).map((r) => r.binds)).toEqual([3])
  })
})

describe('(f) with the rules on and no row anywhere', () => {
  beforeEach(() => {
    flags.listsOn = true
  })

  async function webhook(sessionId: string, metadata: Record<string, string>) {
    const rawBody = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: sessionId, payment_intent: 'pi_test', metadata } } })
    const res = await invoke(webhookPost, { method: 'POST', rawBody, headers: { 'stripe-signature': await signStripePayload(rawBody) } })
    expect(res.status).toBe(200)
  }

  it('a support ticket\'s acknowledgment and its staff copy arrive, and the contact form\'s', async () => {
    expect((await invoke(supportPost, { method: 'POST', body: { name: 'A', email: 'a@example.org', subject: 'One', body: 'x' } })).status).toBe(201)
    expect((await invoke(contactPost, { method: 'POST', body: { name: 'B', email: 'b@example.org', subject: 'Two', body: 'y' } })).status).toBe(201)
    expect(subjectsTo('a@example.org')).toEqual(['We got your message'])
    expect(subjectsTo('b@example.org')).toEqual(['We got your message'])
    expect(mailTo(bindings.CONTACT_EMAIL).map((e) => e.subject)).toContainEqual(expect.stringMatching(/^Two \(from B\)/))
  })

  it('a free entry\'s confirmation, a paid entry\'s once its payment arrives, and a family\'s one email arrive', async () => {
    const free = await seedMember({ email: 'free@example.org' })
    const freeEvent = await seedTournament({ name: 'Free Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    expect((await invoke(registrationPost, { method: 'POST', as: free, body: { tournamentId: freeEvent, section: 'Open' } })).status).toBe(201)

    const paid = await seedMember({ email: 'paid@example.org' })
    const paidEvent = await seedTournament({ name: 'Paid Swiss', sections: [{ name: 'Open', entryFee: 40 }] })
    expect((await invoke(registrationPost, { method: 'POST', as: paid, body: { tournamentId: paidEvent, section: 'Open' } })).status).toBe(201)
    const session = stripeSessions.at(-1)!
    await webhook(session.id, session.metadata)
    await webhook(session.id, session.metadata)

    const parent = await seedMember({ email: 'parent@example.org', fullName: 'Pat Parent' })
    const child = async (fullName: string) => {
      const r = await invoke(childrenPost, { method: 'POST', as: parent, body: { fullName } })
      return (await r.json<{ children: { id: string; full_name: string }[] }>()).children.find((c) => c.full_name === fullName)!.id
    }
    const kids = [await child('Alpha Kid'), await child('Bravo Kid')]
    const familyEvent = await seedTournament({ name: 'Scholastic Swiss', sections: [{ name: 'K-8', entryFee: 15 }] })
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId: familyEvent, entries: kids.map((memberId) => ({ memberId, section: 'K-8', gradeRange: '0-8' })) } })
    expect(res.status).toBe(201)
    const family = stripeSessions.at(-1)!
    await webhook(family.id, family.metadata)

    expect(subjectsTo('free@example.org')).toEqual(['You\'re registered: Free Swiss'])
    expect(subjectsTo('paid@example.org')).toEqual(['You\'re registered: Paid Swiss'])
    expect(subjectsTo('parent@example.org')).toEqual(['You\'re registered: Scholastic Swiss'])
    expect(mailTo('parent@example.org')[0].html).toContain('Alpha Kid')
    expect(mailTo('parent@example.org')[0].html).toContain('Bravo Kid')
  })
})

describe('(g) the daily run on the free plan\'s budget', () => {
  it('sends 25 reminders first, gives the rating lookups what is left, and stays under 50 outside calls and 50 queries; the next day\'s run sends the next 25 registration-open reminders', async () => {
    flags.listsOn = true
    const clock = holdClock()
    // The members already on file with a US Chess ID, migration 0002's among them, count as looked up today, so the
    // run's 20 lookups go to this case's members, each of whom the ratings service knows, and the count is the same
    // whatever ran before.
    await env.DB.prepare(`UPDATE members SET uscf_rating_updated_at = datetime('now') WHERE uscf_id IS NOT NULL`).run()
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    for (let i = 0; i < 60; i++) {
      const address = `due${i}@example.org`
      const uscfId = `7${String(i).padStart(7, '0')}`
      uscfBehavior.members[uscfId] = rated(1200 + i)
      await bell(open, await seedMember({ email: address, uscfId }), address)
    }
    const { db, ran } = countingDb()
    const hosts = recordHosts()
    try {
      await runDaily(db)
    } finally {
      hosts.stop()
    }
    expect(emailOutbox).toHaveLength(25)
    const unclaimed = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_reminders WHERE tournament_id = ? AND sent_registration_open = 0').bind(open).first<{ n: number }>()
    expect(unclaimed?.n).toBe(35)
    // The reminders went first, and the rating lookups took the 20 calls left of 45.
    const lookups = hosts.hosts.filter((h) => h === 'ratings-api.uschess.org')
    expect(lookups).toHaveLength(20)
    expect(hosts.hosts.lastIndexOf('api.resend.com')).toBeLessThan(hosts.hosts.indexOf('ratings-api.uschess.org'))
    expect(fetchCount).toBe(45)
    expect(fetchCount).toBeLessThan(50)
    // One gate query for the 60 rows, 25 claims, and every query of the run under 50: 3 for the bookkeeping phases,
    // one for each of the four reminder queries, the gate, the 25 claims and 3 for the rating lookups.
    expect(ran.filter((r) => r.sql.includes('mail_do_not_send'))).toHaveLength(1)
    expect(ran.filter((r) => /SET sent_registration_open = 1, registration_opened_notified_at = datetime\('now'\)\s+WHERE id = \? AND sent_registration_open = 0/.test(r.sql))).toHaveLength(25)
    expect(ran.length).toBe(36)
    expect(ran.length).toBeLessThan(50)

    // The registration-open query reads its rows again on a later day, so the next day's run sends the next 25.
    resetHarness()
    clock.nextDay()
    await runDaily()
    expect(emailOutbox).toHaveLength(25)
    expect(new Set(emailOutbox.map((e) => e.to)).size).toBe(25)
  })

  it('takes the reminders whose queries name one day first: with 30 week-before reminders due it sends 25 of them and no registration-open reminder, and the next day sends the registration-open reminders and not the 5 week-before rows past the cap, whose day has gone', async () => {
    flags.listsOn = true
    const clock = holdClock()
    const open = await seedTournament({ name: 'Bayou Open', registrationStatus: 'open', date: dayFromToday(30) })
    const soon = await seedTournament({ name: 'Delta Quads', registrationStatus: 'closed', date: dayFromToday(7) })
    for (let i = 0; i < 30; i++) {
      const address = `week${i}@example.org`
      await bell(soon, await seedMember({ email: address }), address, { registrationOpen: 1 })
    }
    for (let i = 0; i < 10; i++) {
      const address = `open${i}@example.org`
      await bell(open, await seedMember({ email: address }), address)
    }
    const sent = () => ({
      week: emailOutbox.filter((e) => e.subject === 'One week to go: Delta Quads').length,
      open: emailOutbox.filter((e) => e.subject === 'Registration is open: Bayou Open').length,
    })
    const weekBeforeLeft = () =>
      env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_reminders WHERE tournament_id = ? AND sent_week_before = 0').bind(soon).first<{ n: number }>().then((r) => r?.n)

    await runDaily()
    expect(sent()).toEqual({ week: 25, open: 0 })
    expect(await weekBeforeLeft()).toBe(5)

    resetHarness()
    clock.nextDay()
    await runDaily()
    expect(sent()).toEqual({ week: 0, open: 10 })
    // The 5 rows past the first day's cap were never claimed, and the week-before query, which names the day a week
    // ahead, no longer reads them: the follow-up for WS16 step 4 in REDESIGN_STATUS.md.
    expect(await weekBeforeLeft()).toBe(5)
  })

  it('on Workers Paid sends every reminder due and leaves the rating lookups today\'s limit', async () => {
    flags.listsOn = true
    flags.plan = 'paid'
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    for (let i = 0; i < 30; i++) {
      const address = `paid${i}@example.org`
      await bell(open, await seedMember({ email: address }), address)
    }
    await runDaily()
    expect(emailOutbox).toHaveLength(30)
  })
})

describe('(h) a call the runtime refuses for the limit', () => {
  it('gives its claim back and ends the phase, and the next day\'s run sends that registration-open reminder and the rest, never the first again', async () => {
    flags.listsOn = true
    const clock = holdClock()
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const rows: string[] = []
    for (const address of ['first@example.org', 'second@example.org', 'third@example.org']) rows.push(await bell(open, await seedMember({ email: address }), address))
    const warn = vi.spyOn(console, 'warn')
    emailBehavior.limitAfter = 1
    await runDaily()
    expect(emailOutbox.map((e) => e.to)).toEqual(['first@example.org'])
    expect(warn.mock.calls).toContainEqual([TOO_MANY_OUTSIDE_CALLS])
    expect((await reminderRow(rows[0]))?.sent_registration_open).toBe(1)
    expect(await reminderRow(rows[1])).toEqual({ sent_registration_open: 0, sent_week_before: 0, registration_opened_notified_at: null })
    expect((await reminderRow(rows[2]))?.sent_registration_open).toBe(0)

    emailBehavior.limitAfter = null
    clock.nextDay()
    await runDaily()
    expect(emailOutbox.map((e) => e.to)).toEqual(['first@example.org', 'second@example.org', 'third@example.org'])
  })
})

describe('(i) two loops over the same rows', () => {
  it('two notice loops started together send each notice once, and so do a notice loop and the daily run', async () => {
    flags.listsOn = true
    const twice = await seedTournament({ name: 'Bayou Open', registrationStatus: 'open' })
    const met = await seedTournament({ name: 'Delta Quads', registrationStatus: 'open', date: dayFromToday(30) })
    for (let i = 0; i < 5; i++) {
      const address = `subscriber${i}@example.org`
      const memberId = await seedMember({ email: address })
      await bell(twice, memberId, address)
      await bell(met, memberId, address)
    }
    await Promise.all([notifyRegistrationOpen(bindings as never, twice, 'Bayou Open'), notifyRegistrationOpen(bindings as never, twice, 'Bayou Open')])
    expect(emailOutbox.filter((e) => e.subject === 'Registration is open: Bayou Open').map((e) => e.to).sort()).toEqual([0, 1, 2, 3, 4].map((i) => `subscriber${i}@example.org`))

    await Promise.all([notifyRegistrationOpen(bindings as never, met, 'Delta Quads'), runDaily()])
    expect(emailOutbox.filter((e) => e.subject === 'Registration is open: Delta Quads').map((e) => e.to).sort()).toEqual([0, 1, 2, 3, 4].map((i) => `subscriber${i}@example.org`))
  })
})

describe('(j) a gate that cannot be read', () => {
  beforeEach(() => {
    flags.listsOn = true
  })

  it('lets a registration confirmation through, with one log line that names no address', async () => {
    const warn = vi.spyOn(console, 'warn')
    const tournamentId = await seedTournament({ name: 'Free Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    const { db } = countingDb({ refuse: 'mail_do_not_send' })
    const res = await invoke(registrationPost, { method: 'POST', as: await seedMember({ email: 'unread@example.org' }), body: { tournamentId, section: 'Open' }, env: { DB: db } })
    expect(res.status).toBe(201)
    expect(subjectsTo('unread@example.org')).toEqual(['You\'re registered: Free Swiss'])
    expect(warn.mock.calls).toEqual([[GATE_UNREAD_LOG]])
    expect(GATE_UNREAD_LOG).not.toMatch(/@/)
  })

  it('lets the daily run\'s reminders through, logging once for each loop, and still never mails a walk-in placeholder', async () => {
    const warn = vi.spyOn(console, 'warn')
    await dueToday(['unread@example.org'])
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const placeholder = `guest-${nextSeq()}@walkin.lca.invalid`
    await bell(open, await seedMember({ email: placeholder, role: 'guest' }), placeholder)
    const { db } = countingDb({ refuse: 'mail_do_not_send' })
    await runDaily(db)
    expect(mailTo('unread@example.org')).toHaveLength(3)
    expect(emailOutbox.filter((e) => e.to.endsWith('.invalid'))).toEqual([])
    expect(warn.mock.calls.filter(([words]) => words === GATE_UNREAD_LOG)).toHaveLength(3)
  })

  it('holds list mail back, to be tried later, and sends nothing', async () => {
    const { db } = countingDb({ refuse: 'mail_do_not_send' })
    const result = await deliver({ ...bindings, DB: db } as never, message('reader@test.lca', { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS }))
    expect(result).toEqual({ ok: false, gateUnread: true, error: GATE_UNREAD_WORDS })
    expect(emailOutbox).toEqual([])
  })
})

describe('(k) with the rules off, the daily run as today', () => {
  it('looks ratings up before it sends a reminder, as today, and reads no gate and makes no claim', async () => {
    await dueToday(['today@example.org'])
    const { db, ran } = countingDb()
    const hosts = recordHosts()
    try {
      await runDaily(db)
    } finally {
      hosts.stop()
    }
    expect(mailTo('today@example.org')).toHaveLength(3)
    const lastLookup = hosts.hosts.lastIndexOf('ratings-api.uschess.org')
    expect(lastLookup).toBeGreaterThan(-1)
    expect(lastLookup).toBeLessThan(hosts.hosts.indexOf('api.resend.com'))
    expect(ran.filter((r) => /\bmail_|AND sent_registration_open = 0|AND sent_week_before = 0/.test(r.sql))).toEqual([])
  })

  it('marks a reminder only after a send that worked, so a lost answer is sent again on the next run, as today', async () => {
    const { rows } = await dueToday(['today@example.org'])
    emailBehavior.succeed = false
    await runDaily()
    expect(await reminderRow(rows['today@example.org'].open)).toMatchObject({ sent_registration_open: 0 })
    emailBehavior.succeed = true
    emailBehavior.loseAnswer = 3
    await runDaily()
    await runDaily()
    expect(mailTo('today@example.org')).toHaveLength(6)
  })
})
