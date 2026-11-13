// domain/clubs/slug.ts
//
// A club's slug: the part of its address after /clubs/. It is made from the
// club's name by the rule a new club's id has always been made by
// (functions/api/admin/clubs.ts), once, at the club's first save, and kept
// when the club is renamed, so an address someone has shared keeps working.
// A slug is never one of the words the club pages use for their own
// addresses (RESERVED_SLUGS), and never one another club holds as its id,
// its slug or an old slug: uniqueSlug adds a short suffix until it is free.
//
// Pure code: it imports nothing, so the site, the server and the tests can
// all read the one rule.

/** The longest slug: the length a club's id has always been cut to. */
export const SLUG_MAX_LENGTH = 48

/** The slug of a name that has no letter or digit in it. */
export const FALLBACK_SLUG = 'club'

/**
 * The words that name the club pages' own addresses (/clubs/suggest and the
 * like), which no club may take as its slug.
 */
export const RESERVED_SLUGS: readonly string[] = ['suggest', 'reports', 'confirm', 'reply', 'page', 'contact', 'logo']

/** True for a word the club pages keep for their own addresses. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug)
}

/**
 * The slug a name gives: lower case, every run of characters that is not a
 * letter or a digit turned into one hyphen, no hyphen at either end, at most
 * 48 characters, and "club" for a name with no letter or digit at all. It is
 * the rule a new club's id has always been made by, but that a hyphen the
 * cut at 48 characters leaves at the end is dropped, where the old rule kept
 * it: the two differ only for a name whose 48th character is a separator.
 */
export function slugFor(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
  return slug || FALLBACK_SLUG
}

/**
 * The base itself when no club holds it and it is not reserved, or else the
 * base with the first of -2, -3 and so on that is free. The base is cut so
 * that the slug with its suffix stays within 48 characters, and a hyphen the
 * cut leaves at its end is dropped. `taken` holds every club's id, every slug
 * and every old slug.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const held = new Set(taken)
  const free = (slug: string) => !held.has(slug) && !isReservedSlug(slug)
  if (free(base)) return base
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const slug = `${base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`
    if (free(slug)) return slug
  }
}

/**
 * The slug a club keeps at a save: the one it already has, whatever its name
 * now says, or, at its first save, a free slug made from its name.
 */
export function slugAtSave(current: string | null | undefined, name: string, taken: Iterable<string>): string {
  if (current) return current
  return uniqueSlug(slugFor(name), taken)
}
