// @vitest-environment jsdom
//
// The membership page's join and renewal choice, src/pages/MembershipPage.tsx.
// K asked on Wednesday, November 4, 2026 for the choice to start on the tier
// the member held last, so a family renews as a family, and for a member
// renewing as Scholastic or Senior to be asked to confirm that the tier
// still fits them, since a child may have turned 18. That replaces the start
// on Adult K asked for on Tuesday, November 3, 2026. This file holds:
//
// - signed out, the page is today's: four tier cards, each with Join Now to
//   sign-up, Most Popular on Adult, and no choice to make; its first Button
//   is still the Adult card's Join Now, the one test/a11y/baseline.json reads;
// - signed in, the four cards are one choice, "Choose your membership", with
//   one gold button under them that names the choice and its price ("Renew
//   as" the tier, with its price a year), "Join as" for a member with no
//   membership yet, and "Join or renew as" while the member's record is
//   still on its way;
// - the tier the choice starts on, from the record: the tier held last
//   (Adult, Scholastic, Senior or Family, active or expired); Adult for no
//   membership yet, for no tier on the record, for a single event
//   membership and for any tier the price list does not hold; Scholastic
//   for a child that a guardian's family membership covers, signed in with
//   an account of their own, who cannot hold that membership (the site
//   writes family and active on the child's record too, and only
//   guardian_id tells the two apart); a record with a guardian but no
//   family cover follows the tier held last, else Adult, as any other does;
// - the line above the cards for each start, word for word, every price
//   from the price list: Adult's line, that Adult is a little more than
//   Scholastic and Senior; for Scholastic, Senior and Family, that it is the
//   membership the member holds while it is active, or held last once it
//   has expired, then every tier's price; for the covered child, that they
//   are, or were, a child on a family membership; and under it, for a
//   guardian whose own Family membership is active only, that renewing as
//   another tier ends their children's cover when their current membership
//   runs out;
// - the box to tick for Scholastic and Senior, and for no other tier: its
//   exact words, Scholastic's asking both that the member is under 18,
//   below the Adult card's 18 and up, and a student in kindergarten
//   through grade 12, as K asked; the button disabled with "Tick the box
//   above to continue." under it until the box is ticked, nothing asked
//   for while it is unticked (by the button, or by a press that reaches
//   the checkout past it), the tier asked for once after the tick, the
//   tick cleared by any change of tier, and the box held with the choice
//   while a checkout is asked for;
// - "Selected" is on the chosen card only, beside its gold ring, and moves
//   with a click on a card or an arrow key in the group;
// - the button starts the checkout for the chosen tier as the page always
//   has: the payment's id kept under the same key for the success page, and
//   this very tab sent to the payment page, never a new window; the choice
//   holds while the checkout is asked for, a press of the button counts as a
//   pick, and a failure says why;
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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

/** The line above the cards when the choice starts on Adult. */
const ADULT_NOTE =
  `Adult is chosen to start, at $${P.adult} a year. ` +
  `That is a little more than Scholastic ($${P.scholastic}, for K-12 students) ` +
  `or Senior ($${P.senior}, for 65 and up), so if one of those fits you, choose it below. ` +
  `Family ($${P.family}) covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children.`
/** Every tier's price, as the line says them after the first sentence of any other start. */
const EVERY_PRICE =
  `Adult is $${P.adult} a year; Scholastic is $${P.scholastic}, for K-12 students; ` +
  `Senior is $${P.senior}, for 65 and up; Family is $${P.family} and covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. ` +
  'If another fits you, choose it below.'
