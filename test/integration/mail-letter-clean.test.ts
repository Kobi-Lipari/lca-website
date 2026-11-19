// test/integration/mail-letter-clean.test.ts
//
// The newsletter letter's cleaner, cleanLetterHtml in
// functions/utils/mail/letterClean.ts (WS16 part two, page step 1), run in
// the Workers runtime, whose HTML rewriter it cleans with; the unit suite's
// node has none. Pinned here: what the runtime's rewriter itself hands on
// for the inside of each raw-text tag and of template, svg and math, and
// for an attribute's value; the kept tags coming out as they went in, and
// a second cleaning changing nothing, for each kept tag, for text with
// references, an emoji, Spanish and Vietnamese, and for each starter's
// letter; everything the cleaner removes, with or without
// its words; the link rule; a numbered list's start; broken markup closed
// or refused; every way the cleaner answers null, each with a case; the
// anchors withAnchors adds (domain/mail/letter.ts) being what the cleaner
// takes out again; and a letter over the cap cleaned, since holding the
// cap is the caller's, on the cleaned letter, which can be longer than
// what went in. Every sample word is plainly made up (K's decision 39).
// Nothing here makes a request.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LETTER_MAX_BYTES, letterParts, STARTER_IDS, STARTERS, withAnchors } from '../../domain/mail/letter'
import { cleanLetterHtml } from '../../functions/utils/mail/letterClean'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** An img that runs script when it fails to load and a link that runs script when pressed: neither may reach a letter. */
const HOSTILE = '<img src=x onerror=alert(1)><a href="https://example.org/hostile" onclick="alert(2)">Hostile sample link</a>'

/** The tags whose inside the runtime's rewriter hands on as raw text, and the three whose inside it hands on as tags. */
const RAW_TEXT = ['textarea', 'title', 'noscript', 'xmp', 'noembed', 'noframes', 'plaintext'] as const
const INSIDE_AS_TAGS = ['template', 'svg', 'math'] as const

/** The names of the tags the runtime's rewriter hands to a handler, in order, with nothing changed. */
async function tagsSeen(html: string): Promise<string[]> {
  const seen: string[] = []
  await new HTMLRewriter()
    .on('*', {
      element(el) {
        seen.push(el.tagName)
      },
    })
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    .text()
  return seen
}

/** What one pass of the rewriter makes of a letter when it unwraps a span: the method's one pass, with no second. */
async function unwrapSpanOnce(html: string): Promise<string> {
  return new HTMLRewriter()
    .on('span', {
      element(el) {
        el.removeAndKeepContent()
      },
    })
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    .text()
}

/** A letter's size as the cap counts it: the UTF-8 bytes of its HTML. */
function bytes(html: string): number {
  return new TextEncoder().encode(html).length
}

/** Nothing of HOSTILE is left in a cleaned letter. */
function noneOfIt(out: string | null): void {
  for (const piece of ['<img', 'onerror', 'alert', 'onclick', 'Hostile sample link', 'example.org/hostile']) expect(out ?? '', piece).not.toContain(piece)
}

