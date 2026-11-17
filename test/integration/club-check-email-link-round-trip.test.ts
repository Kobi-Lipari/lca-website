// test/integration/club-check-email-link-round-trip.test.ts
//
// WS09 checkpoint V, the email and the page it opens read together: the
// monthly check is sent for real (the timed run, and the LCA admin's
// button), each club's two buttons are read back out of the mail that was
// caught, and the Still accurate address in it is followed through the real
// GET handler, so what the person is shown on the page is what the email
// showed for the same club. Every club, person, address and key is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS, runMonthlyCheck, type MonthlyCheckEnv } from '../../functions/utils/clubs/monthlyCheck'
import { signToken } from '../../functions/utils/tokens'
import { onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { onRequestGet as linkGet } from '../../functions/api/clubs/confirm/[token]'
import { NO_STATEMENT } from '../../domain/clubs/monthlyCheck'
import { seedAdmin, seedClub, seedMember } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ keepersOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

const KEY = 'example-made-up-signing-key-for-the-round-trip-01'
const keyed = (): MonthlyCheckEnv => ({ ...(env as unknown as MonthlyCheckEnv), SIGNING_SECRET: KEY })
const DEC_7_8AM = new Date('2026-12-07T14:00:00Z')

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`

/** A club in a made-up region of its own, with the meeting words given (null for none). */
async function clubIn(region: string, name: string, words: string | null): Promise<string> {
  const id = await seedClub({ name, city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, how_we_meet_text = ? WHERE id = ?').bind(region, words, id).run()
  return id
}

/** A person holding a seat over a region, with the clubs given in it; the clubs' names are returned in order. */
async function keeper(clubs: Array<[string, string | null]>) {
  const region = `Example Region ${next()}`
  for (const [name, words] of clubs) await clubIn(region, name, words)
  const email = `player-${next()}@example.org`
  const memberId = await seedMember({ fullName: 'Player One', email })
  const seatId = `seat-${next()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seatId, seatId).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seatId, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seatId, memberId).run()
  return { email, memberId }
}

type Button = { label: string; href: string; style: string }
/** Every link of the email's HTML as its words, address and inline style, in the order drawn. */
function buttons(html: string): Button[] {
  return [...html.matchAll(/<a href="([^"]+)" style="([^"]*)">([^<]*)<\/a>/g)]
    .map((m) => ({ href: m[1].replace(/&amp;/g, '&'), style: m[2], label: m[3] }))
    .filter((b) => b.label === 'Still accurate' || b.label === 'Update')
}
const tokenOf = (href: string) => decodeURIComponent(href.slice(href.indexOf('/clubs/confirm/') + '/clubs/confirm/'.length))
const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)

beforeEach(async () => {
  resetHarness()
  flags.keepersOn = true
  await env.DB.batch([
    env.DB.prepare('DELETE FROM board_seat_assignments'),
    env.DB.prepare('DELETE FROM club_check_marks'),
    env.DB.prepare('DELETE FROM automation_runs'),
  ])
})