/** The lines when the choice starts on the tier the member held last, once that membership has expired. */
const SCHOLASTIC_NOTE = `Scholastic is chosen to start, the membership you held last, at $${P.scholastic} a year. ${EVERY_PRICE}`
const SENIOR_NOTE = `Senior is chosen to start, the membership you held last, at $${P.senior} a year. ${EVERY_PRICE}`
const FAMILY_NOTE = `Family is chosen to start, the membership you held last, at $${P.family} a year. ${EVERY_PRICE}`
/** The same lines while that membership is active: the membership the member holds. */
const SCHOLASTIC_NOTE_HELD = `Scholastic is chosen to start, the membership you hold, at $${P.scholastic} a year. ${EVERY_PRICE}`
const SENIOR_NOTE_HELD = `Senior is chosen to start, the membership you hold, at $${P.senior} a year. ${EVERY_PRICE}`
const FAMILY_NOTE_HELD = `Family is chosen to start, the membership you hold, at $${P.family} a year. ${EVERY_PRICE}`
/** The covered child's line: in the present tense while the cover runs, in the past once it has run out. */
const CHILD_NOTE = `Scholastic is chosen to start, at $${P.scholastic} a year, since you are a child on a family membership. ${EVERY_PRICE}`
const CHILD_NOTE_PAST = `Scholastic is chosen to start, at $${P.scholastic} a year, since you were a child on a family membership. ${EVERY_PRICE}`
/** Said under the line to a guardian whose own Family membership is active, and to no one else. */
const REASON = 'Your family membership covers the children on your account. Renewing as another tier ends their cover when your current membership runs out.'
/** The box each tier bound to an age asks the member to tick, in its exact words. */
const BOX: Partial<Record<Tier['id'], string>> = {
  scholastic: 'I am under 18 and a student in kindergarten through grade 12.',
  senior: 'I am 65 or older.',
}
/** The line under the button while it waits for the tick. */
const WAIT = 'Tick the box above to continue.'

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
 * functions/utils/family.ts), so guardian_id on a family record is the one
 * sign that the membership is the guardian's.
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

const group = () => screen.getByRole('group', { name: GROUP }) as HTMLFieldSetElement
const radio = (tier: Tier) => within(group()).getByRole('radio', { name: new RegExp(`^${tier.name} `) }) as HTMLInputElement
/** The card a radio sits in: its label, and the box round it that carries the ring. */
const cardOf = (tier: Tier) => radio(tier).closest('label')!.parentElement!
const checkoutButton = () => screen.getByRole('button', { name: /^(Join|Renew|Join or renew) as |^Starting checkout…$/ }) as HTMLButtonElement
/** The box to tick for Scholastic and Senior, drawn in the group under the cards. */
const box = () => within(group()).getByRole('checkbox') as HTMLInputElement
/** The paragraphs that describe the group, in the order a screen reader is given them. */
const described = () => group().getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)!)
/** A tick in the box when the tier asks for one, as a member gives it before the press. */
const tickIfAsked = (tier: Tier) => {
  if (BOX[tier.id]) fireEvent.click(box())
}

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

/**
 * A press that reaches the checkout although the button is disabled, as a
 * press that slipped past it would. A disabled button takes no click, so
 * this calls the click handler the page gave the button, read from the
 * element's own props. It shows that the checkout holds the rule on its
 * own, not the disabled button alone.
 */
function pressPastTheButton() {
  const button = checkoutButton()
  const key = Object.keys(button).find((k) => k.startsWith('__reactProps$'))
  expect(key, 'the props the page gave the button').toBeDefined()
  const props = (button as unknown as Record<string, { onClick: () => Promise<void> }>)[key!]
  act(() => {
    void props.onClick()
  })
}

/**
 * What the case expects the choice to be: that tier's radio alone checked,
 * "Selected" on its card alone, the button naming it, and the box there for
 * Scholastic and Senior alone, in that tier's words.
 */
