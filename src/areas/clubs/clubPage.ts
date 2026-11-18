// src/areas/clubs/clubPage.ts
//
// The plain code of the new club page (src/areas/clubs/components/ClubPage.tsx
// and its parts, WS09 steps 21 and 22): which of the answer's sections the
// page draws, the line the site writes under the club's name, whether the
// club's words in About are one sentence, which links it may draw, the
// address the page goes by and the one it gives to Share and Copy link, and
// whether the person reading is one of the club's keepers. The page draws
// what GET /api/clubs/:address/page answers and builds none of the server's
// words: the told line is drawn as given. A component
// file exports only components, so these live here.
import type { ClubPageResponse } from '@domain/contracts'

/** A control of the page: 44 pixels tall at least, with the look's focus ring. */
export const CONTROL = 'inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-focus'

/** A link in the page's words: 44 pixels tall at least, underlined, with the look's focus ring. */
export const WORD_LINK = 'inline-flex min-h-11 items-center gap-1 rounded-sm font-semibold text-ink underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus'

/**
 * The room a section, or a control the keyboard brings into view, keeps
 * above it for the sticky section nav (SectionNav.tsx, 53 pixels) and,
 * where the site's header writes no height of its own, for today's sticky
 * header too: the new look's page already keeps --header-h at its top when
 * the new header writes it, so the header's part counts only where it does
 * not. A focused control is never left under either bar (WCAG 2.4.11).
 */
export const CLEAR_OF_BARS = 'scroll-mt-[calc(3.5rem_+_var(--header-h,4.0625rem)_-_var(--header-h,0px))]'

/** The same room for every control and section inside the page. */
export const CONTROLS_CLEAR_OF_BARS = '[&_:is(a,button,[tabindex],section)]:scroll-mt-[calc(3.5rem_+_var(--header-h,4.0625rem)_-_var(--header-h,0px))]'

/** The sections the page draws, in the nav's order. Contact and Photos come with later steps. */
export const DRAWN_SECTIONS = ['about', 'when_and_where', 'events', 'news'] as const
export type DrawnSection = (typeof DRAWN_SECTIONS)[number]

/** Each drawn section's name in the section nav. */
export const SECTION_LABELS: Record<DrawnSection, string> = { about: 'About', when_and_where: 'When and where', events: 'Events', news: 'News' }

/** Each drawn section's id on the page, so /clubs/example-chess-club#when-and-where can be shared. */
export const SECTION_IDS: Record<DrawnSection, string> = { about: 'about', when_and_where: 'when-and-where', events: 'events', news: 'news' }

/** How many of the answer's events and news rows there are; none where it is not said, as in the editor's preview. */
export interface SectionRows {
  events?: number
  news?: number
}

/**
 * The sections of an answer the page draws, in the nav's order: only those
 * the answer names and the page builds, and Events and News only with a row
 * to draw, so neither is ever an empty block or a link to nothing.
 */
export function drawnSections(sections: readonly string[], rows: SectionRows = {}): DrawnSection[] {
  return DRAWN_SECTIONS.filter((section) => {
    if (!sections.includes(section)) return false
    if (section === 'events') return (rows.events ?? 0) > 0
    if (section === 'news') return (rows.news ?? 0) > 0
    return true
  })
}

/**
 * The one line the site writes under the club's name: "Chess club in
 * {city}, Louisiana · {region}". Its words live in domain/clubs/pageWords.ts,
 * which the page the server writes before any script reads too.
 */
export { cityLine } from '@domain/clubs/pageWords'

/**
 * A club's initials, for its tile on the page's cover and the card a shared
 * link shows when the club has no logo: the first letter of each of the
 * first two words of its name, or the first two letters of a name of one
 * word, in capitals (Example Chess Club gives EC, as the board draws a
 * club's two letters). src/areas/clubs/previews.ts gives it to the editor's
 * previews.
 */
export function clubInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? [...words[0]].slice(0, 2).join('') : words.slice(0, 2).map((w) => [...w][0]).join('')
  return letters.toUpperCase()
}

/** Text with something in it once its spaces are taken off. */
export const hasWords = (text: string | null | undefined): text is string => typeof text === 'string' && text.trim() !== ''

/**
 * The short words a full stop follows inside a sentence, as a club writes
 * them: St. Example's hall, Dr. One, Example Ave., 7:00 p.m. Each must
 * stand as a word of its own, so "the 3rd." still ends a sentence.
 */
