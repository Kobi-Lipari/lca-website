// src/areas/clubs/components/ClubNewsPanel.tsx
//
// A club's news, as today's admin club page has drawn it on its News tab:
// the list of posted news with Delete on each, and the form that posts a
// title, a date and an excerpt. Its lines are those of src/pages/AdminClubPage.tsx,
// moved here without a word, a class or the order of the markup changed, so
// the admin club page draws exactly what it drew before (WS09 step 12), and
// a club's page in My region draws the same form and list.
//
// The page that draws it keeps the news, the form's values and what is on
// its way, and makes the calls, so the admin club page loads and says its
// errors as before. Drawn on a club in My region (myRegion), each date also
// carries its weekday, each Delete is named with the news it deletes, and an
// empty list reads "Nothing posted yet." alone; unset, none of these is
// drawn, as on the admin club page.
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Newspaper, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ApiClubNews } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The admin club page's gold button, moved here with the form it draws. */
const goldButtonClass = 'bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90'

/** The form's three values, as the news endpoint takes them. */
export interface ClubNewsForm {
  title: string
  newsDate: string
  excerpt: string
}

export function ClubNewsPanel({
  news, newsForm, setNewsForm, newsSaving, newsDeletingId, handleDeleteNews, handlePostNews, myRegion = false,
}: {
  news: ApiClubNews[]
  newsForm: ClubNewsForm
  setNewsForm: Dispatch<SetStateAction<ClubNewsForm>>
  newsSaving: boolean
  /** The news whose delete is on its way, or null. */
  newsDeletingId: string | null
  handleDeleteNews: (item: ApiClubNews) => void
  handlePostNews: (e: FormEvent) => void
  /** Drawn on a club in My region: each date with its weekday, and each Delete named with its news. */
  myRegion?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Newspaper className="size-5 text-gold-ink" />
          <h2 className="text-base font-semibold text-ink">
            Posted news · {news.length}
          </h2>
        </div>
        {news.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {/* My region has no Help to hold the explaining sentence, so a club there reads the first alone. */}
            {myRegion ? 'Nothing posted yet.' : 'Nothing posted yet. Anything you publish below appears on the club\'s public page.'}
          </p>
        ) : (
          <ul className="divide-y">
            {news.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{myRegion ? formatDate(item.news_date, { year: true }) : item.news_date}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.excerpt}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 text-bad hover:bg-bad-50"
                  disabled={newsDeletingId === item.id}
                  onClick={() => handleDeleteNews(item)}
                  aria-label={myRegion ? `Delete: ${item.title}` : undefined}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  {newsDeletingId === item.id ? 'Deleting…' : 'Delete'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

    <form onSubmit={handlePostNews} className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="size-5 text-gold-ink" />
        <h2 className="text-base font-semibold text-ink">Post club news</h2>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="news-title">Title</Label>
          <Input id="news-title" value={newsForm.title} onChange={(e) => setNewsForm((p) => ({ ...p, title: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="news-date">Date</Label>
          <Input id="news-date" type="date" value={newsForm.newsDate} onChange={(e) => setNewsForm((p) => ({ ...p, newsDate: e.target.value }))} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="news-excerpt">Excerpt</Label>
          <textarea
            id="news-excerpt"
            className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={newsForm.excerpt}
            onChange={(e) => setNewsForm((p) => ({ ...p, excerpt: e.target.value }))}
            required
          />
        </div>
      </div>
      <Button type="submit" className={cn('mt-4', goldButtonClass)} disabled={newsSaving}>
        {newsSaving ? 'Posting…' : 'Post news'}
      </Button>
    </form>
    </div>
  )
}
