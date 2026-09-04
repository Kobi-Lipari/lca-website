// functions/utils/site.ts
//
// One answer to "what is this site's address?".
//
// It was previously spelled out in six places, three of which still said
// lca-website.pages.dev — so ticket links, tournament reminders and the
// email logo all pointed at the old deployment domain after the move to
// louisianachess.org.

/**
 * Where the site lives when nothing says otherwise.
 *
 * The www form is canonical: a Cloudflare rule redirects the apex to it, so
 * the apex never serves a page. A default pointing at the apex still worked,
 * but only by way of that redirect.
 */
export const DEFAULT_SITE_URL = 'https://www.louisianachess.org'

/** Every binding shape that carries a site URL. Kept structural so the cron
 *  Worker, whose Env is its own, can call in without importing Pages types. */
export interface SiteEnv {
  SITE_URL?: string
}

/**
 * The origin to put in links that leave the site — emails, mostly.
 *
 * Configuration wins over the incoming request on purpose. A member opening
 * a ticket notification should land on the canonical site whichever host the
 * admin happened to be signed in to; deriving from the request would mail out
 * whatever preview or deployment URL generated it. The request is only a
 * fallback, which is what keeps links working on localhost with no config.
 *
 * Never returns a trailing slash, so callers can append a path directly.
 */
export function resolveSiteUrl(env: SiteEnv, request?: Request): string {
  const configured = env.SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (request) return new URL(request.url).origin
  return DEFAULT_SITE_URL
}

/** The logo used by the branded email templates. Must be absolute: it is
 *  loaded by a mail client that has no notion of the site's base URL. */
export function emailLogoUrl(env: SiteEnv, request?: Request): string {
  return `${resolveSiteUrl(env, request)}/lca-logo.jpg`
}
