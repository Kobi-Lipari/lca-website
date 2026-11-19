// test/integration/mail-newsletter-layout-cleaned.test.ts
//
// The navy email (renderNewsletter, domain/mail/newsletterLayout.ts, WS16
// part two page step 2) fed the real cleaner's own output, run in the Workers
// runtime whose HTML rewriter the cleaner needs (functions/utils/mail/letterClean.ts):
// the layout trusts a cleaned letter and does not clean again, so this holds
// that what the cleaner really hands on, for every kept tag, for each
// starter's letter and for a letter full of markup a sender should not be able
// to send, comes out of the layout with no tag, attribute or address that is
// not the cleaner's or the layout's own, and with the letter's words and tags
// as the cleaner wrote them once the layout's rules and styles are set aside.
// The page's side of the same check, with a DOM, is in
// test/unit/mail-newsletter-layout.test.ts. Every sample word is plainly made
// up (K's decision 39). Nothing here makes a request.
import { describe, expect, it } from 'vitest'
import { defaultSubject, letterParts, monthLabel, STARTER_IDS, STARTERS, withAnchors } from '../../domain/mail/letter'
import { EMAIL_MAX_BYTES, renderNewsletter } from '../../domain/mail/newsletterLayout'
import { cleanLetterHtml } from '../../functions/utils/mail/letterClean'

const SITE = 'https://www.example.org'
const MONTH = monthLabel(2026, 12)
const FOOTER = '<p style="margin:0 0 10px;font-size:13px;color:#3a3f4b;">Sample footer words.</p>'
const bytes = (text: string) => new TextEncoder().encode(text).length

/** What a sender might try to put in a letter: script, a form, an image that runs script, event handlers, a script address, a style, a frame. */
const HOSTILE = [
  '<h2 onclick="alert(1)" style="color:red">Sample heading one</h2>',
  '<p>Sample words <img src="https://example.org/pixel.gif" onerror="alert(2)"> and <script>alert(3)</script>more.</p>',
  '<form action="https://example.org/steal"><input name="x"><button>Send</button></form>',
  '<p><a href="javascript:alert(4)">Sample script link</a> <a href="https://example.org/ok" onclick="alert(5)" target="_blank">Sample good link</a></p>',
  '<h2>Sample heading two</h2>',
  '<iframe src="https://example.org/frame"></iframe><style>p{display:none}</style><p><span style="color:red">Sample span</span></p>',
  '<h3 class="x">Sample smaller heading</h3><hr class="x"><ul><li onmouseover="alert(6)">Sample item</li></ul>',
].join('')

/** A letter holding every tag the cleaner keeps, as the editor writes each. */
const EVERY_TAG = [
  '<h2>Sample heading one</h2>',
  `<p>Sample words with <strong>Player One</strong>, <em>Player Two</em> and <a href="${SITE}/sample?a=1&amp;b=2">a sample link</a>.<br>A second sample line.</p>`,
  '<h3>Sample smaller heading</h3>',
  '<ul><li><p>Sample item</p></li><li><p>Another sample item</p></li></ul>',
  '<hr>',
  '<h2>Sample heading two &amp; more</h2>',
  '<ol start="4"><li><p>Player Four</p></li><li><p>Player Five</p></li></ol>',
  `<p>Sample sums: 4 &lt; 5, 4 < 5 and 6 > 5. <a href="mailto:player.one@example.org">Player One</a> <a href="http://example.org/plain">plain link</a></p>`,
].join('')

/** The email's elements, and every attribute of each, in order, as the runtime's own rewriter reads them. */
async function elementsOf(html: string): Promise<{ tag: string; attributes: Record<string, string> }[]> {
  const found: { tag: string; attributes: Record<string, string> }[] = []
  await new HTMLRewriter()
    .on('*', {
      element(el) {
        const attributes: Record<string, string> = {}
        for (const [name, value] of el.attributes) attributes[name] = value
        found.push({ tag: el.tagName, attributes })
      },
    })
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    .text()
  return found
}

async function render(cleaned: string): Promise<string> {
  return renderNewsletter({ siteUrl: SITE, month: MONTH, subject: defaultSubject(MONTH), preheader: 'Sample preview line.', bodyHtml: cleaned, footerHtml: FOOTER })
}

/** The letter's cell, as its bytes. */
function letterCell(email: string): string {
  return /<td class="nl-letter" style="[^"]*">([\s\S]*?)<\/td><\/tr>\n<tr><td class="nl-foot"/.exec(email)?.[1] ?? 'not found'
}

