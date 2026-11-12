// domain/mail/letter.ts
//
// The rules of an LCA newsletter letter, written once for the newsletter's
// own page and the server (WS16 part two, page step 1). Pure, with no
// import, so the page, the server functions and the daily-emails worker can
// all read it. Nothing imports it yet.
//
// - letterParts reads a cleaned letter's h2 headings, in order, as the
//   letter's parts: the "In this issue" list is made from them and is never
//   typed (P7). Each part has a name for its jump link.
// - withAnchors writes an empty named anchor just before each part's
//   heading, <a name="results"></a>, the form part one's build notes ask
//   for, since a target with only an id fails in Gmail and classic Outlook.
//   The anchors are added after the cleaner (functions/utils/mail/letterClean.ts),
//   by the email's layout at each send and in each preview, and are never
//   stored: the cleaner would take them out again, since an anchor with no
//   address is not one of a letter's tags. The list and the anchors are
//   made together from the same words, so a heading whose words change
//   breaks nothing.
// - STARTERS are LCA's ways to start a letter, as the approved board's
//   chooser names them. They hold headings only, never a sentence that
//   explains a control (K's decision 40); PART_PROMPTS are the board's own
//   words for a letter's empty parts.
// - defaultSubject and monthLabel give a new letter's subject and its month,
//   and LETTER_MAX_BYTES is the most a saved letter may hold once cleaned.

/**
 * The most a saved letter may hold: the UTF-8 bytes of its HTML once cleaned, the letter as it is stored and sent. It
 * leaves room, under the 102,000 bytes after which Gmail cuts an email and leaves the later parts unreachable, for the
 * layout round the letter and for what the layout adds to it, the anchors and the list of parts. The caller refuses a
 * longer letter in words, and checks the cleaned letter, not only what was sent to it, since cleaning can make a
 * letter longer: each tag left open gets its end tag, so a letter under the cap can clean to one over it. The caller
 * may also refuse an input past a bound of its own before cleaning, to bound the work. The cleaner cleans a letter of
 * any length.
 */
export const LETTER_MAX_BYTES = 80000

/** One part of a letter: a worded h2 heading. */
export interface LetterPart {
  /**
   * The heading's words as plain text: tags gone, the editor's character references read, every run of spaces one
   * space. Plain text, so whatever writes it into HTML escapes it there.
   */
  title: string
  /**
   * The name of the part's anchor: the words in lower case with letters and digits kept and every other run one hyphen,
   * accents dropped, always starting with a letter, and never the same as another part's.
   */
  name: string
}

/** A part's name, as letterParts makes it and withAnchors writes it: so a name can never carry markup into the email. */
const NAME_FORM = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** Each h2 heading of a letter, in order: where its start tag sits, and its words. */
function headings(html: string): { at: number; title: string }[] {
  const found: { at: number; title: string }[] = []
  // A heading runs to the first end of any heading or the start of the next one, as a browser reads it.
  const stop = /<\/?h[23]>/g
  for (const match of html.matchAll(/<h2>/g)) {
    const from = match.index + match[0].length
    stop.lastIndex = from
    const end = stop.exec(html)
    found.push({ at: match.index, title: plainText(html.slice(from, end ? end.index : html.length)) })
  }
  return found
}

/** A heading's inside as plain text: a line break is a space, every other tag goes, and the references are read. */
function plainText(inside: string): string {
  return readReferences(inside.replace(/<br>/g, ' ').replace(/<\/?[A-Za-z][^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }

/** The character references the editor writes, and every numeric one, read in one pass, so "&amp;lt;" stays "&lt;". */
function readReferences(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));/g, (whole, decimal, hex, named) => {
    if (named) return NAMED[named]
    const point = decimal !== undefined ? Number(decimal) : parseInt(hex, 16)
    const usable = point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
    return usable ? String.fromCodePoint(point) : '\ufffd'
  })
}

/** A heading's name before numbering: its words as a name, or "part" for words with no letter or digit to keep. */
function nameOf(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (words === '') return 'part'
  // A name always starts with a letter, so no name is a bare number like a repeat's.
  return /^[0-9]/.test(words) ? `part-${words}` : words
}

