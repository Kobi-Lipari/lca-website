// @vitest-environment jsdom
//
// The membership page's join and renewal choice, src/pages/MembershipPage.tsx.
// K asked on Tuesday, November 3, 2026 for Adult to be the renewal everyone
// starts on, with the price difference plain to see and the other tiers one
// step away. This file holds:
//
// - signed out, the page is today's: four tier cards, each with Join Now to
//   sign-up, Most Popular on Adult, and no choice to make; its first Button
//   is still the Adult card's Join Now, the one test/a11y/baseline.json reads;
// - signed in, the four cards are one choice, "Choose your membership", with
//   Adult chosen to start, the line above them saying that Adult is a little
//   more than Scholastic and Senior, and one gold button under them that
//   names the choice and its price ("Renew as Adult" with Adult's price a
//   year), "Join as" for a member with no membership yet, and "Join or
//   renew as" while the member's record is still on its way;
// - one exception: a guardian whose own Family membership is active starts
//   on Family, with a sentence under the price line saying that renewing as
//   another tier ends their children's cover when their current membership
//   runs out; an expired Family member, and a member of any other tier,
//   starts on Adult;
// - a child that a guardian's family membership covers, signed in with an
//   account of their own, starts on Adult like everyone else and is told
//   nothing about children of their own: the site writes family and active
//   on the child's record too, and only guardian_id tells the two apart;
// - "Selected" is on the chosen card only, beside its gold ring, and moves
//   with a click on a card or an arrow key in the group;
// - the button starts the checkout for the chosen tier as the page always
//   has: the payment's id kept under the same key for the success page, and
//   this very tab sent to the payment page, never a new window; the choice
//   holds while the checkout is asked for, and a failure says why;
// - an active member sees the choice too, with their banner, and a word on
//   renewing early; every date a person reads carries its weekday;
// - "Already a member? Log in to renew" is there for a visitor who is
//   signed out only; a signed-in member, with or without their record yet,
//   has the choice instead.
//
// Every price is read from domain/membership/tiers.ts, as the page and the
// checkout read it. jsdom carries out no arrow key on a radio, so the case
// for the keys does the browser's part (the next radio of the group takes
// the focus and is checked) and reads the page's. There is no axe for jsdom
// in this repository's test set; the case on the group's names and states
// holds what a screen reader is given.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiMember } from '@/lib/api'
import { FAMILY_MEMBERSHIP_CHILDREN } from '@/lib/family'
import { MEMBERSHIP_TIER_PRICES } from '@domain/membership/tiers'

