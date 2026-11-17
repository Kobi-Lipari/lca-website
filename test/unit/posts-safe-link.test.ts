// test/unit/posts-safe-link.test.ts
//
// The site-path rule (isSafeLink) and the field-kind check (checkPostBody) in
// functions/utils/posts.ts. Both are plain functions with no HTMLRewriter, so
// they run in the node suite; the cleaner and the handlers that use them are
// held in test/integration/posts-links-fields.test.ts.
//
// The rule is held by a second reading, not only by listed inputs: a few
// thousand addresses are built from the pieces an attacker has (a slash, a
// backslash, a tab, a line feed, a carriage return, a space, a null and other
// control characters, the entities for each in decimal, hexadecimal and named
// form with and without the semicolon, "%2f", "%5c", a dot, letters, a host, a
// query and a fragment), and for every one the rule accepts as a site path we
// require both that Node's own URL parser keeps the site's origin and that the
// same holds for the address as a real HTML parser decodes it from an href
// attribute. parse5, which jsdom installs, is that parser; it is the one the
// integration suite reads post bodies with. Every sample is made up.
import { describe, expect, it } from 'vitest'
import { parseFragment } from 'parse5'
import { isSafeLink, checkPostBody, POST_FIELD_REFUSAL } from '../../functions/utils/posts'
import { isSafeLink as isSafeLinkToday } from './fixtures/posts-cleaner-today'

const SITE = 'https://www.example.org'

type Node = { tagName?: string; attrs?: Array<{ name: string; value: string }>; childNodes?: Node[] }

/** The origin Node reads for an address against the site, or null if it will not parse. */
function originOf(address: string): string | null {
  try {
    return new URL(address, SITE).origin
  } catch {
    return null
  }
}

/** The href a real HTML parser hands a browser from `href="…"`, entities decoded. */
function decodeHref(address: string): string {
  const frag = parseFragment(`<a href="${address.replace(/"/g, '&quot;')}">x</a>`) as unknown as Node
  const anchor = frag.childNodes?.find((n) => n.tagName === 'a')
  return anchor?.attrs?.find((a) => a.name === 'href')?.value ?? ''
}

// The attacker's alphabet: a slash, a backslash, every whitespace and control
// character, the entities for each (decimal, hex, named, with and without the
// semicolon), the percent forms of slash and backslash, and the ordinary parts
// of a path, a query and a fragment.
const PIECES = [
  '/', '\\', '\t', '\n', '\r', ' ', '\u0000', '\u0001', '\u000b', '\u001f', '\u007f',
  '&#47;', '&#47', '&#x2f;', '&#x2F', '&sol;', '&sol',
  '&#92;', '&#92', '&#x5c;', '&#x5C', '&bsol;', '&bsol',
  '&#9;', '&#9', '&Tab;', '&#10;', '&#10', '&NewLine;', '&#13;', '&#13',
  '&amp;', '&amp', '&', '%2f', '%5c', '%2F', '%5C',
  '.', 'a', 'b', 'x', 'evil.example', '?q=1', '#frag',
]

/** A few thousand addresses that start with "/": each piece, each ordered pair, and a deterministic third piece on each pair. */
function builtAddresses(): string[] {
  const out: string[] = []
  for (const p of PIECES) out.push('/' + p)
  PIECES.forEach((p, i) => {
    PIECES.forEach((q, j) => {
      out.push('/' + p + q)
      out.push('/' + p + q + PIECES[(i * 7 + j * 13) % PIECES.length])
    })
  })
  return out
}

