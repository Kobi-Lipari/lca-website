// test/unit/strip-comments-edges.test.ts
//
// stripComments in test/unit/helpers/cssTokens.ts, which every unit test
// that reads a stylesheet reads it through, held at its edges and against
// a browser's own reading of strings and comments (CSS Syntax Level 3,
// written out below for nothing else):
//
// - a quoted string is kept whole, whichever its quote mark, with the other
//   mark, an escaped quote or an escaped backslash inside it, and a slash
//   and a star inside it start no comment, in a url's data as in content
// - a comment is taken out whole, whatever quote marks it holds and however
//   many lines it runs over, and a string and a comment on one line are
//   each read as what they are
// - a string ends on its line: a quote that does not close there opens no
//   string, so an apostrophe in a TypeScript line comment or in a page's
//   words keeps no block comment after it, which is why the stripper's
//   strings end on their line (the record's deviation for it)
// - every stylesheet of the site's own and every stylesheet of the packages
//   they import strips to exactly what the browser's reading leaves, and
//   the bare pattern the stripper replaced does not, on a stylesheet that
//   quotes a slash and a star as src/index.css's fourth @source line does
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from './helpers/cssTokens'

const ROOT = resolve(__dirname, '../..')

/** What a browser leaves of a stylesheet once its comments are gone: strings and all else as written. */
function asBrowserReads(css: string): string {
  let out = ''
  let i = 0
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      // A comment runs to the first */ after it, or to the end of the sheet.
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
      continue
    }
    const quote = css[i]
    if (quote === '"' || quote === '\'') {
      // A string runs to its own quote mark; a backslash escapes what follows it, a line break
      // included; a line break that is not escaped ends it there, as a bad string.
      let j = i + 1
      while (j < css.length && css[j] !== quote && !'\n\r\f'.includes(css[j])) j += css[j] === '\\' ? 2 : 1
      if (j < css.length && css[j] === quote) j++
      out += css.slice(i, Math.min(j, css.length))
      i = Math.min(j, css.length)
      continue
    }
    out += css[i]
    i++
  }
  return out
}

/** The pattern the stripper replaced, which took no notice of quotes. */
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Every stylesheet in a folder and the folders inside it, packages' own packages left out. */
function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : stylesheets(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}
const SITE_SHEETS = stylesheets(join(ROOT, 'src'))
/** The packages the site's stylesheets import from, by name: "tailwindcss", "@fontsource/barlow". */
const PACKAGES = [...new Set(SITE_SHEETS.flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1])))]
  .filter((name) => !name.startsWith('.'))
  .map((name) => name.split('/').slice(0, name.startsWith('@') ? 2 : 1).join('/'))
  .filter((name, i, all) => all.indexOf(name) === i)
const PACKAGE_SHEETS = PACKAGES.flatMap((name) => stylesheets(join(ROOT, 'node_modules', name)))
const relative = (path: string) => path.slice(ROOT.length + 1)

describe('a quoted string is kept whole', () => {
  it.each([
    ['a slash and a star in double quotes', '@source not "../*.md";'],
    ['a slash and a star in single quotes', 'a::after { content: \'/* kept */\'; }'],
    ['the other quote mark inside', 'a::after { content: "it\'s /* kept */"; } b::after { content: \'say "/* kept */"\'; }'],
    ['an escaped quote inside', 'a::after { content: "say \\"/* kept */\\" twice"; }'],
    ['a url\'s data', '.icon { background: url("data:image/svg+xml,%3Csvg%3E/*%3C/svg%3E") no-repeat; }'],
    ['a closing star and slash with no opening', '.a::after { content: \'*/\'; } .b { color: red; }'],
  ])('%s', (_what, css) => {
    expect(stripComments(css)).toBe(css)
    expect(stripComments(css)).toBe(asBrowserReads(css))
  })

  it('ends a string at an escaped backslash\'s quote, so a comment after it is still taken out', () => {
    const css = 'a::after { content: "\\\\"; } /* gone */ b { }'
    expect(stripComments(css)).toBe('a::after { content: "\\\\"; }  b { }')
    expect(stripComments(css)).toBe(asBrowserReads(css))
  })
})