const api = vi.hoisted(() => ({ createMembershipCheckout: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { MembershipPage } = await import('@/pages/MembershipPage')

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const P = MEMBERSHIP_TIER_PRICES
/** The four tiers in the order the page draws them. */
const TIERS = [
  { id: 'adult', name: 'LCA Adult Membership', short: 'Adult' },
  { id: 'scholastic', name: 'LCA Scholastic Membership', short: 'Scholastic' },
  { id: 'family', name: 'LCA Family Membership', short: 'Family' },
  { id: 'senior', name: 'LCA Senior Membership', short: 'Senior' },
] as const
type Tier = (typeof TIERS)[number]
const [ADULT, SCHOLASTIC, FAMILY, SENIOR] = TIERS

const GROUP = 'Choose your membership'
const KEY = 'lca_pending_payment_id'
/** An en dash or an em dash, built from their codes so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const label = (verb: string, tier: Tier) => `${verb} as ${tier.short}, $${P[tier.id]} a year`

/** A member as GET /api/me answers one; guardian_id is null unless the member is a guardian's child. */
function member(status: ApiMember['membership_status'], expiry: string | null, type: string | null = null, guardian: string | null = null): ApiMember {
  return {
    id: 'fx-renew-1',
    email: 'renew@example.com',
    full_name: 'Riley Fixture',
    uscf_id: null,
    uscf_rating: null,
    uscf_rating_updated_at: null,
    membership_status: status,
    membership_expiry: expiry,
    membership_type: type,
    guardian_id: guardian,
    role: 'member',
    club_id: null,
    created_at: '2025-10-24 12:00:00',
  }
}

/**
 * A child that a guardian's family membership covers, signed in with an
 * account of their own, as GET /api/me answers one: the site writes family
 * and active on the child's own record too (syncFamilyCoverage in
 * functions/utils/family.ts), so guardian_id is the one sign that the
 * membership is the guardian's.
 */
function coveredChild(status: ApiMember['membership_status'], expiry: string | null): ApiMember {
  return { ...member(status, expiry, 'family', 'fx-renew-guardian'), id: 'fx-renew-child', full_name: 'Robin Fixture' }
}

/** The page, for a visitor signed out (no user), or signed in with or without their member record yet. */
function page({ user, who }: { user: boolean; who: ApiMember | null }) {
  const auth = {
    user: user ? { id: who?.id ?? 'fx-renew-1' } : null,
    member: who,
    session: null,
    role: who?.role ?? null,
    loading: false,
    memberLoading: false,
  } as unknown as AuthContextValue
  return (
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/membership']}>
        <MembershipPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
const renderPage = (who: { user: boolean; who: ApiMember | null }) => render(page(who))

const group = () => screen.getByRole('group', { name: GROUP })
const radio = (tier: Tier) => within(group()).getByRole('radio', { name: new RegExp(`^${tier.name} `) }) as HTMLInputElement
/** The card a radio sits in: its label, and the box round it that carries the ring. */
const cardOf = (tier: Tier) => radio(tier).closest('label')!.parentElement!
const checkoutButton = () => screen.getByRole('button', { name: /^(Join|Renew|Join or renew) as |^Starting checkout…$/ })

/** The checkout's address, made a place in this very page, so a move to it is one jsdom carries out. */
const inThisPage = (place: string) => `${window.location.href.split('#')[0]}#${place}`

/**
 * An arrow key on a radio, as a browser carries it out: unless the page
 * takes the key for itself, the next radio of the same group (the same
 * name, in the order of the page, round from the last to the first, and
 * back the other way for Left and Up) takes the focus and is checked, which
 * reaches the page as a click on it. jsdom sends the key but moves nothing.
 */
function pressArrow(from: HTMLInputElement, key: 'ArrowRight' | 'ArrowDown' | 'ArrowLeft' | 'ArrowUp') {
  if (!fireEvent.keyDown(from, { key })) return
  const ring = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter((r) => r.name === from.name && r.form === from.form && !r.disabled)
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
  const next = ring[(ring.indexOf(from) + step + ring.length) % ring.length]
  next.focus()
  fireEvent.click(next)
  fireEvent.keyUp(next, { key })
}

/** What the case expects the choice to be: that tier's radio alone checked, "Selected" on its card alone, and the button naming it. */
function expectChosen(tier: Tier, verb = 'Renew') {
  for (const t of TIERS) {
    expect(radio(t).checked, t.id).toBe(t === tier)
    expect(cardOf(t).textContent!.includes('Selected'), t.id).toBe(t === tier)
    expect(cardOf(t).className.split(' ').includes('ring-lca-gold/30'), t.id).toBe(t === tier)
  }
  expect(screen.getAllByText('Selected')).toHaveLength(1)
  expect(checkoutButton().textContent).toBe(label(verb, tier))
}

beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  api.createMembershipCheckout.mockReset()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('the membership page for a visitor who is not signed in', () => {
  it('is today\'s page: four cards, each with Join Now to sign-up, Most Popular on Adult, and no choice to make', () => {
    renderPage({ user: false, who: null })
    const joins = screen.getAllByRole('link', { name: 'Join Now' })
    expect(joins).toHaveLength(4)
    for (const link of joins) expect(link.getAttribute('href')).toBe('/register')
    expect(screen.getAllByRole('heading', { level: 3 }).slice(0, 4).map((h) => h.textContent)).toEqual(TIERS.map((t) => t.name))
    for (const t of TIERS) expect(screen.getByRole('heading', { level: 3, name: t.name }).closest('li')!.textContent).toContain(`$${P[t.id]}per year`)
    expect(screen.getAllByText('Most Popular')).toHaveLength(1)
    expect(screen.getByText('Most Popular').closest('li')!.textContent).toContain(ADULT.name)
    expect(screen.queryAllByRole('radio')).toEqual([])
    expect(screen.queryByRole('group', { name: GROUP })).toBeNull()
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryByText('Selected')).toBeNull()
  })

  it('draws each of the four cards exactly as before the change: the same words in the same order, Adult first', () => {
    renderPage({ user: false, who: null })
    const cards = screen.getAllByRole('heading', { level: 3 }).slice(0, 4).map((h) => h.closest('li')!)
    // Read from the page as it stood before the choice was added; only K-12 is spelled with a hyphen now.
    expect(cards.map((li) => li.textContent)).toEqual([
      `Most PopularLCA Adult MembershipFor players 18 and up.$${P.adult}per yearJoin Now`,
      `LCA Scholastic MembershipFor K-12 students. Same benefits as adult membership at a reduced rate to support youth chess.$${P.scholastic}per yearJoin Now`,
      `LCA Family MembershipCovers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. Add your children on your profile and they are covered automatically.$${P.family}per yearJoin Now`,
      `LCA Senior MembershipFor members 65 and up. Full membership benefits at a reduced rate.$${P.senior}per yearJoin Now`,
    ])
    // The cards are a plain list of four, not a form: no radio, no fieldset, no choice line, no checkout button.
    expect(cards[0].parentElement!.tagName).toBe('UL')
    expect(cards[0].parentElement!.children).toHaveLength(4)
    expect(document.querySelector('fieldset')).toBeNull()
    expect(document.querySelector('input')).toBeNull()
    expect(document.body.textContent).not.toMatch(/Adult is chosen to start|Choose your membership|Selected/)
    expect(document.body.textContent).not.toMatch(/(Join|Renew|Join or renew) as /)
    // Only Adult is marked, and only with the gold ring, as before.
    expect(cards.map((li) => li.className.includes('ring-lca-gold/30'))).toEqual([true, false, false, false])
  })

  it('keeps the Adult card\'s Join Now as the page\'s first Button, the one the accessibility baseline reads', () => {
    renderPage({ user: false, who: null })
    const first = document.querySelector('[data-slot="button"]')
    expect(first).toBe(screen.getAllByRole('link', { name: 'Join Now' })[0])
    expect(first!.closest('li')!.textContent).toContain(ADULT.name)
  })

  it('writes K-12 with a plain hyphen and US Chess in full, with no dash anywhere on the page', () => {
    renderPage({ user: false, who: null })
    expect(screen.getByText(/^For K-12 students\./)).toBeTruthy()
    expect(screen.getByText(/connected with US Chess ID,/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(DASHES)
    expect(document.body.textContent).not.toMatch(/\bUSCF\b/)
  })
})

describe('the choice for a signed-in member whose membership has expired', () => {
  it('shows the four tiers as one group of radios with Adult chosen, and one button that names it and its price', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    const radios = within(group()).getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.value)).toEqual(TIERS.map((t) => t.id))
    expectChosen(ADULT)
    expect(checkoutButton().textContent).toBe(`Renew as Adult, $${P.adult} a year`)
    expect(screen.queryAllByRole('link', { name: 'Join Now' })).toEqual([])
    expect(screen.queryByRole('button', { name: 'Join / Renew' })).toBeNull()
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('data-slot') === 'button')).toEqual([checkoutButton()])
    // Most Popular gives way to the chosen card's own mark, so one gold mark follows the choice.
    expect(screen.queryByText('Most Popular')).toBeNull()
  })

  it('says above the cards that Adult is a little more than Scholastic and Senior, every price from the price list', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    const note = within(group()).getByText(/^Adult is chosen to start/)
    expect(note.textContent).toBe(
      `Adult is chosen to start, at $${P.adult} a year. ` +
      `That is a little more than Scholastic ($${P.scholastic}, for K-12 students) ` +
      `or Senior ($${P.senior}, for 65 and up), so if one of those fits you, choose it below. ` +
      `Family ($${P.family}) covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children.`,
    )
    // "A little more" is true of the prices the checkout charges.
    expect(P.adult).toBeGreaterThan(P.scholastic)
    expect(P.adult).toBeGreaterThan(P.senior)
    // The group is described by the line, so a screen reader hears it on the way in.
    expect(group().getAttribute('aria-describedby')).toBe(note.id)
    for (const t of TIERS) expect(cardOf(t).textContent).toContain(`$${P[t.id]} per year`)
  })

  it('gives a screen reader the group\'s name, each tier\'s name and price, and the checked state, with the word "Selected" for the eye only', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    expect(group().tagName).toBe('FIELDSET')
    expect(group().querySelector('legend')!.textContent).toBe(GROUP)
    for (const t of TIERS) {
      const r = radio(t)
      expect(r.type).toBe('radio')
      expect(r.name).toBe('membership-tier')
      expect(r.hasAttribute('tabindex')).toBe(false)
      expect(r.disabled).toBe(false)
      expect(r.closest('label')).toBe(cardOf(t).querySelector('label'))
      expect(within(group()).getByRole('radio', { name: new RegExp(`^${t.name} .*\\$${P[t.id]} per year$`) })).toBe(r)
    }
    const selected = screen.getByText('Selected')
    expect(selected.getAttribute('aria-hidden')).toBe('true')
    expect(within(group()).getByRole('radio', { checked: true })).toBe(radio(ADULT))
  })

  it('moves the choice, "Selected" and the button with a click anywhere on a card', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(screen.getByText(SCHOLASTIC.name))
    expectChosen(SCHOLASTIC)
    expect(checkoutButton().textContent).toBe(`Renew as Scholastic, $${P.scholastic} a year`)
    for (const t of [FAMILY, SENIOR, ADULT]) {
      fireEvent.click(cardOf(t).querySelector('label')!)
      expectChosen(t)
    }
  })

  it('moves the choice with the arrow keys, round the group in the order of the cards', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    radio(ADULT).focus()
    expect(document.activeElement).toBe(radio(ADULT))
    pressArrow(radio(ADULT), 'ArrowRight')
    expect(document.activeElement).toBe(radio(SCHOLASTIC))
    expectChosen(SCHOLASTIC)
    expect(checkoutButton().textContent).toBe(`Renew as Scholastic, $${P.scholastic} a year`)
    pressArrow(radio(SCHOLASTIC), 'ArrowDown')
    expectChosen(FAMILY)
    pressArrow(radio(FAMILY), 'ArrowDown')
    expectChosen(SENIOR)
    pressArrow(radio(SENIOR), 'ArrowRight')
    expectChosen(ADULT)
    pressArrow(radio(ADULT), 'ArrowUp')
    expectChosen(SENIOR)
    pressArrow(radio(SENIOR), 'ArrowLeft')
    expect(document.activeElement).toBe(radio(FAMILY))
    expectChosen(FAMILY)
  })

  it('starts the checkout for the chosen tier, keeps the payment for the success page and moves this tab to the payment page', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    const to = inThisPage('fx-membership-checkout')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-1', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '/membership/success?paymentId=fx-pay-membership-1' })
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(screen.getByText(SCHOLASTIC.name))
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('scholastic')
    expect(sessionStorage.getItem(KEY)).toBe('fx-pay-membership-1')
    expect(opened).not.toHaveBeenCalled()
  })

  it('starts the checkout for Adult when the member changes nothing', async () => {
    const to = inThisPage('fx-membership-adult')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-2', tier: 'adult', amount: P.adult, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('adult')
    expect(sessionStorage.getItem(KEY)).toBe('fx-pay-membership-2')
  })

  it('holds the choice and the button while the checkout is asked for, and on a failure says why and gives both back', async () => {
    let fail!: (reason: unknown) => void
    api.createMembershipCheckout.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject }))
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(screen.getByText(FAMILY.name))
    fireEvent.click(checkoutButton())
    expect(checkoutButton().textContent).toBe('Starting checkout…')
    expect((checkoutButton() as HTMLButtonElement).disabled).toBe(true)
    expect((group() as HTMLFieldSetElement).disabled).toBe(true)
    // A second press while the first is on its way asks for nothing more.
    fireEvent.click(checkoutButton())
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('family')

    fail(new Error('The payment service did not answer. Try again in a minute.'))
    expect((await screen.findByRole('alert')).textContent).toBe('The payment service did not answer. Try again in a minute.')
    expect((group() as HTMLFieldSetElement).disabled).toBe(false)
    expect((checkoutButton() as HTMLButtonElement).disabled).toBe(false)
    expectChosen(FAMILY)
    expect(sessionStorage.getItem(KEY)).toBeNull()
    expect(window.location.hash).toBe('')

    // A failure that is not an Error gives the page's own words, and a second try clears the first.
    api.createMembershipCheckout.mockRejectedValueOnce('no answer')
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Checkout failed'))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(2)
  })

  it('tells the member when their membership ran out, with the weekday', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    expect(screen.getByText(/Your membership has/).textContent).toBe('Your membership has expired (it ran through Sat, Oct 24, 2026). Renew below to keep your member benefits.')
  })
})

