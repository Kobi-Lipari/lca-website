// src/areas/clubs/components/SectionNav.tsx
//
// The new club page's section nav (WS09 step 21): a row of links to the
// sections the page draws, in the page's order, which sticks under the
// site's header as the page scrolls. It lists only what the page draws, so
// it never links to nothing: About, When and where, Events and News, each
// only when the page draws it (WS09 step 22 adds the last two); Contact and
// Photos join it with the steps that build them. Below 768 pixels of the
// page's width it is a row of pills, as the phone boards draw it, which
// scrolls sideways inside itself while the page never does: each pill is 32
// pixels tall for the eye inside a link 44 pixels tall, and the row keeps
// room inside its scrolling box for the focus ring, which the box would
// otherwise clip. With the new chrome on, the row sticks
// at the height its bar writes to --header-h, and at the top of the window
// where no bar writes one; today's header writes none and is 65 pixels
// tall, which is the fallback with the chrome off. In the reflow fallback,
// a window under 480 pixels tall or under 300 wide, the row does not stick
// at all and scrolls with the page, as the chrome's own phone bar does, so
// the little height there is stays the page's. The page keeps the room this
// row takes when the keyboard brings a control into view (ClubPage.tsx).
import { SECTION_IDS, SECTION_LABELS, type DrawnSection } from '@/areas/clubs/clubPage'
import { useReflowFallback } from '@/hooks/useWideScreen'
import { chromeOn } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Where the row sticks: under the new chrome's bar, or under today's 65 pixel header. */
const STICKS_UNDER_CHROME = 'sticky top-[var(--header-h,0px)]'
const STICKS_UNDER_TODAYS_HEADER = 'sticky top-[var(--header-h,4.0625rem)]'

export function SectionNav({ sections }: { sections: readonly DrawnSection[] }) {
  const reflow = useReflowFallback()
  if (sections.length === 0) return null
  const sticks = reflow ? 'static' : chromeOn() ? STICKS_UNDER_CHROME : STICKS_UNDER_TODAYS_HEADER
  return (
    <nav aria-label="On this page" data-slot="club-section-nav" className={cn(sticks, 'z-30 border-b border-hairline bg-surface shadow-sm')}>
      <div data-slot="club-section-row" className="mx-auto max-w-6xl overflow-x-auto overscroll-x-contain px-4 sm:px-6">
        {/* The row scrolls sideways on a narrow phone; its padding keeps room for the focus ring, which a scrolling box would clip, and the list is as wide as its links so the padding stays at its end. */}
        <ul className="flex w-max min-w-full gap-1 py-1 @max-3xl:gap-1.5">
          {sections.map((section) => (
            <li key={section} className="shrink-0">
              <a
                href={`#${SECTION_IDS[section]}`}
                className="group inline-flex min-h-11 items-center whitespace-nowrap rounded-sm border-b-[3px] border-transparent px-3 text-[15px] font-semibold text-ink outline-none hover:border-ink focus-visible:ring-3 focus-visible:ring-focus @max-3xl:rounded-full @max-3xl:border-b-0 @max-3xl:px-0 @max-3xl:text-[13.5px]"
              >
                <span data-slot="club-section-pill" className="@max-3xl:inline-flex @max-3xl:min-h-8 @max-3xl:items-center @max-3xl:rounded-full @max-3xl:border @max-3xl:border-field @max-3xl:px-3 @max-3xl:group-hover:bg-surface-2">
                  {SECTION_LABELS[section]}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
