// test/integration/admin-newsletter-link-rule.test.ts
//
// The newsletter page's link rule, keepableAddress in
// src/areas/admin/newsletter/letterRules.ts (WS16 part two, page step 4),
// held to the letter's cleaner itself, cleanLetterHtml in
// functions/utils/mail/letterClean.ts, run in the Workers runtime whose HTML
// rewriter it cleans with; the unit suite's node has none. The page takes a
// link's address only when the cleaner keeps the link with that address as
// written, and refuses it, in words, only when the cleaner would not: for
// every character from U+0000 to U+FFFF but the surrogates, inside an
// address, and for a list of addresses with each way an address can start.
// An address reaches the cleaner as the editor writes it into the letter:
// an ampersand as &amp;, a quote mark as &quot;, a no-break space as &nbsp;
// and the angle brackets as &lt; and &gt;, as today's browsers write an
// attribute. Every address here is plainly made up. Nothing here makes a
// request.
import { describe, expect, it } from 'vitest'
import { cleanLetterHtml } from '../../functions/utils/mail/letterClean'
import { keepableAddress } from '../../src/areas/admin/newsletter/letterRules'

/** A no-break space, made from its code so the source shows it. */
const NO_BREAK_SPACE = String.fromCharCode(0xa0)

/** An address as the editor writes it in a link's href. */
function asWritten(address: string): string {
  return address
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .split(NO_BREAK_SPACE)
    .join('&nbsp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** A link as the editor writes it, its words numbered so each can be found in what the cleaner hands back. */
const linkOf = (address: string, at: number) => `<a href="${asWritten(address)}">Sample link ${at}</a>`

/**
 * Which of a list of addresses the cleaner keeps on its link exactly as written, read from one letter holding them all,
 * each in its own paragraph; a letter the cleaner refuses whole is read again one link at a time.
 */
async function keptByTheCleaner(addresses: string[]): Promise<boolean[]> {
  const letter = addresses.map((address, at) => `<p>${linkOf(address, at)}</p>`).join('')
  const cleaned = await cleanLetterHtml(letter)
  if (cleaned !== null) return addresses.map((address, at) => cleaned.includes(`<p>${linkOf(address, at)}</p>`))
  return Promise.all(addresses.map(async (address, at) => (await cleanLetterHtml(`<p>${linkOf(address, at)}</p>`)) === `<p>${linkOf(address, at)}</p>`))
}

/** What the page would put in the letter for what a person typed: the kept address, or, refused, what they typed, trimmed. */
const putInTheLetter = (typed: string) => keepableAddress(typed) ?? typed.trim()

describe('the page\'s link rule and the cleaner agree', () => {
  it('on every character from U+0000 to U+FFFF but the surrogates, inside an address', async () => {
    const characters: number[] = []
    for (let code = 0; code <= 0xffff; code += 1) {
      if (code < 0xd800 || code > 0xdfff) characters.push(code)
    }
    const disagree: string[] = []
    let keptCount = 0
    for (let from = 0; from < characters.length; from += 1024) {
      const codes = characters.slice(from, from + 1024)
      const typed = codes.map((code) => `https://example.org/sample${String.fromCharCode(code)}page`)
      const kept = await keptByTheCleaner(typed.map(putInTheLetter))
      typed.forEach((address, at) => {
        const byThePage = keepableAddress(address) !== null
        if (byThePage) keptCount += 1
        if (byThePage !== kept[at]) disagree.push(`U+${codes[at].toString(16).toUpperCase().padStart(4, '0')} page ${byThePage ? 'keeps' : 'refuses'}, cleaner ${kept[at] ? 'keeps' : 'drops'}`)
      })
    }
    expect(disagree).toEqual([])
    // Refused, 90 in all: the 32 control characters below a space; delete and the 32 after it; the 20 spaces and line
    // ends above a space that JavaScript counts as space, the no-break space among them; and the rule's five marks, the
    // two quote marks, the two angle brackets and the backtick. Every other character is kept.
    expect(characters.length - keptCount).toBe(90)
  }, 60_000)

  const each: [string, string, boolean][] = [
    ['an https address', 'https://example.org/sample', true],
    ['an http address', 'http://example.org/sample', true],
    ['a mailto address', 'mailto:player.one@example.org', true],
    ['an address in capitals', 'HTTPS://EXAMPLE.ORG/SAMPLE', true],
    ['mailto in mixed capitals', 'MailTo:player.one@example.org', true],
    ['an address with an ampersand, which the editor writes as &amp;', 'https://example.org/sample?a=1&b=2', true],
    ['an address with a reference typed out', 'https://example.org/sample?a=1&amp;b=2', true],
    ['an address with a jump to a part', 'https://example.org/sample#part-two', true],
    ['an address with an accent', 'https://example.org/café', true],
    ['an address with spaces around it, kept trimmed', '  https://example.org/sample  ', true],
    ['an address with a no-break space around it, kept trimmed', `${NO_BREAK_SPACE}https://example.org/sample${NO_BREAK_SPACE}`, true],
    ['the scheme alone', 'https://', true],
    ['no scheme', 'example.org/sample', false],
    ['www and no scheme', 'www.example.org/sample', false],
    ['an address that starts with two slashes', '//example.org/sample', false],
    ['a path on the site', '/sample', false],
    ['a jump alone', '#sample', false],
    ['ftp', 'ftp://example.org/sample', false],
    ['javascript', 'javascript:alert(1)', false],
    ['javascript in mixed capitals', 'JaVaScRiPt:alert(1)', false],
    ['data', 'data:text/html,sample', false],
    ['tel', 'tel:+15555550100', false],
    ['https with no slashes', 'https:example.org', false],
    ['http with one slash', 'http:/example.org', false],
    ['mailto with a space for its colon', 'mailto player.one@example.org', false],
    ['a space inside', 'https://example.org/sample page', false],
    ['a no-break space inside', `https://example.org/sample${NO_BREAK_SPACE}page`, false],
    ['a quote mark', 'https://example.org/"sample"', false],
    ['an apostrophe', "https://example.org/'sample'", false],
    ['angle brackets', 'https://example.org/<sample>', false],
    ['a backtick', 'https://example.org/`sample`', false],
    ['a tab inside', 'https://example.org/sample\tpage', false],
    ['a line break inside', 'https://example.org/sample\npage', false],
    ['a control character before the scheme', `${String.fromCharCode(1)}https://example.org/sample`, false],
    ['nothing', '', false],
    ['spaces alone', '   ', false],
  ]

  it.each(each)('on %s', async (_name, typed, keeps) => {
    expect(keepableAddress(typed) !== null).toBe(keeps)
    expect(await keptByTheCleaner([putInTheLetter(typed)])).toEqual([keeps])
  })

  it('keeps an address trimmed, the rest as typed', () => {
    expect(keepableAddress('  https://example.org/sample?a=1&b=2  ')).toBe('https://example.org/sample?a=1&b=2')
    expect(keepableAddress('MAILTO:Player.One@example.org')).toBe('MAILTO:Player.One@example.org')
  })
})
