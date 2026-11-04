// test/unit/redesign-status-ws02-step4-claims.test.ts
//
// The figures the WS02 step 4 record gives, checked against each other, and
// the few of its claims about files that stay true after the step.
// test/unit/redesign-status-ws02-step4.test.ts pins the record's words and
// some of its claims; this file holds that the numbers it states in more
// than one place, or builds from parts, agree, so a figure brought up to
// date in one place and not in another fails here:
//
// - the unit counts: the total is the base's, the new files' tests and the
//   changed files' gains, file for file with the Files bullet, the file
//   count rises by the new files, and the verify item gives the base's
// - the browser counts: each project's tests are those that run and those
//   that skip, the two make the run's total, and the run's quoted lines,
//   the Checks line and the verify item say the same
// - the build: the three stylesheets make the CSS total, the growth over
//   WS02 step 3's close is what the two records' figures make, and the
//   verify item and the Checks line give the same totals
// - lint: the files it read rose by the new files the block lists
// - the comment stripper: its tests and its texts rose by the one new case,
//   the inputs it lists add up, and the TypeScript files it names are four
// - the reads moved: the per-file counts add up to the totals the block,
//   the deviations and the verify item give, and each spec's count is the
//   number of lines it lists
// - the closing search's kinds add up to the lines it found, and the grep
//   check's parts to its total, the files it counts being the block's
// - the eighteen checks of today's chrome under newLook: each test the list
//   names is in the file it is kept in
// - the gold-ink codemod's command line: the tests that run it five times
//   carry 20 seconds or more, as the record says they were given
// - the record test of this step reads no switch and not the helper's
//   answer, only files' words
// It reads only the WS02 section, and pins no switch's value.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const block = between(ws02, '### WS02 step 4: the browser specs read the chrome through one helper', '\n### ')
const step3 = between(ws02, '### WS02 step 3: the page frame, the chrome\'s rings, the browser bar colour and the loading line', '\n### ')
const verify = between(ws02, '### WS02 verify items resolved', '\n### ')
const deviations = between(ws02, '### WS02 deviations from the brief', '\n### ')
/** A line of `text` that starts with `start`. */
const lineOf = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(start)) ?? ''
/** A bullet of a block and the lines indented under it. */
function bulletOf(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
const bullet = (start: string) => bulletOf(block, start)
/** A number as the record writes it, with commas between its thousands. */
const n = (written: string) => Number(written.replace(/,/g, ''))
/** A number as the record writes it: 1,440. */
const written = (value: number) => value.toLocaleString('en-US')
/** The numbers the record writes in words. */
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, nineteen: 19,
}
/** The numbers a pattern finds, as numbers, or a failure that names what was looked for. */
function figures(text: string, pattern: RegExp, what: string): number[] {
  const m = pattern.exec(text)
  if (!m) throw new Error(`the record no longer says ${what}`)
  return m.slice(1).map((g) => (g === undefined ? Number.NaN : (WORDS[g] ?? n(g))))
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
const verifyItem = (name: string) => lineOf(verify, `- **${name} (WS02 step 4).**`)

const files = bullet('- **Files.**')
const newLine = lineOf(files, '  - New:')
const changedLine = lineOf(files, '  - Changed:')
const testsChanged = lineOf(files, '  - Tests changed:')
const checks = lineOf(block, '- Checks:')

describe('the unit counts in the WS02 step 4 record', () => {
  /** Each new unit test file the Files bullet lists, with the number of its tests. */
  const newUnit = [...newLine.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx?)` \((\d+): /g)].map((m) => ({ file: m[1], tests: Number(m[2]) }))
  /** Each changed test file, with its count after and before ("as before" being no change). */
  const changed = [...testsChanged.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx?)` \((\d+), (?:(\d+) before|as before)/g)].map((m) => ({
    file: m[1], after: Number(m[2]), before: m[3] === undefined ? Number(m[2]) : Number(m[3]),
  }))

  it('reads every new unit file and every changed one the Files bullet lists', () => {
    expect(newUnit.map((f) => f.file)).toEqual(expect.arrayContaining(['test/unit/chrome-helper.test.tsx', 'test/unit/redesign-status-ws02-step4.test.ts']))
    expect(changed.map((f) => f.file)).toEqual(expect.arrayContaining(['test/unit/brand-placements.test.tsx', 'test/unit/gold-ink.test.ts']))
    // Every test file the bullet names in either list is read here, so none is left out of the sums.
    const named = (line: string) => [...line.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx?)` \(/g)].map((m) => m[1])
    expect(named(newLine)).toEqual(newUnit.map((f) => f.file))
    expect(named(testsChanged)).toEqual(changed.map((f) => f.file))
  })

  it('makes the total from the base\'s count, the new files\' tests and the changed files\' gains, file for file', () => {
    const [total, filesAfter, before, filesBefore] = figures(checks, /unit (\d+) tests in (\d+) files \((\d+) in (\d+) on the base;/, 'the unit counts in its Checks line')
    const [newFiles] = figures(checks, /the (\w+) new files hold/, 'how many new files the Checks line counts')
    const held = /new files hold ([\d, and]+?), and/.exec(checks)?.[1] ?? ''
    const newCounts = [...held.matchAll(/\d+/g)].map((m) => Number(m[0]))
    const gainLine = /and (\w+) changed files gain (\d+): (.+?)\), integration/.exec(checks)
    expect(gainLine, 'the changed files\' gains in the Checks line').not.toBeNull()
    const gains = [...gainLine![3].matchAll(/(\d+) in `([^`]+)`/g)].map((m) => ({ file: m[2], gain: Number(m[1]) }))
    // The new files' counts are the Files bullet's, as a set of numbers.
    expect(newFiles).toBe(newUnit.length)
    expect([...newCounts].sort((a, b) => a - b)).toEqual(newUnit.map((f) => f.tests).sort((a, b) => a - b))
    // The gains are the Files bullet's, file for file, and only the files that gained.
    expect(gains).toEqual(changed.filter((f) => f.after !== f.before).map((f) => ({ file: f.file, gain: f.after - f.before })))
    expect(WORDS[gainLine![1]]).toBe(gains.length)
    expect(Number(gainLine![2])).toBe(sum(gains.map((g) => g.gain)))
    expect(total).toBe(before + sum(newCounts) + Number(gainLine![2]))
    expect(filesAfter).toBe(filesBefore + newUnit.length)
  })

  it('gives the base\'s counts in its verify item as in its Checks line, and the integration suite as on the base', () => {
    const [before, filesBefore] = figures(checks, /\((\d+) in (\d+) on the base;/, 'the unit counts on the base')
    const [integration, integrationFiles] = figures(checks, /integration (\d+) in (\d+), as on the base/, 'the integration count')
    expect(verifyItem('Lint and counts')).toContain(`unit ${before} tests in ${filesBefore} files and integration ${integration} in ${integrationFiles}`)
  })
})

describe('the browser counts in the WS02 step 4 record', () => {
  const runs = bullet('- **The browser runs.**')
  const [total, on, onRun, onSkip, off, offRun, offSkip] = figures(
    runs, /hold the same (\d+) tests, (\d+) on `a11y-on` \((\d+) that run and (\d+) that skip\) and (\d+) on `a11y-off` \((\d+) and (\d+)\)/, 'the two projects\' counts',
  )

  it('makes each project\'s tests of those that run and those that skip, and the two projects the run\'s total', () => {
    expect(on).toBe(onRun + onSkip)
    expect(off).toBe(offRun + offSkip)
    expect(total).toBe(on + off)
  })

  it('quotes the run\'s own lines with the same counts, and the Checks line and the verify item say the same', () => {
    const run = onRun + offRun
    const skip = onSkip + offSkip
    expect(runs).toContain(`"Running ${total} tests using 2 workers"`)
    expect(runs).toContain(`"${skip} skipped"`)
    expect(runs).toMatch(new RegExp(`"${run} passed \\(`))
    expect(checks).toContain(`${total} tests, ${run} that run and ${skip} that skip, as on the base`)
    expect(verifyItem('Lint and counts')).toContain(`the browser suite ${total} tests, ${run} that run and ${skip} that skip`)
  })
})

describe('the build in the WS02 step 4 record', () => {
  const build = bullet('- **Build.**')
  const [dist, assets, css, site, heritage, live, js, jsFiles] = figures(
    build,
    /(\d+) files in `dist` before and after, (\d+) in `dist\/assets`; CSS ([\d,]+) bytes in three files \(the site's stylesheet, `index-\*\.css`, ([\d,]+), the heritage stylesheet ([\d,]+) and the live one ([\d,]+)\) and JavaScript ([\d,]+) bytes in (\d+) files/,
    'the build\'s files and sizes',
  )

  it('makes the CSS total of its three stylesheets, and gives the same totals in its verify item and its Checks line', () => {
    expect(css).toBe(site + heritage + live)
    expect(verifyItem('Lint and counts')).toContain(`the production build ${dist} files in \`dist\`, ${assets} in \`dist/assets\`, CSS ${written(css)} bytes in three files and JavaScript ${written(js)} in ${jsFiles}`)
    expect(checks).toContain(`"No zod in the site bundle: ${assets} files in dist/assets checked."`)
    expect(verifyItem('The built site')).toContain(`the same ${dist} files`)
  })

  it('grows over WS02 step 3\'s close by what the two records\' figures make', () => {
    const [grewSite, grewJs, grewDist] = figures(build, /grew the site's stylesheet by ([\d,]+) bytes and its JavaScript by ([\d,]+), and `dist` by (\d+) files/, 'the growth since WS02 step 3')
    const step3Build = bulletOf(step3, '- **Build.**')
    const [, siteThen] = figures(step3Build, /the site's stylesheet, `index-\*\.css`, goes from ([\d,]+) to ([\d,]+) bytes/, 'WS02 step 3\'s stylesheet')
    const [heritageThen, liveThen] = figures(step3Build, /the heritage and live stylesheets keep their ([\d,]+) and ([\d,]+) bytes/, 'WS02 step 3\'s two looks')
    const [, jsThen] = figures(step3Build, /JavaScript ([\d,]+) bytes in \d+ files before and ([\d,]+) after/, 'WS02 step 3\'s JavaScript')
    const [, distThen] = figures(step3Build, /\((\d+) and (\d+) in `dist`\)/, 'WS02 step 3\'s dist')
    expect(grewSite).toBe(site - siteThen)
    expect(grewJs).toBe(js - jsThen)
    expect(grewDist).toBe(dist - distThen)
    expect([heritage, live]).toEqual([heritageThen, liveThen])
  })
})

describe('lint in the WS02 step 4 record', () => {
  it('rises in the files it read by the new files the block lists, with the same findings before and after', () => {
    const lint = bullet('- **Lint.**')
    const [errors, warnings] = figures(lint, /(\d+) errors and (\d+) warnings each/, 'lint\'s findings')
    const [before, after, rise] = figures(lint, /(\d+) files linted before and (\d+) after, the step's (\w+) new files the difference/, 'the files lint read')
    const newPaths = [...newLine.matchAll(/`((?:test|src)\/[\w./-]+\.tsx?)` \(/g)].map((m) => m[1])
    expect(newPaths).toHaveLength(rise)
    expect(after - before).toBe(rise)
    expect(checks).toContain(`\`npm run lint\` is ${errors} errors and ${warnings} warnings before and after`)
    expect(verifyItem('Lint and counts')).toContain(`\`npm run lint\` ${errors} errors and ${warnings} warnings over ${before} files`)
  })
})

describe('the comment stripper in the WS02 step 4 record', () => {
  const stripper = bullet('- **The comment stripper.**')

  it('rises by the one new case, in the tests and in the texts, which the Files bullet gives the same gain', () => {
    const [testsBefore, testsAfter] = figures(stripper, /hold ([\d,]+) tests before and ([\d,]+) after, the one more being the new case of `test\/unit\/source-not-lines\.test\.ts`/, 'the stripper\'s readers\' tests')
    const [textsBefore, textsAfter] = figures(stripper, /(\d+) different texts before and (\d+) after/, 'the texts handed to the stripper')
    const [after, before] = figures(testsChanged, /`test\/unit\/source-not-lines\.test\.ts` \((\d+), (\d+) before:/, 'the gain of test/unit/source-not-lines.test.ts')
    expect(testsAfter - testsBefore).toBe(1)
    expect(after - before).toBe(1)
    expect(textsAfter - textsBefore).toBe(1)
  })

  it('makes its texts of the files it lists and the others, and of the same texts but three after the change', () => {
    const [textsBefore, textsAfter] = figures(stripper, /(\d+) different texts before and (\d+) after/, 'the texts handed to the stripper')
    const m = /the (\d+) files among them \((.+?)\) and the (\d+) others/.exec(stripper)
    expect(m, 'the files among the texts').not.toBeNull()
    const [listedFiles, list, others] = [Number(m![1]), m![2], Number(m![3])]
    expect(listedFiles + others).toBe(textsBefore)
    // The list: the paths it gives, and the stylesheets and files it counts in words.
    const paths = [...list.matchAll(/`([^`]+\.(?:css|tsx?))`/g)].map((p) => p[1]).filter((p) => !p.startsWith('test/'))
    const counted = [...list.matchAll(/\b(\w+) (?:stylesheets|files) of\b/g)].map((w) => WORDS[w[1]] ?? Number.NaN)
    expect(paths.length + sum(counted)).toBe(listedFiles)
    const [same] = figures(stripper, /After the change the inputs are the same (\d+) texts but for the edited `src\/index\.css`, the same file less its `@source` lines, and the made-up stylesheet of the new case/, 'the texts after the change')
    expect(same + 3).toBe(textsAfter)
  })

  it('gives src/index.css the same lengths in the block and in its verify item, and names four TypeScript files the example form reads otherwise', () => {
    const [stripped, old] = figures(stripper, /strips to ([\d,]+) characters in place of ([\d,]+)/, 'src/index.css stripped')
    expect(verifyItem('The comment stripper and its readers')).toContain(`${written(stripped)} characters in place of ${written(old)}`)
    expect(stripped).toBeGreaterThan(old)
    const four = [...stripper.matchAll(/`([\w./-]+\.tsx?)` from ([\d,]+)(?: characters)? to (?:all )?([\d,]+)/g)].map((f) => ({ file: f[1], from: n(f[2]), to: n(f[3]) }))
    expect(four.map((f) => f.file)).toEqual(['filter-chip.tsx', 'StatusBadge.tsx', 'DateBlock.tsx', 'src/lib/brand.ts'])
    // The example form keeps comments the line-bound form takes out, so each reads longer.
    for (const f of four) expect(f.to, f.file).toBeGreaterThan(f.from)
    expect(verifyItem('The comment stripper and its readers')).toContain('changes four of the eight TypeScript files')
    expect(lineOf(deviations, '- **The stripper\'s strings end on their line (WS02 step 4).**')).toContain('keeps block comments in four of the TypeScript files')
  })
})

describe('the reads moved in the WS02 step 4 record', () => {
  const reads = bullet('- **The reads moved.**')
  /** The spec's count and the lines it lists, from its line of the bullet. */
  function moved(spec: string): { count: number; lines: number[] } {
    const line = lineOf(reads, `  - \`test/a11y/${spec}\`, `)
    const count = Number(/^ {2}- `[^`]+`, (\d+):/.exec(line)?.[1] ?? Number.NaN)
    const lines: number[] = []
    for (const group of line.matchAll(/\(([^)]*)\)/g)) {
      for (const part of group[1].matchAll(/(\d+) to (\d+)|(\d+)/g)) {
        if (part[3] !== undefined) lines.push(Number(part[3]))
        else for (let at = Number(part[1]); at <= Number(part[2]); at++) lines.push(at)
      }
    }
    return { count, lines }
  }

  it('adds up the plan\'s eleven files and WS02\'s own four, by the rule it states', () => {
    const plan = between(reads, 'in exactly the plan\'s 11 files:', '; with comments')
    const elevenSpecs = [...plan.matchAll(/`([\w-]+\.spec\.ts)` (\d+) and (\d+)/g)].map((m) => ({ spec: m[1], header: Number(m[2]), footer: Number(m[3]) }))
    expect(elevenSpecs).toHaveLength(11)
    const [header, footer] = figures(reads, /finds (\d+) header lines and (\d+) footer lines/, 'this tree\'s count')
    expect(sum(elevenSpecs.map((s) => s.header))).toBe(header)
    expect(sum(elevenSpecs.map((s) => s.footer))).toBe(footer)
    const own = between(reads, 'WS02\'s own four specs', 'Read line by line')
    const fourSpecs = [...own.matchAll(/`([\w-]+\.spec\.ts)` (\d+) and (\d+)/g)].map((m) => ({ spec: m[1], header: Number(m[2]), footer: Number(m[3]) }))
    expect(fourSpecs.map((s) => s.spec)).toEqual(['nav.spec.ts', 'nav-edges.spec.ts', 'signed-in.spec.ts', 'signed-in-edges.spec.ts'])
    const [ownHeader, ownFooter] = figures(own, /add (\d+) and (\d+), \d+ lines/, 'WS02\'s own specs\' count')
    expect(sum(fourSpecs.map((s) => s.header))).toBe(ownHeader)
    expect(sum(fourSpecs.map((s) => s.footer))).toBe(ownFooter)
    // The verify item on the size of the rework gives the same figures.
    expect(verifyItem('The size of the rework')).toContain(`${header} and ${footer} lines`)
    expect(verifyItem('The size of the rework')).toContain(`WS02's own four specs add ${ownHeader} and ${ownFooter}`)
  })

  it('lists for each spec as many of its lines as it says moved, none twice', () => {
    for (const spec of ['brand.spec.ts', 'brand-edges.spec.ts', 'heritage.spec.ts', 'home.spec.ts', 'tokens.spec.ts', 'nav.spec.ts', 'nav-edges.spec.ts']) {
      const { count, lines } = moved(spec)
      expect(lines, spec).toHaveLength(count)
      expect(new Set(lines).size, spec).toBe(lines.length)
    }
  })

  it('makes the lines that moved of WS01\'s five specs and WS02\'s four, as the deviations and the verify item give them', () => {
    const counts = (specs: string[]) => specs.map((spec) => moved(spec).count)
    const signedIn = figures(reads, /`test\/a11y\/signed-in\.spec\.ts`, (\d+), and `test\/a11y\/signed-in-edges\.spec\.ts`, (\d+):/, 'the signed-in specs\' counts')
    const ws01 = sum(counts(['brand.spec.ts', 'brand-edges.spec.ts', 'heritage.spec.ts', 'home.spec.ts', 'tokens.spec.ts']))
    const ws02Own = sum(counts(['nav.spec.ts', 'nav-edges.spec.ts'])) + sum(signedIn)
    const [all, specs] = figures(reads, /are (\d+) in (\d+) files, and every one now goes through the helper/, 'the lines that moved')
    expect(specs).toBe(9)
    expect(ws01 + ws02Own).toBe(all)
    expect(verifyItem('The size of the rework')).toContain(`${all} lines in ${specs} files locate the site's chrome, ${ws01} of them in WS01's five specs and ${ws02Own} in WS02's four`)
    expect(lineOf(deviations, '- **WS02\'s own specs read through the helper too (WS02 step 4).**')).toContain(`their ${ws02Own} lines that locate the chrome`)
    expect(lineOf(deviations, '- **The reads counted again (WS02 step 4).**')).toContain(`the ${all} lines in ${specs} files that locate the site's chrome`)
  })
})

describe('the closing search and the grep check in the WS02 step 4 record', () => {
  it('adds up the closing search\'s kinds of lines to the lines it found', () => {
    const search = verifyItem('The closing search')
    const [found] = figures(search, /as words, finds (\d+) lines/, 'the lines the closing search found')
    const opening = 'besides the fixture page\'s own header in `tokens.spec.ts`: '
    const kinds = between(search, opening, '. A search of `test/`').slice(opening.length)
    const parts = kinds.split('; ').map((part) => Number(/^(?:and )?(\d+) (?:are|is|read)\b/.exec(part)?.[1] ?? Number.NaN))
    expect(parts.length).toBeGreaterThan(5)
    expect(parts.every((p) => Number.isInteger(p))).toBe(true)
    expect(sum(parts)).toBe(found)
  })

  it('gives the grep check\'s lines as the sum of its parts, over the files the Files bullet counts', () => {
    const grep = verifyItem('The grep check')
    const [total, adds, added, changedFiles, newLines, newFiles, drafts] = figures(
      grep,
      /Measured: ([\d,]+) lines, the ([\d,]+) this step adds against `42289d4` \(the ([\d,]+) added lines of the (\w+) changed files, as `git diff --numstat` counts them, and the ([\d,]+) lines of the (\w+) new files\) and the ([\d,]+) of the commit and pull request texts/,
      'the grep check\'s parts',
    )
    expect(adds).toBe(added + newLines)
    expect(total).toBe(adds + drafts)
    const paths = (line: string) => [...line.matchAll(/`([\w./-]+\.(?:tsx?|css|md))` \(/g)].map((m) => m[1])
    const changedPaths = [...paths(changedLine), ...paths(testsChanged)]
    expect(new Set(changedPaths).size).toBe(changedFiles)
    expect(paths(newLine)).toHaveLength(newFiles)
  })
})

describe('the eighteen checks of today\'s chrome under newLook', () => {
  const eighteen = bullet('- **Today\'s chrome under newLook.**')
  /** The tests the list says each check is kept in, by file and title. */
  const KEPT: Array<[string, string]> = [
    ['test/unit/brand-placements.test.tsx', 'the brand link holds one mark and the header no image; put today\'s image back and the header is today\'s'],
    ['test/unit/brand-placements.test.tsx', 'is LcaLogo at 56px with empty words, beside the name, on the navy with no plate; put today\'s image back and the footer is today\'s'],
    ['test/unit/brand-placements.test.tsx', 'is the favicon\'s rook, 28px on a phone and 30px wider, in the header\'s white with no colour of its own, hidden from screen readers'],
    ['test/unit/brand-edges.test.tsx', 'under the new look, %s: one rook in the brand link, no image anywhere in the header, the link named once'],
    ['test/unit/brand-placements.test.tsx', 'the brand link is named once, by its words; today it is named twice, by the image and the words'],
    ['test/unit/brand-placements.test.tsx', 'is left out by a screen reader, which reads the name beside it once'],
    ['test/unit/lca-mark.test.tsx', 'is the official file: a 400 by 399 picture of 16,468 bytes, unchanged'],
    ['test/unit/brand-placements.test.tsx', 'has nothing from the logo up to the footer that could recolour it: no opacity, filter, blend or brightness class'],
    ['test/unit/heritage-app-routes.test.tsx', '%s is drawn in a heritage div that is the site\'s main\'s own child, with the header and the footer outside it'],
    ['test/unit/heritage-app-routes.test.tsx', '%s draws the header, its brand link, the footer and the footer\'s first four links with the classes the home page gives them'],
    ['test/unit/appearance-control.test.tsx', 'carries the control beside the copyright line, once'],
    ['test/unit/appearance-control.test.tsx', 'sits on the footer\'s own navy, with nothing between giving a ground or a ring of its own, so the navy band rule rings it gold'],
  ]
  /** What the list quotes that is not a test's title: a follow-up, a name, an attribute's value and three phrases. */
  const NOT_TITLES = [
    'K looks at today\'s chrome under newLook on a preview (WS02 step 4)', 'Louisiana Chess Association', 'currentColor',
    'drawn as on `/`', 'every image has a width and a height', 'nothing recolours it',
  ]

  it('names each test it keeps a check in, in a file it names, and the test is there', () => {
    for (const [file, title] of KEPT) {
      expect(eighteen, title).toContain(`"${title}"`)
      expect(eighteen, file).toContain(`\`${file}\``)
      expect(read(file).replace(/\\'/g, '\''), `${file}: ${title}`).toContain(title)
    }
  })

  it('quotes nothing else but the start of one of those titles, ended with an ellipsis, and the few words that are not titles', () => {
    for (const [, quoted] of eighteen.matchAll(/"([^"]+)"/g)) {
      if (NOT_TITLES.includes(quoted) || KEPT.some(([, title]) => title === quoted)) continue
      const start = /^(.+)[,;] \.\.\.$/.exec(quoted)?.[1]
      expect(start, `"${quoted}"`).toBeDefined()
      expect(KEPT.filter(([, title]) => title.startsWith(start!)), `"${quoted}"`).toHaveLength(1)
    }
  })
})

describe('the gold-ink codemod\'s command line', () => {
  /** Each test under "the command line" in test/unit/gold-ink.test.ts: its title, the runs of the codemod it makes and its own time limit. */
  function commandLineTests(): Array<{ title: string; runs: number; limit: number | null }> {
    const path = 'test/unit/gold-ink.test.ts'
    const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const found: Array<{ title: string; runs: number; limit: number | null }> = []
    /** The runs a piece of a test makes: each call of run, as many times as a loop over a written list repeats it. */
    const runsIn = (node: ts.Node, times: number): number => {
      let count = 0
      const visit = (child: ts.Node, repeat: number) => {
        if (ts.isForOfStatement(child) && ts.isArrayLiteralExpression(child.expression)) {
          visit(child.statement, repeat * child.expression.elements.length)
          return
        }
        if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === 'run') count += repeat
        ts.forEachChild(child, (c) => visit(c, repeat))
      }
      visit(node, times)
      return count
    }
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'describe' && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'the command line') {
        const body = node.arguments[1]
        const tests = (child: ts.Node) => {
          if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === 'it' && ts.isStringLiteral(child.arguments[0])) {
            const limit = child.arguments[2]
            found.push({
              title: child.arguments[0].text,
              runs: runsIn(child.arguments[1], 1),
              limit: limit && ts.isNumericLiteral(limit) ? Number(limit.text.replace(/_/g, '')) : null,
            })
            return
          }
          ts.forEachChild(child, tests)
        }
        tests(body)
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
    return found
  }

  it('runs the codemod 5, 5, 1 and 1 times in its four tests, as the record counts them', () => {
    const counted = verifyItem('The command line tests of the gold-ink codemod')
    const [first, second, third, fourth] = figures(counted, /which run `scripts\/codemods\/gold-ink\.ts` (\d+), (\d+), (\d+) and (\d+) times/, 'how many times each test runs the codemod')
    expect(commandLineTests().map((t) => t.runs)).toEqual([first, second, third, fourth])
  })

  it('gives each test that runs it five times 20 seconds or more, the limit the record says they were given', () => {
    expect(verifyItem('The command line tests of the gold-ink codemod')).toContain('now carry 20 seconds, `}, 20_000)`')
    const fiveRuns = commandLineTests().filter((t) => t.runs >= 5)
    expect(fiveRuns).toHaveLength(2)
    for (const t of fiveRuns) expect(t.limit, t.title).toBeGreaterThanOrEqual(20_000)
  })
})

describe('the record test of WS02 step 4', () => {
  it('reads no switch and not the helper\'s answer: it imports neither, and reads the helper as words', () => {
    const source = read('test/unit/redesign-status-ws02-step4.test.ts')
    const imported = [...source.matchAll(/^import [^\n]* from '([^']+)'/gm)].map((m) => m[1])
    expect(imported).toEqual(expect.arrayContaining(['vitest']))
    // The switches, the chrome's condition, the helper and the builds it answers for.
    for (const answer of ['@/lib/features', '@/lib/nav', '../a11y/chrome', '../a11y/global-setup', '../a11y/support']) expect(imported, answer).not.toContain(answer)
    expect(source).not.toMatch(/\bFEATURES\b|\bchromeOn\(|\bchromeAt\(|\btodayAt\(|\bimport\(/)
    expect(source).toContain('read(\'test/a11y/chrome.ts\')')
  })
})
