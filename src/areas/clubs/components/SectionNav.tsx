// src/areas/clubs/components/SectionNav.tsx
//
// The new club page's section nav (WS09 step 21): a row of links to the
// sections the page draws, in the page's order, which sticks under the
// site's header as the page scrolls. It lists only what the page draws, so
// it never links to nothing: at this step About and When and where, each
// only when the answer names it. Events and News, Contact and Photos join
// it with the steps that build them. With the new chrome on, the row sticks
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
      <div className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
        {/* The row scrolls sideways on a narrow phone; its padding keeps room for the focus ring, which a scrolling box would clip. */}
        <ul className="flex gap-1 py-1">
          {sections.map((section) => (
            <li key={section}>
              <a
                href={`#${SECTION_IDS[section]}`}
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-sm border-b-[3px] border-transparent px-3 text-[15px] font-semibold text-ink outline-none hover:border-ink focus-visible:ring-3 focus-visible:ring-focus"
              >
                {SECTION_LABELS[section]}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