describe('a comment is taken out whole', () => {
  it.each([
    ['holding both quote marks', '/* it\'s "quoted" */a { color: red; }', 'a { color: red; }'],
    ['running over three lines with an apostrophe', 'a { color: red; }\n/* the brand\'s\n  gold, kept\n  apart */\nb { color: blue; }', 'a { color: red; }\n\nb { color: blue; }'],
    ['ending at its first star and slash, a quote mark inside it or not', '/* "*/ b { }', ' b { }'],
    ['after a string on one line', '.a { content: "/*"; } /* a note */ .b { }', '.a { content: "/*"; }  .b { }'],
    ['before a string on one line', '/* a note */ .a { content: "*/"; }', ' .a { content: "*/"; }'],
    ['two on a line, with a string between', '/* one */ .a { content: "/* two */"; } /* three */', ' .a { content: "/* two */"; } '],
  ])('%s', (_what, css, left) => {
    expect(stripComments(css)).toBe(left)
    expect(stripComments(css)).toBe(asBrowserReads(css))
  })
})

describe('a string ends on its line', () => {
  it('takes a quote that does not close on its line for no string, so a comment on the next line is taken out, as a browser does', () => {
    const css = '.a::after { content: "open }\n/* gone */ .b { color: red; }'
    expect(stripComments(css)).toBe('.a::after { content: "open }\n .b { color: red; }')
    expect(stripComments(css)).toBe(asBrowserReads(css))
  })

  it('keeps no block comment after an apostrophe in a TypeScript line comment or in a page\'s words, on its line or on the next', () => {
    // What test/unit/heritage-controls-tokens.test.tsx hands the stripper: TypeScript, whose // comments it leaves alone.
    const tsx = [
      '// the club\'s own colour /* a block comment on the line */',
      'export const label = <p>It\'s free</p>',
      '/* a block comment on the next line */',
      'export const cls = \'bg-card /* kept, in quotes */\'',
    ].join('\n')
    expect(stripComments(tsx)).toBe([
      '// the club\'s own colour ',
      'export const label = <p>It\'s free</p>',
      '',
      'export const cls = \'bg-card /* kept, in quotes */\'',
    ].join('\n'))
  })
})

describe('the stylesheets the unit tests read', () => {
  it('finds the site\'s own stylesheets and the packages they import', () => {
    expect(SITE_SHEETS.map(relative)).toEqual(expect.arrayContaining(['src/index.css', 'src/styles/themes/heritage.css', 'src/styles/themes/live.css']))
    expect(PACKAGES).toEqual(expect.arrayContaining(['tailwindcss', 'tw-animate-css', 'shadcn']))
    expect(PACKAGE_SHEETS.length).toBeGreaterThan(PACKAGES.length)
  })

  it.each(SITE_SHEETS.map(relative))('%s strips to what a browser\'s reading leaves', (path) => {
    const css = readFileSync(join(ROOT, path), 'utf8')
    expect(stripComments(css)).toBe(asBrowserReads(css))
  })

  it('strips every stylesheet of the packages the site imports to what a browser\'s reading leaves', () => {
    const differ = PACKAGE_SHEETS.filter((path) => {
      const css = readFileSync(path, 'utf8')
      return stripComments(css) !== asBrowserReads(css)
    })
    expect(differ.map(relative)).toEqual([])
  })

  it('keeps src/index.css\'s four @source not lines whole and in their order, and leaves no comment in it', () => {
    const stripped = stripComments(readFileSync(join(ROOT, 'src/index.css'), 'utf8'))
    expect(stripped.split('\n').filter((line) => line.startsWith('@source'))).toEqual([
      '@source not "../docs";', '@source not "../test";', '@source not "../scripts";', '@source not "../*.md";',
    ])
    // Outside its strings, nothing that opens or closes a comment is left.
    expect(stripped.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""')).not.toMatch(/\/\*|\*\//)
  })

  it('tells the bare pattern it replaced from a browser, on a stylesheet that quotes a slash and a star before a comment', () => {
    const css = '@source not "../docs";\n@source not "../*.md";\n\n/* A comment after the line. */\n.a { color: red; }\n'
    expect(asBrowserReads(css)).toBe('@source not "../docs";\n@source not "../*.md";\n\n\n.a { color: red; }\n')
    expect(stripComments(css)).toBe(asBrowserReads(css))
    expect(bare(css)).toBe('@source not "../docs";\n@source not "..\n.a { color: red; }\n')
    expect(bare(css)).not.toBe(asBrowserReads(css))
  })
})