/**
 * The parts of a cleaned letter, in order: one for each h2 heading with words, a heading with none skipped. A heading
 * whose name is taken gets the first free number from 2 ("results-2", then "results-3"), so two headings never share
 * a name, even "Results", "Results" and "Results 2". Reads a cleaned letter, or the editor's own HTML, whose headings
 * carry no attributes.
 */
export function letterParts(html: string): LetterPart[] {
  const parts: LetterPart[] = []
  const taken = new Set<string>()
  for (const { title } of headings(html)) {
    if (title === '') continue
    const base = nameOf(title)
    let name = base
    for (let n = 2; taken.has(name); n += 1) name = `${base}-${n}`
    taken.add(name)
    parts.push({ title, name })
  }
  return parts
}

/**
 * The letter with an empty named anchor just before each part's heading, and every other byte as it was. The anchor
 * of parts[i] goes before the letter's i-th heading with words, and only when that part's title is the heading's and
 * its name is in a part's form, so parts made by letterParts from the same letter give every part its anchor. Run by
 * the layout after the letter has been cleaned; the result is never stored.
 */
export function withAnchors(html: string, parts: readonly LetterPart[]): string {
  let out = ''
  let from = 0
  let next = 0
  for (const { at, title } of headings(html)) {
    if (title === '') continue
    const part = parts[next]
    next += 1
    if (part === undefined || part.title !== title || !NAME_FORM.test(part.name)) continue
    out += `${html.slice(from, at)}<a name="${part.name}"></a>`
    from = at
  }
  return out + html.slice(from)
}

/** LCA's ways to start a letter, in the chooser's order: the blank letter, then the starters the board pins. */
export const STARTER_IDS = ['blank', 'monthly', 'results-and-thanks', 'short-notice'] as const
export type StarterId = (typeof STARTER_IDS)[number]

/** One way to start a letter. */
export interface Starter {
  /** Its name in the chooser, as the approved board writes it. */
  name: string
  /** The letter's h2 headings, in order, each part empty; none for a letter with no parts. */
  headings: readonly string[]
}

/**
 * The starters' names and headings. "Monthly newsletter" holds the usual six headings, the ones a new month starts
 * from (K's decision 26). The board names no heading for "Results and thanks" and draws one, so it holds one, in the
 * words of its own name; "Short notice" is drawn as "A few lines, no sections", so it holds none. The blank letter is
 * the month's band and an empty page, and the band is the layout's, so it holds none either.
 */
export const STARTERS: Readonly<Record<StarterId, Starter>> = {
  blank: { name: 'Blank letter', headings: [] },
  monthly: {
    name: 'Monthly newsletter',
    headings: ['A note from the president', 'Coming up', 'Results', 'From the clubs', 'Scholastic', 'Board business'],
  },
  'results-and-thanks': { name: 'Results and thanks', headings: ['Results and thanks'] },
  'short-notice': { name: 'Short notice', headings: [] },
}

/** The prompts the page shows in a letter's empty parts, in this order, word for word as the approved board draws a blank start. */
export const PART_PROMPTS = ['Write your opening here', 'Add what is coming up', 'Add results or club news'] as const

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const

/**
 * A month as a letter's band and subject write it, "December 2026" for (2026, 12). The names come from the table
 * above rather than from Intl, so the words are the same in browsers, Node and Workers. Throws a RangeError for a
 * month that is not a whole number from 1 to 12 or a year that is not a whole number from 1 to 9999.
 */
export function monthLabel(year: number, month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('A month is a whole number from 1 to 12.')
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError('A year is a whole number from 1 to 9999.')
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** The words a new letter's subject starts with. */
const SUBJECT_START = 'LCA Newsletter'

/** The separator between them and the month: a middle dot with a space each side, the character the approved board draws. */
const SUBJECT_SEPARATOR = ' \u00b7 '

/**
 * A new letter's subject for its month, given as the letter's band writes it: "LCA Newsletter · December 2026" for
 * "December 2026". Spaces in the month are run together and trimmed; with no month the subject is "LCA Newsletter".
 */
export function defaultSubject(month: string): string {
  const words = month.replace(/\s+/g, ' ').trim()
  return words === '' ? SUBJECT_START : `${SUBJECT_START}${SUBJECT_SEPARATOR}${words}`
}
