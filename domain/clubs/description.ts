// domain/clubs/description.ts
//
// A club's description in one wording for its two readers: the page the
// server writes before any script (functions/utils/clubs/pageHtml.ts) and
// the directory's list, which gives it for a club with no meeting statement
// (functions/utils/clubs/directory.ts, WS09 step 32). It is About's opening
// and the statement, by the rule of ./pageMeta.ts, at most 155 characters;
// for a club that has written neither, the line the club page writes under
// its name (cityLine in ./pageWords.ts), cut by the same rule.
//
// A file of its own, so the two files of words the site's pages read keep
// the imports they had and the site's bundle is not changed by it. Plain
// code with no zod.
import { clubPageDescription } from './pageMeta'
import { cityLine } from './pageWords'

/** The club's description: its own words, or the line under its name. */
export function clubDescription(
  about: string | null | undefined,
  statement: string | null | undefined,
  city: string | null | undefined,
  region: string | null | undefined,
): string {
  return clubPageDescription(about, statement) || clubPageDescription(cityLine(city, region), null)
}
