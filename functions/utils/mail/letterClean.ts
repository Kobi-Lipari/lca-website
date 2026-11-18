// functions/utils/mail/letterClean.ts
//
// The cleaner every saved newsletter letter passes through (WS16 part two,
// page step 1): the one thing between what a sender pastes and what reaches
// members' inboxes and other senders' browsers. Nothing imports it yet. The
// letter's saving (page step 3) is its first caller, and each issue's page
// on the site (page step 11) cleans the stored words again, once for each
// issue it shows, kept or cached, not on every request.
//
// It uses the method of sanitizePostHtml in ../posts, the Workers runtime's
// HTML rewriter with an allow list, kept to what the newsletter's editor
// makes, with that method's blind spot closed and its result checked:
//
// - Kept: p, br, strong, em, h2, h3, ul, ol, li, hr and a. The cleaner
//   writes each kept tag itself, in lower case and with every attribute
//   gone but two, a link's address and a numbered list's start, and closes
//   at the letter's end what is left open there, so nothing of the letter
//   reaches past its own end into the email around it. A heading of level 1
//   becomes h2 and one of level 4, 5 or 6 becomes h3, the nearest kept form.
// - A link keeps one attribute, its address, and only when the address,
//   trimmed, starts with https://, http:// or mailto: in any mix of capitals
//   and holds no quote mark, angle bracket, backtick, space or control
//   character, and no character reference but &amp;, the editor's own way to
//   write an ampersand. Any other link loses its tag and keeps its words, a
//   site path among them, since an email has no page to be relative to. An
//   anchor with no address left is not written as a tag. rel and target are
//   not kept: the layout that sends the email adds what it needs.
// - A numbered list keeps one attribute, its start, the number its first
//   item shows, which the editor writes when a sender begins a list at a
//   number other than 1, so places 4 to 6 of a result stay 4 to 6. It is
//   kept only when it is a whole number from 1 to 9999 written in digits
//   alone, with no sign, space or leading zero; any other start is dropped
//   and the list is numbered from 1. A list's type, its letters or Roman
//   numerals, is dropped like any other attribute, so the list shows numbers.
// - Removed with everything they hold: script, style, iframe, object, embed,
//   img, svg, math and template, and the tags whose inside the rewriter
//   hands on as raw text, textarea, title, noscript, xmp, noembed, noframes
//   and plaintext. That last group is sanitizePostHtml's blind spot: it
//   unwraps them, so the text inside, an img with an onerror among it, comes
//   out as live markup. The inside of template, svg and math reaches the
//   rewriter as tags, as test/integration/mail-letter-clean.test.ts shows.
// - Comments are removed. Any other tag is removed and its words kept. The
//   control characters nobody types and a browser shows nothing for, every
//   one below a space but tab, line feed, form feed and carriage return, and
//   delete, are removed first.
//
// cleanLetterHtml takes any string and never throws. It answers the cleaned
// letter, or null, and the caller refuses the letter in words, in exactly
// these cases:
//   1. The value is not a string.
//   2. The letter does not end cleanly: its last characters leave a tag, an
//      attribute, a comment or a doctype open, or a tag removed with what it
//      holds is still open at its end (plaintext anywhere, an unclosed
//      textarea, title, template, svg or the like), so the rest of the
//      letter would go with it, or, in an email, the markup after the letter
//      would be read as part of it.
//   3. Cleaning the cleaned letter once more would change it, as when the
//      removal of a tag joins a lone "<" to the words after it and makes a
//      new tag of them. The own-form check (case 4) alone also refuses these
//      letters, so this second pass is a back-up against a change in the
//      runtime's rewriter.
//   4. The cleaned letter is not in the cleaner's own form: text, and the
//      kept tags exactly as the cleaner writes them, each closed by its own
//      end tag in turn. The rewriter passes on as written an end tag that
//      closes nothing, and a doctype, so either makes the letter null, and
//      so does a "<" as the letter's last character, which could join what
//      follows the letter.
//   5. The runtime's rewriter fails on the letter, as it does on tags nested
//      tens of thousands deep.
// So a saved letter is always one the cleaner would leave alone.
//
// The cap, LETTER_MAX_BYTES (domain/mail/letter.ts), is the caller's to hold,
// and on the cleaned letter, the one stored and sent, not only on what was
// sent to it: cleaning can make a letter longer, since each kept tag left
// open gets its end tag and an address written without quotes gets them, so
// a letter under the cap can clean to one over it. The caller may also
// refuse an input past a bound of its own before cleaning, to bound the
// work, such as three times the cap, 240,000 bytes, and then hold the
// cleaned letter to the cap itself. The cleaner cleans a letter of any
// length.