function expectChosen(tier: Tier, verb = 'Renew') {
  for (const t of TIERS) {
    expect(radio(t).checked, t.id).toBe(t === tier)
    expect(cardOf(t).textContent!.includes('Selected'), t.id).toBe(t === tier)
    expect(cardOf(t).className.split(' ').includes('ring-lca-gold/30'), t.id).toBe(t === tier)
  }
  expect(screen.getAllByText('Selected')).toHaveLength(1)
  expect(checkoutButton().textContent).toBe(label(verb, tier))
  const boxes = screen.queryAllByRole('checkbox') as HTMLInputElement[]
  expect(boxes.map((b) => b.labels![0].textContent), 'the box').toEqual(BOX[tier.id] ? [BOX[tier.id]] : [])
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

  it('starts the checkout for the chosen tier once its box is ticked, keeps the payment for the success page and moves this tab to the payment page', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    const to = inThisPage('fx-membership-checkout')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-1', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '/membership/success?paymentId=fx-pay-membership-1' })
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(screen.getByText(SCHOLASTIC.name))
    fireEvent.click(box())
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
  // The tier the member held last, whether the membership is active or has
  // expired: Adult, Scholastic, Senior or Family on the record. Adult for no
  // membership yet, for no tier on the record, for a single event
  // membership and for a tier the price list does not hold. The line says
  // "the membership you hold" while it is active and "the membership you
  // held last" once it has expired. A child that a family membership covers
  // starts on Scholastic; a record with a guardian and no family cover does
  // not (the cases at the end).
  // Only a guardian whose own Family membership is active is told that
  // renewing as another tier ends their children's cover.
  const starts: Array<[string, string, ApiMember, Tier, string]> = [
    ['an active Adult membership', 'Adult', member('active', '2027-10-24', 'adult'), ADULT, ADULT_NOTE],
    ['an expired Adult membership', 'Adult', member('expired', '2026-10-24', 'adult'), ADULT, ADULT_NOTE],
    ['an active Scholastic membership', 'Scholastic', member('active', '2027-10-24', 'scholastic'), SCHOLASTIC, SCHOLASTIC_NOTE_HELD],
    ['an expired Scholastic membership', 'Scholastic', member('expired', '2026-10-24', 'scholastic'), SCHOLASTIC, SCHOLASTIC_NOTE],
    ['an active Senior membership', 'Senior', member('active', '2027-10-24', 'senior'), SENIOR, SENIOR_NOTE_HELD],
    ['an expired Senior membership', 'Senior', member('expired', '2026-10-24', 'senior'), SENIOR, SENIOR_NOTE],
    ['an expired Family membership', 'Family', member('expired', '2026-10-24', 'family'), FAMILY, FAMILY_NOTE],
    ['no membership yet', 'Adult', member('none', null), ADULT, ADULT_NOTE],
    ['no membership yet, with a tier left on the record', 'Adult', member('none', null, 'family'), ADULT, ADULT_NOTE],
    ['an active membership with no tier on the record', 'Adult', member('active', '2027-10-24'), ADULT, ADULT_NOTE],
    ['an expired membership with no tier on the record', 'Adult', member('expired', '2026-10-24'), ADULT, ADULT_NOTE],
    ['an active single event membership', 'Adult', member('active', '2027-10-24', 'single_event'), ADULT, ADULT_NOTE],
    ['an expired single event membership', 'Adult', member('expired', '2026-10-24', 'single_event'), ADULT, ADULT_NOTE],
    ['a tier the price list does not hold', 'Adult', member('expired', '2026-10-24', 'lifetime'), ADULT, ADULT_NOTE],
  ]
  const verbOf = (who: ApiMember) => (who.membership_status === 'none' ? 'Join' : 'Renew')

  it.each(starts)('a member with %s starts on %s, with the line for that start word for word, every price from the price list, and no word on family cover', (_what, _start, who, tier, note) => {
    renderPage({ user: true, who })
    expectChosen(tier, verbOf(who))
    expect(checkoutButton().textContent).toBe(label(verbOf(who), tier))
    expect(described().map((p) => p.textContent)).toEqual([note])
    for (const [id, price] of Object.entries(P)) expect(note, id).toContain(`$${price}`)
    expect(note).not.toMatch(DASHES)
    expect(note).not.toMatch(/\bmembers? (save|pay|price|rate|discount)/i)
    expect(screen.queryByText(REASON)).toBeNull()
    expect(document.body.textContent).not.toMatch(/Your family membership covers|ends their cover|since you (are|were) a child/)
    // Scholastic and Senior start with their box unticked and the button waiting for it; Adult and Family ask none.
    expect(checkoutButton().disabled).toBe(!!BOX[tier.id])
    if (BOX[tier.id]) expect(box().checked).toBe(false)
  })

  it('a member with an active Family membership starts on Family, is told why under the price line, and can switch to Adult', () => {
    renderPage({ user: true, who: member('active', '2027-10-24', 'family') })
    expectChosen(FAMILY)
    expect(checkoutButton().textContent).toBe(`Renew as Family, $${P.family} a year`)
    // The price line says Family is the one chosen, as the membership the member holds, with the children it covers and every price from the price list, and the reason comes straight after it.
    const [note, reason] = described()
    expect(note.textContent).toBe(FAMILY_NOTE_HELD)
    expect(note.textContent).toContain(`Family is $${P.family} and covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children.`)
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

  it('a member whose Family membership has expired and who changes nothing is sent to the checkout for Family, with no box to tick', async () => {
    const to = inThisPage('fx-membership-family-expired')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-6', tier: 'family', amount: P.family, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('expired', '2026-10-24', 'family') })
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(checkoutButton().disabled).toBe(false)
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

  it('moves to the tier held last when the record arrives after the page is drawn: Scholastic, with its line and its box unticked', () => {
    const view = renderPage({ user: true, who: null })
    expectChosen(ADULT, 'Join or renew')
    expect(checkoutButton().disabled).toBe(false)
    view.rerender(page({ user: true, who: member('expired', '2026-10-24', 'scholastic') }))
    expectChosen(SCHOLASTIC)
    expect(described().map((p) => p.textContent)).toEqual([SCHOLASTIC_NOTE])
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
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

  it.each(starts)('a member with %s (a start on %s) can switch to each other tier, and the button follows', (_what, _start, who) => {
    renderPage({ user: true, who })
    for (const t of [SCHOLASTIC, FAMILY, SENIOR, ADULT]) {
      fireEvent.click(radio(t))
      expectChosen(t, verbOf(who))
    }
  })

  it('a member who last held Family and chooses Scholastic meets the box, and once it is ticked is sent to the checkout for Scholastic, not for the tier on the record', async () => {
    const to = inThisPage('fx-membership-held')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-3', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('expired', '2026-10-24', 'family') })
    expectChosen(FAMILY)
    fireEvent.click(radio(SCHOLASTIC))
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    fireEvent.click(checkoutButton())
    expect(api.createMembershipCheckout).not.toHaveBeenCalled()
    fireEvent.click(box())
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('scholastic')
  })

  it('a member who last held Scholastic and changes nothing ticks the box and is sent to the checkout for Scholastic', async () => {
    const to = inThisPage('fx-membership-held-scholastic')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-4', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })
    fireEvent.click(checkoutButton())
    expect(api.createMembershipCheckout).not.toHaveBeenCalled()
    fireEvent.click(box())
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('scholastic')
  })

  describe('a child that a guardian\'s family membership covers, signed in with an account of their own', () => {
    /** The Family card's own words, which every member reads. */
    const FAMILY_CARD = `Covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. Add your children on your profile and they are covered automatically.`
    /** Each piece of text on the page that speaks of children, in page order. */
    const aboutChildren = () => [...document.body.querySelectorAll('*')].filter((el) => el.children.length === 0 && /children/i.test(el.textContent!)).map((el) => el.textContent)

    it('starts on Scholastic, with the child\'s line alone describing the group, no word on children of their own and the box to tick, and can switch to Adult', () => {
      const child = coveredChild('active', '2027-10-25')
      // The record says family and active, as the guardian's does; guardian_id alone says the membership is the guardian's.
      expect(child).toMatchObject({ membership_type: 'family', membership_status: 'active', guardian_id: 'fx-renew-guardian' })
      renderPage({ user: true, who: child })
      expectChosen(SCHOLASTIC)
      expect(checkoutButton().textContent).toBe(`Renew as Scholastic, $${P.scholastic} a year`)
      const note = within(group()).getByText(/^Scholastic is chosen to start/)
      expect(note.textContent).toBe(CHILD_NOTE)
      expect(group().getAttribute('aria-describedby')).toBe(note.id)
      // Nothing says a membership of theirs covers children: the only words about children are the price line's and the Family card's.
      expect(screen.queryByText(REASON)).toBeNull()
      expect(document.body.textContent).not.toMatch(/the membership you (hold|held last)|Your family membership covers|ends their cover/)
      expect(aboutChildren()).toEqual([CHILD_NOTE, FAMILY_CARD])
      // The box asks whether Scholastic still fits, and the button waits for the tick.
      expect(box().checked).toBe(false)
      expect(checkoutButton().disabled).toBe(true)
      // Their banner says how long the cover runs, with the weekday.
      expect(screen.getByRole('button', { name: 'View my profile' }).closest('section')!.textContent).toBe('Your membership is active through Mon, Oct 25, 2027. View my profile')
      // Adult is one click away, asks no box, and the button follows.
      fireEvent.click(radio(ADULT))
      expectChosen(ADULT)
      expect(checkoutButton().disabled).toBe(false)
      expect(checkoutButton().textContent).toBe(`Renew as Adult, $${P.adult} a year`)
    })

    it('moves to Scholastic when the child\'s record arrives after the page is drawn', () => {
      const first = renderPage({ user: true, who: null })
      expectChosen(ADULT, 'Join or renew')
      first.rerender(page({ user: true, who: coveredChild('active', '2027-10-25') }))
      expectChosen(SCHOLASTIC)
      expect(described().map((p) => p.textContent)).toEqual([CHILD_NOTE])
      expect(screen.queryByText(REASON)).toBeNull()
      expect(box().checked).toBe(false)
    })

    it('starts on Scholastic once the cover has run out, too, and once the box is ticked is sent to the checkout for Scholastic', async () => {
      const to = inThisPage('fx-membership-child')
      api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-8', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '' })
      renderPage({ user: true, who: coveredChild('expired', '2026-10-23') })
      expectChosen(SCHOLASTIC)
      expect(described().map((p) => p.textContent)).toEqual([CHILD_NOTE_PAST])
      expect(screen.queryByText(REASON)).toBeNull()
      expect(screen.getByText(/Your membership has/).textContent).toBe('Your membership has expired (it ran through Fri, Oct 23, 2026). Renew below to keep your member benefits.')
      fireEvent.click(box())
      fireEvent.click(checkoutButton())
      await waitFor(() => expect(window.location.href).toBe(to))
      expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
      expect(api.createMembershipCheckout).toHaveBeenCalledWith('scholastic')
    })
  })

  describe('a record with a guardian on it but no family cover', () => {
    // guardian_id alone does not make a covered child: the start on
    // Scholastic and the child's line need the family cover on the record
    // too. Without it the record follows the tier held last, else Adult.
    const withGuardian = (status: ApiMember['membership_status'], expiry: string | null, type: string | null) =>
      ({ ...member(status, expiry, type, 'fx-renew-guardian'), id: 'fx-renew-ward', full_name: 'Robin Fixture' })
    const rows: Array<[string, string, ApiMember, Tier, string, string]> = [
      ['no membership yet (no type on the record)', 'Adult', withGuardian('none', null, null), ADULT, ADULT_NOTE, 'Join'],
      ['an active Adult membership of its own', 'Adult', withGuardian('active', '2027-10-24', 'adult'), ADULT, ADULT_NOTE, 'Renew'],
      ['an expired Scholastic membership of its own', 'Scholastic', withGuardian('expired', '2026-10-24', 'scholastic'), SCHOLASTIC, SCHOLASTIC_NOTE, 'Renew'],
    ]

    it.each(rows)('with %s starts on %s, with that start\'s line and no word of a family membership', (_what, _start, who, tier, note, verb) => {
      expect(who.guardian_id).toBe('fx-renew-guardian')
      expect(who.membership_type).not.toBe('family')
      renderPage({ user: true, who })
      expectChosen(tier, verb)
      expect(checkoutButton().textContent).toBe(label(verb, tier))
      expect(described().map((p) => p.textContent)).toEqual([note])
      expect(note).not.toMatch(/family membership|a child on/i)
      expect(document.body.textContent).not.toMatch(/since you (are|were) a child|Your family membership covers|ends their cover/)
      expect(screen.queryByText(REASON)).toBeNull()
      expect(checkoutButton().disabled).toBe(!!BOX[tier.id])
    })

    it('with an active Adult membership of its own reads Adult\'s line, word for word', () => {
      renderPage({ user: true, who: withGuardian('active', '2027-10-24', 'adult') })
      const line = described()[0].textContent!
      expect(line.startsWith(`Adult is chosen to start, at $${P.adult} a year. `)).toBe(true)
      expect(line).toBe(ADULT_NOTE)
    })

    it('with an expired Scholastic membership of its own reads the line for the membership held last, not the child\'s', () => {
      renderPage({ user: true, who: withGuardian('expired', '2026-10-24', 'scholastic') })
      const line = described()[0].textContent!
      expect(line).toBe(SCHOLASTIC_NOTE)
      expect(line).toContain('the membership you held last')
      expect(line).not.toBe(CHILD_NOTE_PAST)
    })
  })
})

describe('the box a member ticks for Scholastic and Senior', () => {
  /** The ways a choice comes to Scholastic or Senior: the tier the member held last, or a pick from a start on Adult. */
  const asked: Array<[string, Tier, () => void]> = [
    ['starting on Scholastic, the tier held last', SCHOLASTIC, () => renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })],
    ['starting on Senior, the tier held last', SENIOR, () => renderPage({ user: true, who: member('active', '2027-10-24', 'senior') })],
    ['picking Scholastic from a start on Adult', SCHOLASTIC, () => {
      renderPage({ user: true, who: member('expired', '2026-10-24') })
      fireEvent.click(radio(SCHOLASTIC))
    }],
    ['picking Senior from a start on Adult', SENIOR, () => {
      renderPage({ user: true, who: member('expired', '2026-10-24', 'adult') })
      fireEvent.click(radio(SENIOR))
    }],
  ]

  it.each(TIERS)('$short: the box is drawn for Scholastic and Senior alone, each in its own words', (tier) => {
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(radio(tier))
    const words = BOX[tier.id]
    const boxes = screen.queryAllByRole('checkbox')
    expect(boxes).toHaveLength(words ? 1 : 0)
    for (const other of Object.values(BOX)) expect(document.body.textContent!.includes(other!), other).toBe(other === words)
    if (words) {
      expect(within(group()).getByRole('checkbox', { name: words })).toBe(boxes[0])
      expect(screen.getByText(WAIT)).toBeTruthy()
    } else {
      expect(document.querySelector('input[type="checkbox"]')).toBeNull()
      expect(screen.queryByText(WAIT)).toBeNull()
      expect(checkoutButton().disabled).toBe(false)
      expect(checkoutButton().hasAttribute('aria-describedby')).toBe(false)
    }
  })

  it('asks a Scholastic member both things K asked for: under 18, below the Adult card\'s 18 and up, and a student in kindergarten through grade 12', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })
    const words = box().labels![0].textContent!
    expect(words).toBe(BOX.scholastic)
    expect(words).toMatch(/\bunder 18 and\b/)
    expect(words).toMatch(/\ba student in kindergarten through grade 12\.$/)
    // The Adult card starts at 18, so no member who can tick this box truthfully is one the page calls Adult.
    expect(cardOf(ADULT).textContent).toContain('For players 18 and up.')
  })

  it.each(asked)('%s: the box is drawn unticked in its exact words and the button waits, with "Tick the box above to continue." under it; a tick lets it go and takes the line away, an untick brings both back', (_how, tier, open) => {
    open()
    expectChosen(tier)
    expect(within(group()).getByRole('checkbox', { name: BOX[tier.id] })).toBe(box())
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    const line = screen.getByText(WAIT)
    // Said in words in the page's plain ink, straight under the button, and given to a screen reader as the button's description.
    expect(line.tagName).toBe('P')
    expect(line.className.split(' ')).toEqual(expect.arrayContaining(['text-sm', 'text-ink']))
    expect(line.getAttribute('role')).toBeNull()
    expect(checkoutButton().nextElementSibling).toBe(line)
    expect(checkoutButton().getAttribute('aria-describedby')).toBe(line.id)
    fireEvent.click(box())
    expect(box().checked).toBe(true)
    expect(checkoutButton().disabled).toBe(false)
    expect(screen.queryByText(WAIT)).toBeNull()
    expect(checkoutButton().hasAttribute('aria-describedby')).toBe(false)
    expectChosen(tier)
    fireEvent.click(box())
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    expect(checkoutButton().getAttribute('aria-describedby')).toBe(screen.getByText(WAIT).id)
  })

  it.each(asked)('%s: a press while the box is unticked asks for nothing; a press after the tick asks for that tier once and moves this tab to the payment page', async (_how, tier, open) => {
    const to = inThisPage(`fx-membership-ticked-${tier.id}`)
    api.createMembershipCheckout.mockResolvedValue({ paymentId: `fx-pay-ticked-${tier.id}`, tier: tier.id, amount: P[tier.id], paymentUrl: to, successUrl: '' })
    open()
    fireEvent.click(checkoutButton())
    expect(api.createMembershipCheckout).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(KEY)).toBeNull()
    expect(window.location.hash).toBe('')
    expect(checkoutButton().textContent).toBe(label('Renew', tier))
    fireEvent.click(box())
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith(tier.id)
    expect(sessionStorage.getItem(KEY)).toBe(`fx-pay-ticked-${tier.id}`)
  })

  it('asks for nothing when a press reaches the checkout while the box is unticked: the checkout holds the rule itself, not the disabled button alone', () => {
    api.createMembershipCheckout.mockReturnValue(new Promise(() => {}))
    renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })
    pressPastTheButton()
    expect(api.createMembershipCheckout).not.toHaveBeenCalled()
    expect(checkoutButton().textContent).toBe(label('Renew', SCHOLASTIC))
    expect(group().disabled).toBe(false)
    fireEvent.click(radio(SENIOR))
    pressPastTheButton()
    expect(api.createMembershipCheckout).not.toHaveBeenCalled()
    expect(checkoutButton().textContent).toBe(label('Renew', SENIOR))
    // Once the box is ticked, the same press asks for Senior, once.
    fireEvent.click(box())
    pressPastTheButton()
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('senior')
  })

  it('clears the tick with any change of tier: Adult takes the box away and lets the button go, a switch back draws it unticked, and Scholastic to Senior, by a click or an arrow key, clears it too', () => {
    renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })
    fireEvent.click(box())
    expect(checkoutButton().disabled).toBe(false)
    fireEvent.click(radio(ADULT))
    expectChosen(ADULT)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(checkoutButton().disabled).toBe(false)
    expect(screen.queryByText(WAIT)).toBeNull()
    fireEvent.click(radio(SCHOLASTIC))
    expectChosen(SCHOLASTIC)
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    expect(screen.getByText(WAIT)).toBeTruthy()
    // Scholastic to Senior: the box takes Senior's words, unticked.
    fireEvent.click(box())
    fireEvent.click(radio(SENIOR))
    expectChosen(SENIOR)
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    // The arrow keys move the choice as a click does, and clear the tick as a click does: Senior round to Adult and back.
    fireEvent.click(box())
    pressArrow(radio(SENIOR), 'ArrowRight')
    expectChosen(ADULT)
    pressArrow(radio(ADULT), 'ArrowLeft')
    expectChosen(SENIOR)
    expect(box().checked).toBe(false)
    // A click on the card already chosen changes no tier, so a tick stays.
    fireEvent.click(box())
    fireEvent.click(cardOf(SENIOR).querySelector('label')!)
    expect(box().checked).toBe(true)
    expect(checkoutButton().disabled).toBe(false)
  })

  it('keeps a tick for its own tier: a record that moves the start to another tier, before the member picks one, leaves the new tier\'s box unticked', () => {
    const view = renderPage({ user: true, who: member('expired', '2026-10-24', 'scholastic') })
    fireEvent.click(box())
    expect(checkoutButton().disabled).toBe(false)
    view.rerender(page({ user: true, who: member('expired', '2026-10-24', 'senior') }))
    expectChosen(SENIOR)
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    expect(screen.getByText(WAIT)).toBeTruthy()
  })

  it('holds the box with the choice while the checkout is asked for, and gives it back ticked after a failure', async () => {
    let fail!: (reason: unknown) => void
    api.createMembershipCheckout.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject }))
    renderPage({ user: true, who: member('expired', '2026-10-24', 'senior') })
    fireEvent.click(box())
    fireEvent.click(checkoutButton())
    expect(checkoutButton().textContent).toBe('Starting checkout…')
    expect(checkoutButton().disabled).toBe(true)
    expect(group().disabled).toBe(true)
    expect(group().contains(box())).toBe(true)
    expect(box().matches(':disabled')).toBe(true)
    expect(box().checked).toBe(true)
    expect(screen.queryByText(WAIT)).toBeNull()
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('senior')
    fail(new Error('Card service is down.'))
    expect((await screen.findByRole('alert')).textContent).toBe('Card service is down.')
    expect(box().matches(':disabled')).toBe(false)
    expect(box().checked).toBe(true)
    expect(checkoutButton().disabled).toBe(false)
    expectChosen(SENIOR)
  })

  it('is a real checkbox with its label tied to it by htmlFor, in the price line\'s ink, drawn as the radios are and with no ring of its own, so it takes the focus outline every control gets', () => {
    renderPage({ user: true, who: member('active', '2027-10-24', 'senior') })
    const b = box()
    expect(b.tagName).toBe('INPUT')
    expect(b.type).toBe('checkbox')
    expect(b.hasAttribute('tabindex')).toBe(false)
    expect(b.disabled).toBe(false)
    expect(b.id).not.toBe('')
    const tied = [...document.querySelectorAll('label')].filter((l) => l.htmlFor === b.id)
    expect(tied).toHaveLength(1)
    expect(tied[0].textContent).toBe(BOX.senior)
    expect(tied[0].contains(b)).toBe(false)
    expect([...b.labels!]).toEqual([tied[0]])
    // The line round the box and its label is in the price line's ink.
    const line = b.parentElement!
    expect(line.contains(tied[0])).toBe(true)
    for (const c of ['text-sm', 'text-ink']) {
      expect(described()[0].className.split(' '), c).toContain(c)
      expect(line.className.split(' '), c).toContain(c)
    }
    // The tick is in the ink, as the radios' is, and no class draws a ring, an outline or gold.
    expect(b.className.split(' ')).toEqual(['mt-0.5', ...radio(ADULT).className.split(' ')])
    expect(`${b.className} ${tied[0].className} ${line.className}`).not.toMatch(/\b(?:focus|ring|outline)|gold/)
    // With no outline of its own, the box takes the outline every control
    // without one gets, as the radios do. With newLook off, as on the live
    // site, that is the browser's own focus outline in the base layer's
    // colour, outline-ring/50 on every element; with newLook on, the new
    // look's ring overrides it. Two facts, two rules.
    const css = read('src/index.css')
    expect(css).toMatch(/@layer base \{\s*\* \{\s*@apply border-border outline-ring\/50;/)
    expect(css).toMatch(/:root\[data-look="new"\] :focus-visible \{\s*outline: 2px solid var\(--focus\);/)
  })

  it('reads in order: the cards, the box, the button, the line under it, then the word on renewing early for an active member', () => {
    renderPage({ user: true, who: member('active', '2027-10-24', 'scholastic') })
    const everything = [...document.querySelectorAll('*')]
    const at = (el: Element) => everything.indexOf(el)
    const radios = [...group().querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    const line = screen.getByText(WAIT)
    const early = screen.getByText('Renewing now adds a year on top of the time you have left.')
    expect(at(radios[3])).toBeLessThan(at(box()))
    expect(at(box())).toBeLessThan(at(checkoutButton()))
    expect(at(checkoutButton())).toBeLessThan(at(line))
    expect(at(line)).toBeLessThan(at(early))
    // The box sits in the group, under the cards, so it is held with them; the button is outside it.
    expect(group().contains(box())).toBe(true)
    expect(group().contains(checkoutButton())).toBe(false)
  })

  it('a guardian whose own Family membership is active and who switches to Scholastic meets the box, keeps the reason in view, and once it is ticked is sent to the checkout for Scholastic', async () => {
    const to = inThisPage('fx-membership-guardian-scholastic')
    api.createMembershipCheckout.mockResolvedValue({ paymentId: 'fx-pay-membership-7', tier: 'scholastic', amount: P.scholastic, paymentUrl: to, successUrl: '' })
    renderPage({ user: true, who: member('active', '2027-10-24', 'family') })
    expectChosen(FAMILY)
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(radio(SCHOLASTIC))
    expectChosen(SCHOLASTIC)
    expect(box().checked).toBe(false)
    expect(checkoutButton().disabled).toBe(true)
    expect(screen.getByText(REASON)).toBeTruthy()
    fireEvent.click(checkoutButton())
    expect(api.createMembershipCheckout).not.toHaveBeenCalled()
    fireEvent.click(box())
    fireEvent.click(checkoutButton())
    await waitFor(() => expect(window.location.href).toBe(to))
    expect(api.createMembershipCheckout).toHaveBeenCalledTimes(1)
    expect(api.createMembershipCheckout).toHaveBeenCalledWith('scholastic')
  })
})

describe('the checkout in flight and after a failure, for the tier chosen', () => {
  it.each([SCHOLASTIC, FAMILY, SENIOR, ADULT])('while the $short checkout starts, the button is disabled and says "Starting checkout…", and the radios, with the box where there is one, are held on $short', async (tier) => {
    let release!: (reason: unknown) => void
    api.createMembershipCheckout.mockReturnValueOnce(new Promise((_resolve, reject) => { release = reject }))
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(radio(tier))
    tickIfAsked(tier)
    fireEvent.click(checkoutButton())
    const button = screen.getByRole('button', { name: 'Starting checkout…' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    for (const t of TIERS) {
      expect(radio(t).checked, t.id).toBe(t === tier)
      expect(radio(t).matches(':disabled'), t.id).toBe(true)
    }
    if (BOX[tier.id]) {
      expect(box().checked).toBe(true)
      expect(box().matches(':disabled')).toBe(true)
    }
    expect(api.createMembershipCheckout).toHaveBeenCalledWith(tier.id)
    release(new Error('Card service is down.'))
    await screen.findByRole('alert')
  })

  it.each([SCHOLASTIC, FAMILY, SENIOR, ADULT])('after a failed $short checkout the error shows, the choice stays on $short, and the button names it again', async (tier) => {
    api.createMembershipCheckout.mockRejectedValueOnce(new Error('Card service is down.'))
    renderPage({ user: true, who: member('expired', '2026-10-24') })
    fireEvent.click(radio(tier))
    tickIfAsked(tier)
    fireEvent.click(checkoutButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Card service is down.')
    expectChosen(tier)
    if (BOX[tier.id]) expect(box().checked).toBe(true)
    expect((checkoutButton() as HTMLButtonElement).disabled).toBe(false)
    expect(sessionStorage.getItem(KEY)).toBeNull()
    // The member can then change the choice, and the next try asks for the new tier and clears the old error.
    api.createMembershipCheckout.mockReturnValueOnce(new Promise(() => {}))
    const other = tier === ADULT ? SENIOR : ADULT
    fireEvent.click(radio(other))
    expectChosen(other)
    tickIfAsked(other)
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

  it('writes no price as a figure: every price comes from domain/membership/tiers.ts, in the page and in this file', () => {
    expect(page).toContain("from '@domain/membership/tiers'")
    expect(page).not.toMatch(/\$\d/)
    expect(read('test/unit/membership-renew.test.tsx')).not.toMatch(/\$\d/)
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
