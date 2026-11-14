// src/areas/clubs/components/SearchPreview.tsx
//
// How a club's page shows up in a search, drawn in the club editor's preview
// column as the keeper types: the site's line with the page's address, the
// title and the description. Both are made by domain/clubs/pageMeta.ts, the
// one rule the club page the server writes uses too, so the preview is the
// page's own words. A screen reader reads it as a title and a description.
// It is a drawing of the club's own words: it makes no request.
import { SITE_HOST, SITE_NAME, clubPageDescription, clubPageTitle } from '@domain/clubs/pageMeta'

export function SearchPreview({
  name, city, about, statement, address,
}: {
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
      <h3 id="preview-search-title" className="text-sm font-semibold text-ink">How your page shows up in a search</h3>
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
