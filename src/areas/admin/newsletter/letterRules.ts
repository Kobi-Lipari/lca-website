// src/areas/admin/newsletter/letterRules.ts
//
// The newsletter page's own copies of three rules the server holds, kept in
// a file with no import so that the unit tests and the integration suite
// (which runs the real cleaner in the Workers runtime) can each hold a copy
// equal to the server's:
// - the three fields' limits, from domain/contracts/newsletter.ts, which the
//   page may not import at run time, since that file brings the schema
//   library into the site's bundle (npm run check:bundle);
// - the characters a field may not hold (holdsControl in the same file),
//   which the page drops as they are typed or pasted, so nobody is asked to
//   find a character they cannot see;
// - the link addresses the letter's cleaner keeps (keptAddress in
//   functions/utils/mail/letterClean.ts), so the page takes only an address
//   the email will keep and says so in words when it cannot.
// test/unit/admin-newsletter-page.test.tsx holds the limits and the
// characters to the contract, and test/integration/admin-newsletter-link-rule.test.ts
// holds the address rule to the cleaner itself.

/** The most characters a letter's month, subject and inbox preview line keep once trimmed, as the server holds them. */
export const MONTH_LABEL_MAX = 40
export const SUBJECT_MAX = 200
export const PREHEADER_MAX = 150

/** The length the Subject's count is measured against: about what an inbox shows. A guide only; it never stops typing. */
export const SUBJECT_GUIDE = 60

/**
 * Whether a character is one the server refuses in a letter's month, subject or preview line: a line break or any
 * other control character (below a space, delete, U+0080 to U+009F, and the line and paragraph separators), or one of
 * the nine that force the direction or the order in which what follows is drawn (U+202A to U+202E, U+2066 to U+2069).
 * The joiners, the variation selector, the direction marks that force nothing, the zero width space and the soft
 * hyphen are kept, as the server keeps them.
 */
export function isHiddenCharacter(code: number): boolean {
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true
  return (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
}

/** A field's words without the characters the server would refuse, everything else as typed. */
export function withoutHiddenCharacters(text: string): string {
  let out = ''
  let from = 0
  for (let i = 0; i < text.length; i += 1) {
    if (!isHiddenCharacter(text.charCodeAt(i))) continue
    out += text.slice(from, i)
    from = i + 1
  }
  return from === 0 ? text : out + text.slice(from)
}

/**
 * A text field's value with the characters the server would refuse taken out as they arrive, typed or pasted, the
 * caret kept where it was among the characters that stay. Returns the value the field now holds. The field is a box of
 * one line or one that wraps its words, as the Subject's is.
 */
export function keepVisible(input: HTMLInputElement | HTMLTextAreaElement): string {
  const raw = input.value
  const clean = withoutHiddenCharacters(raw)
  if (clean !== raw) {
    const caret = withoutHiddenCharacters(raw.slice(0, input.selectionStart ?? raw.length)).length
    input.value = clean
    input.setSelectionRange(caret, caret)
  }
  return clean
}

/**
 * A link's address as the letter will keep it, trimmed, or null when the cleaner would drop the link and keep only its
 * words. The cleaner reads the address as the editor writes it into the letter, an ampersand as &amp;, and keeps it
 * when it starts with https://, http:// or mailto: in any capitals and holds no quote mark, angle bracket, backtick,
 * space or control character. An ampersand typed here is fine: the editor writes it as the one reference the cleaner
 * keeps.
 */
export function keepableAddress(raw: string): string | null {
  const address = raw.trim()
  if (!/^(?:https?:\/\/|mailto:)[^"'<>`\s]*$/i.test(address)) return null
  for (let i = 0; i < address.length; i += 1) {
    const code = address.charCodeAt(i)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return null
  }
  return address
}
