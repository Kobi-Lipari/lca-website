// test/integration/newsletter-test-own.test.ts
//
// Checkpoint M's review: the newsletter's test, POST
// /api/admin/mail/newsletter/test, for anyone the Media manager seat admits,
// an LCA officer who holds it among them, goes only to their own account's
// address. A `to` that is not their own, compared as the gate compares
// addresses, and an account with no usable address, get 403 with
// TEST_TO_OWN_ADDRESS's words after the guard and the 404, with nothing
// written and nothing sent; an LCA admin with a second factor and the
// president keep the address they type, as today's Group email test gives it
// to them. With MAIL_LISTS_ON unset every caller gets WS16 step 4's answer,
// held by test/integration/media-manager.test.ts and here for the seat
// holder, an LCA admin and the president. The edges of "their own address":
// capitals and spaces on either side, an address only like it, a `to` that
// holds two addresses; the order of the refusals (the guard, the 404, a test
// through Amazon SES, the address, the link key); and whoever the seat does
// not admit never reads the words about the address. The switches are read through getters on the mocked
// functions/utils/mail/switches, set before every case. Nothing here reaches
// an outside service, and every name, address and subject is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { LIST_MAILERS_ONLY } from '../../functions/utils/auth'
import { LINK_KEY_MISSING, SES_TEST_ADMINS_ONLY, TEST_TO_OWN_ADDRESS } from '../../functions/utils/mail/newsletterAnswers'
import { seedAdmin, seedMember, seedSeat } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
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

const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
let seq = 0
const address = (name: string) => `${name}-${++seq}@own.test.lca`
const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
/** What a refused test must leave as it was: the contacts, the choices, the activity log and the outbox. */
const traces = async () => ({
  contacts: await count('SELECT COUNT(*) AS n FROM mail_contacts'),
  choices: await count('SELECT COUNT(*) AS n FROM mail_list_choices'),
  audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
  campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
  sent: emailOutbox.length,
})
const test = (as: string, to: string) => invoke(testPost, { as, method: 'POST', body: { to, ...SAMPLE } })

