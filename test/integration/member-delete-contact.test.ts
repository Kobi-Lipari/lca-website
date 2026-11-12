// test/integration/member-delete-contact.test.ts
//
// Checkpoint M's review: the member delete's guarded batch
// (functions/api/admin/members/[id].ts) also removes the deleted account's
// mail contact when no member's account still holds the address and the
// contact holds no list choice, no stop-all and no spam report's mark
// (forgetEmptyContact in functions/utils/mail/lists.ts). A contact that
// holds any of them stays. With no contact rows, which is always while
// MAIL_LISTS_ON is unset, the delete answers and writes as on WS16 step 8's
// commit, its answer held as the literal text that commit's handler wrote.
// The switches are the shipped ones unless a case says otherwise, read
// through getters on the mocked functions/utils/mail/switches. Nothing here
// reaches an outside service, and every address and name is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { contactFor } from '../../functions/utils/mail/lists'
import { campaignOf, rowsOf, stageCampaign } from './campaignRuns'
import { seedAdmin, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

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

let seq = 0
const address = (name: string) => `${name}-${++seq}@delete.test.lca`
const count = async (sql: string, ...binds: unknown[]) => (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())!.n
const contactOf = (email: string) => count('SELECT COUNT(*) AS n FROM mail_contacts WHERE address = ?', email)
const remove = (admin: string, id: string) => invoke(memberDelete, { method: 'DELETE', as: admin, params: { id } })

/** Every mail table's rows, to hold that a delete wrote nothing there. */
async function mailTables(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  for (const table of ['mail_contacts', 'mail_list_choices', 'mail_do_not_send', 'email_campaigns', 'email_campaign_recipients']) {
    out[table] = (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results ?? []
  }
  return out
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = false
  flags.sender = 'resend'
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('with the switches as shipped and no contact rows', () => {
  it('answers in the very words WS16 step 8\'s delete wrote, writes nothing to a mail table, and takes the member out as before', async () => {
    const admin = await seedAdmin()
    const leaving = await seedMember({ email: address('leaving'), fullName: 'Player One' })
    const before = await mailTables()
    const res = await remove(admin, leaving)
    expect(res.status).toBe(200)
    expect(res.response.headers.get('Content-Type')).toBe('application/json')
    expect(await res.response.clone().text()).toBe('{"success":true,"authDeleted":false}')
    expect(await mailTables()).toEqual(before)
    expect(await count('SELECT COUNT(*) AS n FROM members WHERE id = ?', leaving)).toBe(0)
  })
})

describe('the deleted account\'s contact', () => {
  it('is removed when no account holds the address and the contact holds nothing, the delete answering as before', async () => {
    const admin = await seedAdmin()
    const email = address('alone')
    const leaving = await seedMember({ email, fullName: 'Player One' })
    await contactFor(env.DB, email)
    expect(await contactOf(email)).toBe(1)
    const res = await remove(admin, leaving)
    expect(await res.response.clone().text()).toBe('{"success":true,"authDeleted":false}')
    expect(await contactOf(email)).toBe(0)
  })

  it('is removed for an address written with capitals and spaces on the account, as the mail tables keep it', async () => {
    const admin = await seedAdmin()
    const email = address('written')
    const leaving = await seedMember({ email: `  ${email.toUpperCase()} `, fullName: 'Player One' })
    await contactFor(env.DB, email)
    expect((await remove(admin, leaving)).status).toBe(200)
    expect(await contactOf(email)).toBe(0)
  })

  it('stays while another account holds the address, as a family\'s does, written in other letter case', async () => {
    const admin = await seedAdmin()
    const email = address('family')
    const parent = await seedMember({ email, fullName: 'Parent One' })
    await seedMember({ email: email.toUpperCase(), fullName: 'Player Two' })
    await contactFor(env.DB, email)
    expect((await remove(admin, parent)).status).toBe(200)
    expect(await contactOf(email)).toBe(1)
  })

  it('stays when it holds a choice on a list, the person\'s own stop-all or a spam report\'s mark, each with what it holds', async () => {
    const admin = await seedAdmin()
    const kept: Array<[string, string]> = []
    for (const [name, hold] of [
      ['chose', (id: string) => env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, ?, 'out', 'link')`).bind(id, NEWSLETTER_LIST_ID).run()],
      ['stopped', (id: string) => env.DB.prepare(`UPDATE mail_contacts SET optional_off_at = datetime('now') WHERE id = ?`).bind(id).run()],
      ['reported', (id: string) => env.DB.prepare(`UPDATE mail_contacts SET complained_at = datetime('now') WHERE id = ?`).bind(id).run()],
    ] as const) {
      const email = address(name)
      const leaving = await seedMember({ email, fullName: 'Player One' })
      const contact = await contactFor(env.DB, email)
      await hold(contact)
      expect((await remove(admin, leaving)).status).toBe(200)
      kept.push([name, email])
    }
    for (const [name, email] of kept) expect(await contactOf(email), name).toBe(1)
    expect(await count(`SELECT COUNT(*) AS n FROM mail_list_choices WHERE list_id = ?`, NEWSLETTER_LIST_ID)).toBe(1)
  })

  it('leaves every other contact as it was, an address with no account among them', async () => {
    const admin = await seedAdmin()
    const email = address('leaving')
    const leaving = await seedMember({ email, fullName: 'Player One' })
    const stranger = address('stranger')
    await contactFor(env.DB, email)
    await contactFor(env.DB, stranger)
    expect((await remove(admin, leaving)).status).toBe(200)
    expect(await contactOf(email)).toBe(0)
    expect(await contactOf(stranger)).toBe(1)
  })

  it('goes in the same batch as the sending newsletter\'s untried row: both are taken out, the counts add up, and a sent row\'s history keeps its contact id', async () => {
    const admin = await seedAdmin()
    const email = address('leaving')
    const leaving = await seedMember({ email, fullName: 'Player One' })
    const staying = address('staying')
    await seedMember({ email: staying, fullName: 'Player Two' })
    const contact = await contactFor(env.DB, email)
    const id = await stageCampaign({
      listId: NEWSLETTER_LIST_ID,
      recipients: [{ email, contactId: contact }, { email: staying }, { email: address('earlier'), contactId: contact }],
    })
    // The third row was sent to the same contact earlier in the same send.
    await env.DB.prepare(`UPDATE email_campaign_recipients SET status = 'sent' WHERE id = ?`).bind(`${id}-0002`).run()
    const res = await remove(admin, leaving)
    expect(res.status).toBe(200)
    expect(await res.response.clone().text()).toBe('{"success":true,"authDeleted":false}')
    expect(await contactOf(email)).toBe(0)
    const rows = await rowsOf(id)
    expect(rows.map((r) => [r.email === email ? 'leaving' : r.email === staying ? 'staying' : 'earlier', r.status, r.contact_id])).toEqual([
      ['staying', 'pending', null],
      ['earlier', 'sent', contact],
    ])
    expect(await campaignOf(id)).toMatchObject({ total_recipients: 2, skipped_count: 1 })
  })

  it('removes the contact the same way with MAIL_LISTS_ON set, the delete answering as before', async () => {
    flags.listsOn = true
    const admin = await seedAdmin()
    const email = address('alone')
    const leaving = await seedMember({ email, fullName: 'Player One' })
    await contactFor(env.DB, email)
    const res = await remove(admin, leaving)
    expect(await res.response.clone().text()).toBe('{"success":true,"authDeleted":false}')
    expect(await contactOf(email)).toBe(0)
  })
})
