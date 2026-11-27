// functions/utils/clubs/pageHtml.ts
//
// The club page the server writes before any script (WS09 step 23): what a
// search engine, a shared link and a reader that runs no script read at
// /clubs/:slug. It turns the page's one answer (clubPageAnswer in
// functions/utils/clubs/pageAnswer.ts, the same answer the app draws) into
// strings: the head's title and description, the JSON-LD block, and the body
// written inside the shell's root element, which the app replaces when it
// draws, so nobody meets the page twice.
//
// The body is plain HTML with no script: the club's name as the h1, the line
// under it, how it meets in its own words, About, its places and its events
// with their dates, each only where the answer has something to put under
// it. Its wrapper carries one small style element of fixed text (checkpoint
// W), so a reader before the app draws, or with no script at all, meets a
// plain page rather than one dense block; the styling names the wrapper
// alone and goes with it when the app draws. It sets no colour and no type,
// so the page keeps the site's own. Contact comes last (WS09 step 26): its
// heading and one line saying a message can be sent to the club through the
// site, with no form, no name of a volunteer and no address. The body writes
// no email address, no officer and no roster: the answer carries none.
// Every word a club or a keeper typed is escaped for where it lands, and
// none enters the style element: for HTML text
// and attributes in the body, and in the JSON-LD block every "<", ">", "&"
// and line separator is written as a JSON escape, so no value can end the
// block or start a tag. The words the app's page also writes come from
// domain/clubs/pageWords.ts, and the title and description from
// domain/clubs/pageMeta.ts. The three sections before Contact carry the ids
// the app's page gives them (PAGE_SECTION_IDS there), so a shared section
// link names its section before any script, and how the club meets keeps the
// club's single line breaks as <br> (checkpoint W's review).
import { clubPageTitle, SITE_NAME } from '../../../domain/clubs/pageMeta'
import {
  ABOUT_LABELS, ABOUT_TICKS, CONTACT_HEADING, CONTACT_WRITTEN_LINE, EVENTS_HEADING, PAGE_SECTION_IDS, aboutHeading, cityLine, eventDates, whenAndWhereHeading,
} from '../../../domain/clubs/pageWords'
import { clubDescription } from '../../../domain/clubs/description'
import { isFacebookAddress } from '../../../domain/clubs/facebook'
import type { ClubPageResponse } from '../../../domain/contracts/clubPage'

/** Text made safe for HTML text and for a quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Text with something in it once its spaces are taken off. */
const hasWords = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim() !== ''

/**
 * A link the club gave, written only when it is a web address with a host
 * and no name or password before an "@": the rule of webLink in
 * src/areas/clubs/clubPage.ts, which the site's page draws by. The two are
 * held equal by test/unit/club-page-html.test.tsx.
 */
export function webLink(url: string | null | undefined): string | null {
  if (!hasWords(url)) return null
  const trimmed = url.trim()
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) return null
  try {
    const parsed = new URL(trimmed)
    return parsed.username === '' && parsed.password === '' ? trimmed : null
  } catch {
    return null
  }
}

/** A web address's site, without its www., as a link's words name it (siteOf in src/areas/clubs/clubPage.ts). */
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The club's links the page draws, with the words the site's About gives
 * each: the Facebook field's link is called Facebook only when it goes to
 * Facebook's own site (domain/clubs/facebook.ts), and is otherwise named by
 * its site, as the other two are.
 */
export function clubLinks(about: ClubPageResponse['about']): Array<{ href: string; words: string }> {
  const links: Array<{ href: string; words: string }> = []
  const facebook = webLink(about.facebook)
  if (facebook) links.push({ href: facebook, words: isFacebookAddress(facebook) ? 'Facebook' : siteOf(facebook) })
  const website = webLink(about.website)
  if (website) links.push({ href: website, words: `Website: ${siteOf(website)}` })
  const other = webLink(about.other)
  if (other) links.push({ href: other, words: siteOf(other) })
  return links
}

/** The page's own address on this site: the club's slug, encoded. */
export function clubPagePath(slug: string): string {
  return `/clubs/${encodeURIComponent(slug)}`
}

/** The page's title, for the head's title element. */
export function pageTitle(answer: ClubPageResponse): string {
  return clubPageTitle(answer.club.name, answer.club.city)
}

