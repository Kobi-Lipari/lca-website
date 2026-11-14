// test/unit/mail-newsletter-layout.test.ts
//
// The newsletter's email in the navy look, renderNewsletter in
// domain/mail/newsletterLayout.ts (WS16 part two, page step 2), board
// Newsletter-Email-6. Pinned here: the bytes of the board's own made-up
// issue, held in test/unit/fixtures/newsletter-navy.html, which holds the
// function's output alone, with no head comment of its own; the head and
// the tables an email needs; the one table more that holds the email's
// width in Outlook on Windows; one style block holding only the dark
// colours and the narrow-screen rules; every pair of words and ground at
// 4.5 to 1 or better with that block taken out and with its dark colours,
// computed here; gold as words on the navy alone in light and on a dark
// ground alone in dark; the band's one h1 and the outline under it; the
// strip made from letterParts, in the board's order, each link to its
// part's anchor, and left out under two parts; the letter's words byte for
// byte, its anchors as withAnchors writes them, a rule over each part's
// heading alone, and a style only on the tags that need one; the footer
// builder's bytes unchanged, then the follow line, then nothing, and no
// postal address; month, subject, preheader and the site's address escaped;
// the size of a plain letter at the cap and the layout's own cost for each
// tag; and the rook image. The footer is built by the server's real builder
// for a made-up person at example.org. Every sample word is the board's own
// made-up issue or plainly made up (K's decision 39). Nothing here makes a
// request.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { NEWSLETTER_FOLLOW_LINE } from '../../domain/mail/footer'
import { defaultSubject, LETTER_MAX_BYTES, letterParts, monthLabel, STARTERS, withAnchors } from '../../domain/mail/letter'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { EMAIL_MAX_BYTES, renderNewsletter, type NewsletterEmail } from '../../domain/mail/newsletterLayout'
import { listMailParts } from '../../functions/utils/mail/footer'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const bytes = (text: string) => Buffer.byteLength(text, 'utf8')

const FIXTURE = 'test/unit/fixtures/newsletter-navy.html'
/** The most the rook image may weigh. */
const ROOK_MAX_BYTES = 2000

/** A made-up site, a made-up key for the links signed here and a made-up person, used nowhere else. */
const SITE = 'https://www.example.org'
const KEY = 'unit-test-made-up-newsletter-key-7340'
const PERSON = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

/** The board's own made-up issue, in the cleaner's own form: its links at example.org, its bold as the editor's strong. */
const ISSUE = [
  '<h2>A note from the president</h2>',
  '<p>Dear members,</p>',
  '<p>Thank you for a great year of chess in Louisiana, and to every volunteer who made it happen.</p>',
  '<p>The new year brings more chances to play, to learn and to meet new people at the board.</p>',
  `<p>One ask: please <a href="${SITE}/membership">renew your membership</a>, and bring one new player to a club night.</p>`,
  '<p>See you over the board,<br>LCA President</p>',
  '<h2>Coming up</h2>',
  `<p>Sat,&nbsp;Jan&nbsp;9,&nbsp;2027 · Sample Winter Open · Sample&nbsp;City · <a href="${SITE}/events/sample-winter-open">Register on King Registration ↗</a></p>`,
  `<p>Sat to Sun, Feb&nbsp;6&nbsp;to&nbsp;7,&nbsp;2027 · Example Memorial · Anytown · run by Example Chess Club · <a href="${SITE}/events/example-memorial">Registers on the organizer's site ↗</a></p>`,
  `<p>Sat,&nbsp;May&nbsp;8,&nbsp;2027 · Sample Spring Scholastic · Sample&nbsp;City · <a href="${SITE}/events/sample-spring-scholastic">Details on King Registration ↗</a></p>`,
  '<h2>Results</h2>',
  `<p><strong>Player One wins the Sample Fall Open</strong> with 4½&nbsp;of&nbsp;5 in Sample&nbsp;City, Sat to Sun, Nov&nbsp;7&nbsp;to&nbsp;8,&nbsp;2026, among 40 players. Section winners: Open&nbsp;Player&nbsp;One&nbsp;4½&nbsp;· U1800&nbsp;Player&nbsp;Two&nbsp;4½&nbsp;· U1400&nbsp;Player&nbsp;Three and Player&nbsp;Four&nbsp;4,&nbsp;tied&nbsp;· U1000&nbsp;Player&nbsp;Five&nbsp;4½. <a href="${SITE}/results/sample-fall-open">Full results ↗</a></p>`,
  '<h2>From the clubs</h2>',
  `<p>Example Chess Club: quick-rated nights on first Mondays, next Mon,&nbsp;Dec&nbsp;7,&nbsp;2026 at 6:00&nbsp;PM. <a href="${SITE}/clubs/example-chess-club">Club page</a></p>`,
  `<p>Sample City Chess Club: Tuesdays, 4:00&nbsp;PM to 6:00&nbsp;PM, at the library. All ages, free to join. <a href="${SITE}/clubs/sample-city-chess-club">Club page</a></p>`,
  `<p>Anytown Chess Club: casual nights on Wednesdays. <a href="${SITE}/clubs/anytown-chess-club">Club page</a></p>`,
  '<h2>Scholastic</h2>',
  `<p>For parents: the Sample Youth Chess season began Sat,&nbsp;Nov&nbsp;14,&nbsp;2026, one Saturday a month to May.<br>Players need a US Chess membership. <a href="${SITE}/scholastic">Scholastic page</a></p>`,
  '<h2>Board business</h2>',
  `<p>An example item: one board seat is open; reply to this email if you would like to help. Draft minutes of the last board meeting are posted for members' comments. <a href="${SITE}/minutes/draft">Read the draft minutes</a></p>`,
].join('')

/** A letter holding every tag the cleaner keeps that the board does not draw, in the cleaner's own form. */
const TAGS = [
  '<h2>Sample heading one</h2>',
  `<p>Sample words with <strong>Player One</strong>, <em>Player Two</em> and a <a href="${SITE}/sample?a=1&amp;b=2">sample link</a>.<br>A second sample line.</p>`,
  '<h3>Sample smaller heading</h3>',
  '<ul><li><p>Sample item</p></li><li><p>Another sample item</p></li></ul>',
  '<hr>',
  '<h2>Sample heading two &amp; more</h2>',
  '<ol start="4"><li><p>Player Four</p></li><li><p>Player Five</p></li></ol>',
  '<ol><li><p>Player One</p></li></ol>',
  '<p>Sample sums: 4 &lt; 5, 4 < 5 and 6 > 5.</p>',
  '<h3>Another sample heading</h3>',
  '<p>Sample words, <a href="mailto:player.one@example.org">Player One</a>.</p>',
].join('')

