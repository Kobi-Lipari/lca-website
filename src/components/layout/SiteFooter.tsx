// src/components/layout/SiteFooter.tsx
//
// The new footer (WS02 step 8), which src/components/layout/Footer.tsx draws
// with the chrome on (newNav and newLook, chromeOn in src/lib/nav.ts) at
// every width, as brief 1.4's footer and the decided board Nav-Footer-Final
// set it out. Everything it links to is the navigation model's
// (src/lib/nav.ts): the four columns from footerColumns, the brand block's
// buttons from FOOTER_BRAND_ACTIONS and the trust line's two links from
// TRUST_LINE_LINKS, each an entry by id with its one label and its address
// as the switches stand, so a link waiting for its switch is not drawn and
// a link that moves with a switch moves here too. Nothing here names a
// label or an address of its own.
//
// One navy footer with a 3 pixel gold line along its top, in three parts:
//
// - the brand block, never folded: the official logo (LcaLogo, decision D1)
//   at 56 pixels from the two copies sized for this place, with no plate,
//   beside the association's name in words, so the logo's own words are
//   empty; the board's one sentence; and the join slot, by the header's
//   rule (Join LCA for a visitor signed out, Renew once a membership has
//   expired, nothing for an active member), beside Donate;
// - the four columns, Play, Community, About LCA and Contact, each a nav
//   named by its heading. From 768 pixels up the headings are plain and
//   every list shows. Below 768, and where the window's width cannot be
//   asked, each heading holds a button that opens and closes its list,
//   saying so with aria-expanded and naming the list with aria-controls:
//   Contact starts open and the others closed, each its own switch, and
//   nothing slides or turns slowly at any motion setting. A closed list
//   stays in the page, hidden, so the button always names a list;
// - the base line, never folded: the trust line, its facts with a middle
//   dot between them from 768 pixels up, which a screen reader does not
//   read, and one fact a line below that, ending with the build's date when
//   the page holds one (footerParts.ts), and today's Appearance control,
//   with a label of its own, so the page never holds one id twice.
//
// Its three layouts, the phone's below 768 pixels (and where the width
// cannot be asked), the tablet's from 768 and the desktop's from 1024, are
// chosen from the same two widths the header asks (src/hooks/useWideScreen.ts),
// and so is the fold: every class that differs between them is picked here
// from that one answer, never by the stylesheet's breakpoints. Those are
// written in rem, which follow the browser's own font size, where the widths
// asked here are pixels, so with a larger or a smaller default font the two
// would part: plain headings over the phone's one column, or fold buttons in
// the tablet's two. The bars choose their forms the same way.
//
// Donate, in the brand block and in the Contact column, opens today's
// donation dialog until the Give page exists behind newMembership, then goes
// to /give. The dialog's code is fetched the first time it is asked for, as
// the header's is, inside the footer's own boundary (OnDemand), so a file
// that cannot be fetched closes the dialog and says so at the footer's top;
// the focus goes back to the Donate that was pressed.
//
// Its navy is the brand navy read through its variable, the navy that stays
// navy, not the navy band classes, whose gold focus ring rule would outrank
// a light surface's own; data-ring-ground="navy" gives its controls the gold
// ring, and the boundary's notice keeps the look's own on its light ground.
// The room the phone's dock needs under the footer's last line is the
// footer's own bottom padding (src/index.css), so the footer sets none.
import { lazy, useId, useRef, useState } from 'react'
import { ChevronDown, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppearanceControl } from '@/components/AppearanceControl'
import { LcaLogo } from '@/components/LcaLogo'
import { OnDemand } from '@/components/layout/OnDemand'
import { lastUpdated } from '@/components/layout/footerParts'
import { joinSlotOf, useOnDemandPart } from '@/components/layout/headerParts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useTabletScreen, useWideScreen } from '@/hooks/useWideScreen'
import { FOOTER_BRAND_ACTIONS, TRUST_LINE_LINKS, footerColumns, headerUtilities, navEntry, type FooterColumn, type NavId } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** The donation dialog, fetched the first time one of the footer's Donate buttons is pressed. */
const DonateDialog = lazy(() => import('@/components/DonateButton').then((m) => ({ default: m.DonateDialog })))

/** The brand block's one sentence, as the decided board words it. */
const SENTENCE = 'Tournaments, clubs and scholastic chess across the state, run by volunteers.'

/** The trust line's facts before its links, in their order. */
const TRUST_FACTS = ['US Chess state affiliate', "Louisiana's chess community since 1915"] as const

