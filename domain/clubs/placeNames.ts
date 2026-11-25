// domain/clubs/placeNames.ts
//
// How the place a person types into Suggest a club or Start a club (WS09 step
// 30) is read: a ZIP code, or the name of a town. Written once for the two
// that need it, the script that makes the place file
// (scripts/data/build-la-places.ts), which stores each town's name in the
// form placeKey gives, and the server's lookup (functions/utils/clubs/places.ts),
// which reads what was typed the same way, so the two can never part.
//
// A town's name is matched without regard to case, spaces at the ends or
// between words, full stops and the two spellings of Saint ("St. Gabriel",
// "st gabriel" and "Saint Gabriel" are one name). A ZIP code is five digits,
// with or without the four after a hyphen. A state named after the town
// (", LA" or ", Louisiana") is let go, and a ZIP code after a town's name is
// read as the ZIP code.
//
// Plain code with no import.

/** A town's name in the one form the place file stores it in. */
export function placeKey(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’]/g, '\'')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bsaint\b/g, 'st')
}

/** What a person typed, read as a ZIP code or a town's name; null when it holds neither. */
export type TypedPlace = { zip: string } | { town: string }

/** A ZIP code at the end of what was typed, with or without its last four digits. */
const ZIP_AT_END = /(?:^|[\s,])(\d{5})(?:-\d{4})?$/

/** The state, when it is written after the town's name. */
const STATE_AT_END = /[\s,]+(?:la|louisiana)$/i

/** Reads the place a person typed: the ZIP code when there is one at its end, and the town's name otherwise. */
export function readTypedPlace(text: string): TypedPlace | null {
  const typed = text.trim()
  const zip = ZIP_AT_END.exec(typed)
  if (zip) return { zip: zip[1] }
  const town = placeKey(typed.replace(STATE_AT_END, ''))
  return town === '' ? null : { town }
}
