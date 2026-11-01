// src/components/layout/footerParts.ts
//
// What the new footer (src/components/layout/SiteFooter.tsx, WS02 step 8)
// reads that is not a component. It is a file of its own, as
// headerParts.ts is the bars', since the lint rule for fast refresh wants a
// file that exports a component to export components alone.
//
// - The site's build date, for the trust line's "Site last updated": the
//   instant the build ran, which the prepaint plugin in vite.config.ts
//   writes into the built index.html as <meta name="build-date"> when the
//   chrome is on, read here when the footer is drawn and shown as its
//   Louisiana day, with its weekday and year, as every date the site shows
//   is written (formatDate). A page without the meta, as with the chrome
//   off or in a unit test, or with a meta that holds no instant in the
//   plugin's own form, has no date, so the trust line leaves the item out
//   rather than show an empty or a wrong one.
import { formatDate } from '@/lib/format'

/**
 * An instant as the plugin writes it, Date's toISOString in UTC. Date.parse
 * reads looser forms too, a date with no zone among them, which formatDate
 * would read as Louisiana wall-clock time, so only this one is trusted.
 */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** The build's date: the instant, for a time element's dateTime, and its words. */
export interface BuildDate {
  readonly instant: string
  /** The Louisiana day of the instant, with its weekday and year, as in Sat, Oct 31, 2026. */
  readonly text: string
}

/** The build's date from the page's build-date meta, or null when the page has none that holds an instant. */
export function lastUpdated(): BuildDate | null {
  if (typeof document === 'undefined') return null
  const content = document.querySelector('meta[name="build-date"]')?.getAttribute('content') ?? ''
  if (!INSTANT.test(content) || Number.isNaN(Date.parse(content))) return null
  return { instant: content, text: formatDate(content, { year: true }) }
}