/** Whether a column's list is open when the footer is first drawn below 768 pixels: the one that holds the Contact page. */
const opensAtStart = (column: FooterColumn) => column.links.includes('contact')

/**
 * A column's link: white, underlined on hover and when focused, 44 pixels
 * high in the phone's layout and 34 in the wider two. A word too long for
 * its line, such as the email address in a narrow column, breaks rather
 * than spill.
 */
const linkClass = (folds: boolean) =>
  cn(
    'inline-flex min-w-0 items-center gap-2 text-left [overflow-wrap:anywhere] underline-offset-4 hover:underline focus-visible:underline',
    folds ? 'min-h-11 text-[15px]' : 'min-h-[34px] text-[14.5px]',
  )

/** The brand block's two buttons: 48 pixels high in the phone's layout, side by side across the width, and 40 in the wider two. */
const brandButtonClass = (folds: boolean) => (folds ? 'h-12 px-4 text-[15px] font-semibold' : 'h-10 px-4 text-sm font-semibold')

/** Donate in the brand block: outlined in white on the navy, its line full white on hover, never a fill. */
const OUTLINED = 'inline-flex items-center justify-center rounded-lg border border-white/70 hover:border-white'

/** A link of the trust line: white and underlined, 44 pixels high in the phone's layout, where each is a line of its own. */
const trustLinkClass = (folds: boolean) => cn('inline-flex items-center underline decoration-white/55 underline-offset-[3px]', folds && 'min-h-11')

/** What a footer link or button does when pressed: Donate opens the dialog, handed the button the focus goes back to. */
type OpenDonate = (from: HTMLElement) => void

/**
 * One entry as the footer draws it: a page as a router link, the Facebook
 * page and the email address as links that leave the site (the Facebook
 * page in a new tab), and Donate as the button that opens the donation
 * dialog while it has no address, then as a link.
 */
function EntryLink({ id, className, onDonate }: { id: NavId; className: string; onDonate: OpenDonate }) {
  const entry = navEntry(id)
  if (entry.href === null) {
    if (entry.does !== 'donate-dialog') return null
    return (
      <button type="button" onClick={(event) => onDonate(event.currentTarget)} className={className}>
        {entry.label}
      </button>
    )
  }
  if (entry.leavesSite) {
    return (
      <a href={entry.href} target={entry.newTab ? '_blank' : undefined} rel="noopener noreferrer" className={className}>
        {entry.kind === 'email' && <Mail aria-hidden="true" className="size-4 flex-none" />}
        {entry.label}
      </a>
    )
  }
  return (
    <Link to={entry.href} className={className}>
      {entry.label}
    </Link>
  )
}

interface FooterGroupProps {
  column: FooterColumn
  /** The phone's layout, below 768 pixels: the heading is a button over a list that opens and closes. */
  folds: boolean
  open: boolean
  onToggle: () => void
  onDonate: OpenDonate
}

