// domain/format/searchText.ts
// How the site's search compares words: one normaliser for a query and for
// the text it is matched against, and the match itself. The search endpoint
// (functions/utils/search.ts) applies both to what the database holds, and
// the site's matching of its own pages takes the same two (WS02 step 11),
// so a query finds the same things on the server and in the page. Pure code
// shared by the site (`@domain/format/searchText`), the server functions and
// the workers (relative imports). No database, DOM, Workers types or React.

/** The fewest letters or numbers a search holds once normalised, counted as characters. */
export const SEARCH_QUERY_MIN = 2

/** The most letters or numbers a search holds once normalised, counted as characters. */
export const SEARCH_QUERY_MAX = 64

/** What "Saint" and "St." both read as once normalised. */
const SAINT = 'st'

/**
 * Text as search compares it, in this order: small letters; the marks taken
 * off the letters ("Café" is "cafe"); "&" read as "and"; every run of what is
 * not a letter or a digit read as one space, so punctuation, dashes,
 * apostrophes and symbols part words; the whole word "saint" read as "st"
 * ("Saint Martin" and "St. Martin" are both "st martin", while "Saints" and
 * "Sainte" stay as they are); and one space between words, none at the ends.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((word) => word !== '')
    .map((word) => (word === 'saint' ? SAINT : word))
    .join(' ')
}

/**
 * Whether a search finds a text, both already normalised: every word of the
 * query starts a word of the text, in any order, so "morph" finds "paul
 * morphy open" and "orphy" does not. The one word "st", which is what
 * "Saint" and "St." read as, finds only the whole word "st", so a search for
 * Saint finds St. Tammany and never State, Street or Stanley. A query with
 * no words finds nothing.
 */
export function matchesSearch(text: string, query: string): boolean {
  const asked = query.split(' ').filter((word) => word !== '')
  if (asked.length === 0) return false
  const words = text.split(' ').filter((word) => word !== '')
  return asked.every((start) => words.some((word) => (start === SAINT ? word === SAINT : word.startsWith(start))))
}
