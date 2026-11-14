// domain/clubs/pageMeta.ts
//
// A club page's title and description, as a search result and a shared link
// show them: the title "{Club} · Chess club in {city}, Louisiana · Louisiana
// Chess Association", and the description, About's opening and then the
// meeting statement, as plain text of at most 155 characters, cut at the end
// of a word and never in the middle of one. Where About is long, About is cut
// and the statement kept whole, so a search result still says when the club
// meets, but only while the statement leaves ABOUT_ROOM_MIN (60) or more
// characters for About; with a longer statement the whole text is cut at the
// limit, and the statement may not show in full. The editor's Help says so.
//
// The club editor's search preview draws them as the keeper types, and the
// club page the server writes later uses the same two functions, so the
// preview is the page's own words. Pure code: it imports nothing, so the
// site, the server and the tests all read the one rule.

/** The association's name, which ends every club page's title. */
export const SITE_NAME = 'Louisiana Chess Association'

/** The site's address, as a search result prints it before the page's path. */
export const SITE_HOST = 'louisianachess.org'

/** The longest description, in characters, the cut's mark included. */
export const PAGE_DESCRIPTION_MAX = 155

/** The mark a cut description ends with. */
const CUT_MARK = '…'

/**
 * Text as plain words on one line: a comment and anything shaped like a tag
 * (a less-than sign, a letter, and on to the next greater-than sign) taken
 * out, and every run of spaces, tabs and line breaks made one space. Signs a
 * keeper types as words, "rated <1200" or "over > 18", are kept, so a page's
 * description never loses the words between them.
 */
export function plainText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[a-z][^<>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The page's title: the club's name, the line the site writes under it, and the association's name. */
export function clubPageTitle(name: string | null | undefined, city: string | null | undefined): string {
  const town = plainText(city)
  const line = town ? `Chess club in ${town}, Louisiana` : 'Chess club in Louisiana'
  return [plainText(name), line, SITE_NAME].filter(Boolean).join(' · ')
}

/** The fewest characters of About a description keeps before the meeting statement, when About must be cut to make room for it. */
export const ABOUT_ROOM_MIN = 60

/** Text cut at the last space at or before `room`, its trailing punctuation taken off; empty when no word fits whole. */
function cutAtWord(text: string, room: number): string {
  const space = text.lastIndexOf(' ', room)
  if (space <= 0) return ''
  return text.slice(0, space).replace(/[\s,;:.!?·]+$/, '')
}

/**
 * The page's description: About's opening, then the meeting statement, as
 * plain text of at most PAGE_DESCRIPTION_MAX characters. About gets a full
 * stop when it ends without one, so the two read as two sentences.
 *
 * When the two do not fit together, the statement is kept whole and About is
 * cut to make room for it: About's opening, cut at the end of a word, then
 * the cut's mark, a space and the statement. That holds while the statement
 * leaves at least ABOUT_ROOM_MIN characters for About. With a longer
 * statement, or none, the whole text is cut at the last space that leaves
 * room for the mark, and the mark added. A cut never falls in the middle of
 * a word, and takes off a comma or a stop before the mark; where no word of
 * About fits whole the whole text is cut instead, and a text whose first
 * word alone is longer than the limit gives no description, rather than half
 * a word.
 */
export function clubPageDescription(about: string | null | undefined, statement: string | null | undefined): string {
  const opening = plainText(about)
  const meets = plainText(statement)
  const first = opening && meets && !/[.!?…]$/.test(opening) ? `${opening}.` : opening
  const whole = [first, meets].filter(Boolean).join(' ')
  if (whole.length <= PAGE_DESCRIPTION_MAX) return whole
  // Room for About beside the whole statement: the limit, less the mark, the space and the statement.
  const room = PAGE_DESCRIPTION_MAX - CUT_MARK.length - 1 - meets.length
  if (opening && meets && room >= ABOUT_ROOM_MIN) {
    const kept = cutAtWord(opening, room)
    if (kept) return `${kept}${CUT_MARK} ${meets}`
  }
  const kept = cutAtWord(whole, PAGE_DESCRIPTION_MAX - CUT_MARK.length)
  return kept ? `${kept}${CUT_MARK}` : ''
}