/** One column: a nav named by its heading, over its list. */
function FooterGroup({ column, folds, open, onToggle, onDonate }: FooterGroupProps) {
  const headingId = useId()
  const listId = useId()
  return (
    <nav aria-labelledby={headingId} data-slot="footer-column" className={folds ? 'border-t border-white/15' : undefined}>
      {folds ? (
        <h2 id={headingId}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={onToggle}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left text-base font-semibold"
          >
            {column.title}
            <ChevronDown aria-hidden="true" className={cn('size-[18px] flex-none', open && 'rotate-180')} />
          </button>
        </h2>
      ) : (
        <h2 id={headingId} className="mt-1 mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-lca-gold">
          {column.title}
        </h2>
      )}
      <ul id={listId} hidden={folds && !open} className={folds ? 'px-4 pb-2.5' : undefined}>
        {column.links.map((id) => (
          <li key={id}>
            <EntryLink id={id} className={linkClass(folds)} onDonate={onDonate} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SiteFooter() {
  const auth = useAuth()
  const wide = useWideScreen()
  const tablet = useTabletScreen()
  // The phone's layout, with the columns folded: below 768 pixels, and where the width cannot be asked. Every layout
  // choice below is made from this answer and wide, the desktop's from 1024, so the fold and the layout never part.
  const folds = !(wide || tablet)
  const appearanceLabel = useId()
  const donation = useOnDemandPart()
  /** The Donate the dialog was opened from, which the focus goes back to when it closes. */
  const donateFrom = useRef<HTMLElement | null>(null)
  // One switch a column, kept as long as the footer is drawn: across a page change and across 768 pixels.
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>(() => Object.fromEntries(footerColumns().map((column) => [column.title, opensAtStart(column)])))
  // The page's build-date meta, read once: the meta never changes while the page is open.
  const [updated] = useState(lastUpdated)

  const signedIn = !auth.loading && !!auth.user
  // The join slot by the header's rule: Join LCA for a visitor signed out, and for someone signed in Join LCA, Renew or nothing.
  const [, , slot] = headerUtilities({ signedIn, joinSlot: signedIn ? joinSlotOf(auth) : undefined })
  const join = slot ? navEntry(slot) : null
  const donate = navEntry('donate')
  const columns = footerColumns()

  function openDonate(from: HTMLElement) {
    donateFrom.current = from
    donation.show()
  }

  const trust = [
    ...TRUST_FACTS.map((fact) => ({ key: fact, item: <>{fact}</> })),
    ...TRUST_LINE_LINKS.map((id) => ({ key: id, item: <EntryLink id={id} className={trustLinkClass(folds)} onDonate={openDonate} /> })),
    ...(updated
      ? [{ key: 'updated', item: <>Site last updated <time dateTime={updated.instant}>{updated.text}</time></> }]
      : []),
  ]

  return (
    <footer data-slot="site-footer" data-ring-ground="navy" className="border-t-[3px] border-lca-gold bg-(--color-brand-navy) text-white print:hidden">
      {donate.href === null && donation.drawn && (
        <OnDemand
          notice="The donation form could not be loaded. Reload the page to try again."
          onFailed={() => donation.setOpen(false)}
          returnFocus={() => donateFrom.current}
          tries={donation.tries}
        >
          <DonateDialog open={donation.open} onOpenChange={donation.setOpen} returnFocus={() => donateFrom.current} />
        </OnDemand>
      )}
      {/* The phone's layout puts each part under the one before; the tablet's sets the brand block across the top
          over the four columns in two, and the desktop's the brand block and the four columns in one row of five. */}
      <div className={cn('mx-auto max-w-6xl', folds ? undefined : wide ? 'px-8 pt-[42px]' : 'px-6 pt-[42px]')}>
        <div className={folds ? undefined : cn('grid gap-x-8 gap-y-9', wide ? 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-2')}>
          <div data-slot="footer-brand" className={folds ? 'px-4 pt-6 pb-5' : wide ? undefined : 'col-span-2'}>
            <div className="flex items-center gap-3">
              <LcaLogo width={56} height={56} alt="" sized />
              <span className="text-[17px] leading-tight font-bold">Louisiana Chess Association</span>
            </div>
            <p className={cn('mt-3.5 mb-4 text-sm leading-normal text-white/80', !folds && 'max-w-[270px]')}>{SENTENCE}</p>
            <div className={folds ? 'grid grid-cols-2 gap-2.5' : 'flex flex-wrap gap-2.5'}>
              {FOOTER_BRAND_ACTIONS.map((id) => {
                if (id === 'joinLca') {
                  return join?.href ? (
                    <Button key={id} asChild variant="gold" className={brandButtonClass(folds)}>
                      <Link to={join.href}>{join.label}</Link>
                    </Button>
                  ) : null
                }
                return <EntryLink key={id} id={id} className={cn(brandButtonClass(folds), OUTLINED)} onDonate={openDonate} />
              })}
            </div>
          </div>
          {columns.map((column) => (
            <FooterGroup
              key={column.title}
              column={column}
              folds={folds}
              open={!!open[column.title]}
              onToggle={() => setOpen((now) => ({ ...now, [column.title]: !now[column.title] }))}
              onDonate={openDonate}
            />
          ))}
        </div>
        <div
          data-slot="footer-base"
          className={cn('border-t border-white/15 pt-4', folds ? 'px-4 pb-[22px]' : 'mt-[34px] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-5')}
        >
          {/* Its size before its line height: a size class that comes after one drops it when the two are joined. */}
          <ul aria-label="About this site" data-slot="trust-line" className={cn(folds ? 'text-sm' : 'flex flex-wrap items-center text-[13.5px]', 'leading-[1.45] text-white/80')}>
            {trust.map(({ key, item }, i) => (
              <li key={key} className="flex min-h-[26px] items-center">
                {!folds && i > 0 && (
                  <span aria-hidden="true" className="mx-2.5 text-white/60">
                    ·
                  </span>
                )}
                {/* One run of words, so the space before the date is kept. */}
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <AppearanceControl labelId={appearanceLabel} className={folds ? 'mt-3' : undefined} />
        </div>
      </div>
    </footer>
  )
}