describe('the choice for other signed-in members', () => {
  it('a member with no membership yet joins: "Join as Adult", with the same choice', () => {
    renderPage({ user: true, who: member('none', null) })
    expectChosen(ADULT, 'Join')
    expect(checkoutButton().textContent).toBe(`Join as Adult, $${P.adult} a year`)
    expect(screen.getByText(/^No LCA membership on this account yet\./)).toBeTruthy()
    fireEvent.click(screen.getByText(SENIOR.name))
    expectChosen(SENIOR, 'Join')
  })

  it('an active member sees the choice too, with their banner, its weekday date, and a word on renewing early', () => {
    renderPage({ user: true, who: member('active', '2027-10-24') })
    const profile = screen.getByRole('button', { name: 'View my profile' })
    const banner = profile.closest('section')!
    expect(banner.className.split(' ')).toContain('bg-ok-50')
    expect(profile.className.split(' ')).toContain('text-ink')
    expect(banner.textContent).toBe('Your membership is active through Sun, Oct 24, 2027. View my profile')
    expectChosen(ADULT)
    expect(screen.getByText('Renewing now adds a year on top of the time you have left.')).toBeTruthy()
    fireEvent.click(screen.getByText(FAMILY.name))
    expectChosen(FAMILY)
  })

  it('says nothing of renewing early to a member whose membership is not active', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    expect(screen.queryByText(/Renewing now adds a year/)).toBeNull()
  })

  it('while the member\'s record is still on its way, offers the same choice and says "Join or renew"', () => {
    renderPage({ user: true, who: null })
    expectChosen(ADULT, 'Join or renew')
    expect(checkoutButton().textContent).toBe(`Join or renew as Adult, $${P.adult} a year`)
  })
})

