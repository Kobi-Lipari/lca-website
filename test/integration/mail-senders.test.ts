// test/integration/mail-senders.test.ts
//
// Who may send email to members (the owner's decision 79, "2 b."), through
// the real handlers and the two real guards, requireMailer (Group email's
// five campaign methods) and requireListMailer (the newsletter's methods), on
// the D1 database every integration test builds from the migrations:
// - an LCA admin with a second factor, by today's path: no seat read, two
//   sign-in calls on a campaign method and one on the newsletter;
// - the holder of the President seat, whatever their role, read at each
//   request, with a second factor while PRESIDENT_NEEDS_SECOND_FACTOR is set
//   (turned through a getter on the mocked domain/mail/senders);
// - on the newsletter's methods alone, the holder of the Media manager seat
//   with a second factor;
// - everyone else refused, an LCA Observer or Officer without either seat
//   among them, with LIST_MAILERS_ONLY, and nothing written or sent.
// MAIL_LISTS_ON, MAIL_PAGE_ON and MAIL_SENDER are read through getters on the
// mocked functions/utils/mail/switches, set before every case. Nothing here
// reaches an outside service: the harness answers the mail service and the
// sign-in service. Every name, address and subject here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as campaignsGet, onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import { onRequestGet as campaignGet } from '../../functions/api/admin/campaigns/[id]'
import { onRequestPost as previewPost } from '../../functions/api/admin/campaigns/preview'
import { onRequestPost as campaignTestPost } from '../../functions/api/admin/campaigns/test'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestGet as issueGet, onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as issueStartPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestGet as issuesGet } from '../../functions/api/admin/mail/newsletter/issues'
import { onRequestPost as stopPost } from '../../functions/api/admin/mail/newsletter/stop'
import {
  onRequestDelete as templatesDelete,
  onRequestGet as templatesGet,
  onRequestPost as templatesPost,
  onRequestPut as templatesPut,
} from '../../functions/api/admin/mail/newsletter/templates'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR } from '../../functions/utils/auth'
import { seedAdmin, seedMember, seedPresident, seedSeat } from './factories'
import { emailOutbox, fetchCount, invoke, resetHarness, type Aal, type InvokeOptions } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true, pageOn: true, sender: 'resend', presidentNeedsSecondFactor: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_PAGE_ON() {
      return flags.pageOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
  }
})
vi.mock('../../domain/mail/senders', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/mail/senders')>()
  return {
    ...real,
    get PRESIDENT_NEEDS_SECOND_FACTOR() {
      return flags.presidentNeedsSecondFactor
    },
  }
})

type Handler = Parameters<typeof invoke>[0]
type Call = readonly [string, (to: string) => { handler: Handler; options: InvokeOptions }]

const SAMPLE = { subject: 'Sample message one', bodyHtml: '<p>Example words for a sample message.</p>' }
const ADMIN_SECOND_FACTOR = 'Two-factor authentication is required for admin access. Set it up in your account security settings.'
/** Every answer either guard gives, by its words; an answer with none of them is one the guard let through. */
const GUARD_WORDS = new Set(['Unauthorized', 'Forbidden', LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR, ADMIN_SECOND_FACTOR, 'Group email is limited to admins and the LCA Observer'])

let seq = 0
const address = (name: string) => `${name}-${++seq}@senders.test.lca`

/** Group email's five campaign methods, guarded by requireMailer. `to` is the caller's own address. */
const CAMPAIGNS: readonly Call[] = [
  ['GET /api/admin/campaigns', () => ({ handler: campaignsGet, options: {} })],
  ['POST /api/admin/campaigns', (to) => ({ handler: campaignsPost, options: { method: 'POST', body: { ...SAMPLE, filter: {}, extraEmails: [to], onlySelected: true } } })],
  ['GET /api/admin/campaigns/[id]', () => ({ handler: campaignGet, options: { params: { id: 'campaign-sample' } } })],
  ['POST /api/admin/campaigns/preview', () => ({ handler: previewPost, options: { method: 'POST', body: { filter: {} } } })],
  ['POST /api/admin/campaigns/test', (to) => ({ handler: campaignTestPost, options: { method: 'POST', body: { email: to, ...SAMPLE } } })],
]