/** The tags a letter keeps that hold words, each with the tag the cleaner writes for it. */
const KEPT = new Map<string, string>([
  ['p', 'p'], ['strong', 'strong'], ['em', 'em'], ['h2', 'h2'], ['h3', 'h3'], ['ul', 'ul'], ['ol', 'ol'], ['li', 'li'], ['a', 'a'],
  ['h1', 'h2'], ['h4', 'h3'], ['h5', 'h3'], ['h6', 'h3'],
])

/** The kept tags that hold nothing and have no end tag. */
const KEPT_EMPTY = new Set(['br', 'hr'])

/** The tags removed with everything they hold. */
const REMOVED_WHOLE = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'img', 'svg', 'math',
  'textarea', 'title', 'noscript', 'xmp', 'noembed', 'noframes', 'plaintext', 'template',
])

/** Of those, the ones whose inside the rewriter reads as tags, so the cleaner knows when the letter is inside one. */
const REMOVED_HOLDING_TAGS = new Set(['object', 'svg', 'math', 'template'])

/** Whether a character is one nobody types and a browser shows nothing for: below a space but tab, line feed, form feed and carriage return, or delete. */
function untyped(code: number): boolean {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0c && code !== 0x0d) || code === 0x7f
}

/** The letter without the characters untyped() names. */
function withoutUntyped(html: string): string {
  let out = ''
  let from = 0
  for (let i = 0; i < html.length; i += 1) {
    if (!untyped(html.charCodeAt(i))) continue
    out += html.slice(from, i)
    from = i + 1
  }
  return from === 0 ? html : out + html.slice(from)
}