const SHORT_WORD = /(?:^|[^\p{L}\p{N}.])(?:St|Dr|Mr|Mrs|Ms|Mt|Ave|Blvd|Rd|[aApP]\.[mM])$/u

/**
 * True for words that are one sentence on one line: no line break, and no
 * full stop, question mark or exclamation mark followed by more words. A
 * full stop after a short word (St., Dr., Ave., p.m. and the like) or
 * followed by a word in lower case does not end the sentence, so "We meet
 * at St. Example's hall on Tuesdays." is one. Such words are set large
 * across About; anything longer is set as paragraphs.
 */
export function oneSentence(text: string): boolean {
  const words = text.trim()
  if (words === '' || /\n/.test(words)) return false
  for (const end of words.matchAll(/([.!?])["'”)\]]?\s+(\S)/gu)) {
    // A stop straight after a short word, with no closing quote between, is the short word's.
    if (end[1] === '.' && (/\p{Ll}/u.test(end[2]) || (/^\.\s/.test(end[0]) && SHORT_WORD.test(words.slice(0, end.index))))) continue
    return false
  }
  return true
}

/** The club's words as paragraphs, split at blank lines (a single line break stays inside its paragraph). */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
}

/**
 * A link the club gave, drawn only when it is a web address with a host and
 * no name or password before an "@", as the keeper's save holds it; anything
 * else is not drawn.
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

/** A web address's site, without its www., as a link's words name it. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** The address the page goes by, with the query and the hash it was opened with. */
export function pageAddress(slug: string, search: string, hash: string): string {
  return `/clubs/${encodeURIComponent(slug)}${search}${hash}`
}

/** The page's own address in full, as Share and Copy link give it and the foot line shows it: the slug on this site, with no query and no hash. */
export function pageLink(origin: string, slug: string): string {
  return `${origin}/clubs/${encodeURIComponent(slug)}`
}

/** Copies an address to the clipboard and gives back what happened, in the words the page's status says. */
export async function copyLink(address: string): Promise<string> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
    await navigator.clipboard.writeText(address)
    return 'Link copied.'
  } catch {
    return `The link could not be copied. The page's address is ${address}`
  }
}

/** What the page's one status says, and which control spoke last: the cover's Share or the foot line's Copy link. */
export interface Said {
  words: string
  from: 'cover' | 'foot'
}

/**
 * A keeper of the club, as the page's keeper line names one: the club's own
 * rep, or the representative whose region covers it. Each comes with where
 * Edit leads: Your club's page, or the club's page in My region.
 */
export type Keeper =
  | { kind: 'rep'; edit: string }
  | { kind: 'region'; region: string | null; edit: string }

/** What the signed-in session already knows, as AuthContext holds it. */
export interface KeeperAuth {
  role: string
  member: { club_id: string | null } | null
  managedClubs: ReadonlyArray<{ id: string; region: string | null }>
}

/**
 * Whether the person reading keeps this club, from what the session already
 * holds and nothing more: the club's rep is a club_rep whose club is this
 * one, as Your club's page reads it; a region's representative is one whose
 * seat's clubs include it. A person who is both reads as the club's rep, as
 * Your club's page treats them. Anyone else, an LCA admin among them, and a
 * visitor who is not signed in, is no keeper here. The two pages Edit leads
 * to exist only with clubKeepers on, so the caller asks only then.
 */
export function keeperFor(club: Pick<ClubPageResponse['club'], 'id' | 'slug' | 'region'>, auth: KeeperAuth): Keeper | null {
  if (!auth.member) return null
  if (auth.role === 'club_rep' && auth.member.club_id === club.id) {
    return { kind: 'rep', edit: `/my/club/${encodeURIComponent(club.slug)}` }
  }
  const managed = auth.managedClubs.find((c) => c.id === club.id)
  if (managed) {
    return { kind: 'region', region: managed.region ?? club.region, edit: `/workspace/region/clubs/${encodeURIComponent(club.id)}` }
  }
  return null
}

/** The keeper line's words before Edit. */
export function keeperWords(keeper: Keeper): string {
  if (keeper.kind === 'rep') return 'This is your club\'s page'
  return keeper.region ? `You can edit this page as the ${keeper.region} representative` : 'You can edit this page as the region\'s representative'
}