describe('isSafeLink: a site path the rule accepts is never another site to a browser', () => {
  const addresses = builtAddresses()

  it('builds a few thousand addresses', () => {
    expect(addresses.length).toBeGreaterThanOrEqual(3000)
  })

  it('every accepted site path keeps the site origin, as written and as a real HTML parser decodes it', () => {
    let accepted = 0
    for (const address of addresses) {
      if (!isSafeLink(address)) continue
      accepted++
      expect(originOf(address), `as written: ${JSON.stringify(address)}`).toBe(SITE)
      expect(originOf(decodeHref(address)), `decoded: ${JSON.stringify(address)}`).toBe(SITE)
    }
    // Not a vacuous pass: the ordinary site paths among the thousands are kept.
    expect(accepted).toBeGreaterThan(300)
  })

  it('refuses the forms a browser would read as another site, by kind', () => {
    for (const address of [
      '//evil.example', // a second slash
      '/\\evil.example', // a slash then a backslash
      '/&#47;evil.example', '/&sol;evil.example', '/&#x2f;evil.example', // an entity for a slash
      '/&#92;evil.example', '/&bsol;evil.example', // an entity for a backslash
      '/\tevil.example', '/\n/evil.example', '/\r/evil.example', // a tab or a line break
      '/&#9;/evil.example', '/&Tab;/evil.example', // an entity for a tab
      '/\u0000/evil.example', '/x\u0001y', // a null or another control character
    ]) {
      expect(isSafeLink(address), address).toBe(false)
    }
  })

  it('keeps the ordinary site paths, as decided on purpose', () => {
    for (const address of [
      '/', '/?x', '/#x', '/tournaments/sample-open', '/news/sample-post?x=1&y=2#part',
      '/a\\b', // a backslash later in the path, which stays on the site
      '/a%2fb', '/a%5cb', '/%2fevil.example', '/%5cevil.example', // %2f and %5c, kept in the path
      '/a?x=1&amp;y=2', '/a&b', // an "&" later in the address, a query's
      '/..//evil.example', '/ /evil.example', // a path a browser keeps on the site
    ]) {
      expect(isSafeLink(address), address).toBe(true)
      expect(originOf(address), address).toBe(SITE)
      expect(originOf(decodeHref(address)), address).toBe(SITE)
    }
  })

  it('leaves http(s) and mailto addresses as they were, and refuses everything else', () => {
    for (const address of ['https://example.org', 'http://example.org/x', 'HTTPS://example.org', 'mailto:someone@example.org', 'MAILTO:a@example.org']) {
      expect(isSafeLink(address), address).toBe(true)
    }
    for (const address of ['javascript:alert(1)', 'tel:+15555550100', 'data:text/html,x', 'ftp://example.org', 'example.org', '', ' /x']) {
      expect(isSafeLink(address), address).toBe(false)
    }
  })
})

describe('checkPostBody: every field held to its kind', () => {
  it('passes an ordinary request, fields present or left out', () => {
    expect(checkPostBody({ title: 'Sample post one' })).toBeNull()
    expect(checkPostBody({})).toBeNull()
    expect(checkPostBody({
      title: 'Sample post one', slug: 'sample-post-one', summary: 'Sample summary', bodyHtml: '<p>Sample</p>',
      linkUrl: '/tournaments/sample-open', linkLabel: 'Learn more', status: 'published', pinned: true, publishedAt: '2026-11-13',
    })).toBeNull()
  })

  it('allows a null where the field clears, and a boolean for pinned', () => {
    for (const body of [{ linkUrl: null }, { linkLabel: null }, { publishedAt: null }, { pinned: false }, { pinned: true }]) {
      expect(checkPostBody(body), JSON.stringify(body)).toBeNull()
    }
  })

  it('leaves unknown keys alone', () => {
    expect(checkPostBody({ title: 'Sample post one', extra: 42, body: 'x' })).toBeNull()
  })

  it('refuses a body that is not an object', () => {
    for (const body of [null, undefined, [], 'abc', 5, true, ['<p>a</p>']]) {
      expect(checkPostBody(body), JSON.stringify(body) ?? 'undefined').toBe(POST_FIELD_REFUSAL)
    }
  })

  it('refuses a field of the wrong kind', () => {
    for (const body of [
      { title: 5 }, { title: null }, { slug: 5 }, { slug: null }, { summary: null }, { summary: 5 },
      { bodyHtml: null }, { bodyHtml: ['<p>a</p>'] }, { bodyHtml: 42 },
      { linkUrl: 5 }, { linkUrl: false }, { linkLabel: 5 }, { publishedAt: 5 }, { publishedAt: false },
      { status: 5 }, { status: null }, { pinned: 'false' }, { pinned: 1 }, { pinned: null },
    ]) {
      expect(checkPostBody(body), JSON.stringify(body)).toBe(POST_FIELD_REFUSAL)
    }
  })
})