/** The newsletter's methods, every one guarded by requireListMailer. */
const NEWSLETTER: readonly Call[] = [
  ['GET /api/admin/mail/newsletter', () => ({ handler: newsletterGet, options: {} })],
  ['POST /api/admin/mail/newsletter', () => ({ handler: newsletterPost, options: { method: 'POST', body: SAMPLE } })],
  ['POST /api/admin/mail/newsletter/test', (to) => ({ handler: testPost, options: { method: 'POST', body: { to, ...SAMPLE } } })],
  ['POST /api/admin/mail/newsletter/stop', () => ({ handler: stopPost, options: { method: 'POST' } })],
  ['GET /api/admin/mail/newsletter/issue', () => ({ handler: issueGet, options: {} })],
  ['PUT /api/admin/mail/newsletter/issue', () => ({ handler: issuePut, options: { method: 'PUT', body: { id: 'issue-sample', version: 1, bodyHtml: SAMPLE.bodyHtml } } })],
  ['POST /api/admin/mail/newsletter/issue/start', () => ({ handler: issueStartPost, options: { method: 'POST', body: {} } })],
  ['GET /api/admin/mail/newsletter/issues', () => ({ handler: issuesGet, options: {} })],
  ['GET /api/admin/mail/newsletter/templates', () => ({ handler: templatesGet, options: {} })],
  ['POST /api/admin/mail/newsletter/templates', () => ({ handler: templatesPost, options: { method: 'POST', body: { name: 'Sample template', bodyHtml: SAMPLE.bodyHtml } } })],
  ['PUT /api/admin/mail/newsletter/templates', () => ({ handler: templatesPut, options: { method: 'PUT', body: { id: 'template-sample', version: 1, name: 'Sample name' } } })],
  ['DELETE /api/admin/mail/newsletter/templates', () => ({ handler: templatesDelete, options: { method: 'DELETE', body: { id: 'template-sample', version: 1 } } })],
]

/** What any write of these endpoints would leave a trace in, counted with the outbox. */
async function traces() {
  const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n
  return {
    campaigns: await count('email_campaigns'),
    recipients: await count('email_campaign_recipients'),
    contacts: await count('mail_contacts'),
    choices: await count('mail_list_choices'),
    issues: await count('newsletter_issues'),
    audit: await count('admin_audit_log'),
    sent: emailOutbox.length,
  }
}

/** A member with a made-up name and an address of the harness's own kind, and that address. */
async function person(role?: string): Promise<{ id: string; email: string }> {
  const email = address(role ?? 'member')
  const id = await seedMember({ fullName: 'Player One', email, role })
  return { id, email }
}

/** A member who holds the President seat now. */
async function president(role?: string) {
  const who = await person(role)
  await seedPresident(who.id)
  return who
}

/** Each call of the list, as `who` at `aal`: its status and body. */
async function answers(calls: readonly Call[], who: { id: string; email: string } | null, aal: Aal = 'aal2') {
  const out: Array<{ name: string; status: number; body: Record<string, unknown> }> = []
  for (const [name, call] of calls) {
    const { handler, options } = call(who?.email ?? address('nobody'))
    const res = await invoke(handler, who ? { ...options, as: who.id, aal } : options)
    const text = await res.response.clone().text()
    out.push({ name, status: res.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} })
  }
  return out
}

/** Every call answered exactly `status` and `body`, with nothing written and nothing sent. */
async function expectRefused(calls: readonly Call[], who: { id: string; email: string } | null, aal: Aal, status: number, body: Record<string, unknown>) {
  const before = await traces()
  for (const a of await answers(calls, who, aal)) expect({ status: a.status, body: a.body }, a.name).toEqual({ status, body })
  expect(await traces()).toEqual(before)
}

/** Every call answered past the guard: no 401 and none of the guards' words. */
async function expectAdmitted(calls: readonly Call[], who: { id: string; email: string }, aal: Aal = 'aal2') {
  for (const a of await answers(calls, who, aal)) {
    expect(a.status, a.name).not.toBe(401)
    expect(GUARD_WORDS.has(String(a.body.error ?? '')), `${a.name}: ${a.status} ${JSON.stringify(a.body)}`).toBe(false)
  }
}

