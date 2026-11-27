// domain/clubs/facebook.ts
//
// Whether a web address a club gave is Facebook's own, so a club page puts
// the word "Facebook" on a link only when the link goes there (checkpoint
// W's review). The club editor's Facebook field takes any web address, so a
// keeper may put another site's address in it; that link is still drawn,
// and the page names it by its site, as the club's other links are named.
// The new club page the site draws (src/areas/clubs/components/ClubAbout.tsx)
// and the page the server writes before any script
// (functions/utils/clubs/pageHtml.ts) both ask here.
//
// Pure code: it imports nothing, so the site's bundle and the server read
// the one rule.

/** The hosts that are Facebook's own, each with any host under it. */
const FACEBOOK_HOSTS = ['facebook.com', 'fb.com']

/** Facebook's short-link host, taken alone. */
const FACEBOOK_SHORT_HOST = 'fb.me'

/**
 * True when the address's host, read from the parsed address, is
 * facebook.com, fb.com or fb.me, or a host under facebook.com or fb.com
 * (www.facebook.com, m.facebook.com). The text is never searched for the
 * word, so "https://facebook.com.example.net/" and
 * "https://example.net/facebook.com" are not Facebook's, and neither is
 * "https://facebook.com@example.net/", whose host is example.net. Anything
 * that is not a web address is not Facebook's either.
 */
export function isFacebookAddress(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || url.trim() === '') return false
  let host: string
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    host = parsed.hostname.toLowerCase()
  } catch {
    return false
  }
  if (host === FACEBOOK_SHORT_HOST) return true
  return FACEBOOK_HOSTS.some((own) => host === own || host.endsWith(`.${own}`))
}