describe('what the runtime\'s rewriter hands on', () => {
  it.each(RAW_TEXT)('hands on the inside of %s as raw text, never as tags', async (tag) => {
    const seen = await tagsSeen(`<p>Before</p><${tag}>${HOSTILE}</${tag}><p>After</p>`)
    expect(seen).not.toContain('img')
    expect(seen).not.toContain('a')
    // plaintext never closes: the rest of the letter is its raw text too.
    expect(seen).toEqual(tag === 'plaintext' ? ['p', 'plaintext'] : ['p', tag, 'p'])
  })

  it.each(INSIDE_AS_TAGS)('hands on the inside of %s as tags', async (tag) => {
    expect(await tagsSeen(`<p>Before</p><${tag}>${HOSTILE}</${tag}><p>After</p>`)).toEqual(['p', tag, 'img', 'a', 'p'])
  })

  it('makes a new tag in one pass when it unwraps a tag between a lone "<" and the words after it', async () => {
    expect(await unwrapSpanOnce('<p>Sample</p><<span>img src=x onerror=alert(1)>')).toBe('<p>Sample</p><img src=x onerror=alert(1)>')
  })

  it('hands on an attribute\'s value as it was written, its references unread, so the link rule reads the address as written', async () => {
    let href: string | null = null
    await new HTMLRewriter()
      .on('a', {
        element(el) {
          href = el.getAttribute('href')
        },
      })
      .transform(new Response('<a href="https://example.org/sample?a=1&amp;b=2&quot;x">Sample</a>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
      .text()
    expect(href).toBe('https://example.org/sample?a=1&amp;b=2&quot;x')
  })
})

describe('the kept tags', () => {
  const kept: [string, string][] = [
    ['p', '<p>Sample words.</p>'],
    ['an empty p, the editor\'s empty letter', '<p></p>'],
    ['br', '<p>Sample<br>words</p>'],
    ['strong', '<p><strong>Sample words</strong></p>'],
    ['em', '<p><em>Sample words</em></p>'],
    ['h2', '<h2>Sample heading</h2>'],
    ['h3', '<h3>Sample heading</h3>'],
    ['ul', '<ul><li>Sample one</li><li>Sample two</li></ul>'],
    ['ol', '<ol><li>Sample one</li><li>Sample two</li></ol>'],
    ['ol with its start, as the editor writes a list begun at 4', '<ol start="4"><li><p>Player Four, 3½</p></li><li><p>Player Five, 3</p></li></ol>'],
    ['li with a paragraph, as the editor writes it', '<ul><li><p>Sample one</p></li></ul>'],
    ['hr', '<p>Sample</p><hr><p>words</p>'],
    ['a to https', '<p><a href="https://example.org/sample">Sample link</a></p>'],
    ['a to http', '<p><a href="http://example.org/sample">Sample link</a></p>'],
    ['a to mailto', '<p><a href="mailto:player.one@example.org">Player One</a></p>'],
    ['a with an ampersand as the editor writes it', '<p><a href="https://example.org/sample?a=1&amp;b=2">Sample link</a></p>'],
  ]

  it.each(kept)('%s comes out as it went in, and a second cleaning changes nothing', async (_name, letter) => {
    const once = await cleanLetterHtml(letter)
    expect(once).toBe(letter)
    expect(await cleanLetterHtml(once!)).toBe(letter)
  })

  const text: [string, string][] = [
    ['an ampersand', '<p>Sample &amp; words</p>'],
    ['a less-than sign written as a reference', '<p>Sample &lt;b&gt; words, &#60;i&#62; too</p>'],
    ['a non-breaking space', '<p>Sample&nbsp;words</p>'],
    ['an emoji', '<p>Sample words \u{1F600}\u{265F}\u{FE0F}</p>'],
    ['Spanish', '<p>Palabras de ejemplo: año, señal, ¿qué?</p>'],
    ['Vietnamese', '<p>Tiếng Việt: một ví dụ mẫu.</p>'],
    ['a lone "<" in the words', '<p>Sample 1 < 2 and 3 > 2</p>'],
  ]

  it.each(text)('text with %s comes out as it went in, and a second cleaning changes nothing', async (_name, letter) => {
    const once = await cleanLetterHtml(letter)
    expect(once).toBe(letter)
    expect(await cleanLetterHtml(once!)).toBe(letter)
  })

  it('a whole letter in the editor\'s form comes out as it went in', async () => {
    const letter = [
      '<h2>A note from the president</h2><p>Sample words for the opening, with <strong>Player One</strong> and <em>Player Two</em>.</p>',
      '<h2>Coming up</h2><ul><li><p>Sat, Jan 9, 2027 · Sample Winter Open · <a href="https://example.org/sample">Register</a></p></li></ul>',
      '<h2>Results</h2><ol><li><p>Player One, 4½</p></li><li><p>Player Two, 4</p></li></ol><hr>',
      '<h3>Example Chess Club</h3><p>Sample words.<br>More sample words.</p>',
    ].join('')
    expect(await cleanLetterHtml(letter)).toBe(letter)
  })

  it('each starter\'s letter, its headings with an empty paragraph under each, comes out as it went in, its parts its headings', async () => {
    for (const id of STARTER_IDS) {
      const letter = STARTERS[id].headings.map((heading) => `<h2>${heading}</h2><p></p>`).join('')
      expect(await cleanLetterHtml(letter), id).toBe(letter)
      expect(letterParts(letter).map((part) => part.title), id).toEqual([...STARTERS[id].headings])
    }
  })
})

describe('what is removed with everything it holds', () => {
  it.each(['textarea', 'title', 'noscript', 'xmp', 'noembed', 'noframes', 'template', 'svg', 'math'])(
    '%s holding an img with an onerror and a link with an onclick: nothing of either is left',
    async (tag) => {
      const out = await cleanLetterHtml(`<p>Before</p><${tag}>${HOSTILE}</${tag}><p>After</p>`)
      expect(out).toBe('<p>Before</p><p>After</p>')
      noneOfIt(out)
    },
  )

  it('plaintext holding them: the letter is null, since plaintext never closes and the rest of the letter would go with it', async () => {
    const out = await cleanLetterHtml(`<p>Before</p><plaintext>${HOSTILE}</plaintext><p>After</p>`)
    expect(out).toBeNull()
    noneOfIt(out)
  })

  it.each(['TEXTAREA', 'Title', 'NOSCRIPT', 'Template', 'SVG', 'MATH'])('%s in capitals, with attributes, is removed the same way', async (tag) => {
    expect(await cleanLetterHtml(`<p>Before</p><${tag} id="sample" class="sample">${HOSTILE}</${tag}><p>After</p>`)).toBe('<p>Before</p><p>After</p>')
  })

  it.each([
    ['script', '<script>alert(1)</script>'],
    ['style', '<style>p { color: red }</style>'],
    ['iframe', '<iframe src="https://example.org/sample"><p>Sample</p></iframe>'],
    ['object', '<object data="https://example.org/sample"><param name="sample" value="x"><p>Sample</p></object>'],
    ['embed', '<embed src="https://example.org/sample" onload="alert(1)">'],
    ['img', '<img src="https://example.org/sample.png" alt="Sample" onerror="alert(1)">'],
  ])('%s is gone with what it holds', async (_tag, removed) => {
    expect(await cleanLetterHtml(`<p>Before</p>${removed}<p>After</p>`)).toBe('<p>Before</p><p>After</p>')
  })

  it('a tag removed whole is removed inside another one, and with nested tags of its own', async () => {
    expect(await cleanLetterHtml(`<p>Before</p><svg><style>${HOSTILE}</style></svg><p>After</p>`)).toBe('<p>Before</p><p>After</p>')
    expect(await cleanLetterHtml(`<p>Before</p><template><template>${HOSTILE}</template></template><p>After</p>`)).toBe('<p>Before</p><p>After</p>')
    expect(await cleanLetterHtml(`<p>Before</p><svg><p>${HOSTILE}</p></svg><p>After</p>`)).toBe('<p>Before</p><p>After</p>')
    expect(await cleanLetterHtml('<p>Before</p><svg/><p>After</p>')).toBe('<p>Before</p><p>After</p>')
  })

  it('a raw-text tag closed inside an attribute leaves only stray words', async () => {
    const out = await cleanLetterHtml('<p>Sample</p><noscript><p title="</noscript><img src=x onerror=alert(1)>">')
    expect(out).toBe('<p>Sample</p>">')
    noneOfIt(out)
  })
})

describe('what loses its tag and keeps its words', () => {
  it('drops every attribute of a kept tag but a link\'s address and a list\'s start: onclick, style, class and id among them', async () => {
    expect(await cleanLetterHtml('<p onclick="alert(1)" style="color:red" class="sample" id="sample">Sample</p><strong onmouseover=alert(1)>words</strong>'))
      .toBe('<p>Sample</p><strong>words</strong>')
  })

  it('removes comments, the conditional ones mail programs read among them, and the other bogus kinds', async () => {
    expect(await cleanLetterHtml('<p>Sample</p><!-- Sample comment --><p>words<!-- inside --></p><!--[if mso]><img src=x onerror=alert(1)><![endif]-->'))
      .toBe('<p>Sample</p><p>words</p>')
    expect(await cleanLetterHtml('<p>Sample</p><![CDATA[x]]><?xml version="1.0"?><! sample></ 3><p>words</p>')).toBe('<p>Sample</p><p>words</p>')
  })

  it('keeps the words of the tags the editor kit can make that are not kept: a quote, a code block, inline code, strike, underline, b and i', async () => {
    expect(await cleanLetterHtml('<blockquote><p>Sample quote</p></blockquote><pre><code class="language-js">Sample code</code></pre>'))
      .toBe('<p>Sample quote</p>Sample code')
    expect(await cleanLetterHtml('<p><code>one</code> <s>two</s> <u>three</u> <b>four</b> <i>five</i></p>')).toBe('<p>one two three four five</p>')
  })

  it('writes a heading of level 1 as h2 and one of level 4, 5 or 6 as h3, the nearest kept form', async () => {
    expect(await cleanLetterHtml('<h1>Sample one</h1><h4>Sample four</h4><h5>Sample five</h5><h6>Sample six</h6>'))
      .toBe('<h2>Sample one</h2><h3>Sample four</h3><h3>Sample five</h3><h3>Sample six</h3>')
  })

  it('keeps the words of any other tag, a page pasted whole among them', async () => {
    expect(await cleanLetterHtml('<div><span style="font-weight:700">Sample</span> <font color="red">words</font></div><table><tr><td>Example</td></tr></table>'))
      .toBe('Sample wordsExample')
    expect(await cleanLetterHtml('<html><head><title>Sample</title><style>p {}</style></head><body><p>Sample words</p></body></html>')).toBe('<p>Sample words</p>')
    expect(await cleanLetterHtml('<form action="https://example.org/sample"><input value="x"><button>Sample</button><select><option>words</option></select></form>'))
      .toBe('Samplewords')
  })

  it('writes kept tags its own way: lower case, no attributes, no slash', async () => {
    expect(await cleanLetterHtml('<P CLASS="sample">Sample</P onclick="alert(1)"><p/>words</p><STRONG >S</STRONG><BR/><HR class="sample" />'))
      .toBe('<p>Sample</p><p>words</p><strong>S</strong><br><hr>')
  })

  it('removes the control characters nobody types and keeps tab, line feed and carriage return', async () => {
    expect(await cleanLetterHtml('<p>Sam\u0000ple\u0007 \u000bwords\u007f</p>\n<p>\tSample\r\n</p>')).toBe('<p>Sample words</p>\n<p>\tSample\r\n</p>')
  })
})

describe('links', () => {
  it('a single-quoted address that holds a double quote comes out with no onclick and no address', async () => {
    const out = await cleanLetterHtml(`<p><a href='https://x" onclick="y'>Sample words</a></p>`)
    expect(out).toBe('<p>Sample words</p>')
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['javascript: in capitals, after spaces', '  JaVaScRiPt:alert(1)'],
    ['javascript: written with a reference', '&#x6a;avascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
    ['file:', 'file:///sample'],
    ['tel:', 'tel:5550100'],
    ['a site path', '/tournaments/sample'],
    ['an address with no scheme', '//example.org/sample'],
    ['a jump within the page', '#sample'],
    ['an empty address', ''],
    ['an address holding a quote mark by reference', 'https://example.org/sample&quot;x'],
    ['an address holding an apostrophe', "https://example.org/sample'x"],
    ['an address holding an angle bracket by reference', 'https://example.org/&lt;sample'],
    ['an address holding a backtick', 'https://example.org/`sample'],
    ['an address holding a space', 'https://example.org/sample words'],
    ['an address holding a tab', 'https://example.org/sample\tx'],
    ['an address holding a control character', 'https://example.org/sample\u0085x'],
    ['an address holding a bare ampersand', 'https://example.org/?a=1&b=2'],
    ['the scheme written with a reference', 'https&#58;//example.org/sample'],
  ])('a link to %s loses its tag and keeps its words', async (_name, href) => {
    expect(await cleanLetterHtml(`<p><a href="${href}">Sample words</a></p>`)).toBe('<p>Sample words</p>')
  })

  it('matches the scheme without regard to capitals, after trimming, and writes the address trimmed', async () => {
    expect(await cleanLetterHtml('<p><a href="  HTTPS://EXAMPLE.ORG/Sample  ">Sample</a><a href="\nMailTo:player.one@example.org">Player One</a></p>'))
      .toBe('<p><a href="HTTPS://EXAMPLE.ORG/Sample">Sample</a><a href="MailTo:player.one@example.org">Player One</a></p>')
  })

  it('keeps no rel and no target, the editor\'s own link among them', async () => {
    expect(await cleanLetterHtml('<p><a target="_blank" rel="noopener noreferrer nofollow" class="sample" href="https://example.org/sample">Sample</a></p>'))
      .toBe('<p><a href="https://example.org/sample">Sample</a></p>')
  })

  it('does not write an anchor with no address left, a named anchor among them', async () => {
    expect(await cleanLetterHtml('<p><a name="sample">Sample</a> <a>words</a> <a id="sample" href="javascript:alert(1)">more</a></p>')).toBe('<p>Sample words more</p>')
  })
})

describe('a numbered list\'s start', () => {
  it('keeps a whole number from 1 to 9999, and writes it its own way', async () => {
    for (const start of ['1', '4', '12', '9999']) {
      expect(await cleanLetterHtml(`<ol start="${start}"><li>Sample</li></ol>`), start).toBe(`<ol start="${start}"><li>Sample</li></ol>`)
    }
    expect(await cleanLetterHtml('<OL class="sample" START=4 onclick="alert(1)"><li>Sample</li></OL>')).toBe('<ol start="4"><li>Sample</li></ol>')
  })

  it.each([
    ['letters after the number', '4x'],
    ['a sign', '-1'],
    ['a plus sign', '+4'],
    ['nought', '0'],
    ['a leading zero', '04'],
    ['a number past 9999', '10000'],
    ['a space before the number', ' 4'],
    ['a space after the number', '4 '],
    ['a fraction', '4.5'],
    ['a number written with a reference', '&#52;'],
    ['a digit of another script', '٤'],
    ['nothing', ''],
  ])('drops a start of %s and keeps the list, numbered from 1', async (_name, start) => {
    expect(await cleanLetterHtml(`<ol start="${start}"><li>Sample</li></ol>`)).toBe('<ol><li>Sample</li></ol>')
  })

  it('drops a start with no value, and one that holds a quote and an onclick', async () => {
    expect(await cleanLetterHtml('<ol start><li>Sample</li></ol>')).toBe('<ol><li>Sample</li></ol>')
    expect(await cleanLetterHtml(`<ol start='4" onclick="alert(1)'><li>Sample</li></ol>`)).toBe('<ol><li>Sample</li></ol>')
  })

  it('keeps a start on a numbered list alone, and drops a list\'s type, its letters or Roman numerals', async () => {
    expect(await cleanLetterHtml('<ul start="4"><li start="4">Sample</li></ul><p start="4">words</p>')).toBe('<ul><li>Sample</li></ul><p>words</p>')
    expect(await cleanLetterHtml('<ol type="a" start="2"><li>Sample</li></ol><ol type="I"><li>words</li></ol>')).toBe('<ol start="2"><li>Sample</li></ol><ol><li>words</li></ol>')
  })
})

describe('broken markup', () => {
  it('closes at the letter\'s end what is left open there', async () => {
    expect(await cleanLetterHtml('<p>Sample<strong>words')).toBe('<p>Sample<strong>words</strong></p>')
    expect(await cleanLetterHtml('<ul><li>Sample one<li>Sample two')).toBe('<ul><li>Sample one<li>Sample two</li></li></ul>')
    expect(await cleanLetterHtml('<p><a href="https://example.org/sample">Sample')).toBe('<p><a href="https://example.org/sample">Sample</a></p>')
  })

  it('closes a kept tag where an outer tag\'s end closes it, a removed tag\'s end among them', async () => {
    expect(await cleanLetterHtml('<div><p>Sample</div><p>words</p>')).toBe('<p>Sample</p><p>words</p>')
    expect(await cleanLetterHtml('<p>Sample<strong>words</p>more')).toBe('<p>Sample<strong>words</strong></p>more')
    expect(await cleanLetterHtml('<p><strong>Sample<svg>words</p>more')).toBe('<p><strong>Sample</strong></p>more')
    expect(await cleanLetterHtml('<ul><li>Sample<template>words</ul>more')).toBe('<ul><li>Sample</li></ul>more')
    expect(await cleanLetterHtml('<h1>Sample<h4>heading</h1>more')).toBe('<h2>Sample<h3>heading</h3></h2>more')
  })

  it('makes what it keeps safe, and a second cleaning changes none of it', async () => {
    const broken = [
      '<p>Sample<strong>words<p>more',
      '<ul><li>Sample one<li>Sample two</ul>',
      '<h2>Sample<h3>heading</h2>',
      '<p>Sample</p><svg/><math/><p>words</p>',
      '<p><a href="https://example.org/sample"><a href="https://example.org/sample">Sample</a></a></p>',
      '<p onclick=alert(1) <img src=x onerror=alert(1)>>Sample</p>',
      '<p>Sample</p><image src=x onerror=alert(1)>',
    ]
    for (const letter of broken) {
      const once = await cleanLetterHtml(letter)
      expect(once, letter).not.toBeNull()
      expect(await cleanLetterHtml(once!), letter).toBe(once)
      noneOfIt(once)
    }
  })
})

describe('null, and every way to it', () => {
  it('1. a value that is not a string', async () => {
    for (const value of [undefined, null, 42, {}, ['<p>Sample</p>']]) expect(await cleanLetterHtml(value as unknown as string)).toBeNull()
  })

  it.each([
    ['a tag', '<p>Sample</p><p'],
    ['an attribute', '<p>Sample</p><p title="Sample'],
    ['an attribute with no quote', '<p>Sample</p><p title=Sample'],
    ['an end tag', '<p>Sample</p></p'],
    ['a "</"', '<p>Sample</p></'],
    ['a comment', '<p>Sample</p><!-- Sample'],
    ['a doctype', '<p>Sample</p><!DOCTYPE html'],
    ['a bogus comment', '<p>Sample</p><?sample'],
    ['an unclosed textarea', '<p>Sample</p><textarea>Sample words'],
    ['an unclosed title', '<p>Sample</p><title>Sample words'],
    ['an unclosed style', '<p>Sample</p><style>p {}'],
    ['an unclosed script', '<p>Sample</p><script>alert(1)'],
    ['plaintext anywhere', '<plaintext><p>Sample</p>'],
    ['an unclosed template', '<p>Sample</p><template><p>Sample words</p>'],
    ['an unclosed svg', '<p>Sample</p><svg><p>Sample words</p>'],
    ['an unclosed math', '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'],
    ['an unclosed object', '<p>Sample</p><object><p>Sample words</p>'],
  ])('2. a letter that ends inside %s', async (_name, letter) => {
    expect(await cleanLetterHtml(letter)).toBeNull()
  })

  it('3. a letter whose cleaning a second cleaning would change, one pass leaving a live img: the second pass refuses it, and the own-form check alone does too', async () => {
    for (const letter of ['<<span>img src=x onerror=alert(1)>', '<<!-- -->img src=x onerror=alert(1)>', '<<script></script>img src=x onerror=alert(1)>']) {
      expect(await cleanLetterHtml(letter), letter).toBeNull()
    }
  })

  it.each([
    ['an end tag that closes nothing', '<p>Sample</p></div>'],
    ['a kept end tag that closes nothing', '<p>Sample</p></p></strong>'],
    ['an end tag that carries attributes and closes nothing', '<p>Sample</p></p onclick="alert(1)"></a href="javascript:alert(1)">'],
    ['a line break written as an end tag', '<p>Sample</br>words</p>'],
    ['an end tag left over from tags closed out of order', '<p><em><strong>Sample</em>words</strong></p>'],
    ['a doctype', '<!DOCTYPE html><p>Sample</p>'],
    ['a "<" as its last character', '<p>Sample</p><'],
    ['an end tag that closes the frame of an old cleaner', '<p>Sample</p></div><img src=x onerror=alert(1)><div><p>words</p>'],
  ])('4. a letter not in the cleaner\'s own form: %s', async (_name, letter) => {
    expect(await cleanLetterHtml(letter)).toBeNull()
  })

  it('5. a letter the runtime\'s rewriter fails on: tags nested a hundred thousand deep', async () => {
    const deep = `${'<em>'.repeat(100000)}Sample`
    await expect(
      new HTMLRewriter()
        .on('*', {
          element(el) {
            el.onEndTag(() => {})
          },
        })
        .transform(new Response(deep, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
        .text(),
    ).rejects.toThrow(/memory limit/i)
    expect(await cleanLetterHtml(deep)).toBeNull()
  })

  it('5. and any other failure of the rewriter: null, never a throw', async () => {
    vi.stubGlobal('HTMLRewriter', class {
      on(): never {
        throw new Error('Sample failure')
      }
    })
    await expect(cleanLetterHtml('<p>Sample</p>')).resolves.toBeNull()
  })
})

describe('the anchors and the cap', () => {
  it('the anchors withAnchors adds to a cleaned letter are what the cleaner takes out again, and nothing else', async () => {
    const letter = (await cleanLetterHtml('<h2>Results</h2><p>Sample</p><h2>Results</h2><h2></h2><h2>Results 2</h2><p>words</p>'))!
    const anchored = withAnchors(letter, letterParts(letter))
    expect(anchored.match(/<a name="[^"]*"><\/a>/g)).toEqual(['<a name="results"></a>', '<a name="results-2"></a>', '<a name="results-2-2"></a>'])
    expect(await cleanLetterHtml(anchored)).toBe(letter)
  })

  it('a letter over LETTER_MAX_BYTES is cleaned, not refused: refusing it is the caller\'s', async () => {
    const letter = `<p>${'Sample words. '.repeat(6000)}</p>`
    expect(bytes(letter)).toBeGreaterThan(LETTER_MAX_BYTES)
    expect(await cleanLetterHtml(letter)).toBe(letter)
  })

  it('a cleaned letter can be longer than what went in, so the caller holds the cap on the cleaned letter', async () => {
    // Each kept tag left open gets its end tag: 4,000 bytes clean to 9,000.
    const open = '<li>'.repeat(1000)
    const cleanedOpen = (await cleanLetterHtml(open))!
    expect(cleanedOpen).toBe(`${open}${'</li>'.repeat(1000)}`)
    expect([bytes(open), bytes(cleanedOpen)]).toEqual([4000, 9000])
    // So a letter under the cap can clean to one over it, here 70,500 bytes to 135,000.
    const under = `<i>${'<li>'.repeat(10)}</i>`.repeat(1500)
    const cleanedUnder = (await cleanLetterHtml(under))!
    expect(bytes(under)).toBeLessThan(LETTER_MAX_BYTES)
    expect(bytes(cleanedUnder)).toBeGreaterThan(LETTER_MAX_BYTES)
    expect([bytes(under), bytes(cleanedUnder)]).toEqual([70500, 135000])
    // And an address written without quotes gets them.
    expect(await cleanLetterHtml('<a href=https://example.org/sample>Sample</a>')).toBe('<a href="https://example.org/sample">Sample</a>')
  })
})

/** The tags a cleaned letter may hold. Two attributes alone may come with them: a link's address and a numbered list's start. */
const LETTER_TAGS = new Set(['p', 'br', 'strong', 'em', 'h2', 'h3', 'ul', 'ol', 'li', 'hr', 'a'])

/**
 * A second read of a cleaned letter placed inside an email's cell, with the runtime's tokenizer, the same one the
 * cleaner runs on: every tag and every attribute it sees. No mail program reads an email with it; with the count of
 * tags below, it shows that no tag was made out of text.
 */
async function readBack(cleaned: string): Promise<{ tags: string[]; attributes: [string, string, string][]; comments: number }> {
  const tags: string[] = []
  const attributes: [string, string, string][] = []
  let comments = 0
  await new HTMLRewriter()
    .on('*', {
      element(el) {
        tags.push(el.tagName)
        for (const [name, value] of el.attributes) attributes.push([el.tagName, name, value])
      },
    })
    .onDocument({
      comments() {
        comments += 1
      },
    })
    .transform(new Response(`<table><tr><td>${cleaned}</td></tr></table>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    .text()
  return { tags, attributes, comments }
}

/** A cleaned letter is null, or safe in every way the tests can read: its own form, only kept tags, only safe links, and left alone by a second cleaning. */
async function expectNullOrSafe(letter: string): Promise<string | null> {
  const out = await cleanLetterHtml(letter)
  if (out === null) return null
  expect(await cleanLetterHtml(out), letter).toBe(out)
  const back = await readBack(out)
  expect(back.tags.filter((tag) => tag !== 'table' && tag !== 'tr' && tag !== 'td' && !LETTER_TAGS.has(tag)), letter).toEqual([])
  expect(back.comments, letter).toBe(0)
  for (const [tag, name, value] of back.attributes) {
    if (tag === 'table' || tag === 'tr' || tag === 'td') continue
    if (tag === 'ol') {
      expect(name, letter).toBe('start')
      expect(value, letter).toMatch(/^[1-9][0-9]{0,3}$/)
      continue
    }
    expect([tag, name], letter).toEqual(['a', 'href'])
    expect(value, letter).toMatch(/^(?:https?:\/\/|mailto:)[^"'<>`\s]*$/i)
  }
  // The tags the parser reads are exactly the tags the cleaner wrote: none made out of text.
  expect(back.tags.length - 3, letter).toBe((out.match(/<[a-z0-9]+(?: (?:href|start)="[^"]*")?>/g) ?? []).length)
  return out
}

describe('hostile letters', () => {
  const vectors: [string, string][] = [
    ['an img with a slash for a space', '<img/src=x/onerror=alert(1)>'],
    ['an img in capitals', '<IMG SRC=x ONERROR=alert(1)>'],
    ['an img with a quote left open', '<img src="x onerror=alert(1)>'],
    ['an img made by a null character in the name', '<im\u0000g src=x onerror=alert(1)>'],
    ['a script made by a null character in the name', '<scr\u0000ipt>alert(1)</scr\u0000ipt>'],
    ['a script split by another script', '<scr<script></script>ipt>alert(1)</script>'],
    ['a script closed with a space and attributes', '<script>alert(1)</script foo="bar" >'],
    ['an svg with an onload', '<svg onload=alert(1)>'],
    ['an svg with an animate', '<svg><animate onbegin=alert(1) attributeName=x dur=1s>'],
    ['a math with a link', '<math><mtext><a xlink:href="javascript:alert(1)">Sample</a></mtext></math>'],
    ['a style inside a noscript', '<noscript><style></noscript><img src=x onerror=alert(1)></style></noscript>'],
    ['a title that holds an end tag in its text', '<title></title><img src=x onerror=alert(1)></title>'],
    ['a textarea closed by a space and an attribute', '<textarea></textarea x=y><img src=x onerror=alert(1)>'],
    ['a template inside a textarea', '<textarea><template><img src=x onerror=alert(1)></template></textarea>'],
    ['an xmp inside a template', '<template><xmp></template><img src=x onerror=alert(1)></xmp></template>'],
    ['a form with a button and a formaction', '<form><button formaction="javascript:alert(1)">Sample</button></form>'],
    ['a base tag', '<base href="https://example.org/"><p>Sample</p>'],
    ['a meta refresh', '<meta http-equiv="refresh" content="0;url=https://example.org/"><p>Sample</p>'],
    ['a link tag to a stylesheet', '<link rel="stylesheet" href="https://example.org/sample.css"><p>Sample</p>'],
    ['a body with an onload', '<body onload=alert(1)><p>Sample</p>'],
    ['a details with an ontoggle', '<details open ontoggle=alert(1)>Sample</details>'],
    ['a video with an onerror', '<video><source onerror=alert(1)></video>'],
    ['a marquee', '<marquee onstart=alert(1)>Sample</marquee>'],
    ['an anchor with an href in a second attribute', '<a title=x href="javascript:alert(1)">Sample</a>'],
    ['an anchor with two hrefs, the first a script', '<a href="javascript:alert(1)" href="https://example.org/sample">Sample</a>'],
    ['an anchor with two hrefs, the second a script', '<a href="https://example.org/sample" href="javascript:alert(1)">Sample</a>'],
    ['an anchor with no quotes round a long address', '<a href=https://example.org/sample onclick=alert(1)>Sample</a>'],
    ['an anchor whose address starts with a newline and a script scheme', '<a href="\njavascript:alert(1)">Sample</a>'],
    ['an anchor whose scheme is split by a tab', '<a href="java\tscript:alert(1)">Sample</a>'],
    ['an anchor whose scheme is split by a null character', '<a href="java\u0000script:alert(1)">Sample</a>'],
    ['an anchor to https with a script scheme after it', '<a href="https://example.org/sample javascript:alert(1)">Sample</a>'],
    ['an anchor to a mailto with a quote written by reference', '<a href="mailto:player.one@example.org?subject=x&quot; onclick=&quot;y">Sample</a>'],
    ['an anchor to an address with a double-encoded quote', '<a href="https://example.org/sample&amp;quot;onclick=alert(1)">Sample</a>'],
    ['an anchor inside a heading', '<h2><a href="javascript:alert(1)">Sample</a></h2>'],
    ['a list start beside an onclick', '<ol start="4" onclick="alert(1)"><li>Sample</li></ol>'],
    ['a list start that holds a quote and an onclick', `<ol start='4" onclick="alert(1)'><li>Sample</li></ol>`],
    ['a list start that holds an img', '<ol start="4><img src=x onerror=alert(1)>"><li>Sample</li></ol>'],
    ['an end tag inside a comment', '<!-- </p><img src=x onerror=alert(1)> -->'],
    ['a comment that ends late', '<!----!><img src=x onerror=alert(1)>-->'],
    ['a comment with a conditional', '<!--[if gte mso 9]><xml></xml><![endif]--><p>Sample</p>'],
    ['a cdata section', '<![CDATA[<img src=x onerror=alert(1)>]]>'],
    ['an img inside a cdata in an svg', '<svg><![CDATA[<img src=x onerror=alert(1)>]]></svg>'],
    ['a lone angle bracket before an img written by reference', '&lt;img src=x onerror=alert(1)&gt;'],
    ['a lone angle bracket before a tag that is removed', '<<em>img src=x onerror=alert(1)>'],
    ['a lone angle bracket before a tag removed with its words', '<<style></style>img src=x onerror=alert(1)>'],
    ['a lone angle bracket before a removed tag with an attribute', '<<b class="x">img src=x onerror=alert(1)>'],
    ['a lone angle bracket then a comment then a tag name', '<<!--x-->script>alert(1)</script>'],
    ['two lone angle brackets', '<<<span></span>img src=x onerror=alert(1)>'],
    ['a lone angle bracket before a slash', '<<span></span>/p><img src=x onerror=alert(1)>'],
    ['a lone angle bracket before an exclamation mark', '<<span></span>!-- --><img src=x onerror=alert(1)>'],
    ['an end tag of a tag that was never opened, then an img', '</span><img src=x onerror=alert(1)>'],
    ['a tag with a "<" inside an attribute value', '<p title="<img src=x onerror=alert(1)>">Sample</p>'],
    ['a tag with an unquoted "<" attribute', '<p <img src=x onerror=alert(1)>Sample</p>'],
    ['a unicode line separator in an address', '<a href="https://example.org/sample\u2028onclick=alert(1)">Sample</a>'],
    ['a byte order mark before a tag', '\ufeff<img src=x onerror=alert(1)>'],
    ['full-width angle brackets', '\uff1cimg src=x onerror=alert(1)\uff1e'],
  ]

  it.each(vectors)('%s: the letter is null, or safe in everything the runtime\'s parser reads back', async (_name, letter) => {
    const out = await expectNullOrSafe(letter)
    // Words of a vector may stay as inert text; what may not stay is a tag that is not the letter's, which the read-back also checks.
    expect(out ?? '').not.toMatch(/<(?:img|script|svg|style|base|meta|link|form|button|iframe|object|embed|math|template|textarea|title|noscript|xmp)\b/i)
  })

  it('a vector among words keeps the words and none of the vector', async () => {
    const out = await cleanLetterHtml('<p>Sample before</p><IMG SRC=x ONERROR=alert(1)><p>Sample after</p>')
    expect(out).toBe('<p>Sample before</p><p>Sample after</p>')
  })

  it('every letter of a seeded run of random markup is null or safe, and the cleaner never throws', async () => {
    // A fixed seed, so a failing letter is the same on every run and its text is in the message.
    let state = 0x2f6e2b1
    const random = (n: number): number => {
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n)
    }
    const pieces = [
      '<', '>', '</', '/>', '<p>', '</p>', '<strong>', '</strong>', '<em>', '</em>', '<h2>', '</h2>', '<h3>', '</h3>', '<ul>', '</ul>', '<li>',
      '</li>', '<ol>', '<ol start="4">', '<ol start="4x">', '</ol>', '<br>', '<hr>', '<a href="https://example.org/sample">', '<a href="javascript:alert(1)">',
      '<a href=\'https://x" onclick="y\'>', '<a>', '</a>',
      '<img src=x onerror=alert(1)>', '<script>', '</script>', '<style>', '</style>', '<textarea>', '</textarea>', '<title>', '</title>',
      '<noscript>', '</noscript>', '<xmp>', '</xmp>', '<noembed>', '</noembed>', '<noframes>', '</noframes>', '<template>', '</template>',
      '<svg>', '</svg>', '<math>', '</math>', '<iframe>', '</iframe>', '<object>', '</object>', '<span>', '</span>', '<div>', '</div>', '<b>',
      '</b>', '<h1>', '</h1>', '<h4>', '</h4>', '<!--', '-->', '<!', '<?', '"', "'", '=', ' ', '\n', '&amp;', '&lt;', '&quot;', '&#60;',
      'onerror=alert(1)', 'Sample words', 'x', '\u0000', '\u00a0', '\u{1F600}',
    ]
    let answered = 0
    for (let n = 0; n < 4000; n += 1) {
      const length = 1 + random(14)
      let letter = ''
      for (let i = 0; i < length; i += 1) letter += pieces[random(pieces.length)]
      const out = await expectNullOrSafe(letter)
      if (out === null) continue
      answered += 1
      // The anchors the layout adds are the one markup the cleaner takes out again, and never anything of the letter's.
      const anchored = withAnchors(out, letterParts(out))
      expect(await cleanLetterHtml(anchored), letter).toBe(out)
      expect(anchored.replace(/<a name="[a-z][a-z0-9]*(?:-[a-z0-9]+)*"><\/a>/g, ''), letter).toBe(out)
    }
    // The run is not empty of answers: most letters are cleaned, and the rest are null.
    expect(answered).toBeGreaterThan(200)
    expect(answered).toBeLessThan(4000)
  })
})
