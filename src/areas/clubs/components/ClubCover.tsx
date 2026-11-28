// src/areas/clubs/components/ClubCover.tsx
//
// The top of the new club page (WS09 step 21), as Club-Final-Bare draws a
// club with no photo: a cover in the club's colour (navy when it has none,
// as the answer gives it), 260 pixels tall at full width and 200 on a phone,
// with the club's white initials tile, or its logo in that tile, at its
// foot. Under the cover, on the page's own ground, stand the club's name as
// the page's one h1, the one line the site writes ("Chess club in {city},
// Louisiana · {region}"), and how the club meets in its own words, so when
// and where is on the first screen. The name never sits on the club's
// colour, which is a fill and never words: the cover draws no words at all.
// How the club meets keeps the club's line breaks, as When and where keeps
// them, and a long run with no space in it, such as a web address, breaks
// inside the column rather than widening the page.
//
// Two buttons: Contact the club, which leads where today's club page sends a
// visitor while the club's address is hidden (the site's contact page) until
// the page's own Contact section is built, and Share, which opens the
// visitor's own share sheet where the browser has one and otherwise copies
// the page's address, and says what happened in words in a status beside
// it. That status is the page's one status: the page holds what it says, so
// the foot line's Copy link says its outcome there too (WS09 step 22).
// Nothing is sent anywhere by either. There is no Follow button.
//
// Drawn in the club editor's preview column (compact), the cover is smaller,
// the name is words rather than a heading, and there are no buttons.
import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Mail, Share2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CONTROL, cityLine, clubInitials, copyLink, pageLink } from '@/areas/clubs/clubPage'
import type { ClubPageResponse } from '@domain/contracts'

/** The cover's quiet pattern of squares, a lighter wash over the club's colour on its right. */
const SQUARES = {
  backgroundImage: 'conic-gradient(rgb(255 255 255 / 0.07) 0 25%, transparent 0 50%, rgb(255 255 255 / 0.07) 0 75%, transparent 0)',
  backgroundSize: '64px 64px',
  maskImage: 'linear-gradient(90deg, transparent 0, black 55%)',
  WebkitMaskImage: 'linear-gradient(90deg, transparent 0, black 55%)',
} as const

export function ClubCover({
  club, statement, compact = false, headingRef, said = '', say,
}: {
  club: ClubPageResponse['club']
  /** How the club meets, in its own words, drawn under the name. */
  statement: string | null
  /** Drawn in the editor's preview column. */
  compact?: boolean
  /** The page's h1, which the page focuses once it has drawn. */
  headingRef?: Ref<HTMLHeadingElement>
  /** What the page's one status says now. */
  said?: string
  /** Sets what the status says; the page passes it, and the buttons are drawn with it. */
  say?: (words: string) => void
}) {
  const initials = clubInitials(club.name)
  const logo = club.logo && club.logo.startsWith('/') && !club.logo.startsWith('//') ? club.logo : null
  const line = cityLine(club.city, club.region)
  const meets = statement?.trim() ? statement.trim() : null

  return (
    <div className="bg-ground">
      <div aria-hidden="true" className={cn('relative overflow-hidden', compact ? 'h-16' : 'h-[200px] @3xl:h-[260px]')} style={{ backgroundColor: club.color }}>
        <div className="absolute inset-y-0 right-0 w-2/3" style={SQUARES} />
      </div>
      <div className={cn('mx-auto max-w-6xl', compact ? 'px-3' : 'px-4 sm:px-6')}>
        <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-4 @xl:flex-row @xl:items-start @xl:gap-6')}>
          <div
            aria-hidden="true"
            className={cn(
              'relative flex shrink-0 items-center justify-center overflow-hidden bg-surface font-bold text-ink shadow-lg ring-1 ring-hairline',
              compact ? '-mt-7 size-14 rounded-xl text-xl' : '-mt-12 size-24 rounded-[18px] text-[40px] leading-none',
            )}
          >
            {logo ? <img src={logo} alt="" className="size-full object-contain p-2" /> : initials}
          </div>
          <div className={cn('min-w-0 flex-1', !compact && '@xl:pt-4')}>
            {compact ? (
              <p className="break-words text-lg font-bold text-ink">{club.name}</p>
            ) : (
              <h1 ref={headingRef} tabIndex={-1} className="break-words text-3xl font-bold tracking-tight text-ink outline-none @3xl:text-[44px] @3xl:leading-[1.05]">
                {club.name}
              </h1>
            )}
            <p className={cn('break-words text-ink', compact ? 'mt-1 text-sm' : 'mt-2 text-lg')}>{line}</p>
            {meets && (
              <p className={cn('flex items-start gap-2 break-words text-ink', compact ? 'mt-2 text-sm' : 'mt-3 text-base')}>
                <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-muted" />
                {/* The club's own words: they may hold a long address, which breaks anywhere so the page never widens, and their line breaks are kept. */}
                <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{meets}</span>
              </p>
            )}
          </div>
          {!compact && say && <CoverButtons name={club.name} slug={club.slug} said={said} say={say} />}
        </div>
      </div>
    </div>
  )
}

/** Contact the club and Share, with the page's one status, which says Share's outcome in words. */
function CoverButtons({ name, slug, said, say }: { name: string; slug: string; said: string; say: (words: string) => void }) {
  async function share() {
    const address = pageLink(window.location.origin, slug)
    say('')
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: name, url: address })
        say('Shared.')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') say('Not shared.')
        else say(await copyLink(address))
      }
      return
    }
    say(await copyLink(address))
  }

  return (
    <div className="flex flex-col gap-2 @xl:items-end @xl:self-end @xl:pb-1">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/contact" className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90')}>
          <Mail aria-hidden="true" className="size-4" />
          Contact the club
        </Link>
        <button type="button" onClick={() => { void share() }} className={cn(CONTROL, 'border border-field bg-surface text-ink hover:bg-surface-2')}>
          <Share2 aria-hidden="true" className="size-4" />
          Share
        </button>
      </div>
      <p role="status" className="max-w-xs break-words text-sm text-ink">{said}</p>
    </div>
  )
}