describe('the tier the choice starts on, from what the member holds', () => {
  // Everyone starts on Adult except a guardian whose own Family membership
  // is active, who starts on Family so a renewal does not end their
  // children's cover by accident. An expired Family membership starts on
  // Adult, and so does a child that a family membership covers.
  const held: Array<[string, ApiMember]> = [
    ['an expired Family membership', member('expired', '2026-10-24', 'family')],
    ['an expired Scholastic membership', member('expired', '2026-10-24', 'scholastic')],
    ['an expired Senior membership', member('expired', '2026-10-24', 'senior')],
    ['an active Adult membership', member('active', '2027-10-24', 'adult')],
    ['an active Scholastic membership', member('active', '2027-10-24', 'scholastic')],
    ['an active Senior membership', member('active', '2027-10-24', 'senior')],
    ['no membership yet, with a tier left on the record', member('none', null, 'family')],
  ]
  const verbOf = (who: ApiMember) => (who.membership_status === 'none' ? 'Join' : 'Renew')
  const ADULT_NOTE =
    `Adult is chosen to start, at $${P.adult} a year. ` +
    `That is a little more than Scholastic ($${P.scholastic}, for K-12 students) ` +
    `or Senior ($${P.senior}, for 65 and up), so if one of those fits you, choose it below. ` +
    `Family ($${P.family}) covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children.`
  const FAMILY_NOTE =
    `Family is chosen to start, at $${P.family} a year, and covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. ` +
    `Adult is $${P.adult} a year, a little more than Scholastic ($${P.scholastic}, for K-12 students) ` +
    `or Senior ($${P.senior}, for 65 and up), so if one of those fits you, choose it below.`
  const REASON = 'Your family membership covers the children on your account. Renewing as another tier ends their cover when your current membership runs out.'
  /** The paragraphs that describe the group, in the order a screen reader is given them. */
  const described = () => group().getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)!)

  it.each(held)('a member with %s starts on Adult, with the button naming Adult and its price and no word on family cover', (_what, who) => {
    renderPage({ user: true, who })
    expectChosen(ADULT, verbOf(who))
    expect(checkoutButton().textContent).toBe(label(verbOf(who), ADULT))
    expect(described().map((p) => p.textContent)).toEqual([ADULT_NOTE])
    expect(screen.queryByText(REASON)).toBeNull()
    expect(document.body.textContent).not.toMatch(/Family is chosen to start|Your family membership covers/)
  })

  it('a member with an active Family membership starts on Family, is told why under the price line, and can switch to Adult', () => {
    renderPage({ user: true, who: member('active', '2027-10-24', 'family') })
    expectChosen(FAMILY)
    expect(checkoutButton().textContent).toBe(`Renew as Family, $${P.family} a year`)
    // The price line says Family is the one chosen, every price from the price list, and the reason comes straight after it.
    const [note, reason] = described()
    expect(note.textContent).toBe(FAMILY_NOTE)
    expect(reason.textContent).toBe(REASON)
    expect(note.nextElementSibling).toBe(reason)
    expect(group().contains(reason)).toBe(true)
    const everything = [...document.querySelectorAll('*')]
    expect(everything.indexOf(reason)).toBeLessThan(everything.indexOf(radio(ADULT)))
    // Said in words, in the same plain ink as the price line: no colour of its own.
    expect(reason.tagName).toBe('P')
    expect(reason.className).toBe(note.className)
    expect(reason.getAttribute('role')).toBeNull()
    expect(screen.getAllByText(REASON)).toHaveLength(1)
    for (const text of [note.textContent!, reason.textContent!]) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(/\bmembers? (save|pay|price|rate|discount)/i)
    }
    // Adult, and every other tier, is still one click away, and the reason stays in view after the switch.
    fireEvent.click(radio(ADULT))
    expectChosen(ADULT)
    expect(screen.getByText(REASON)).toBe(reason)
    for (const t of [SCHOLASTIC, SENIOR, FAMILY]) {
      fireEvent.click(radio(t))
      expectChosen(t)
    }
  })

  it('a member with an active Family membership who changes nothing is sent to the checkout for Family', async () => {
    const to = inThisPage('fx-membership-family')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-5', tier: 'family', amount: P.family, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('active', '2027-10-24', 'family') })
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('family')
  })

  it('moves to Family when an active Family member\'s record arrives after the page is drawn, but keeps a tier the member already picked', () => {
    const family = member('active', '2027-10-24', 'family')
    const first = renderPage({ user: true, who: null })
    expectChosen(ADULT, 'Join or renew')
    first.rerender(page({ user: true, who: family }))
    expectChosen(FAMILY)
    expect(screen.getByText(REASON)).toBeTruthy()
    cleanup()

    const second = renderPage({ user: true, who: null })
    fireEvent.click(radio(SENIOR))
    second.rerender(page({ user: true, who: family }))
    expectChosen(SENIOR)
  })

  it('counts a press of the button as a pick: a Family record that arrives while the Adult checkout is asked for leaves the choice on Adult', async () => {
    let release!: (reason: unknown) => void
    api.createMembershipCheckout.mockReturnValueOnce(new Promise((_resolve, reject) => { release = reject }))
    const family = member('active', '2027-10-24', 'family')
    expect(family).toMatchObject({ membership_type: 'family', membership_status: 'active', guardian_id: null })
    const view = renderPage({ user: true, who: null })
    expectChosen(ADULT, 'Join or renew')
    fireEvent.click(checkoutButton())
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('adult')
    // The record arrives while the checkout is still asked for.
    view.rerender(page({ user: true, who: family }))
    expect(checkoutButton().textContent).toBe('Starting checkout…')
    for (const t of TIERS) expect(radio(t).checked, t.id).toBe(t === ADULT)
    release(new Error('Card service is down.'))
    expect((await screen.findByRole('alert')).textContent).toBe('Card service is down.')
    expectChosen(ADULT)
    expect(checkoutButton().textContent).toBe(`Renew as Adult, $${P.adult} a year`)
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
  })

  it.each(held)('a member with %s can switch to each other tier, and the button follows', (_what, who) => {
    renderPage({ user: true, who })
    for (const t of [SCHOLASTIC, FAMILY, SENIOR, ADULT]) {
      fireEvent.click(radio(t))
      expectChosen(t, verbOf(who))
    }
  })

  it('a member who last held Family and chooses Scholastic is sent to the checkout for Scholastic, not for the tier on the record', async () => {
    const to = inThisPage('fx-membership-held')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-3', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('expired', '2026-10-24', 'family') })
    fireEvent.click(radio(SCHOLASTIC))
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('scholastic')
  })

  it('a member who last held Scholastic and changes nothing is sent to the checkout for Adult', async () => {
    const to = inThisPage('fx-membership-held-adult')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-4', tier: 'adult', amount: P.adult, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('adult')
  })

  describe('a child that a guardian\'s family membership covers, signed in with an account of their own', () => {
    /** The Family card's own words, which every member reads. */
    const FAMILY_CARD = `Covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. Add your children on your profile and they are covered automatically.`
    /** Each piece of text on the page that speaks of children, in page order. */
    const aboutChildren = () => [...document.body.querySelectorAll('*')].filter((el) => el.children.length === 0 && /children/i.test(el.textContent!)).map((el) => el.textContent)

    it('starts on Adult like everyone else, with the Adult price line alone describing the group and no word on children of their own, and can switch to Scholastic', () => {
      const child = coveredChild('active', '2027-10-25')
      // The record says family and active, as the guardian's does; guardian_id alone says the membership is the guardian's.
      expect(child).toMatchObject({ membership_type: 'family', membership_status: 'active', guardian_id: 'fx-renew-guardian' })
      renderPage({ user: true, who: child })
      expectChosen(ADULT)
      expect(checkoutButton().textContent).toBe(`Renew as Adult, $${P.adult} a year`)
      const note = within(group()).getByText(/^Adult is chosen to start/)
      expect(note.textContent).toBe(ADULT_NOTE)
      expect(group().getAttribute('aria-describedby')).toBe(note.id)
      // Nothing says a membership of theirs covers children: the only words about children are the price line's and the Family card's.
      expect(screen.queryByText(REASON)).toBeNull()
      expect(document.body.textContent).not.toMatch(/Family is chosen to start|Your family membership covers|ends their cover/)
      expect(aboutChildren()).toEqual([ADULT_NOTE, FAMILY_CARD])
      // Their banner says how long the cover runs, with the weekday.
      expect(screen.getByRole('button', { name: 'View my profile' }).closest('section')!.textContent).toBe('Your membership is active through Mon, Oct 25, 2027. View my profile')
      // Scholastic is one click away, and the button follows.
      fireEvent.click(radio(SCHOLASTIC))
      expectChosen(SCHOLASTIC)
      expect(checkoutButton().textContent).toBe(`Renew as Scholastic, $${P.scholastic} a year`)
    })

    it('stays on Adult when the child\'s record arrives after the page is drawn', () => {
      const first = renderPage({ user: true, who: null })
      expectChosen(ADULT, 'Join or renew')
      first.rerender(page({ user: true, who: coveredChild('active', '2027-10-25') }))
      expectChosen(ADULT)
      expect(described().map((p) => p.textContent)).toEqual([ADULT_NOTE])
      expect(screen.queryByText(REASON)).toBeNull()
    })

    it('starts on Adult once the cover has run out, too', () => {
      renderPage({ user: true, who: coveredChild('expired', '2026-10-23') })
      expectChosen(ADULT)
      expect(described().map((p) => p.textContent)).toEqual([ADULT_NOTE])
      expect(screen.queryByText(REASON)).toBeNull()
      expect(screen.getByText(/Your membership has/).textContent).toBe('Your membership has expired (it ran through Fri, Oct 23, 2026). Renew below to keep your member benefits.')
    })
  })
})