/**
 * The page's description: About's opening and the meeting statement, by the
 * rule of domain/clubs/pageMeta.ts, at most 155 characters; for a club that
 * has written neither, the line under its name, cut by the same rule.
 */
export function pageDescription(answer: ClubPageResponse): string {
  return clubDescription(answer.about.text, answer.statement.text, answer.club.city, answer.club.region)
}

/** A value written into a JSON-LD block: JSON with every "<", ">", "&" and line separator escaped. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/**
 * The JSON-LD block of type SportsClub: the club's name, its sport, the
 * description, the page's address, its address and point from the first of
 * its places that has each, the association it is a member of, its links
 * where the page draws them, and an Event for each event the answer
 * carries. No image: a club has no photo until WS09 step 36.
 */
export function clubJsonLd(answer: ClubPageResponse, site: string): string {
  const { club } = answer
  const street = answer.places.find((p) => hasWords(p.street))?.street?.trim()
  const point = answer.places.find((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
  const links = clubLinks(answer.about).map((link) => link.href)
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsClub',
    name: club.name,
    sport: 'Chess',
    description: pageDescription(answer),
    url: `${site}${clubPagePath(club.slug)}`,
    address: {
      '@type': 'PostalAddress',
      ...(street ? { streetAddress: street } : {}),
      ...(hasWords(club.city) ? { addressLocality: club.city.trim() } : {}),
      addressRegion: 'LA',
      addressCountry: 'US',
    },
    ...(point ? { geo: { '@type': 'GeoCoordinates', latitude: point.latitude, longitude: point.longitude } } : {}),
    memberOf: { '@type': 'SportsOrganization', name: SITE_NAME, url: site },
    ...(links.length > 0 ? { sameAs: links } : {}),
    ...(answer.events.length > 0
      ? {
          event: answer.events.map((event) => ({
            '@type': 'Event',
            name: event.name,
            startDate: event.date,
            ...(event.end_date ? { endDate: event.end_date } : {}),
            url: `${site}/tournaments/${encodeURIComponent(event.id)}`,
          })),
        }
      : {}),
  }
  return `<script type="application/ld+json">${jsonForScript(data)}</script>`
}

/** The club's words as paragraphs, split at blank lines, each escaped. */
function paragraphsOf(words: string): string[] {
  return words.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`)
}

/**
 * How the club meets, as paragraphs split at blank lines, with each single
 * line break written as a <br> between the paragraph's escaped lines, so the
 * words keep the lines the club gave them, as the page the site draws keeps
 * them under the name and in When and where.
 */
function statementOf(words: string): string[] {
  return words.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
    .map((part) => `<p>${part.split(/\r?\n/).map((line) => escapeHtml(line.trim())).join('<br>')}</p>`)
}

/** About: the club's words, then Cost, Who is welcome and Find us online, each only when the club filled it in. */
function aboutHtml(answer: ClubPageResponse): string[] {
  const { about } = answer
  const parts = hasWords(about.text) ? paragraphsOf(about.text) : []
  if (hasWords(about.cost)) parts.push(`<h3>${ABOUT_LABELS.cost}</h3>`, ...paragraphsOf(about.cost))
  const ticks: string[] = []
  if (about.weekend_play) ticks.push(ABOUT_TICKS.weekendPlay)
  if (about.scholastic_friendly) ticks.push(ABOUT_TICKS.scholasticFriendly)
  if (hasWords(about.welcome) || ticks.length > 0) {
    parts.push(`<h3>${ABOUT_LABELS.welcome}</h3>`)
    if (hasWords(about.welcome)) parts.push(...paragraphsOf(about.welcome))
    if (ticks.length > 0) parts.push(`<ul>${ticks.map((tick) => `<li>${tick}</li>`).join('')}</ul>`)
  }
  const links = clubLinks(about)
  if (links.length > 0) {
    const items = links.map((link) => `<li><a href="${escapeHtml(link.href)}" rel="noopener noreferrer">${escapeHtml(link.words)}</a></li>`)
    parts.push(`<h3>${ABOUT_LABELS.online}</h3>`, `<ul>${items.join('')}</ul>`)
  }
  if (parts.length === 0) return []
  return [`<section id="${PAGE_SECTION_IDS.about}"><h2>${escapeHtml(aboutHeading(answer.club.name))}</h2>${parts.join('')}</section>`]
}

/** When and where: the club's places, each with its street and its note where it has them. */
function placesHtml(answer: ClubPageResponse): string[] {
  if (answer.places.length === 0) return []
  const rows = answer.places.map((place) => {
    const lines = [`<p>${escapeHtml(place.name)}</p>`]
    if (hasWords(place.street)) lines.push(`<p>${escapeHtml(place.street.trim())}</p>`)
    if (hasWords(place.note)) lines.push(...paragraphsOf(place.note))
    return `<li>${lines.join('')}</li>`
  })
  return [`<section id="${PAGE_SECTION_IDS.when_and_where}"><h2>${escapeHtml(whenAndWhereHeading(answer.club.name))}</h2><ul>${rows.join('')}</ul></section>`]
}

/** Events: each of the club's events, its name a link to its page here and its dates with the weekday and year. */
function eventsHtml(answer: ClubPageResponse): string[] {
  if (answer.events.length === 0) return []
  const rows = answer.events.map((event) => {
    const link = `<a href="/tournaments/${escapeHtml(encodeURIComponent(event.id))}">${escapeHtml(event.name)}</a>`
    return `<li><h3>${link}</h3><p>${escapeHtml(eventDates(event))}</p></li>`
  })
  return [`<section id="${PAGE_SECTION_IDS.events}"><h2>${EVENTS_HEADING}</h2><ul>${rows.join('')}</ul></section>`]
}

/** Contact: its heading and its one line, for every club, since every club can be written to through the site. */
function contactHtml(): string[] {
  return [`<section><h2>${CONTACT_HEADING}</h2><p>${CONTACT_WRITTEN_LINE}</p></section>`]
}

/** The attribute that marks the written body's wrapper: the styling below names it, and nothing the app draws uses it. */
export const WRITTEN_PAGE_MARK = 'data-club-written-page'

const WRAPPER = `main[${WRITTEN_PAGE_MARK}]`

/**
 * The written body's styling, fixed text with nothing of a club or a reader
 * in it: a measure of at most 42rem in the middle of the window with room
 * around it, the name as the largest heading and the section headings a
 * step above the text, air between paragraphs, lists and sections, bullets
 * back on the lists and an underline on links. Sizes are in rem, so a
 * reader's own text size is kept, and no height is set. No colour, no
 * ground and no type: those stay the site's own in the light and the dark.
 * Every rule starts at the wrapper, so it touches nothing of the app's page,
 * and it sits inside the root element the app empties when it draws.
 */
export const WRITTEN_PAGE_STYLE = [
  `${WRAPPER}{box-sizing:border-box;max-width:42rem;margin:0 auto;padding:2rem 1rem 3rem;overflow-wrap:anywhere}`,
  `${WRAPPER} h1{font-size:2rem;font-weight:700;line-height:1.2;margin:0 0 0.5rem}`,
  `${WRAPPER} h2{font-size:1.375rem;font-weight:700;line-height:1.3;margin:2.5rem 0 0.75rem}`,
  `${WRAPPER} h3{font-size:1.125rem;font-weight:700;line-height:1.4;margin:1.5rem 0 0.5rem}`,
  `${WRAPPER} p{margin:0 0 1rem}`,
  `${WRAPPER} ul{list-style:disc;margin:0 0 1rem;padding-left:1.5rem}`,
  `${WRAPPER} li{margin:0 0 1rem}`,
  `${WRAPPER} li h3{margin:0 0 0.25rem}`,
  `${WRAPPER} li p{margin:0 0 0.25rem}`,
  `${WRAPPER} a{text-decoration:underline}`,
].join('')

/**
 * The body written inside the shell's root element: the wrapper with its
 * styling, then the club's name as the h1, the line under it and how it
 * meets, then About, When and where and Events, each only where the answer
 * has something to put under it, and Contact, which every club has.
 */
export function clubPageBody(answer: ClubPageResponse): string {
  const { club } = answer
  const top = [`<h1>${escapeHtml(club.name)}</h1>`, `<p>${escapeHtml(cityLine(club.city, club.region))}</p>`]
  if (hasWords(answer.statement.text)) top.push(...statementOf(answer.statement.text))
  const words = [...top, ...aboutHtml(answer), ...placesHtml(answer), ...eventsHtml(answer), ...contactHtml()].join('')
  return `<main ${WRITTEN_PAGE_MARK}><style>${WRITTEN_PAGE_STYLE}</style>${words}</main>`
}