/** The email's elements the layout itself writes. */
const LAYOUT_TAGS = ['html', 'head', 'meta', 'title', 'style', 'body', 'div', 'table', 'tr', 'td', 'img', 'h1', 'span', 'br', 'ul', 'li', 'p', 'a']
/** The cleaner's own tags. */
const LETTER_TAGS = ['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'hr', 'a']

describe('the navy email for letters the real cleaner has cleaned', () => {
  it('keeps the cleaner\'s letter as it is once the layout\'s rules and styles are set aside, for every kept tag and for a letter of hostile markup', async () => {
    for (const letter of [EVERY_TAG, HOSTILE]) {
      const cleaned = await cleanLetterHtml(letter)
      expect(cleaned).not.toBeNull()
      const cell = letterCell(await render(cleaned!))
      expect(cell.replace(/<div[^>]*><\/div>/g, '').replace(/ (?:style|class)="[^"]*"/g, '')).toBe(withAnchors(cleaned!, letterParts(cleaned!)))
    }
    expect(await cleanLetterHtml(EVERY_TAG)).toBe(EVERY_TAG)
  })

  it('writes no element, attribute or address of a hostile letter into the email: only the layout\'s elements, and the cleaner\'s with a style and a class of the layout\'s own', async () => {
    const cleaned = (await cleanLetterHtml(HOSTILE))!
    const email = await render(cleaned)
    for (const piece of ['<script', '<form', '<input', '<button', '<iframe', 'onerror', 'onclick', 'onmouseover', 'javascript:', 'target=', 'pixel.gif', 'example.org/steal', 'example.org/frame', 'color:red', 'display:none}', '<svg']) {
      expect(email, piece).not.toContain(piece)
    }
    const seen = await elementsOf(email)
    for (const { tag, attributes } of seen) {
      expect([...LAYOUT_TAGS, ...LETTER_TAGS], tag).toContain(tag)
      for (const name of Object.keys(attributes)) expect(name, tag).not.toMatch(/^on/)
    }
    // The one image is the rook; the one style block is the layout's; the only addresses are the cleaner's own links, the strip's jump links and the follow line.
    expect(seen.filter((el) => el.tag === 'img').map((el) => el.attributes.src)).toEqual([`${SITE}/email-rook.png`])
    expect(seen.filter((el) => el.tag === 'style')).toHaveLength(1)
    for (const { attributes } of seen.filter((el) => el.tag === 'a' && 'href' in el.attributes)) {
      expect(attributes.href).toMatch(/^(?:https?:\/\/|mailto:|#[a-z][a-z0-9-]*$)/)
      expect(attributes.style).toBe('color:#1a2744;text-decoration:underline;')
    }
    // Still the sender's good words and link, and the headings' words, with the cleaner's own rule set aside.
    expect(email).toContain('Sample good link')
    expect(email).toContain('Sample span')
  })

  it('leaves no heading, line or link of the cleaner\'s bare in the email, and gives every anchor to a part and every part to the strip', async () => {
    const cleaned = (await cleanLetterHtml(EVERY_TAG))!
    const email = await render(cleaned)
    const cell = letterCell(email)
    expect(cell).not.toMatch(/<h[23]>|<hr>|<a href="[^"]*">/)
    const parts = letterParts(cleaned)
    expect(parts.map((part) => part.title)).toEqual(['Sample heading one', 'Sample heading two & more'])
    const seen = await elementsOf(email)
    const anchors = seen.filter((el) => el.tag === 'a' && 'name' in el.attributes).map((el) => el.attributes.name)
    expect(anchors).toEqual(parts.map((part) => part.name))
    const jumps = seen.filter((el) => el.tag === 'a' && el.attributes.href?.startsWith('#')).map((el) => el.attributes.href)
    expect(jumps).toEqual(parts.map((part) => `#${part.name}`))
    // Headings: the band's one h1, then the letter's, as the cleaner wrote them.
    expect(seen.filter((el) => /^h\d$/.test(el.tag)).map((el) => el.tag)).toEqual(['h1', 'h2', 'h3', 'h2'])
  })

  it.each(STARTER_IDS)('renders the %s starter\'s letter, cleaned, with a strip of its headings from two parts up', async (id) => {
    const headings = STARTERS[id].headings
    const letter = headings.map((heading) => `<h2>${heading}</h2><p></p>`).join('')
    const cleaned = (await cleanLetterHtml(letter))!
    const email = await render(cleaned)
    expect(letterParts(cleaned).map((part) => part.title)).toEqual(headings)
    expect(email.includes('class="nl-toc"')).toBe(headings.length >= 2)
    expect(bytes(email)).toBeLessThan(EMAIL_MAX_BYTES)
  })
})