describe('the checkout in flight and after a failure, for the tier chosen', () => {
  it.each([SCHOLASTIC, FAMILY, SENIOR, ADULT])('while the $short checkout starts, the button is disabled and says "Starting checkout…", and the radios are held on $short', async (tier) => {
    let release!: (reason: unknown) => void
    api.createMembershipCheckout.mockReturnValueOnce(new Promise((_resolve, reject) => { release = reject }))
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(radio(tier))
    fireEvent.click(checkoutButton())
    const button = screen.getByRole('button', { name: 'Starting checkout…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    for (const t of TIERS) {
      expect(radio(t).checked, t.id).toBe(t === tier)
      expect(radio(t).matches(':disabled'), t.id).toBe(true)
    }
    expect(api.createMembershipCheckout).toHaveBeenCalledWith(tier.id)
    release(new Error('Card service is down.'))
    await screen.findByRole('alert')
  })

  it.each([SCHOLASTIC, FAMILY, SENIOR, ADULT])('after a failed $short checkout the error shows, the choice stays on $short, and the button names it again', async (tier) => {
    api.createMembershipCheckout.mockRejectedValueOnce(new Error('Card service is down.'))
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(radio(tier))
    fireEvent.click(checkoutButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Card service is down.')
    expectChosen(tier)
    expect((checkoutButton() as HTMLButtonElement).disabled).toBe(false)
    expect(sessionStorage.getItem(KEY)).toBeNull()
    // The member can then change the choice, and the next try asks for the new tier and clears the old error.
    api.createMembershipCheckout.mockReturnValueOnce(new Promise(() => {}))
    const other = tier === ADULT ? SENIOR : ADULT
    fireEvent.click(radio(other))
    expectChosen(other)
    fireEvent.click(checkoutButton())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.createMembershipCheckout).toHaveBeenLastCalledWith(other.id)
  })
})

describe('reading order and the choice line', () => {
  it('puts Adult first, then Scholastic, Family and Senior, in the order the radios are reached', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    const radios = [...group().querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map((r) => r.value)).toEqual(['adult', 'scholastic', 'family', 'senior'])
    const names = [...group().querySelectorAll('label')].map((l) => TIERS.find((t) => l.textContent!.includes(t.name))!.id)
    expect(names).toEqual(['adult', 'scholastic', 'family', 'senior'])
    // The line comes before the first card, the button after the last, so the page reads in the order it is heard.
    const note = within(group()).getByText(/^Adult is chosen to start/)
    const everything = [...document.querySelectorAll('*')]
    expect(everything.indexOf(note)).toBeLessThan(everything.indexOf(radios[0]))
    expect(everything.indexOf(radios[3])).toBeLessThan(everything.indexOf(checkoutButton()))
    // One radio is checked to start, and it is the first.
    expect(radios.filter((r) => r.checked)).toEqual([radios[0]])
  })

  it('puts the Adult card first for a visitor who is not signed in too', () => {
    renderPage({ user: false, who: null })
    const headings = screen.getAllByRole('heading', { level: 3 }).slice(0, 4).map((h) => h.textContent)
    expect(headings).toEqual(TIERS.map((t) => t.name))
    expect(screen.getAllByRole('link', { name: 'Join Now' })[0].closest('li')!.textContent).toContain('LCA Adult Membership')
  })

  it('names all four prices from the price list in the line above the cards, with Adult more than Scholastic and Senior', () => {
    renderPage({ user: true, who: member('none', null) })
    const note = within(group()).getByText(/^Adult is chosen to start/).textContent!
    for (const [tier, price] of Object.entries(P)) expect(note, tier).toContain(`$${price}`)
    expect(note).toContain(`Adult is chosen to start, at $${P.adult} a year`)
    expect(note).toContain(`Scholastic ($${P.scholastic}`)
    expect(note).toContain(`Senior ($${P.senior}`)
    expect(note).toContain(`Family ($${P.family})`)
    expect(note).toMatch(/a little more than Scholastic/)
    expect(note).not.toMatch(DASHES)
    expect(note).not.toMatch(/\bmembers? (save|pay|price|rate|discount)/i)
  })
})