describe('the email\'s buttons and the page they open (WS09 checkpoint V)', () => {
  it('the timed email draws each club\'s two buttons, and each Still accurate address opens a page whose words are the email\'s for that club', async () => {
    const who = await keeper([
      ['Example Chess Club', 'Saturdays from 10:00 AM\nat the Example Library.\n\nBring a board.'],
      ['Example Knights Club', null],
    ])
    expect((await runMonthlyCheck(keyed(), DEC_7_8AM, false, { pauseMs: 0 })).sent).toBe(1)
    const [mail] = mailTo(who.email)
    const links = buttons(mail.html)
    expect(links.map((b) => b.label)).toEqual(['Still accurate', 'Update', 'Still accurate', 'Update'])
    // Each is a button: the 44 pixels and 8 pixels are in the HTML itself, not in a sheet.
    for (const b of links) {
      expect(b.style).toMatch(/display:inline-block/)
      expect(b.style).toMatch(/padding:12px 22px/)
      expect(b.style).toMatch(/line-height:20px/)
    }
    expect(mail.html).not.toContain('&middot;')
    // The layout's own sheet is not the buttons': they carry no class, and the HTML holds no script.
    expect(mail.html).not.toMatch(/<script/)
    for (const b of links) expect(mail.html).not.toMatch(new RegExp(`<a [^>]*class=[^>]*>${b.label}</a>`))

    const wording = new Map<string, string | null>()
    for (const b of links.filter((l) => l.label === 'Still accurate')) {
      const answer = await invoke(linkGet, { params: { token: tokenOf(b.href) }, env: { SIGNING_SECRET: KEY } })
      expect(answer.status).toBe(200)
      const body = await answer.json<{ name: string; city: string; statement: string | null }>()
      wording.set(body.name, body.statement)
      // The words the page draws are the words the email drew for that club, as one line.
      const shown = body.statement ?? NO_STATEMENT
      expect(mail.html).toContain(shown)
      expect(mail.text).toContain(shown)
    }
    expect(Object.fromEntries(wording)).toEqual({
      'Example Chess Club': 'Saturdays from 10:00 AM at the Example Library. Bring a board.',
      'Example Knights Club': null,
    })
  })

  it('the admin\'s button sends the same buttons, and each address of the two buttons reads back to the same club and the same person', async () => {
    const who = await keeper([['Example Chess Club', 'Tuesdays at 7:00 PM.']])
    const admin = await seedAdmin()
    const sent = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(sent.status).toBe(200)
    const [mail] = mailTo(who.email)
    const links = buttons(mail.html)
    expect(links.map((b) => b.label)).toEqual(['Still accurate', 'Update'])
    // The two addresses are the text part's two addresses, exactly.
    expect(mail.text).toContain(`Still accurate: ${links[0].href}`)
    expect(mail.text).toContain(`Update: ${links[1].href}`)
    const answer = await invoke(linkGet, { params: { token: tokenOf(links[0].href) }, env: { SIGNING_SECRET: KEY } })
    expect(await answer.json()).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: 'Tuesdays at 7:00 PM.' })
    // Update is the club's own page in the site, never a token.
    expect(links[1].href).toMatch(/^https?:\/\/[^/]+\/workspace\/region\//)
    expect(links[1].href).not.toContain(tokenOf(links[0].href))
  })

  it('the admin\'s own link, who holds no seat, is answered with the club\'s words too', async () => {
    const region = `Example Region ${next()}`
    const clubId = await clubIn(region, 'Example Chess Club', 'Saturdays from 10:00 AM.')
    const adminId = await seedAdmin()
    const token = await signToken(KEY, CONFIRM_PURPOSE, { club: clubId, member: adminId }, LINK_TTL_SECONDS, new Date())
    const answer = await invoke(linkGet, { params: { token }, env: { SIGNING_SECRET: KEY } })
    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: 'Saturdays from 10:00 AM.' })
  })

  it('markup in a name or in the words is escaped in the email, and the page\'s answer carries it as plain text', async () => {
    const who = await keeper([['Example <b>Chess</b> Club', 'Meets at <i>7:00 PM</i> & more.']])
    await runMonthlyCheck(keyed(), DEC_7_8AM, false, { pauseMs: 0 })
    const [mail] = mailTo(who.email)
    expect(mail.html).not.toContain('<b>Chess</b>')
    expect(mail.html).not.toContain('<i>7:00 PM</i>')
    expect(mail.html).toContain('Example &lt;b&gt;Chess&lt;/b&gt; Club')
    expect(mail.html).toContain('Meets at &lt;i&gt;7:00 PM&lt;/i&gt; &amp; more.')
    const [confirm] = buttons(mail.html)
    const answer = await invoke(linkGet, { params: { token: tokenOf(confirm.href) }, env: { SIGNING_SECRET: KEY } })
    expect(await answer.json()).toEqual({ name: 'Example <b>Chess</b> Club', city: 'Example City', statement: 'Meets at <i>7:00 PM</i> & more.' })
  })
})
