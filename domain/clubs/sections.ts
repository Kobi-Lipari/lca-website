// domain/clubs/sections.ts
//
// Which sections a club page has, in the order its section nav lists them:
// About, When and where, Events, News, Photos and Contact. A section is
// named only when something is behind it, so the page never draws an empty
// block, a bracket or "not listed" (criterion 6 of the brief's WS09 list).
//
// The bare rule: a club with only the five basics (one sentence about the
// club, how it meets in words, a place, a contact name and a contact email
// that stays private) has About, When and where and Contact, and nothing
// else. Contact is always named, since the Contact form always has someone
// to reach: the club's own email, else the region's representative, else
// the LCA admins while the seat is open. Photos is named once a club has a
// photo; no table holds photos yet, so today it is never named.
//
// Pure code: it imports nothing, so the server's answer and the tests read
// the one rule.

/** A section of a club page, as the answer names it. */
export type ClubPageSection = 'about' | 'when_and_where' | 'events' | 'news' | 'photos' | 'contact'

/** Every section, in the section nav's order. */
export const CLUB_PAGE_SECTIONS: readonly ClubPageSection[] = ['about', 'when_and_where', 'events', 'news', 'photos', 'contact']

/** What decides the sections: the club's own words and ticks, and how many of each list it has. */
export interface ClubPageContent {
  aboutText: string | null
  costText: string | null
  welcomeText: string | null
  /** The club's links (Facebook, its website, another), each as stored. */
  links: ReadonlyArray<string | null>
  weekendPlay: boolean
  scholasticFriendly: boolean
  /** How the club meets, in its own words. */
  statement: string | null
  places: number
  events: number
  news: number
  photos: number
}

/** True for text with something in it once its spaces are taken off. */
export const filled = (text: string | null | undefined): boolean => typeof text === 'string' && text.trim() !== ''

/** The sections a club page has, in the nav's order. */
export function clubPageSections(content: ClubPageContent): ClubPageSection[] {
  const has: Record<ClubPageSection, boolean> = {
    about:
      filled(content.aboutText) || filled(content.costText) || filled(content.welcomeText)
      || content.links.some(filled) || content.weekendPlay || content.scholasticFriendly,
    when_and_where: filled(content.statement) || content.places > 0,
    events: content.events > 0,
    news: content.news > 0,
    photos: content.photos > 0,
    contact: true,
  }
  return CLUB_PAGE_SECTIONS.filter((section) => has[section])
}