const MONTH = monthLabel(2026, 12)
const PREVIEW = "Sample preview line: the president's note, what is coming up and the results."

/** The footer the server's real builder gives a made-up person on the newsletter. */
async function footer(site = SITE): Promise<string> {
  return (await listMailParts({ SITE_URL: site, MAIL_LINK_SECRET: KEY }, { contactId: PERSON, listId: NEWSLETTER_LIST_ID })).footerHtml
}

/** The fixture's input, with a part of it changed. */
async function issue(changes: Partial<NewsletterEmail> = {}): Promise<NewsletterEmail> {
  return { siteUrl: SITE, month: MONTH, subject: defaultSubject(MONTH), preheader: PREVIEW, bodyHtml: ISSUE, footerHtml: await footer(), ...changes }
}

const parse = (html: string) => new JSDOM(html).window.document

/** One declaration of an inline style, or undefined. */
function declared(style: string | null, name: string): string | undefined {
  return new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style ?? '')?.[1].trim()
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The style block's rules of one media query, each a selector and its declarations, "!important" set aside. */
function rulesOf(html: string, query: string): { selector: string; set: Record<string, string> }[] {
  const block = /<style>\n([\s\S]*?)\n<\/style>/.exec(html)?.[1] ?? ''
  const start = block.indexOf(`@media ${query} {\n`)
  if (start === -1) return []
  const body = block.slice(start + `@media ${query} {\n`.length, block.indexOf('\n}', start))
  return body.split('\n').map((line) => {
    const [, selector, declarations] = /^(.+?)\{(.+)\}$/.exec(line) ?? ['', line, '']
    const set: Record<string, string> = {}
    for (const part of declarations.split(';')) {
      const at = part.indexOf(':')
      if (at > 0) set[part.slice(0, at).trim()] = part.slice(at + 1).replace('!important', '').trim()
    }
    return { selector, set }
  })
}

/**
 * Every pair of words' colour and ground the email shows, with the words of each: a text node's colour is the nearest
 * colour set on it or round it, and its ground the nearest ground. With dark rules, a rule that matches an element
 * wins over the element's inline style, as each is important. Words hidden from view, the preheader's, are left out.
 */
function pairs(html: string, darkRules: ReturnType<typeof rulesOf> = []): Map<string, string[]> {
  const doc = parse(html)
  const own = (el: Element, property: string) => {
    let found: string | undefined
    for (const rule of darkRules) if (rule.set[property] && el.matches(rule.selector)) found = rule.set[property]
    return found ?? declared(el.getAttribute('style'), property)
  }
  const nearest = (from: Element, property: string) => {
    for (let el: Element | null = from; el; el = el.parentElement) {
      const value = own(el, property)
      if (value) return value
    }
    return undefined
  }
  const found = new Map<string, string[]>()
  const walker = doc.createTreeWalker(doc.body, 4)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const words = (node.textContent ?? '').trim()
    const parent = node.parentElement
    if (!words || !parent) continue
    let hidden = false
    for (let el: Element | null = parent; el; el = el.parentElement) if (declared(el.getAttribute('style'), 'display') === 'none') hidden = true
    if (hidden) continue
    const key = `${nearest(parent, 'color')} on ${nearest(parent, 'background-color')}`
    found.set(key, [...(found.get(key) ?? []), words])
  }
  return found
}

/** The letter's cell, as its bytes. */
function letterCell(html: string): string {
  return /<td class="nl-letter" style="[^"]*">([\s\S]*?)<\/td><\/tr>\n<tr><td class="nl-foot"/.exec(html)?.[1] ?? 'not found'
}

/** Words alone: every tag gone, and a "<" that starts no tag, as in "4 < 5", left as words. */
const withoutTags = (html: string) => html.replace(/<\/?[A-Za-z][^>]*>/g, '')

describe('the navy email for the board\'s made-up issue', () => {
  it('is test/unit/fixtures/newsletter-navy.html byte for byte, the file holding the email alone', async () => {
    const email = renderNewsletter(await issue())
    const file = readFileSync(join(ROOT, FIXTURE))
    expect(bytes(email)).toBe(file.length)
    expect(email).toBe(file.toString('utf8'))
  })

  it('is the same on every call with the same input, and reads nothing but its arguments', async () => {
    const input = await issue()
    expect(renderNewsletter(input)).toBe(renderNewsletter({ ...input }))
    const code = read('domain/mail/newsletterLayout.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bDate\b|Math\.random|\bcrypto\b|\bprocess\b|globalThis|\bfetch\b|\bIntl\b|\bwindow\b|\bdocument\b/)
    const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]).sort()
    expect(imports).toEqual(['./footer', './letter'])
  })
})