// ── A second alphabet, longer addresses and the cleaner's own call ────────────

// Characters a browser's URL reader treats in a way a plain letter is not:
// the other spaces and separators, a byte-order mark, a soft hyphen, the
// full-width slash and backslash, an ideographic stop, and the C1 controls.
const UNICODE_PIECES = [
  '/', '\\', '\u00a0', '\u2028', '\u2029', '\u200b', '\u200d', '\ufeff', '\u00ad', '\u3000',
  '\uff0f', '\uff3c', '\u3002', '\u0085', '\u009f', '\u0080', '\u2215', '\u29f8',
  '&#12;', '&#x0c;', '&#xA0;', '&nbsp;', '&#8232;', '&#65295;', '&#x5C', '&#47',
  '\t', '\n', '\r', '\f', '\u0000', ' ', '%2f', '%5c', '%09', '%0a', '.', '..', 'evil.example', 'a', '?q=1&r=2', '#frag', '@', ':', '%',
]

/** A C0, DEL or C1 control character. */
function isControl(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f)
}

/** A small deterministic generator, so the built addresses are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** Addresses of one to six pieces from the second alphabet and the first, in a fixed order, each starting with "/". */
function longerAddresses(count: number): string[] {
  const next = seeded(61)
  const pool = [...PIECES, ...UNICODE_PIECES]
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const length = 1 + Math.floor(next() * 6)
    let address = '/'
    for (let j = 0; j < length; j++) address += pool[Math.floor(next() * pool.length)]
    out.push(address)
  }
  return out
}

describe('isSafeLink: the second alphabet and longer addresses, read twice', () => {
  const addresses = [
    ...UNICODE_PIECES.flatMap((p) => UNICODE_PIECES.map((q) => '/' + p + q)),
    ...longerAddresses(5000),
  ]

  it('builds thousands more addresses, all starting with a slash', () => {
    expect(addresses.length).toBeGreaterThanOrEqual(6000)
    for (const address of addresses) expect(address.startsWith('/')).toBe(true)
  })

  it('every accepted site path keeps the site origin, as written and as a real HTML parser decodes it', () => {
    let accepted = 0
    for (const address of addresses) {
      if (!isSafeLink(address)) continue
      accepted++
      expect(originOf(address), `as written: ${JSON.stringify(address)}`).toBe(SITE)
      expect(originOf(decodeHref(address)), `decoded: ${JSON.stringify(address)}`).toBe(SITE)
    }
    expect(accepted).toBeGreaterThan(300)
  })

  it('every accepted path also keeps the site once trimmed, as the cleaner calls the rule', () => {
    // The body cleaner hands the rule href.trim(), and the button link is trimmed before it is checked.
    for (const address of addresses) {
      for (const wrapped of [` ${address} `, `\t${address}\n`, `\u00a0${address}\u2028`]) {
        const trimmed = wrapped.trim()
        if (!isSafeLink(trimmed)) continue
        expect(originOf(trimmed), JSON.stringify(wrapped)).toBe(SITE)
        expect(originOf(decodeHref(trimmed)), JSON.stringify(wrapped)).toBe(SITE)
      }
    }
  })

  it('the rule is exactly its sentence: the second character, and no control character anywhere', () => {
    for (const address of addresses) {
      const hasControl = [...address].some(isControl)
      const badSecond = address.length > 1 && ['/', '\\', '&'].includes(address[1])
      expect(isSafeLink(address), JSON.stringify(address)).toBe(!hasControl && !badSecond)
    }
  })

  it('only tightens: nothing the rule accepts was refused before, and an address that does not start with a slash is read as before', () => {
    const everything = [...builtAddresses(), ...addresses]
    for (const address of everything) {
      if (isSafeLink(address)) expect(isSafeLinkToday(address), JSON.stringify(address)).toBe(true)
    }
    for (const address of [
      'https://example.org', 'http://example.org/x?y=1&z=2#p', 'HTTP://example.org', 'mailto:someone@example.org', 'MailTo:a@example.org',
      'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'tel:+15555550100', 'ftp://example.org', 'example.org', '', ' ', 'x/y', '\\evil.example',
      '&#47;docs', 'https:evil.example', 'https//example.org', '\thttps://example.org', ' https://example.org',
    ]) {
      expect(isSafeLink(address), JSON.stringify(address)).toBe(isSafeLinkToday(address))
    }
  })

  it('the ordinary site paths are read as before', () => {
    for (const address of [
      '/', '/tournaments', '/tournaments/sample-open', '/news/sample-post?x=1&y=2#part', '/news/sample-post-one', '/a/b/c/',
      '/?x=1', '/#top', '/members/sample-member?tab=results&page=2', '/a%20b', '/a+b', '/a-b_c.d', '/~sample',
    ]) {
      expect(isSafeLink(address), address).toBe(true)
      expect(isSafeLinkToday(address), address).toBe(true)
    }
  })
})

