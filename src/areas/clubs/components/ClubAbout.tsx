// src/areas/clubs/components/ClubAbout.tsx
//
// The new club page's About (WS09 step 21): the club's own words. Words of
// one sentence are set large across the whole section, as Club-Final-Bare
// draws the bare club, so nothing sits beside them in an empty column;
// longer words are set as paragraphs, with Cost, Who is welcome and Find us
// online beside them, each only when the club filled it in, as Club-G draws
// a fuller club. Who is welcome also says, in words, that the club plays on
// weekends or is scholastic friendly when the club ticked either. A box
// with nothing in it is never drawn, and nothing says "not listed". A link
// is drawn only when it is a web address, and opens in a new tab, which its
// words say. Drawn in the editor's preview column (compact), the headings
// are words and the links are not links.
import type { ReactNode } from 'react'
import { Check, ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CLEAR_OF_BARS, WORD_LINK, hasWords, oneSentence, paragraphs, siteOf, webLink } from '@/areas/clubs/clubPage'
import type { ClubPageResponse } from '@domain/contracts'

type About = ClubPageResponse['about']

/** One of the club's links, with the words it is drawn with. */
interface ClubLink {
  href: string
  words: string
}

function linksOf(about: About): ClubLink[] {
  const links: ClubLink[] = []
  const facebook = webLink(about.facebook)
  if (facebook) links.push({ href: facebook, words: 'Facebook' })
  const website = webLink(about.website)
  if (website) links.push({ href: website, words: `Website: ${siteOf(website)}` })
  const other = webLink(about.other)
  if (other) links.push({ href: other, words: siteOf(other) })
  return links
}

/** A box beside the club's words: its label and what the club wrote. */
function Fact({ label, compact, children }: { label: string; compact: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-xl border border-hairline bg-surface p-4">
      {compact
        ? <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
        : <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</h3>}
      <div className="space-y-1 break-words text-base text-ink">{children}</div>
    </div>
  )
}

export function ClubAbout({
  name, about, compact = false, id,
}: {
  name: string
  about: About
  compact?: boolean
  /** The section's id, for the section nav; none in the preview. */
  id?: string
}) {
  const text = about.text?.trim() ?? ''
  const single = text !== '' && oneSentence(text)
  const links = linksOf(about)
  const ticks = [about.weekend_play && 'The club plays on weekends', about.scholastic_friendly && 'Scholastic friendly'].filter((t): t is string => !!t)

  const facts: ReactNode[] = []
  if (hasWords(about.cost)) {
    facts.push(<Fact key="cost" label="Cost" compact={compact}><p className="whitespace-pre-line">{about.cost.trim()}</p></Fact>)
  }
  if (hasWords(about.welcome) || ticks.length > 0) {
    facts.push(
      <Fact key="welcome" label="Who is welcome" compact={compact}>
        {hasWords(about.welcome) && <p className="whitespace-pre-line">{about.welcome.trim()}</p>}
        {ticks.length > 0 && (
          <ul className="space-y-1">
            {ticks.map((tick) => (
              <li key={tick} className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 shrink-0 text-ok" />{tick}</li>
            ))}
          </ul>
        )}
      </Fact>,
    )
  }
  if (links.length > 0) {
    facts.push(
      <Fact key="online" label="Find us online" compact={compact}>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              {compact ? (
                <span className="font-semibold">{link.words}</span>
              ) : (
                <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`${link.words} (opens in a new tab)`} className={cn(WORD_LINK, 'break-all')}>
                  {link.words}
                  <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </Fact>,
    )
  }

  const heading = `About ${name}`
  const words = single ? (
    <p className={cn('break-words text-ink', compact ? 'text-base' : 'text-xl leading-normal @3xl:text-[21px]')}>{text}</p>
  ) : text ? (
    <div className="space-y-4 break-words text-base leading-relaxed text-ink">
      {paragraphs(text).map((part, i) => <p key={i} className="whitespace-pre-line">{part}</p>)}
    </div>
  ) : null

  return (
    <section id={id} className={cn(compact ? 'px-3 py-3' : cn(CLEAR_OF_BARS, 'py-8'))}>
      <div className={cn('mx-auto max-w-6xl', !compact && 'px-4 sm:px-6')}>
        <SectionHeading compact={compact}>{heading}</SectionHeading>
        {single || !words ? (
          <div className="mt-3 space-y-4">
            {words}
            {facts.length > 0 && <div className={cn('grid gap-3', !compact && '@3xl:grid-cols-3')}>{facts}</div>}
          </div>
        ) : (
          <div className={cn('mt-3 grid gap-6', !compact && facts.length > 0 && '@3xl:grid-cols-[minmax(0,1fr)_24rem]')}>
            {words}
            {facts.length > 0 && <div className="space-y-3">{facts}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

/** A section's heading, with the club's bar before it, as the boards draw one; words in the preview. */
export function SectionHeading({ compact, children }: { compact: boolean; children: ReactNode }) {
  const bar = <span aria-hidden="true" className={cn('shrink-0 rounded-full bg-ink', compact ? 'h-4 w-1' : 'h-6 w-1.5')} />
  return compact ? (
    <p className="flex items-center gap-2 break-words text-base font-bold text-ink">{bar}{children}</p>
  ) : (
    <h2 className="flex items-center gap-2.5 break-words text-2xl font-bold tracking-tight text-ink">{bar}{children}</h2>
  )
}