describe('the line "Already a member? Log in to renew" under How Membership Works', () => {
  it('is there for a visitor who is not signed in, with its link to /login', () => {
    renderPage({ user: false, who: null })
    const link = screen.getByRole('link', { name: 'Log in to renew' })
    expect(link.getAttribute('href')).toBe('/login')
    expect(link.closest('p')!.textContent).toBe('Already a member? Log in to renew or manage your account.')
    expect(screen.getAllByText(/^Already a member\?/)).toHaveLength(1)
  })

  const signedIn: Array<[string, ApiMember | null]> = [
    ['a member whose membership has expired', member('expired', '2026-10-24')],
    ['a member whose membership is active', member('active', '2027-10-24')],
    ['a member with no membership yet', member('none', null)],
    ['a member whose record is still on its way', null],
  ]

  it.each(signedIn)('is not there for %s, who has the choice instead', (_what, who) => {
    renderPage({ user: true, who })
    expect(group()).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Log in to renew' })).toBeNull()
    expect(document.querySelector('a[href="/login"]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/Already a member\?|Log in to renew/)
  })
})

describe('the page\'s source', () => {
  const page = read('src/pages/MembershipPage.tsx')

  it('writes no price as a figure: every price comes from domain/membership/tiers.ts', () => {
    expect(page).toContain("from '@domain/membership/tiers'")
    expect(page).not.toMatch(/\$\d/)
  })

  it('moves the tab to the payment page with window.location.assign once, keeps the one key, and opens no window', () => {
    expect(page.match(/window\.location\.assign\(checkout\.paymentUrl\)/g)).toHaveLength(1)
    expect(page.match(/sessionStorage\.setItem\('lca_pending_payment_id', checkout\.paymentId\)/g)).toHaveLength(1)
    expect(read('src/pages/MembershipSuccessPage.tsx')).toContain("sessionStorage.getItem('lca_pending_payment_id')")
    expect(page).not.toMatch(/window\.open\(/)
  })

  it('has no en dash or em dash in the page or in this file, and says US Chess, not USCF', () => {
    for (const text of [page, read('test/unit/membership-renew.test.tsx')]) expect(text).not.toMatch(DASHES)
    expect(page).not.toMatch(/\bUSCF\b/)
  })
})
