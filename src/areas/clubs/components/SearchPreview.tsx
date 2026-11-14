// src/areas/clubs/components/SearchPreview.tsx
//
// How a club's page shows up in a search, drawn in the club editor's preview
// column as the keeper types: the site's line with the page's address, the
// title and the description. Both are made by domain/clubs/pageMeta.ts, the
// one rule the club page the server writes uses too, so the preview is the
// page's own words. A screen reader reads it as a title and a description.
// It is a drawing of the club's own words: it makes no request. Its heading
// says "your page" only to the club's own rep, and "the club's page" to
// anyone else who keeps the club.
import { SITE_HOST, SITE_NAME, clubPageDescription, clubPageTitle } from '@domain/clubs/pageMeta'

export function SearchPreview({
  own, name, city, about, statement, address,
}: {
  /** The club is the reader's own. */
  own: boolean
  name: string
  city: string
  about: string
  statement: string
  /** The page's part after /clubs/: its slug, else its id. */
  address: string
}) {
  const description = clubPageDescription(about, statement)
  return (
    <section aria-labelledby="preview-search-title" className="space-y-2">
      <h3 id="preview-search-title" className="text-sm font-semibold text-ink">{own ? 'How your page shows up in a search' : 'How the club\'s page shows up in a search'}</h3>
      <dl className="space-y-1 rounded-lg border border-hairline bg-card p-4">
        <dt className="sr-only">Site</dt>
        <dd className="break-words text-sm text-ink">{SITE_NAME} · {SITE_HOST} › clubs › {address}</dd>
        <dt className="sr-only">Title</dt>
        <dd className="break-words text-base font-medium text-ink">{clubPageTitle(name, city)}</dd>
        <dt className="sr-only">Description</dt>
        <dd className="break-words text-sm text-muted-foreground">{description || 'No description yet.'}</dd>
      </dl>
    </section>
  )
}
