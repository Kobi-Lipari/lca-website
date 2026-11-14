// src/areas/clubs/components/SharePreview.tsx
//
// What a shared link to a club's page shows, drawn in the club editor's
// preview column: the club's logo, else its initials in white on navy (a
// photo joins with the club's photos, in a later step), then the site, the
// page's title and its description, the same words the search preview uses.
// A screen reader reads the picture as what it shows. The logo is drawn only
// from the club's own stored path on this site (ownLogo), never from an
// address someone typed, so the preview makes no request to any other site.
import { SITE_HOST, clubPageDescription, clubPageTitle } from '@domain/clubs/pageMeta'
import { clubInitials, ownLogo } from '@/areas/clubs/previews'

export function SharePreview({
  name, city, about, statement, logo,
}: {
  name: string
  city: string
  about: string
  statement: string
  /** The club's stored logo, as the club's answer gives it. */
  logo: string | null | undefined
}) {
  const own = ownLogo(logo)
  const initials = clubInitials(name)
  const description = clubPageDescription(about, statement)
  return (
    <section aria-labelledby="preview-share-title" className="space-y-2">
      <h3 id="preview-share-title" className="text-sm font-semibold text-ink">When someone shares your page</h3>
      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        {own ? (
          <img src={own} alt="The club's logo" className="h-36 w-full bg-card object-contain p-4" />
        ) : (
          <div role="img" aria-label={`The initials ${initials} in white on navy`} className="flex h-36 items-center justify-center bg-brand-navy">
            <span aria-hidden="true" className="text-4xl font-bold tracking-wide text-white">{initials}</span>
          </div>
        )}
        <dl className="space-y-1 border-t border-hairline p-3">
          <dt className="sr-only">Site</dt>
          <dd className="text-xs text-muted-foreground">{SITE_HOST}</dd>
          <dt className="sr-only">Title</dt>
          <dd className="break-words text-sm font-medium text-ink">{clubPageTitle(name, city)}</dd>
          <dt className="sr-only">Description</dt>
          <dd className="line-clamp-2 break-words text-sm text-muted-foreground">{description || 'No description yet.'}</dd>
        </dl>
      </div>
    </section>
  )
}