/** A link's address as the letter keeps it: the scheme, then no quote, angle bracket, backtick or space, and no reference but &amp;. */
const LINK_ADDRESS = /^(?:https?:\/\/|mailto:)(?:[^"'<>`&\s]|&amp;)*$/i

/** A link's address as the letter keeps it, trimmed, or null when the link loses its tag. It holds no control character either. */
function keptAddress(href: string | null): string | null {
  if (href === null) return null
  const address = href.trim()
  if (!LINK_ADDRESS.test(address)) return null
  for (let i = 0; i < address.length; i += 1) {
    const code = address.charCodeAt(i)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return null
  }
  return address
}

/** A numbered list's start as the letter keeps it: a whole number from 1 to 9999, in digits alone. */
const LIST_START = /^[1-9][0-9]{0,3}$/

/** A numbered list's start as the letter keeps it, or null when the list loses it and is numbered from 1. */
function keptStart(start: string | null): string | null {
  return start !== null && LIST_START.test(start) ? start : null
}

/**
 * One tag as the cleaner writes it: a link with its address, a numbered list with its start, another kept start tag,
 * br or hr, or a kept end tag.
 */
const OWN_TAG = /<(?:a href="([^"]*)"|ol start="([^"]*)"|(p|strong|em|h2|h3|ul|ol|li)|br|hr|\/(p|strong|em|h2|h3|ul|ol|li|a))>/y

/**
 * Whether a cleaned letter is in the cleaner's own form: text, where a "<" never starts anything a browser would read
 * as markup, and the kept tags exactly as the cleaner writes them, each closed by its own end tag in turn.
 */
function inOwnForm(html: string): boolean {
  const open: string[] = []
  for (let at = html.indexOf('<'); at !== -1; at = html.indexOf('<', at + 1)) {
    const next = html.charAt(at + 1)
    if (next === '') return false
    if (!/[A-Za-z/!?]/.test(next)) continue
    OWN_TAG.lastIndex = at
    const tag = OWN_TAG.exec(html)
    if (tag === null) return false
    const [, address, listStart, start, end] = tag
    if (address !== undefined) {
      if (keptAddress(address) !== address) return false
      open.push('a')
    } else if (listStart !== undefined) {
      if (keptStart(listStart) !== listStart) return false
      open.push('ol')
    } else if (start !== undefined) {
      open.push(start)
    } else if (end !== undefined && open.pop() !== end) {
      return false
    }
    at = OWN_TAG.lastIndex - 1
  }
  return open.length === 0
}

/** One run of the rewriter over a letter: the cleaned letter, or null when it does not end cleanly (case 2 above). */
async function cleanOnce(html: string): Promise<string | null> {
  // A tag of a name no letter can hold, written after the letter. The rewriter sees it as a tag only when the letter
  // ends in plain text, with nothing left open that would swallow it.
  const endMark = `x-letter-end-${crypto.randomUUID()}`
  let endSeen = false
  let endInsideRemoved = false
  let removedDepth = 0
  const opened: { tag: string; closed: boolean }[] = []
  // End tags the rewriter closed without one of their own, written at the next end tag it reads.
  let pending = ''

  const rewriter = new HTMLRewriter()
    .on('*', {
      element(el) {
        const name = el.tagName
        if (name === endMark) {
          endSeen = true
          endInsideRemoved = removedDepth > 0
          el.remove()
          return
        }
        if (removedDepth > 0) {
          el.remove()
          return
        }
        if (REMOVED_WHOLE.has(name)) {
          if (REMOVED_HOLDING_TAGS.has(name)) {
            try {
              el.onEndTag(() => {
                removedDepth -= 1
              })
              removedDepth += 1
            } catch {
              // Written as self-closing, so it holds nothing.
            }
          }
          el.remove()
          return
        }
        if (KEPT_EMPTY.has(name)) {
          el.replace(`<${name}>`, { html: true })
          return
        }
        const tag = KEPT.get(name)
        const address = name === 'a' ? keptAddress(el.getAttribute('href')) : null
        if (tag === undefined || (name === 'a' && address === null)) {
          // Removed, words kept. Its end tag may close kept tags that had none of their own: they are written there.
          try {
            el.onEndTag((end) => {
              if (end.name !== name || pending === '') return
              end.before(pending, { html: true })
              pending = ''
            })
          } catch {
            // A tag with no end tag.
          }
          el.removeAndKeepContent()
          return
        }
        const start = name === 'ol' ? keptStart(el.getAttribute('start')) : null
        const kept = { tag, closed: false }
        opened.push(kept)
        el.onEndTag((end) => {
          kept.closed = true
          if (end.name !== name) {
            // Closed by an outer tag's end: written when that end tag is read.
            pending += `</${tag}>`
            return
          }
          end.before(`${pending}</${tag}>`, { html: true })
          pending = ''
        })
        el.before(address !== null ? `<a href="${address}">` : start !== null ? `<ol start="${start}">` : `<${tag}>`, { html: true })
        el.removeAndKeepContent()
      },
    })
    .onDocument({
      comments(comment) {
        comment.remove()
      },
      end(end) {
        let closing = pending
        for (let i = opened.length - 1; i >= 0; i -= 1) if (!opened[i].closed) closing += `</${opened[i].tag}>`
        if (closing !== '') end.append(closing, { html: true })
      },
    })

  const letter = withoutUntyped(html)
  const response = rewriter.transform(new Response(`${letter}<${endMark}>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
  const out = await response.text()
  return endSeen && !endInsideRemoved ? out : null
}

/**
 * The letter as the newsletter keeps it, or null for a letter the cleaner cannot make clean, in the five cases the
 * head of this file lists. Never throws.
 */
export async function cleanLetterHtml(html: string): Promise<string | null> {
  if (typeof html !== 'string') return null
  try {
    const once = await cleanOnce(html)
    if (once === null) return null
    const twice = await cleanOnce(once)
    if (twice !== once) return null
    return inOwnForm(once) ? once : null
  } catch {
    return null
  }
}
