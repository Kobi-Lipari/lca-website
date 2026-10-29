// test/unit/redesign-status-ws02-step3-claims.test.ts
//
// The figures the WS02 step 3 record gives, checked against each other.
// test/unit/redesign-status-ws02-step3.test.ts pins the record's words and
// a few of its claims against the files; this file holds that the numbers
// the record states in more than one place, or builds from parts, agree, so
// a figure brought up to date in one place and not in another fails here:
//
// - the unit counts: the total is the count before, the new files' tests and
//   the changed files' gains, file for file with the Files bullet, and the
//   file count rises by the new files
// - the browser counts: the rise is the new specs' tests, in each project
//   and in all, run and skipped, and the run's own quoted lines say the same
// - the build: the three stylesheets make the CSS total, the main script's
//   growth is the JavaScript's and is made of its three parts, the files
//   that took new names and those that kept theirs make the whole folder,
//   and the comparison with main adds up
// - the stylesheet: the four lines' saving, the new rules' growth and the
//   net change agree between the block and its verify items, and the rules
//   and class names the lines took out are counted the same way twice
// - the charset meta: it moved by exactly what the script grew, it is the
//   24 bytes index.html writes, and the room left is what the block says
// - lint: the files it read rose by the new code files the block lists
// - the layout shift figures are the same in the map, the block and the
//   verify item
// It reads only the WS02 section, and pins no switch's value.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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
const block = between(ws02, '### WS02 step 3: the page frame, the chrome\'s rings, the browser bar colour and the loading line', '\n### ')
const verify = between(ws02, '### WS02 verify items resolved', '\n### ')
const map = between(ws02, '### WS02 map: what proves each acceptance criterion and decision', '\n### ')
/** A line of `text` that starts with `start`. */
const lineOf = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(start)) ?? ''
/** A bullet of the block and the lines indented under it. */
function bullet(start: string): string {
  const all = block.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
/** A number as the record writes it, with commas between its thousands. */
const n = (written: string) => Number(written.replace(/,/g, ''))
/** The numbers a pattern finds, as numbers, or a failure that names what was looked for. */
function figures(text: string, pattern: RegExp, what: string): number[] {
  const m = pattern.exec(text)
  if (!m) throw new Error(`the record no longer says ${what}`)
  return m.slice(1).map((g) => (g === undefined ? Number.NaN : n(g)))
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const files = bullet('- **Files.**')
const newFiles = lineOf(files, '  - New:')
const changedTests = lineOf(files, '  - Tests changed:')
const checks = lineOf(block, '- Checks:')

describe('the unit counts in the WS02 step 3 record', () => {
  /** Each new unit test file the Files bullet lists, with the number of its tests. */
  const newUnit = [...newFiles.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx?)` \((\d+): /g)].map((m) => ({ file: m[1], tests: Number(m[2]) }))
  /** Each changed test file, with its count after and before ("as before" being no change). */
  const changed = [...changedTests.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx?)` \((\d+), (?:(\d+) before|as before)/g)].map((m) => ({
    file: m[1], after: Number(m[2]), before: m[3] === undefined ? Number(m[2]) : Number(m[3]),
  }))

  it('reads every new unit file and every changed one the Files bullet lists', () => {
    expect(newUnit.map((f) => f.file)).toEqual(expect.arrayContaining(['test/unit/theme-color.test.tsx', 'test/unit/app-frame.test.tsx', 'test/unit/redesign-status-ws02-step3.test.ts']))
    expect(changed.map((f) => f.file)).toEqual(expect.arrayContaining(['test/unit/prepaint-gate.test.ts', 'test/unit/contrast.test.ts', 'test/unit/announcement-banner-ground.test.tsx']))
    // Every test file the bullet names in either list is read here, so none is left out of the sums.
    const named = (line: string) => [...line.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx?)` \(/g)].map((m) => m[1])
    expect(named(newFiles)).toEqual(newUnit.map((f) => f.file))
    expect(named(changedTests)).toEqual(changed.map((f) => f.file))
  })

  it('makes the total from the count before, the new files\' tests and the changed files\' gains, file for file', () => {
    const [total, filesAfter, before, filesBefore] = figures(checks, /unit (\d+) tests in (\d+) files \((\d+) in (\d+) before;/, 'the unit counts in its Checks line')
    const held = /the \w+ new files hold ([\d, and]+?), and the changed files gain/.exec(checks)?.[1] ?? ''
    const newCounts = [...held.matchAll(/\d+/g)].map((m) => Number(m[0]))
    const gainLine = /the changed files gain (\d+): (.+?)\), integration/.exec(checks)
    expect(gainLine, 'the changed files\' gains in the Checks line').not.toBeNull()
    const gains = [...gainLine![2].matchAll(/(\d+) in `([^`]+)`/g)].map((m) => ({ file: m[2], gain: Number(m[1]) }))
    // The new files' counts are the Files bullet's, as a set of numbers.
    expect([...newCounts].sort((a, b) => a - b)).toEqual(newUnit.map((f) => f.tests).sort((a, b) => a - b))
    // The gains are the Files bullet's, file for file, and only the files that gained.
    expect(gains).toEqual(changed.filter((f) => f.after !== f.before).map((f) => ({ file: f.file, gain: f.after - f.before })))
    expect(Number(gainLine![1])).toBe(sum(gains.map((g) => g.gain)))
    expect(total).toBe(before + sum(newCounts) + Number(gainLine![1]))
    expect(filesAfter).toBe(filesBefore + newUnit.length)
  })

  it('gives the same figures before the step in its verify item as in its Checks line, and the integration suite unchanged', () => {
    const [before, filesBefore] = figures(checks, /\((\d+) in (\d+) before;/, 'the unit counts before the step')
    const item = lineOf(verify, '- **Lint and counts (WS02 step 3).**')
    expect(item).toContain(`unit ${before} tests in ${filesBefore} files and integration`)
    const [integration, integrationFiles] = figures(checks, /integration (\d+) in (\d+), as before/, 'the integration count')
    expect(item).toContain(`integration ${integration} in ${integrationFiles}`)
  })
})

describe('the browser counts in the WS02 step 3 record', () => {
  /** Each new browser spec the Files bullet lists, with its counts. */
  const specs = [...newFiles.matchAll(/`(test\/a11y\/[\w.-]+\.spec\.ts)` \((\d+) in each project, (\d+) in all, (\d+) that run and (\d+) that skip/g)].map((m) => ({
    file: m[1], each: Number(m[2]), all: Number(m[3]), run: Number(m[4]), skip: Number(m[5]),
  }))

  it('counts each new spec once in each project, every test of it run or skipped', () => {
    expect(specs.map((s) => s.file)).toContain('test/a11y/nav.spec.ts')
    expect([...newFiles.matchAll(/`(test\/a11y\/[\w.-]+\.spec\.ts)` \(/g)].map((m) => m[1])).toEqual(specs.map((s) => s.file))
    for (const s of specs) {
      expect(s.all, s.file).toBe(2 * s.each)
      expect(s.run + s.skip, s.file).toBe(s.all)
    }
  })

  it('rises from the count before by the new specs\' tests, run and skipped, and the run\'s own lines say the same', () => {
    const [total, run, skip, totalBefore, runBefore, skipBefore] = figures(
      checks, /(\d+) tests, (\d+) that run and (\d+) that skip \((\d+), (\d+) and (\d+) before\)/, 'the browser counts in its Checks line',
    )
    expect(total).toBe(run + skip)
    expect(totalBefore).toBe(runBefore + skipBefore)
    expect(total - totalBefore).toBe(sum(specs.map((s) => s.all)))
    expect(run - runBefore).toBe(sum(specs.map((s) => s.run)))
    expect(skip - skipBefore).toBe(sum(specs.map((s) => s.skip)))
    const runs = bullet('- **The browser runs.**')
    expect(runs).toContain(`"Running ${total} tests using 2 workers"`)
    expect(runs).toContain(`"${skip} skipped"`)
    expect(runs).toMatch(new RegExp(`"${run} passed \\(`))
    expect(runs).toContain(`${totalBefore} tests, ${runBefore} that run and ${skipBefore} that skip`)
    expect(lineOf(verify, '- **Lint and counts (WS02 step 3).**')).toContain(`${totalBefore} tests in`)
  })
})

describe('the build\'s figures in the WS02 step 3 record', () => {
  const build = bullet('- **Build.**')

  it('makes the CSS total from the three stylesheets, before and after, and the site\'s stylesheet the only one that changed', () => {
    const [cssBefore, cssAfter, siteBefore, siteAfter, fewer, heritage, live] = figures(
      build,
      /CSS ([\d,]+) bytes in three files before and ([\d,]+) after: the site's stylesheet, `index-\*\.css`, goes from ([\d,]+) to ([\d,]+) bytes, ([\d,]+) fewer, and the heritage and live stylesheets keep their ([\d,]+) and ([\d,]+) bytes/,
      'the stylesheets\' bytes in its Build bullet',
    )
    expect(cssBefore).toBe(siteBefore + heritage + live)
    expect(cssAfter).toBe(siteAfter + heritage + live)
    expect(siteBefore - siteAfter).toBe(fewer)
  })

  it('makes the JavaScript\'s growth the main script\'s, and the main script\'s from its three parts', () => {
    const [jsBefore, jsFiles, jsAfter, more, mainBefore, mainAfter, nav, frame, colour] = figures(
      build,
      /JavaScript ([\d,]+) bytes in (\d+) files before and ([\d,]+) after, all of the ([\d,]+) more in the main script, `index-\*\.js`, from ([\d,]+) to ([\d,]+) bytes, which the build's source map divides as ([\d,]+) bytes of `src\/lib\/nav\.ts`.*?, ([\d,]+) more of `src\/App\.tsx`.*?, and ([\d,]+) more of `src\/lib\/colorScheme\.ts`/,
      'the scripts\' bytes in its Build bullet',
    )
    expect(jsFiles).toBeGreaterThan(0)
    expect(jsAfter - jsBefore).toBe(more)
    expect(mainAfter - mainBefore).toBe(more)
    expect(nav + frame + colour).toBe(more)
  })

  it('counts every file of the folder: those with new names, those kept whole and the two that changed', () => {
    const [assetsBefore, assetsAfter] = figures(build, /: (\d+) and (\d+) files \((\d+) and (\d+) in `dist`\)/, 'the files of the folder in its Build bullet')
    expect(assetsAfter).toBe(assetsBefore)
    const [renamed, kept] = figures(build, /(\d+) files take new names at the same size, since only the names of files they import changed, (\d+) keep their names and bytes/, 'the renamed and kept files')
    // The main script and the site's stylesheet are the two whose bytes changed.
    expect(renamed + kept + 2).toBe(assetsAfter)
  })

  it('compares with main by the same main script and switches file it gives for the step', () => {
    const [mainAfter] = figures(build, /from [\d,]+ to ([\d,]+) bytes, which the build's source map/, 'the main script after the step')
    const [switches] = figures(build, /The switches file, `features-\*\.js`, keeps its ([\d,]+) bytes/, 'the switches file\'s bytes')
    const [larger, onMain, switchesMore, switchesOnMain] = figures(
      build, /the main script is ([\d,]+) bytes larger \(([\d,]+) bytes there\), the switches file ([\d,]+) \(([\d,]+) there\)/, 'the comparison with main',
    )
    expect(mainAfter - onMain).toBe(larger)
    expect(switches - switchesOnMain).toBe(switchesMore)
  })
})

describe('the stylesheet\'s figures in the WS02 step 3 record', () => {
  const lines4 = bullet('- **The `@source not` lines.**')
  const measured = lineOf(verify, '- **The @source not measurement (WS02 step 3).**')
  const growth = lineOf(verify, '- **The stylesheet\'s growth (WS02 step 3).**')

  it('gives the four lines\' saving, the new rules\' growth and the net change so that they agree', () => {
    const [before, withLines, saved] = figures(lines4, /goes from ([\d,]+) to ([\d,]+) bytes, ([\d,]+) fewer/, 'the four lines\' saving in its bullet')
    expect(before - withLines).toBe(saved)
    expect(measured).toContain(`${before.toLocaleString('en-US')} and ${withLines.toLocaleString('en-US')} bytes, ${saved.toLocaleString('en-US')} fewer`)
    const [from, to, grew] = figures(growth, /from ([\d,]+) bytes with the four lines alone to ([\d,]+) with all of this step, ([\d,]+) bytes/, 'the new rules\' growth')
    expect(from).toBe(withLines)
    expect(to - from).toBe(grew)
    const [net] = figures(growth, /The site's stylesheet is ([\d,]+) bytes smaller than on the base/, 'the net change')
    expect(saved - grew).toBe(net)
    const [siteBefore, siteAfter, fewer] = figures(bullet('- **Build.**'), /goes from ([\d,]+) to ([\d,]+) bytes, ([\d,]+) fewer, and the heritage/, 'the site\'s stylesheet in its Build bullet')
    expect([siteBefore, siteAfter, fewer]).toEqual([before, to, net])
  })

  it('counts the rules and the class names the lines took out the same way in the block and in the verify item', () => {
    const [rules, names, gone] = figures(lines4, /found (\d+) utility rules gone or rewritten, for (\d+) class names.*?: (\d+) of the rules left outright/, 'the rules the lines took out')
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
    const shared = words[/left outright, (\w+) that had shared their selector/.exec(lines4)?.[1] ?? '']
    const joined = words[/, and (\w+) that the removal left side by side/.exec(lines4)?.[1] ?? '']
    expect([shared, joined].every(Number.isInteger)).toBe(true)
    expect(gone + shared + joined).toBe(rules)
    const [none] = figures(lines4, /Of the (?:\d+) names, (\d+) are in no rule at all any more; the last/, 'the names gone from every rule')
    expect(none + 1).toBe(names)
    expect(measured).toContain(`${rules} utility rules left or were rewritten, naming ${names} classes`)
    expect(measured).toContain(`${none} names are gone and none came`)
  })
})

describe('the charset meta\'s figures in the WS02 step 3 record', () => {
  const place = lineOf(verify, '- **The script\'s place in the head (WS02 step 3).**')
  const where = lineOf(verify, '- **Where the Appearance choice is applied (WS02 step 3).**')
  const colour = bullet('- **The browser bar colour.**')

  it('moved by exactly what the script grew, is the meta index.html writes, and leaves the room the block gives', () => {
    const [startBefore, endBefore, shortBefore, start, end, short, script] = figures(
      place, /started at byte (\d+) and ended at (\d+), (\d+) bytes short of 1,024; now it starts at (\d+) and ends at (\d+), (\d+) short, with the script at (\d+) characters/, 'the charset meta\'s place',
    )
    const [scriptBefore] = figures(where, /`PREPAINT_SCRIPT` was at lines \d+ to \d+, (\d+) characters/, 'the script\'s length before the step')
    const charset = '<meta charset="UTF-8" />'
    expect(read('index.html')).toContain(charset)
    expect(endBefore - startBefore).toBe(Buffer.byteLength(charset))
    expect(end - start).toBe(Buffer.byteLength(charset))
    expect(1024 - endBefore).toBe(shortBefore)
    expect(1024 - end).toBe(short)
    // The script is plain ASCII, so it grew by as many bytes as characters, and the meta moved by that much.
    expect(start - startBefore).toBe(script - scriptBefore)
    const [length, grew, spare] = figures(colour, /The script is (\d+) characters, (\d+) more than before, and the page's charset meta still ends inside its first 1,024 bytes, with (\d+) to spare/, 'the script in the browser bar bullet')
    expect([length, grew, spare]).toEqual([script, script - scriptBefore, short])
  })
})

describe('the lint figures in the WS02 step 3 record', () => {
  it('rose by the new code files the block lists', () => {
    const [before, after] = figures(bullet('- **Lint.**'), /\((\d+) files and (\d+), the \w+ new files the difference\)/, 'the files lint read')
    const code = [...newFiles.matchAll(/`([\w./-]+\.(?:ts|tsx|js|mjs))` \(/g)].map((m) => m[1])
    expect(after - before).toBe(code.length)
  })
})

describe('the layout shift figures in the WS02 step 3 record', () => {
  it('are the same in the map, in the browser runs and in the verify item', () => {
    const runs = bullet('- **The browser runs.**')
    const item = lineOf(verify, '- **The layout shift as measured (WS02 step 3).**')
    const ac23 = map.split('\n').find((l) => l.startsWith('- **AC23.**')) ?? ''
    for (const text of [ac23, runs, item]) {
      expect(text).toMatch(/0\.0000 at 390 (?:pixels )?and 0\.0001 at 1280/)
      expect(text).toMatch(/`\/about` 0\.6718 at 390 pixels and 0\.2494 at 1280|0\.6718 and 0\.2494 on `\/about`/)
      expect(text).toMatch(/`\/membership` 0\.6718 and 0\.4045|0\.6718 and 0\.4045 on `\/membership`/)
    }
  })
})

describe('the files of WS02 step 3, in plain words', () => {
  /** An en dash or an em dash, written by code so that this file holds neither. */
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  /** The names of tools a file must not mention, split up so that this file does not mention them either. */
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'co-' + 'authored'].join('|')})\\b`, 'i')
  /** The two letters on their own, and US Chess's old initials. */
  const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
  const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
  /** Where a file breaks the rules, line by line, so a failure names the line. */
  const breaches = (file: string) =>
    read(file).split('\n').flatMap((text, i) => ([DASHES, TOOLS, BARE, OLD_INITIALS].some((rule) => rule.test(text)) ? [`${file} line ${i + 1}: ${text.trim()}`] : []))

  it.each([
    'test/unit/source-not-lines.test.ts',
    'test/unit/theme-color-edges.test.tsx',
    'test/unit/app-frame-edges.test.tsx',
    'test/unit/chrome-rings-edges.test.tsx',
    'test/unit/redesign-status-ws02-step3-claims.test.ts',
    'test/a11y/nav-edges.spec.ts',
  ])('the edge test %s holds no dash, no tool\'s name, neither letter pair and no old initials', (file) => {
    expect(breaches(file)).toEqual([])
  })

  // The brief's AC8: the source files the step changed hold no literal dash and no tool's name, as files, not only in the lines the step wrote.
  it.each([
    'src/App.tsx',
    'src/lib/colorScheme.ts',
    'src/hooks/useColorScheme.ts',
    'src/index.css',
    'src/components/AnnouncementBanner.tsx',
    'src/components/ImpersonationBanner.tsx',
  ])('the changed source file %s holds no dash, no tool\'s name, neither letter pair and no old initials', (file) => {
    expect(breaches(file)).toEqual([])
  })
})