/** A member who holds the Media manager seat, with the role given, a member's by default. */
async function holder(role = 'member', email = address('holder')): Promise<{ id: string; email: string }> {
  const id = await seedMember({ fullName: 'Player One', email, role })
  await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [id])
  return { id, email }
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('the media manager\'s test goes to their own address', () => {
  it('sends the seat holder\'s test to their own address, and their own address written with capitals and spaces, as their own', async () => {
    const seated = await holder()
    expect((await test(seated.id, seated.email)).status).toBe(200)
    expect((await test(seated.id, `  ${seated.email.toUpperCase()} `)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([seated.email, seated.email])
  })

  it('refuses another member\'s address and an address with no account, 403 in plain words, writing nothing and sending nothing', async () => {
    const seated = await holder()
    const other = address('other')
    await seedMember({ fullName: 'Player Two', email: other })
    const before = await traces()
    for (const to of [other, address('stranger')]) {
      const res = await test(seated.id, to)
      expect(res.status, to).toBe(403)
      expect(await res.json(), to).toEqual({ error: TEST_TO_OWN_ADDRESS })
    }
    expect(await traces()).toEqual(before)
    expect(TEST_TO_OWN_ADDRESS).toBe("A test goes to your own account's email address.")
  })

  it('holds an officer who holds the seat to their own address the same way', async () => {
    const seated = await holder('lca_officer')
    const before = await traces()
    const res = await test(seated.id, address('other'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: TEST_TO_OWN_ADDRESS })
    expect(await traces()).toEqual(before)
    expect((await test(seated.id, seated.email)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([seated.email])
  })

  it('refuses an account with no usable address the same way, whatever it types, the account\'s own text included', async () => {
    // An address under a top-level name RFC 2606 reserves, which no mail reaches.
    const seated = await holder('member', 'player.one@sample.invalid')
    const before = await traces()
    for (const to of ['player.one@sample.invalid', address('typed')]) {
      const res = await test(seated.id, to)
      expect(res.status, to).toBe(403)
      expect(await res.json(), to).toEqual({ error: TEST_TO_OWN_ADDRESS })
    }
    expect(await traces()).toEqual(before)
  })

  it('gives the seat holder the guard\'s Forbidden with MAIL_LISTS_ON unset, before the body is read, as WS16 step 4 did', async () => {
    flags.listsOn = false
    const seated = await holder()
    const res = await test(seated.id, address('other'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })
})

describe('an LCA admin and the president keep the address they type', () => {
  it('sends an LCA admin\'s test and the president\'s to another person\'s address, as today\'s Group email test does', async () => {
    const admin = await seedAdmin()
    const president = await seedMember({ fullName: 'Player Three', email: address('president'), role: 'lca_observer' })
    const [first, second] = [address('reader'), address('reader')]
    expect((await invoke(testPost, { as: admin, method: 'POST', body: { to: first, ...SAMPLE } })).status).toBe(200)
    expect((await invoke(testPost, { as: president, method: 'POST', body: { to: second, ...SAMPLE } })).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([first, second])
  })
})

describe('the edges of "their own address"', () => {
  it('sends a test to an address stored with capitals and spaces on the account when it is typed in lower case, as their own, to the address as the mail tables keep it', async () => {
    const written = address('written')
    const seated = await holder('member', `  ${written.toUpperCase()} `)
    expect((await test(seated.id, written)).status).toBe(200)
    expect((await test(seated.id, ` ${written.toUpperCase()}`)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([written, written])
  })

  it('refuses every address that is only like their own, a plus tag, a longer or shorter name, another domain or a subdomain, and sends nothing', async () => {
    const seated = await holder('member', 'player.one@own.test.lca')
    const before = await traces()
    for (const to of ['player.one+news@own.test.lca', 'player.one2@own.test.lca', 'layer.one@own.test.lca', 'player.one@own.test.example', 'player.one@mail.own.test.lca', 'xplayer.one@own.test.lca']) {
      const res = await test(seated.id, to)
      expect(res.status, to).toBe(403)
      expect(await res.json(), to).toEqual({ error: TEST_TO_OWN_ADDRESS })
    }
    expect(await traces()).toEqual(before)
  })

  it('never sends to another address by a `to` that holds two or has a display name around it, whatever the answer', async () => {
    const seated = await holder()
    const other = address('other')
    const before = await traces()
    for (const to of [`${seated.email},${other}`, `${other},${seated.email}`, `${seated.email} ${other}`, `Player One <${seated.email}>`, `${seated.email}\nBcc: ${other}`]) {
      const res = await test(seated.id, to)
      expect([400, 403], to).toContain(res.status)
    }
    expect(await traces()).toEqual(before)
    expect(emailOutbox.map((e) => e.to).filter((to) => to === other)).toEqual([])
  })

  it('gives the seat holder who asks for a test through Amazon SES the refusal of Amazon SES first, whatever address they type', async () => {
    const seated = await holder()
    const before = await traces()
    for (const to of [seated.email, address('other')]) {
      const res = await invoke(testPost, { as: seated.id, method: 'POST', body: { to, ...SAMPLE, service: 'ses' } })
      expect(res.status, to).toBe(403)
      expect(await res.json(), to).toEqual({ error: SES_TEST_ADMINS_ONLY })
    }
    expect(await traces()).toEqual(before)
  })

  it('refuses another address before it reads the link key, and answers a missing key only for their own address', async () => {
    const seated = await holder()
    const noKey = { MAIL_LINK_SECRET: undefined }
    const before = await traces()
    const other = await invoke(testPost, { as: seated.id, method: 'POST', body: { to: address('other'), ...SAMPLE }, env: noKey })
    expect(other.status).toBe(403)
    expect(await other.json()).toEqual({ error: TEST_TO_OWN_ADDRESS })
    const own = await invoke(testPost, { as: seated.id, method: 'POST', body: { to: seated.email, ...SAMPLE }, env: noKey })
    expect(own.status).toBe(503)
    expect(await own.json()).toEqual({ error: LINK_KEY_MISSING })
    expect(await traces()).toEqual(before)
  })
})

describe('whoever the seat does not admit never reads the own-address words', () => {
  it('gives a member without the seat, an officer without it, one whose term ended and a signed-out caller the guard\'s answers, 403 and 401, and no word of the own address', async () => {
    flags.listsOn = true
    const plain = await seedMember({ fullName: 'Player One', email: address('plain'), role: 'member' })
    const officer = await seedMember({ fullName: 'Player Two', email: address('officer'), role: 'lca_officer' })
    const former = await holder('lca_officer')
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ?`).bind(former.id).run()
    const before = await traces()
    for (const who of [plain, officer, former.id]) {
      for (const to of [address('other'), (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(who).first<{ email: string }>())!.email]) {
        const res = await test(who, to)
        expect(res.status, who).toBe(403)
        expect(await res.json(), who).toEqual({ error: LIST_MAILERS_ONLY })
      }
    }
    const signedOut = await invoke(testPost, { method: 'POST', body: { to: address('other'), ...SAMPLE } })
    expect(signedOut.status).toBe(401)
    expect(JSON.stringify(await signedOut.json())).not.toContain(TEST_TO_OWN_ADDRESS)
    expect(await traces()).toEqual(before)
  })

  it('gives the seat holder without a second factor the media manager\'s 403 before it reads the address, whatever they type', async () => {
    const seated = await holder()
    const before = await traces()
    for (const to of [seated.email, address('other')]) {
      const res = await invoke(testPost, { as: seated.id, aal: 'aal1', method: 'POST', body: { to, ...SAMPLE } })
      expect(res.status, to).toBe(403)
      expect(await res.json(), to).toMatchObject({ mfaRequired: true })
    }
    expect(await traces()).toEqual(before)
  })

  it('lets an LCA admin and the president who hold the seat type any address, as themselves', async () => {
    const admin = await seedAdmin()
    const president = await seedMember({ fullName: 'Player Three', email: address('president'), role: 'lca_observer' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [admin, president])
    const [first, second] = [address('reader'), address('reader')]
    expect((await test(admin, first)).status).toBe(200)
    expect((await test(president, second)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([first, second])
  })

  it('answers an LCA admin and the president 404, "Not found", with MAIL_LISTS_ON unset, whatever address they type and whether or not they hold the seat, as WS16 step 4 did, writing nothing', async () => {
    flags.listsOn = false
    const admin = await seedAdmin()
    const president = await seedMember({ fullName: 'Player Three', email: address('president'), role: 'lca_observer' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [admin, president])
    const before = await traces()
    for (const who of [admin, president]) {
      for (const to of [address('reader'), 'not an address']) {
        const res = await test(who, to)
        expect(res.status, who).toBe(404)
        expect(await res.response.clone().text(), who).toBe('{"error":"Not found"}')
      }
    }
    expect(await traces()).toEqual(before)
  })
})