describe('how the email is built', () => {
  it('carries lang="en", the character set, the viewport, the subject as its title and the two color-scheme metas', async () => {
    const email = renderNewsletter(await issue())
    expect(email.startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n')).toBe(true)
    expect(email).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">')
    expect(email).toContain('<meta name="color-scheme" content="light dark">')
    expect(email).toContain('<meta name="supported-color-schemes" content="light dark">')
    expect(parse(email).title).toBe('LCA Newsletter · December 2026')
  })

  it('lays itself out in tables that each carry role="presentation", 600 pixels wide at most', async () => {
    const email = renderNewsletter(await issue())
    // The page, the email, the band's rook and words, and the strip's two columns, as a mail app reads them.
    const tables = email.replace(/<!--[\s\S]*?-->/g, '').match(/<table[^>]*>/g) ?? []
    expect(tables.length).toBe(4)
    for (const table of tables) expect(table).toContain('role="presentation"')
    expect(email).toContain('max-width:600px;')
    expect(parse(email).querySelectorAll('table')).toHaveLength(4)
  })

  it('holds the email to 600 pixels in Outlook on Windows, which reads no largest width: one table for that program alone, inside two comments, round the email and nothing else', async () => {
    const email = renderNewsletter(await issue())
    const open = '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->'
    const close = '<!--[if mso]></td></tr></table><![endif]-->'
    // The email's only comments, the first just before the email's own table and the second just after its end.
    expect(email.match(/<!--[\s\S]*?-->/g)).toEqual([open, close])
    expect(email).toContain(`<td class="nl-outer" align="center" style="padding:32px 12px 36px;">\n${open}\n<table role="presentation" class="nl-card" `)
    expect(email.endsWith(`</td></tr>\n</table>\n${close}\n</td></tr>\n</table>\n</body>\n</html>`)).toBe(true)
    // What Outlook reads: the comments' marks taken away, the tables still pair up and each carries the role.
    const outlook = email.replace(/<!--\[if mso\]>|<!\[endif\]-->/g, '')
    expect(outlook.match(/<table[^>]*>/g)).toHaveLength(5)
    expect(outlook.match(/<\/table>/g)).toHaveLength(5)
    for (const table of outlook.match(/<table[^>]*>/g) ?? []) expect(table).toContain('role="presentation"')
    expect(parse(outlook).querySelector('table[width="600"] > tbody > tr > td > table.nl-card')).not.toBeNull()
    // A mail app that takes comments out draws the same email.
    expect(parse(email).body.textContent).toBe(parse(email.replace(/<!--[\s\S]*?-->/g, '')).body.textContent)
  })

  it('holds no script, form, web font or background image, and loads no file but the one rook image', async () => {
    const email = renderNewsletter(await issue())
    expect(email).not.toMatch(/<(?:script|form|input|button|select|textarea|link|iframe|object|embed|video|audio|source|svg|base)\b/i)
    expect(email).not.toMatch(/@import|@font-face|url\(|background-image|background:|srcset|\son\w+=/i)
    expect(email.match(/\ssrc=/g)).toHaveLength(1)
    expect(email.match(/<img /g)).toHaveLength(1)
    expect(email).toContain(`<img src="${SITE}/email-rook.png" `)
  })

  it('has one style block, holding only the dark colours and the narrow-screen rules', async () => {
    const email = renderNewsletter(await issue())
    expect(email.match(/<style>/g)).toHaveLength(1)
    const block = /<style>\n([\s\S]*?)\n<\/style>/.exec(email)?.[1] ?? ''
    const outside = block.replace(/@media \([^)]*\) \{\n[\s\S]*?\n\}/g, '').trim()
    expect(outside).toBe('')
    const queries = [...block.matchAll(/@media (\([^)]*\)) \{/g)].map((m) => m[1])
    expect(queries).toEqual(['(prefers-color-scheme: dark)', '(max-width: 480px)', '(max-width: 339px)'])
    const colours = ['color', 'background-color', 'border-color', 'border-top-color', 'border-bottom-color', 'border-top']
    for (const rule of rulesOf(email, '(prefers-color-scheme: dark)')) {
      for (const [property, value] of Object.entries(rule.set)) {
        expect(colours, `${rule.selector} ${property}`).toContain(property)
        expect(value, `${rule.selector} ${property}`).toMatch(/#[0-9a-f]{6}$/)
      }
    }
    const sizes = ['padding', 'padding-right', 'margin', 'margin-top', 'margin-bottom', 'width', 'height', 'font-size', 'line-height', 'letter-spacing', 'display', 'border']
    for (const query of ['(max-width: 480px)', '(max-width: 339px)']) {
      for (const rule of rulesOf(email, query)) for (const property of Object.keys(rule.set)) expect(sizes, `${rule.selector} ${property}`).toContain(property)
    }
  })

  it('reads in light with the style block taken out: every colour of words on its ground at 4.5 to 1 or better', async () => {
    const email = renderNewsletter(await issue()).replace(/<style>[\s\S]*?<\/style>\n/, '')
    expect(email).not.toContain('<style>')
    const found = pairs(email)
    expect([...found.keys()].sort()).toEqual([
      '#1a2744 on #f8f4e8', '#1a2744 on #ffffff', '#1f2a40 on #ffffff', '#3a3f4b on #f8f4e8', '#866a1e on #f8f4e8', '#efd98a on #1a2744', '#ffffff on #1a2744',
    ])
    for (const key of found.keys()) {
      const [colour, ground] = key.split(' on ')
      expect(contrast(colour, ground), key).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('reads in dark with the style block\'s colours: every colour of words on its ground at 4.5 to 1 or better, the footer builder\'s own ink among them', async () => {
    const email = renderNewsletter(await issue())
    const found = pairs(email, rulesOf(email, '(prefers-color-scheme: dark)'))
    expect([...found.keys()].sort()).toEqual([
      '#c4c7ce on #202328', '#c8a94a on #202328', '#c9d7f5 on #151719', '#c9d7f5 on #202328', '#e4e5e8 on #151719', '#efd98a on #1a2744', '#ffffff on #151719', '#ffffff on #1a2744',
    ])
    for (const key of found.keys()) {
      const [colour, ground] = key.split(' on ')
      expect(contrast(colour, ground), key).toBeGreaterThanOrEqual(4.5)
    }
    // The footer builder writes its own navy and grey inline; on the dark footer they would not read, so the block
    // sets its words and links over them.
    expect(contrast('#3a3f4b', '#202328')).toBeLessThan(4.5)
    expect(found.get('#c4c7ce on #202328')).toContain("You're getting the LCA newsletter because this address is on an LCA member's account.")
    expect(found.get('#c9d7f5 on #202328')).toEqual(expect.arrayContaining(['Unsubscribe from the LCA newsletter', 'Email preferences', 'LCA on Facebook']))
  })

  it('sets gold as words on the navy alone in light, with the strip\'s label in the dark bronze #866a1e on the cream, and in dark on a dark ground alone', async () => {
    const email = renderNewsletter(await issue())
    const light = pairs(email.replace(/<style>[\s\S]*?<\/style>\n/, ''))
    const dark = pairs(email, rulesOf(email, '(prefers-color-scheme: dark)'))
    for (const [key, words] of light) {
      if (/^#(?:c8a94a|efd98a) /.test(key)) expect(key, words.join(' | ')).toMatch(/ on #1a2744$/)
    }
    expect(light.get('#efd98a on #1a2744')).toEqual(['LCA Newsletter'])
    expect(light.get('#866a1e on #f8f4e8')).toEqual(['In this issue'])
    // Inline, the brand gold draws the band's rule alone and is never words; the band's own gold is the name's words.
    const inline = email.replace(/<style>[\s\S]*?<\/style>/, '')
    expect(inline.match(/[a-z-]+:[^;"]*#c8a94a/g)).toEqual(['border-bottom:3px solid #c8a94a'])
    expect(inline.match(/[a-z-]+:[^;"]*#efd98a/g)).toEqual(['color:#efd98a'])
    // In the dark, the label takes the site's dark gold ink on the strip's dark ground, as the site's own dark setting does.
    expect(dark.get('#c8a94a on #202328')).toEqual(['In this issue'])
    for (const key of dark.keys()) if (/^#(?:c8a94a|efd98a) /.test(key)) expect(luminance(key.split(' on ')[1]), key).toBeLessThan(0.05)
  })
})

describe('the band', () => {
  it('holds the email\'s one h1: "LCA Newsletter" in ordinary letters set in capitals by a style, then the month', async () => {
    const doc = parse(renderNewsletter(await issue()))
    const h1s = doc.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    const h1 = h1s[0]
    expect(h1.closest('td.nl-band')).not.toBeNull()
    // A screen reader says the name and the month; a mail app that drops the style still shows the name right.
    expect(h1.textContent).toBe('LCA Newsletter December 2026')
    const name = h1.querySelector('span')
    expect(name?.textContent).toBe('LCA Newsletter')
    expect(declared(name?.getAttribute('style') ?? '', 'text-transform')).toBe('uppercase')
    expect(declared(name?.getAttribute('style') ?? '', 'font-size')).toBe('17px')
    expect(declared(h1.getAttribute('style'), 'font-size')).toBe('36px')
    expect(declared(h1.closest('td.nl-band')?.getAttribute('style') ?? '', 'border-bottom')).toBe('3px solid #c8a94a')
  })

  it('draws the rook from the site at 52 pixels, alt "" and display block, so with images off the band still reads in words', async () => {
    const email = renderNewsletter(await issue())
    expect(email).toContain(`<img src="${SITE}/email-rook.png" width="52" height="52" alt="" style="display:block;border:0;">`)
    const band = parse(email).querySelector('td.nl-band')
    band?.querySelector('img')?.remove()
    expect(band?.textContent?.replace(/\s+/g, ' ').trim()).toBe('LCA Newsletter December 2026')
    // A site given with a trailing slash still loads the rook from the site's root.
    expect(renderNewsletter(await issue({ siteUrl: `${SITE}/` }))).toContain(`<img src="${SITE}/email-rook.png" `)
  })
})

describe('the "In this issue" strip', () => {
  /** The strip's two columns, as the parts' titles and the addresses of their links. */
  const columns = (email: string) =>
    [...parse(email).querySelectorAll('td.nl-col')].map((cell) => [...cell.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]))

  it('lists letterParts, down the first column and then the second as the board draws them, each link to its part\'s anchor', async () => {
    const email = renderNewsletter(await issue())
    const parts = letterParts(ISSUE)
    expect(parts.map((part) => part.title)).toEqual(STARTERS.monthly.headings)
    expect(columns(email)).toEqual([
      parts.slice(0, 3).map((part) => [part.title, `#${part.name}`]),
      parts.slice(3).map((part) => [part.title, `#${part.name}`]),
    ])
    for (const part of parts) expect(email.split(`<a name="${part.name}"></a>`), part.name).toHaveLength(2)
    // The first column takes the first half, rounded up.
    const headed = (count: number) => Array.from({ length: count }, (_, i) => `<h2>Sample heading ${i + 1}</h2><p>Sample words.</p>`).join('')
    for (const [count, split] of [[2, [1, 1]], [3, [2, 1]], [5, [3, 2]], [7, [4, 3]]] as const) {
      const cells = columns(renderNewsletter(await issue({ bodyHtml: headed(count) })))
      expect(cells.map((cell) => cell.length), String(count)).toEqual(split)
      expect(cells.flat().map(([title]) => title)).toEqual(letterParts(headed(count)).map((part) => part.title))
    }
  })

  it('is left out for a letter with one part, or none', async () => {
    for (const bodyHtml of ['<h2>Sample heading one</h2><p>Sample words.</p>', '<p>Sample words, with no heading.</p>', '<h2></h2><h2>Sample heading one</h2><p>Sample words.</p>', '']) {
      const email = renderNewsletter(await issue({ bodyHtml }))
      // The style block is the same for every email; the strip itself is not drawn.
      expect(email, bodyHtml).not.toContain('class="nl-toc"')
      expect(email, bodyHtml).not.toContain('In this issue')
      expect(email.replace(/<!--[\s\S]*?-->/g, '').match(/<table/g), bodyHtml).toHaveLength(3)
    }
  })

  it('reads "In this issue" in ordinary letters set in capitals by a style, writes each part\'s words as words, and keeps two columns on a phone and one under 340 pixels, each link 44 pixels tall', async () => {
    const email = renderNewsletter(await issue({ bodyHtml: '<h2>Sample &amp; &lt;b&gt;one&lt;/b&gt; "two"</h2><h2>Sample two</h2>' }))
    const label = parse(email).querySelector('td.nl-toc p')
    expect(label?.textContent).toBe('In this issue')
    expect(declared(label?.getAttribute('style') ?? '', 'text-transform')).toBe('uppercase')
    expect(email).toContain('>Sample &amp; &lt;b&gt;one&lt;/b&gt; &quot;two&quot;</a></li>')
    expect(columns(email)[0]).toEqual([['Sample & <b>one</b> "two"', '#sample-b-one-b-two']])
    const phone = rulesOf(email, '(max-width: 480px)')
    const rule = (selector: string) => phone.find((r) => r.selector === selector)?.set
    expect(rule('.nl-toc ul')?.['line-height']).toBe('22px')
    expect(rule('.nl-toc a')).toEqual({ display: 'inline-block', padding: '11px 0' })
    expect(rule('.nl-col')).toEqual({ width: 'auto' })
    expect(rulesOf(email, '(max-width: 339px)')).toEqual([{ selector: '.nl-col', set: { display: 'block', padding: '0' } }])
  })
})

describe('the letter', () => {
  it('keeps every word: the body\'s text, tags aside, is the letter\'s byte for byte', async () => {
    for (const bodyHtml of [ISSUE, TAGS]) {
      const cell = letterCell(renderNewsletter(await issue({ bodyHtml })))
      expect(withoutTags(cell)).toBe(withoutTags(bodyHtml))
    }
  })

  it('styles only the tags that need it: without the rules and the styles it adds, the body is withAnchors\'s letter byte for byte', async () => {
    for (const bodyHtml of [ISSUE, TAGS]) {
      const cell = letterCell(renderNewsletter(await issue({ bodyHtml })))
      expect(cell.replace(/<div[^>]*><\/div>/g, '').replace(/ (?:style|class)="[^"]*"/g, '')).toBe(withAnchors(bodyHtml, letterParts(bodyHtml)))
    }
    const cell = letterCell(renderNewsletter(await issue({ bodyHtml: TAGS })))
    // Paragraphs, lists, a list's start, a line break, bold and italic keep their bare tags and take the cell's type.
    for (const bare of ['<p>', '<ul>', '<li>', '<ol start="4">', '<ol>', '<br>', '<strong>', '<em>']) expect(cell, bare).toContain(bare)
    const styled = [...cell.matchAll(/<(\w+)[^>]* style="[^"]*"/g)].map((m) => m[1])
    expect([...new Set(styled)].sort()).toEqual(['a', 'div', 'h2', 'h3', 'hr'])
    expect(cell).toContain('<hr style="margin:24px 0;border:0;border-top:1px solid #ebe3c9;">')
    expect(cell).toContain(`<a href="${SITE}/sample?a=1&amp;b=2" style="color:#1a2744;text-decoration:underline;">sample link</a>`)
  })

  it('leaves each part\'s anchor as withAnchors writes it, just before the part\'s rule and its heading', async () => {
    const email = renderNewsletter(await issue())
    const parts = letterParts(ISSUE)
    for (const [i, part] of parts.entries()) {
      const after = email.slice(email.indexOf(`<a name="${part.name}"></a>`) + `<a name="${part.name}"></a>`.length)
      const rule = i === 0 ? '<div class="nl-first" style="width:32px;height:3px;background-color:#866a1e;margin:16px 0 12px;"></div>' : '<div style="width:32px;height:3px;background-color:#866a1e;margin:34px 0 12px;"></div>'
      expect(after.startsWith(`${rule}<h2 style="`), part.name).toBe(true)
      expect(after).toMatch(new RegExp(`^<div[^>]*></div><h2 style="[^"]*">${part.title}</h2>`))
    }
    // A letter that opens with words before its first part gives that part the rule of any other.
    expect(renderNewsletter(await issue({ bodyHtml: `<p>Sample words.</p>${ISSUE}` }))).not.toContain('nl-first"')
  })

  it('keeps the outline: one h1, then the letter\'s own h2 and h3 as the cleaner writes them, no level skipped', async () => {
    for (const bodyHtml of [ISSUE, TAGS]) {
      const levels = [...parse(renderNewsletter(await issue({ bodyHtml }))).querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]))
      expect(levels[0]).toBe(1)
      expect(levels.filter((level) => level === 1)).toHaveLength(1)
      for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1], levels.join(',')).toBeLessThanOrEqual(1)
      expect(levels.slice(1)).toEqual([...bodyHtml.matchAll(/<h([23])>/g)].map((m) => Number(m[1])))
    }
  })

  it('underlines every link, so none is told by its colour alone', async () => {
    for (const bodyHtml of [ISSUE, TAGS]) {
      const links = [...parse(renderNewsletter(await issue({ bodyHtml }))).querySelectorAll('a[href]')]
      expect(links.length).toBeGreaterThan(3)
      for (const link of links) expect(declared(link.getAttribute('style'), 'text-decoration'), link.textContent ?? '').toBe('underline')
    }
  })
})

describe('the footer', () => {
  it('sets the footer builder\'s bytes in unchanged on the cream, then the follow line as its own paragraph, then nothing', async () => {
    const footerHtml = await footer()
    expect(footerHtml).toContain('</p>\n              <p style="margin:0 0 10px;font-size:12px;color:#3a3f4b;">')
    const email = renderNewsletter(await issue({ footerHtml }))
    expect(email.split(footerHtml)).toHaveLength(2)
    const at = email.indexOf(footerHtml)
    expect(email.slice(0, at)).toMatch(/<td class="nl-foot" style="[^"]*background-color:#f8f4e8;[^"]*">$/)
    const follow = `\n<p style="margin:0;font-size:12px;"><a href="${NEWSLETTER_FOLLOW_LINE.url}" style="color:#1a2744;text-decoration:underline;">${NEWSLETTER_FOLLOW_LINE.label}</a></p>`
    const after = email.slice(at + footerHtml.length)
    expect(after.startsWith(follow)).toBe(true)
    // After it, only end tags, with the end of Outlook's own table among them, written for that program alone.
    const ends = after.slice(follow.length)
    expect(ends.split('<!--[if mso]></td></tr></table><![endif]-->')).toHaveLength(2)
    expect(ends.replace('<!--[if mso]></td></tr></table><![endif]-->', '')).toMatch(/^(?:\s|<\/(?:td|tr|table|body|html)>)*$/)
    // The line today's layout writes under every email, the association's name with the site's, is not drawn.
    expect(email).not.toContain('Louisiana Chess Association')
    expect(email).not.toContain(`href="${SITE}"`)
  })

  it('draws the follow line from domain/mail/footer.ts: "LCA on Facebook", to the page the site\'s own footer links', () => {
    expect(NEWSLETTER_FOLLOW_LINE).toEqual({ label: 'LCA on Facebook', url: 'https://www.facebook.com/LouisianaChessAssociation' })
    expect(read('src/components/layout/Footer.tsx')).toContain(`href="${NEWSLETTER_FOLLOW_LINE.url}"`)
  })

  it('holds no postal address, and the email has no slot for one', async () => {
    const POSTAL = /\b(?:P\.?\s?O\.?\s+Box|box|street|st\.|avenue|ave\.|road|suite|postal|address line|zip)\b|\b\d{5}(?:-\d{4})?\b|\bLA\s+\d{5}\b/i
    const doc = parse(renderNewsletter(await issue({ bodyHtml: '' })))
    expect(doc.body.textContent).not.toMatch(POSTAL)
    const code = read('domain/mail/newsletterLayout.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(POSTAL)
    const fields = /export interface NewsletterEmail \{([\s\S]*?)\n\}/.exec(code)?.[1] ?? ''
    expect([...fields.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1])).toEqual(['siteUrl', 'month', 'subject', 'preheader', 'bodyHtml', 'footerHtml'])
  })

  // WS16 part two's page step 4 gives the layout its first reader outside domain/: the newsletter page's side preview,
  // which draws the email with it (K's decision 29). Nothing under functions/ or workers/ reads it yet.
  it('is read by the navy layout and the page\'s side preview alone: nothing else under src/, functions/ or workers/ imports the layout or reads the follow line yet', () => {
    const files = (dir: string): string[] =>
      readdirSync(join(ROOT, dir))
        .filter((name) => !name.startsWith('.') && name !== 'node_modules')
        .flatMap((name) => (statSync(join(ROOT, dir, name)).isDirectory() ? files(`${dir}/${name}`) : [`${dir}/${name}`]))
    const readers = ['src', 'functions', 'workers', 'domain']
      .flatMap(files)
      .filter((file) => /\.(?:ts|tsx)$/.test(file) && /newsletterLayout|NEWSLETTER_FOLLOW_LINE/.test(read(file)))
    expect(readers.sort()).toEqual(['domain/mail/footer.ts', 'domain/mail/newsletterLayout.ts', 'src/areas/admin/newsletter/SidePreview.tsx'])
  })
})

describe('escaping', () => {
  it('escapes month, subject and preheader for words and for an attribute, and the site\'s address in the rook\'s, so none of their markup comes out live', async () => {
    const markup = {
      month: 'December 2026 <img src=x onerror="alert(1)"> & \'more\'',
      subject: 'Sample </title><script>alert(1)</script> "subject"',
      preheader: 'Sample "><svg onload=alert(1)> preview & \'line\'',
      siteUrl: `${SITE}"><script>alert(1)</script><img src="x`,
    }
    const email = renderNewsletter(await issue(markup))
    const doc = parse(email)
    expect(doc.querySelectorAll('script, svg')).toHaveLength(0)
    expect(doc.querySelectorAll('img')).toHaveLength(1)
    for (const el of doc.querySelectorAll('*')) for (const name of el.getAttributeNames()) expect(name, el.tagName).not.toMatch(/^on/i)
    expect(doc.title).toBe(markup.subject)
    expect(doc.querySelector('h1')?.textContent).toBe(`LCA Newsletter ${markup.month}`)
    expect(doc.body.firstElementChild?.textContent).toBe(markup.preheader)
    expect(doc.querySelector('img')?.getAttribute('src')).toBe(`${markup.siteUrl}/email-rook.png`)
    expect(email).toContain('December 2026 &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;more&#39;</h1>')
    expect(email).toContain('<title>Sample &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; &quot;subject&quot;</title>')
    expect(email).toContain('<img src="https://www.example.org&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=&quot;x/email-rook.png" ')
  })

  it('writes the preheader first in the body, hidden from view, from Outlook too, and nothing for an empty or missing one', async () => {
    const email = renderNewsletter(await issue())
    expect(email).toContain(`<body class="nl-page" style="margin:0;padding:0;background-color:#f1efe8;">\n<div style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">Sample preview line: the president&#39;s note, what is coming up and the results.</div>\n<table `)
    for (const preheader of ['', undefined]) {
      const without = renderNewsletter(await issue({ preheader }))
      expect(without).toContain('<body class="nl-page" style="margin:0;padding:0;background-color:#f1efe8;">\n<table ')
      expect(without).not.toContain('display:none')
    }
  })
})

describe('the size', () => {
  it('holds an email to 102,000 bytes, after which Gmail cuts it', () => {
    expect(EMAIL_MAX_BYTES).toBe(102000)
  })

  it('renders a letter of LETTER_MAX_BYTES, the usual six headings and plain paragraphs, under EMAIL_MAX_BYTES', async () => {
    const paragraph = `<p>${'Sample words for this part of the letter, plainly made up. '.repeat(4).trim()}</p>`
    const each = Math.floor((LETTER_MAX_BYTES - 2000) / bytes(paragraph) / STARTERS.monthly.headings.length)
    let letter = STARTERS.monthly.headings.map((heading) => `<h2>${heading}</h2>${paragraph.repeat(each)}`).join('')
    letter += `<p>${'Sample closing words. '.repeat(200).slice(0, LETTER_MAX_BYTES - bytes(letter) - '<p></p>'.length)}</p>`
    expect(bytes(letter)).toBe(LETTER_MAX_BYTES)
    const preheader = 'Sample preview line, plainly made up, of about the length an inbox shows beside the subject, so the measure holds the line a sender would write.'
    expect(preheader.length).toBeGreaterThanOrEqual(140)
    const email = renderNewsletter(await issue({ bodyHtml: letter, preheader }))
    expect(letterParts(letter)).toHaveLength(6)
    expect(bytes(email)).toBeLessThan(EMAIL_MAX_BYTES)
  })

  it('adds known bytes: 3,941 round an empty letter, 49 for each link, 127 for each h3, 61 for each line, and for each part its rule, heading, anchor and line in the strip', async () => {
    const base = { ...(await issue()), preheader: undefined, footerHtml: '' }
    const size = (bodyHtml: string, preheader?: string) => bytes(renderNewsletter({ ...base, bodyHtml, preheader }))
    const empty = size('')
    expect(empty).toBe(3941)
    const added = (letter: string) => size(letter) - bytes(letter) - empty
    expect(added('<p><a href="https://www.example.org/sample">Sample</a></p>')).toBe(49)
    expect(added('<p>Sample</p><h3>Sample</h3>')).toBe(127)
    expect(added('<p>Sample</p><hr>')).toBe(61)
    // A part: its rule and its heading's style, 212 bytes, and its anchor, 15 bytes and its name.
    expect(added('<p>Sample</p><h2>Sample</h2>')).toBe(212 + 15 + 'sample'.length)
    // A part that opens the letter: 17 bytes more, its rule's class.
    expect(added('<h2>Sample</h2>')).toBe(212 + 15 + 'sample'.length + 17)
    // From two parts: the strip, 740 bytes, and its line for each part, 98 bytes, the part's name and its title as words.
    const titles = ['Sample one', 'Sample two & three', 'Sample four']
    const letter = titles.map((title) => `<h2>${title.replace('&', '&amp;')}</h2>`).join('')
    const parts = letterParts(letter)
    const lines = parts.reduce((sum, part) => sum + 212 + 15 + part.name.length + 98 + part.name.length + bytes(part.title.replace('&', '&amp;')), 0)
    expect(added(letter)).toBe(740 + 17 + lines)
    // The preheader: 124 bytes and its words.
    expect(size('', 'Sample') - empty).toBe(124 + 'Sample'.length)
  })
})

describe('the rook', () => {
  it('is a PNG twice the size the band shows it, on the band\'s navy with no see-through ground and no chunk but the image\'s own, under 2,000 bytes', async () => {
    const png = readFileSync(join(ROOT, 'public/email-rook.png'))
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(png.length).toBeLessThan(ROOK_MAX_BYTES)
    const chunks: { kind: string; data: Buffer }[] = []
    for (let at = 8; at < png.length; ) {
      const length = png.readUInt32BE(at)
      chunks.push({ kind: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) })
      at += 12 + length
    }
    expect(chunks.map((chunk) => chunk.kind)).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND'])
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)]
    const tag = /<img src="[^"]*\/email-rook\.png" width="(\d+)" height="(\d+)"/.exec(renderNewsletter(await issue()))
    expect([width, height]).toEqual([2 * Number(tag?.[1]), 2 * Number(tag?.[2])])
    expect([width, height]).toEqual([104, 104])
    // Eight bits a pixel, each an entry of the palette; the first row's first and last pixels are the band's navy.
    expect([png[24], png[25]]).toEqual([8, 3])
    const palette = chunks[1].data
    const colour = (index: number) => `#${[...palette.subarray(index * 3, index * 3 + 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const rows = inflateSync(chunks[2].data)
    expect(rows.length).toBe(height * (width + 1))
    // The first row, unfiltered: with no row above it, "up" adds nothing, "average" adds half the pixel to the left,
    // and "sub" and Paeth's filter add the pixel to the left.
    const kind = rows[0]
    const first: number[] = []
    for (let x = 0; x < width; x += 1) {
      const left = x > 0 ? first[x - 1] : 0
      const add = kind === 1 || kind === 4 ? left : kind === 3 ? left >> 1 : 0
      first.push((rows[1 + x] + add) & 0xff)
    }
    expect([colour(first[0]), colour(first[width - 1])]).toEqual(['#1a2744', '#1a2744'])
    expect([...Array(palette.length / 3).keys()].map(colour)).toContain('#ffffff')
  })
})

describe('the words and the file', () => {
  it('writes no words of its own but the band\'s name and month, the strip\'s label and its parts, and the follow line (K\'s decision 40)', async () => {
    const words = (email: string) => {
      const doc = parse(email)
      doc.querySelector('body > div')?.remove()
      const walker = doc.createTreeWalker(doc.body, 4)
      const found: string[] = []
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.textContent?.trim()) found.push(node.textContent.trim())
      return found
    }
    expect(words(renderNewsletter(await issue({ bodyHtml: '', footerHtml: '' })))).toEqual(['LCA Newsletter', 'December 2026', 'LCA on Facebook'])
    const headings = '<h2>Sample heading one</h2><h2>Sample heading two</h2>'
    expect(words(renderNewsletter(await issue({ bodyHtml: headings, footerHtml: '' })))).toEqual([
      'LCA Newsletter', 'December 2026', 'In this issue', 'Sample heading one', 'Sample heading two', 'Sample heading one', 'Sample heading two', 'LCA on Facebook',
    ])
  })

  it('keep K\'s plain-language rules in the layout, the fixture and this file: no em or en dash, no old initials for US Chess', () => {
    const oldInitials = new RegExp(`\\b${'US'}${'CF'}\\b`)
    for (const file of ['domain/mail/newsletterLayout.ts', FIXTURE, 'test/unit/mail-newsletter-layout.test.ts']) {
      expect(read(file), file).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
      expect(read(file), file).not.toMatch(oldInitials)
    }
  })

  it('hold only sample words that are the board\'s made-up issue or plainly made up (K\'s decision 39), every address at example.org but the follow line\'s', async () => {
    const email = renderNewsletter(await issue())
    const addresses = [...email.matchAll(/href="([^"#][^"]*)"/g)].map((m) => m[1])
    expect(addresses.length).toBeGreaterThan(10)
    for (const address of addresses) expect(address).toMatch(/^https:\/\/www\.example\.org\/|^https:\/\/www\.facebook\.com\/LouisianaChessAssociation$/)
    for (const name of ['Sample Winter Open', 'Example Memorial', 'Sample Spring Scholastic', 'Sample Fall Open', 'Example Chess Club', 'Sample City Chess Club', 'Anytown Chess Club', 'Sample Youth Chess']) {
      expect(ISSUE).toContain(name)
      expect(name).toMatch(/^(?:Sample|Example|Anytown)\b/)
    }
    const people = [...ISSUE.matchAll(/Player(?:&nbsp;| )(\w+)/g)].map((m) => m[1])
    expect(new Set(people)).toEqual(new Set(['One', 'Two', 'Three', 'Four', 'Five']))
  })
})

describe('edges of the letter, the footer and the site\'s address', () => {
  it('gives two parts with the same words their own anchors, and each strip link its own part\'s', async () => {
    const bodyHtml = '<h2>Results</h2><p>Sample words.</p><h2>Results</h2><p>More sample words.</p><h2>Results 2</h2><p>Last sample words.</p>'
    const email = renderNewsletter(await issue({ bodyHtml }))
    const names = letterParts(bodyHtml).map((part) => part.name)
    expect(new Set(names).size).toBe(3)
    expect([...parse(email).querySelectorAll('td.nl-col a')].map((a) => a.getAttribute('href'))).toEqual(names.map((name) => `#${name}`))
    for (const name of names) expect(email.split(`<a name="${name}"></a>`), name).toHaveLength(2)
  })

  it('draws a rule over a part\'s heading alone: a heading with no words, which the strip leaves out, is drawn bare, at the cost of its style alone', async () => {
    const bodyHtml = '<h2>Sample heading one</h2><p>Sample words.</p><h2></h2><h2><br></h2><h2>Sample heading two</h2>'
    const parts = letterParts(bodyHtml)
    expect(parts.map((part) => part.title)).toEqual(['Sample heading one', 'Sample heading two'])
    const cell = letterCell(renderNewsletter(await issue({ bodyHtml })))
    const rules = cell.match(/<div[^>]*><\/div>/g) ?? []
    expect(rules).toHaveLength(parts.length)
    expect(rules[0]).toContain('class="nl-first"')
    // Each rule stands between a part's anchor and its heading; the two headings with no words have none.
    expect(cell.match(/<a name="[a-z0-9-]+"><\/a><div[^>]*><\/div><h2 style="/g)).toHaveLength(parts.length)
    expect(cell.match(/<h2 style="/g)).toHaveLength(4)
    expect(cell).toContain('<p>Sample words.</p><h2 style="')
    // A letter that opens with a heading with no words draws it bare too, and its first part takes the rule of a part after words.
    const opening = letterCell(renderNewsletter(await issue({ bodyHtml: `<h2></h2>${bodyHtml}` })))
    expect(opening.startsWith('<h2 style="')).toBe(true)
    expect(opening.match(/<div[^>]*><\/div>/g)).toHaveLength(parts.length)
    expect(opening).not.toContain('nl-first')
    // What such a heading adds: its style, 126 bytes.
    const base = { ...(await issue()), preheader: undefined, footerHtml: '' }
    const size = (letter: string) => bytes(renderNewsletter({ ...base, bodyHtml: letter }))
    expect(size('<p>Sample</p><h2></h2>') - size('<p>Sample</p>') - bytes('<h2></h2>')).toBe(126)
  })

  it('writes a letter, a month and a footer holding "$&", "$1" and "$`" as they are, since none is read as a replacement', async () => {
    const bodyHtml = '<h2>Sample $& heading</h2><p>Sample $1 and $` and $$ words, <a href="https://www.example.org/a$&b">sample $& link</a>.</p><h3>Sample $\' heading</h3>'
    const footerHtml = '<p>Sample footer $& $1 $` $$ words.</p>'
    const email = renderNewsletter(await issue({ bodyHtml, footerHtml, month: 'Sample $& month' }))
    expect(withoutTags(letterCell(email))).toBe(withoutTags(bodyHtml))
    expect(letterCell(email)).toContain('<a href="https://www.example.org/a$&b" style="color:#1a2744;text-decoration:underline;">sample $& link</a>')
    expect(email).toContain(footerHtml)
    expect(parse(email).querySelector('h1')?.textContent).toBe('LCA Newsletter Sample $& month')
  })

  it('does not change what it was given, and draws a footer with markup of its own in as given, not one byte changed', async () => {
    const input = await issue({ footerHtml: '<p style="color:#3a3f4b;">Sample footer  with  double  spaces\n   and a break</p><p><a href="https://www.example.org/u?k=1&amp;j=2">Sample unsubscribe</a></p>' })
    const copy = { ...input }
    const email = renderNewsletter(input)
    expect(input).toEqual(copy)
    expect(email).toContain(input.footerHtml)
  })

  it('loads the rook from the site\'s root whatever slashes end the address it is given', async () => {
    for (const siteUrl of [SITE, `${SITE}/`, `${SITE}///`]) expect(renderNewsletter(await issue({ siteUrl })), siteUrl).toContain(`<img src="${SITE}/email-rook.png" `)
  })

  it('keeps each strip link 44 pixels tall on a phone: a 22 pixel line and 11 pixels above and below', async () => {
    const rule = rulesOf(renderNewsletter(await issue()), '(max-width: 480px)')
    const line = Number.parseInt(rule.find((r) => r.selector === '.nl-toc ul')?.set['line-height'] ?? '', 10)
    const padding = Number.parseInt(rule.find((r) => r.selector === '.nl-toc a')?.set.padding ?? '', 10)
    expect(line + 2 * padding).toBe(44)
  })
})

describe('the size at the cap, for each kind of letter', () => {
  /**
   * A letter of exactly LETTER_MAX_BYTES: the six usual headings, then one plain paragraph of filler holding `count`
   * of `unit` and filler for the rest, so a unit takes the bytes of filler its own bytes need and the letter stays at the cap.
   */
  async function atTheCap(unit: string, count: number): Promise<string> {
    const headings = STARTERS.monthly.headings.map((heading) => `<h2>${heading}</h2>`).join('')
    const fixed = bytes(headings) + '<p></p>'.length + bytes(unit) * count
    const letter = `${headings}<p>${unit.repeat(count)}${'Sample words. '.repeat(LETTER_MAX_BYTES / 14).slice(0, LETTER_MAX_BYTES - fixed)}</p>`
    expect(bytes(letter)).toBe(LETTER_MAX_BYTES)
    return letter
  }
  const size = async (letter: string) => bytes(renderNewsletter(await issue({ bodyHtml: letter })))

  it.each([
    ['a link', '<a href="https://www.example.org/x">y</a>', 49],
    ['a smaller heading', '<h3>y</h3>', 127],
    ['a line', '<hr>', 61],
  ] as const)('is the plain letter\'s size plus %s\'s bytes each, so the letters that pass are a known number of them', async (_kind, unit, each) => {
    const plain = await size(await atTheCap(unit, 0))
    expect(plain).toBeLessThan(EMAIL_MAX_BYTES)
    const most = Math.floor((EMAIL_MAX_BYTES - 1 - plain) / each)
    expect(most).toBeGreaterThan(10)
    // Each one adds exactly its bytes to an email whose letter stays at the cap; the last that passes and the first that does not.
    expect(await size(await atTheCap(unit, 10))).toBe(plain + 10 * each)
    expect(await size(await atTheCap(unit, most))).toBeLessThan(EMAIL_MAX_BYTES)
    expect(await size(await atTheCap(unit, most + 1))).toBeGreaterThanOrEqual(EMAIL_MAX_BYTES)
  })
})

describe('the plain-language rules in the fixture\'s words', () => {
  const fixture = () => withoutTags(read(FIXTURE).replace(/<style>[\s\S]*?<\/style>/, '')).replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ')

  it('writes a half as ½ and never as .5, and every time as "7:00 PM", never on a 24-hour clock', () => {
    const words = fixture()
    expect(words).toContain('4½')
    expect(words).not.toMatch(/\d\.5\b/)
    const times = [...words.matchAll(/\b(\d{1,2}):(\d{2})(?:\s?([AP]M)\b)?/g)]
    expect(times.length).toBeGreaterThan(0)
    for (const [time, , , meridiem] of times) expect(meridiem, time).toBeDefined()
    for (const [time, hour] of times) expect(Number(hour), time).toBeLessThanOrEqual(12)
  })

  it('puts a weekday on every date: "Sat, Jan 9, 2027", or "Sat to Sun, Feb 6 to 7, 2027" for two days', () => {
    const words = fixture()
    const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'
    const dates = [...words.matchAll(new RegExp(`\\b(?:${months}) \\d{1,2}\\b`, 'g'))]
    expect(dates.length).toBeGreaterThanOrEqual(6)
    const weekday = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)'
    for (const date of dates) {
      const before = words.slice(Math.max(0, date.index - 20), date.index)
      expect(before, date[0]).toMatch(new RegExp(`${weekday}(?: to ${weekday})?, $`))
    }
  })

  it('names the national body "US Chess" and no other way', () => {
    const words = fixture()
    expect(words).toContain('US Chess')
    expect(words).not.toMatch(/\bU\.?S\.? ?Chess Federation\b|\bUS ?C\.?F\b/i)
  })
})