const MFA = { error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.pageOn = true
  flags.sender = 'resend'
  flags.presidentNeedsSecondFactor = true
  // The seats a case made, with their terms, and every term on the President seat the migrations made, which is
  // active again for the next case.
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  await env.DB.prepare(`DELETE FROM board_seat_assignments WHERE seat_id = (SELECT id FROM board_members WHERE slug = 'president')`).run()
  await env.DB.prepare(`UPDATE board_members SET is_active = 1 WHERE slug = 'president'`).run()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'newsletter_issues']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('who may send, on Group email\'s five campaign methods and every newsletter method', () => {
  it('lists the five campaign methods and twelve newsletter methods, which are every caller of the two guards', () => {
    expect(CAMPAIGNS).toHaveLength(5)
    expect(NEWSLETTER).toHaveLength(12)
  })

  it('answers 401 signed out on both', async () => {
    await expectRefused(CAMPAIGNS, null, 'aal2', 401, { error: 'Unauthorized' })
    await expectRefused(NEWSLETTER, null, 'aal2', 401, { error: 'Unauthorized' })
  })

  it('refuses a plain member: Forbidden from requireMailer, LIST_MAILERS_ONLY from requireListMailer', async () => {
    const plain = await person()
    await expectRefused(CAMPAIGNS, plain, 'aal2', 403, { error: 'Forbidden' })
    await expectRefused(NEWSLETTER, plain, 'aal2', 403, { error: LIST_MAILERS_ONLY })
  })

  it.each(['aal1', 'aal2'] as const)('refuses an LCA Observer without either seat at %s with LIST_MAILERS_ONLY from both guards', async (aal) => {
    const observer = await person('lca_observer')
    await expectRefused(CAMPAIGNS, observer, aal, 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, observer, aal, 403, { error: LIST_MAILERS_ONLY })
  })

  it('refuses an LCA Officer without either seat with LIST_MAILERS_ONLY from both guards', async () => {
    const officer = await person('lca_officer')
    await expectRefused(CAMPAIGNS, officer, 'aal2', 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, officer, 'aal2', 403, { error: LIST_MAILERS_ONLY })
  })

  it('admits the president who is an LCA Observer, signed in with a second factor, on both', async () => {
    const seated = await president('lca_observer')
    await expectAdmitted(CAMPAIGNS, seated)
    await expectAdmitted(NEWSLETTER, seated)
  })

  it('asks the same president for a second factor when the session has none, with mfaRequired, on both', async () => {
    const seated = await president('lca_observer')
    await expectRefused(CAMPAIGNS, seated, 'aal1', 403, MFA)
    await expectRefused(NEWSLETTER, seated, 'aal1', 403, MFA)
  })

  it('admits a plain member who holds the President seat, with a second factor, on both', async () => {
    const seated = await president()
    await expectAdmitted(CAMPAIGNS, seated)
    await expectAdmitted(NEWSLETTER, seated)
  })

  it('refuses the president once the term has ended, and while the seat is marked inactive', async () => {
    const seated = await president('lca_observer')
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ?`).bind(seated.id).run()
    await expectRefused(CAMPAIGNS, seated, 'aal2', 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, seated, 'aal2', 403, { error: LIST_MAILERS_ONLY })

    const again = await president('lca_observer')
    await env.DB.prepare(`UPDATE board_members SET is_active = 0 WHERE slug = 'president'`).run()
    await expectRefused(CAMPAIGNS, again, 'aal2', 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, again, 'aal2', 403, { error: LIST_MAILERS_ONLY })
  })

  it('admits an LCA Observer who holds only the Media manager seat to the newsletter alone', async () => {
    const holder = await person('lca_observer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder.id])
    await expectAdmitted(NEWSLETTER, holder)
    await expectRefused(CAMPAIGNS, holder, 'aal2', 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, holder, 'aal1', 403, MFA)
  })

  it('gives an LCA admin without a second factor the admin\'s 403 on both', async () => {
    const admin = { id: await seedAdmin(), email: '' }
    await expectRefused(CAMPAIGNS, admin, 'aal1', 403, { error: ADMIN_SECOND_FACTOR, mfaRequired: true })
    await expectRefused(NEWSLETTER, admin, 'aal1', 403, { error: ADMIN_SECOND_FACTOR, mfaRequired: true })
  })

  it('admits an LCA admin by today\'s path: no seat read, two sign-in calls on a campaign method and one on the newsletter', async () => {
    const id = await seedAdmin()
    const email = (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(id).first<{ email: string }>())!.email
    await expectAdmitted(CAMPAIGNS, { id, email })
    await expectAdmitted(NEWSLETTER, { id, email })
    for (const [handler, expected] of [[campaignsGet, 2], [newsletterGet, 1]] as const) {
      resetHarness()
      const counting = countingDb()
      const res = await invoke(handler, { as: id, env: { DB: counting.db } })
      expect(res.status).toBe(200)
      expect(fetchCount).toBe(expected)
      expect(counting.ran.filter((r) => r.sql.includes('board_seat_assignments'))).toEqual([])
    }
  })

  it('reads the President seat once, binding one value and naming the slug, before the Media manager seat\'s two', async () => {
    const holder = await person('lca_observer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder.id])
    const counting = countingDb()
    expect((await invoke(newsletterGet, { as: holder.id, env: { DB: counting.db } })).status).toBe(200)
    const seatReads = counting.ran.filter((r) => r.sql.includes('board_seat_assignments'))
    expect(seatReads.map((r) => r.binds)).toEqual([1, 2])
    expect(seatReads[0].sql).toContain(`s.slug = 'president'`)
  })

  it.each(['club_rep', 'tournament_director', 'guest'])('refuses a %s without either seat: Forbidden from requireMailer, LIST_MAILERS_ONLY from requireListMailer', async (role) => {
    const who = await person(role)
    await expectRefused(CAMPAIGNS, who, 'aal2', 403, { error: 'Forbidden' })
    await expectRefused(NEWSLETTER, who, 'aal2', 403, { error: LIST_MAILERS_ONLY })
  })

  it('admits an LCA Officer who holds only the Media manager seat to the newsletter alone', async () => {
    const holder = await person('lca_officer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder.id])
    await expectAdmitted(NEWSLETTER, holder)
    await expectRefused(CAMPAIGNS, holder, 'aal2', 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, holder, 'aal1', 403, MFA)
  })

  it.each(['lca_officer', 'guest'])('admits a %s who holds the President seat with a second factor, and asks for one without, on both', async (role) => {
    const seated = await president(role)
    await expectAdmitted(CAMPAIGNS, seated)
    await expectAdmitted(NEWSLETTER, seated)
    await expectRefused(CAMPAIGNS, seated, 'aal1', 403, MFA)
    await expectRefused(NEWSLETTER, seated, 'aal1', 403, MFA)
  })

  it('treats someone who holds both seats as the president on both, with PRESIDENT_NEEDS_SECOND_FACTOR set and unset', async () => {
    const both = await president('lca_observer')
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [both.id])
    await expectAdmitted(CAMPAIGNS, both)
    await expectAdmitted(NEWSLETTER, both)
    await expectRefused(CAMPAIGNS, both, 'aal1', 403, MFA)
    await expectRefused(NEWSLETTER, both, 'aal1', 403, MFA)
    flags.presidentNeedsSecondFactor = false
    await expectAdmitted(CAMPAIGNS, both, 'aal1')
    await expectAdmitted(NEWSLETTER, both, 'aal1')
  })

  it('takes an LCA admin who also holds the President seat by the admin\'s path: no seat read, and the admin\'s 403 without a second factor', async () => {
    const id = await seedAdmin()
    await seedPresident(id)
    const email = (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(id).first<{ email: string }>())!.email
    await expectAdmitted(CAMPAIGNS, { id, email })
    await expectAdmitted(NEWSLETTER, { id, email })
    for (const handler of [campaignsGet, newsletterGet]) {
      const counting = countingDb()
      expect((await invoke(handler, { as: id, env: { DB: counting.db } })).status).toBe(200)
      expect(counting.ran.filter((r) => r.sql.includes('board_seat_assignments'))).toEqual([])
    }
    await expectRefused(CAMPAIGNS, { id, email }, 'aal1', 403, { error: ADMIN_SECOND_FACTOR, mfaRequired: true })
    await expectRefused(NEWSLETTER, { id, email }, 'aal1', 403, { error: ADMIN_SECOND_FACTOR, mfaRequired: true })
  })

  it('with PRESIDENT_NEEDS_SECOND_FACTOR unset, admits the president without a second factor', async () => {
    flags.presidentNeedsSecondFactor = false
    const seated = await president('lca_observer')
    await expectAdmitted(CAMPAIGNS, seated, 'aal1')
    await expectAdmitted(NEWSLETTER, seated, 'aal1')
  })

  it('with MAIL_LISTS_ON unset, admits the president and refuses an observer without the seat with LIST_MAILERS_ONLY and a member with Forbidden', async () => {
    flags.listsOn = false
    const seated = await president('lca_observer')
    await expectAdmitted(NEWSLETTER, seated)
    await expectRefused(NEWSLETTER, await person('lca_observer'), 'aal2', 403, { error: LIST_MAILERS_ONLY })
    await expectRefused(NEWSLETTER, await person(), 'aal2', 403, { error: 'Forbidden' })
  })
})