describe('checkPostBody: every field against every kind', () => {
  const KINDS: Array<[string, unknown]> = [
    ['null', null], ['a number', 5], ['zero', 0], ['true', true], ['false', false], ['a list', []], ['a list of text', ['Sample']],
    ['an object', {}], ['an object holding text', { length: 3 }], ['text', 'Sample'], ['empty text', ''],
  ]
  // What each field may be, by the brief: text, text or null, or true or false.
  const ALLOWED: Record<string, string[]> = {
    title: ['text', 'empty text'],
    slug: ['text', 'empty text'],
    summary: ['text', 'empty text'],
    bodyHtml: ['text', 'empty text'],
    status: ['text', 'empty text'],
    linkUrl: ['text', 'empty text', 'null'],
    linkLabel: ['text', 'empty text', 'null'],
    publishedAt: ['text', 'empty text', 'null'],
    pinned: ['true', 'false'],
  }

  for (const [field, allowed] of Object.entries(ALLOWED)) {
    it(`${field}: refuses every kind but ${allowed.join(', ')}, with the one message`, () => {
      for (const [label, value] of KINDS) {
        const result = checkPostBody({ title: 'Sample post one', [field]: value })
        expect(result, `${field} as ${label}`).toBe(allowed.includes(label) ? null : POST_FIELD_REFUSAL)
      }
    })
  }

  it('does not change the request it reads', () => {
    const body = { title: 'Sample post one', linkUrl: null, pinned: false, extra: [1, 2] }
    const copy = JSON.parse(JSON.stringify(body))
    checkPostBody(body)
    expect(body).toEqual(copy)
  })

  it('a field of the wrong kind is refused whatever else is right, so the first wrong one never hides behind a good one', () => {
    expect(checkPostBody({ title: 'Sample post one', summary: 'Sample', bodyHtml: '<p>Sample</p>', pinned: 'yes' })).toBe(POST_FIELD_REFUSAL)
    expect(checkPostBody({ pinned: true, publishedAt: 20261113 })).toBe(POST_FIELD_REFUSAL)
  })

  it('the one message is in plain words and tells the sender what to do', () => {
    expect(POST_FIELD_REFUSAL).toBe('This post could not be saved because part of it was not in the form the site expects. Reload the page and try again.')
  })
})
