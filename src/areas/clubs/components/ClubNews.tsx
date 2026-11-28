// src/areas/clubs/components/ClubNews.tsx
//
// The new club page's News (WS09 step 22): the club's news rows as the
// answer gives them, newest first, each with its title, its full date with
// the weekday and year, and its excerpt, drawn as text and never as markup.
// A row whose date cannot be read as a date is drawn with no date. The page
// draws this section only when the answer names it and carries a row
// (drawnSections in src/areas/clubs/clubPage.ts). The rows have no page of
// their own and no author in the answer, so neither is drawn, and there is
// no line about the site's own news until the news pages carry club news.
import { cn } from '@/lib/utils'
import { CLEAR_OF_BARS } from '@/areas/clubs/clubPage'
import { newsDate } from '@/areas/clubs/clubPageRows'
import { SectionHeading } from '@/areas/clubs/components/ClubAbout'
import type { ClubPageResponse } from '@domain/contracts'

type NewsRow = ClubPageResponse['news'][number]

export function ClubNews({ id, news }: { id: string; news: readonly NewsRow[] }) {
  return (
    <section id={id} className={cn(CLEAR_OF_BARS, 'border-y border-hairline bg-surface-2 py-8')}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading compact={false}>Club news</SectionHeading>
        <ul className="mt-2">
          {news.map((row) => {
            const date = newsDate(row.news_date)
            return (
              <li key={row.id} data-slot="club-news" className="space-y-1 border-b border-hairline py-4 last:border-b-0">
                <h3 className="break-words text-lg font-semibold text-ink">{row.title}</h3>
                {date && <p className="text-sm text-ink-muted">{date}</p>}
                {row.excerpt.trim() && <p className="whitespace-pre-line break-words text-base text-ink">{row.excerpt.trim()}</p>}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
