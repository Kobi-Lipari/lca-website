// test/unit/redesign-status-step28.test.ts
//
// REDESIGN_STATUS.md records step 28 (the rook mark and the official logo)
// and REDESIGN_SPEC.md's WS01 deviation list carries its sentence. The
// living parts are pinned: the AC10 row names its proofs and is no longer
// planned, and the AC8 row is left as it was, since the fixture page's boxes
// did not change; the step block sits in order and describes the two
// components, the header, the footer, About, the LCA tag, the places left for
// later, the judgement calls, the lint, the build and the browser runs, with
// the counts the tree holds; the decisions are there, and the lines planned
// for this step (the Appearance control and the rook mark, and the earlier
// deviation about the LCA tag) keep their words with Done in step 28 added;
// the verify items and follow-ups are there, none renamed or removed, the
// LCA tag's rook closed and D1's other placements recorded with their
// owners; and the plain-language rules hold (no em dash, none of the working
// words, no mention of an assistant, US Chess rather than its old initials).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')
const footer = readFileSync(join(ROOT, 'src/components/layout/Footer.tsx'), 'utf8')
const badge = readFileSync(join(ROOT, 'src/components/StatusBadge.tsx'), 'utf8')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
/** The names of the tools a record must not mention, split up so this file does not mention them either. */
const ASSISTANT = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** An en dash or an em dash, written by code so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

const lines = status.split('\n')
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
const between = (from: string, to: string) => {
  const start = status.indexOf(from)
  if (start < 0) return ''
  const end = status.indexOf(to, start + from.length)
  return status.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it, from the first line that starts with `start` after `after`. */
function bullet(start: string, after = ''): string {
  const from = after ? lines.findIndex((l) => l.startsWith(after)) : 0
  const at = lines.findIndex((l, i) => i >= from && l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}

const HEADING = '### Step 28: the rook mark and the official logo'
const block = between(HEADING, '### Decisions')
const ac10 = line('| AC10 |')
const ac8 = line('| AC8 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 28)'))
const tagged = lines.filter((l) => /\(steps? (?:21 and )?28[;)]/.test(l))
const deviation = bullet('- **Step 28.**')
const appearance = line('- **Appearance control and the rook mark (steps 21 and 28).**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))

describe('REDESIGN_STATUS.md, step 28: the acceptance rows', () => {
  it('fills the AC10 row for step 28: no longer planned, with its proofs', () => {
    expect(ac10).toMatch(/^\| AC10 \| Official logo and rook mark in their placements \| 28 \| /)
    expect(ac10).not.toContain('Planned')
    for (const piece of [
      'test/unit/lca-mark.test.tsx',
      'test/unit/brand-placements.test.tsx',
      'test/unit/fixtures/brand-today.ts',
      'test/a11y/brand.spec.ts',
      '`src/components/LcaMark.tsx`',
      '`src/components/LcaLogo.tsx`',
      '`public/favicon.svg`',
      '`src/assets/lca-logo.webp`',
      '`currentColor`',
      '`[data-slot="lca-mark"]`',
      '`data-slot="lca-logo-mat"`',
      '1280, 768 and 390 pixels',
      'with a light and a dark device',
      '14.81:1',
      'the same length and hash',
      '`/about` does not scroll sideways at 390 pixels',
      '`test/a11y/brand-edges.spec.ts`',
      'with forced colours on',
      '13.99:1',
      'test/a11y/baseline.json',
      '`df62ca3`',
      'D1\'s other placements (step 28)',
    ]) expect(ac10, piece).toContain(piece)
    // Only /about is measured for sideways scroll there; other pages are recorded under Follow-ups.
    expect(ac10).not.toContain('no page scrolls sideways')
  })

  it('names every refusal of the logo\'s type, so the row says it is never recoloured', () => {
    for (const piece of ['a class', 'a style', 'a filter', 'a colour', 'an opacity', 'another file', 'never recoloured']) expect(ac10, piece).toContain(piece)
  })

  it('leaves the AC8 row as it was: the fixture page\'s boxes did not change, so no sentence is added for step 28', () => {
    expect(ac8).not.toContain('step 28')
    expect(ac8).toMatch(/the status tags' boxes stay put in every look too\. \|$/)
    expect(ac8.indexOf('Since step 27')).toBeLessThan(ac8.indexOf('Since step 26'))
  })
})

describe('REDESIGN_STATUS.md, step 28: the step block', () => {
  it('sits after step 27 and before the Decisions, and the date line names it, after any later step', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 27:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:29|3\d): [^;]+; )*step 28: [^;]+; step 27: [^;]+; step 26: /)
    // The older record tests look for these steps in the file's first 400 characters.
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('records the components, the three places, the LCA tag, the places left for later, the judgement calls, the lint, the build and the browser runs', () => {
    for (const part of ['**Files.**', '**LcaMark**', '**LcaLogo**', '**The header.**', '**The footer.**', '**About.**', '**The LCA tag.**', '**The places left for later.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**']) {
      expect(block, part).toContain(part)
    }
    const calls = bullet('- **Judgement calls.**', HEADING)
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
    expect(calls).toContain('K reviews these calls, with those of steps 23 to 27, before `newLook` is turned on')
    for (const piece of ['30 pixels wide and 28 on a phone', '`aria-label`', 'no plate', 'Q9', 'empty words', 'above "Who we are"', '`slot`', 'without the switch', '`height: auto`', 'snapshot']) {
      expect(calls, piece).toContain(piece)
    }
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    // The intro says which change does not depend on the switch, and why.
    expect(block).toContain('The LCA status tag\'s rook is the one change that does not depend on the switch')
  })

  it('describes the mark: the favicon\'s path in the colour of its words, named by its title or hidden', () => {
    const mark = bullet('- **LcaMark**', HEADING)
    for (const piece of ['`public/favicon.svg`', '196 characters', '`currentColor`', '`#ffd54a`', '`role="img"`', 'empty or blank title', '`data-slot="status-mark"`', 'only-export-components', 'Seal']) {
      expect(mark, piece).toContain(piece)
    }
  })

  it('describes the logo: the file as it is, its words, its own white ground and nothing a caller can recolour', () => {
    const logo = bullet('- **LcaLogo**', HEADING)
    for (const piece of ['`src/assets/lca-logo.webp`', '400 by 399 pixels, 16,468 bytes', '`width`, `height` and `alt`', 'no class, style, colour, filter or opacity', 'no transparency', 'white or cream', '55.86 pixels']) {
      expect(logo, piece).toContain(piece)
    }
  })

  it('describes the three places as drawn, and the gold guard\'s footer line kept where it is', () => {
    const header = bullet('- **The header.**', HEADING)
    for (const piece of ['`text-white`', 'which it inherits', '14.81:1', 'WCAG 1.4.11', '`size-7 md:size-[30px]`', 'Nav-Header-Final', 'forced colours', '1.00:1', '13.99:1', 'named once', 'named twice', 'WS02']) expect(header, piece).toContain(piece)
    const foot = bullet('- **The footer.**', HEADING)
    for (const piece of ['56 pixels', 'no plate', '`alt=""`', 'Nav-Footer-Final', 'line 94']) expect(foot, piece).toContain(piece)
    expect(footer.split('\n')[93]).toContain('tracking-widest text-lca-gold')
    const about = bullet('- **About.**', HEADING)
    for (const piece of ['`GovLayout`', '"Who we are"', '160 pixels', '`data-slot="lca-logo-mat"`', 'border-hairline bg-surface p-3', 'no `bg-white`', '`#fffdf8`', 'Step 31']) expect(about, piece).toContain(piece)
  })

  it('describes the LCA tag\'s rook, and that the lines the gold guard and the contrast test read stay', () => {
    const tag = bullet('- **The LCA tag.**', HEADING)
    for (const piece of ['11 pixels', '`data-slot="status-mark"`', '`animation: none`', 'without the switch', 'lines 26 to 41', 'lines 59 to 66', '13 `[data-status]` elements', '17 pixels wider']) {
      expect(tag, piece).toContain(piece)
    }
    const source = badge.split('\n')
    expect(source[27]).toBe("    gold: 'bg-lca-gold/20 text-lca-gold',")
    expect(source[58]).toBe("  open: 'bg-status-open-tint text-status-open',")
    expect(source[65]).toBe("  lca: 'bg-status-lca-tint text-status-lca',")
  })

  it('records where every place of D1 stands, with the owners of those not built yet', () => {
    const later = bullet('- **The places left for later.**', HEADING)
    for (const piece of ['favicon', 'small badge', 'QR', 'social avatar', '`public/email-logo.jpg`', '`public/og-default.jpg`', 'WS03', 'WS12', 'WS10', 'WS14', '`src/pages/ChampionsPage.tsx`', 'Board, Bylaws, Minutes and Annual meeting', 'certificates and the print kit cover', 'no workstream']) {
      expect(later, piece).toContain(piece)
    }
  })

  it('names every file the step adds, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'src/components/LcaMark.tsx',
      'src/components/LcaLogo.tsx',
      'test/unit/lca-mark.test.tsx',
      'test/unit/brand-placements.test.tsx',
      'test/unit/fixtures/brand-today.ts',
      'test/unit/redesign-status-step28.test.ts',
      'test/a11y/brand.spec.ts',
      'src/components/StatusBadge.tsx',
      'test/unit/status-badge.test.tsx',
      'test/unit/browser-test-wiring.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
  })

  it('names every test whose header says it is of step 28 in its Files, and the files beyond the step\'s list in the deviation', () => {
    const files = bullet('- **Files.**', HEADING)
    const ofStep = ['test/unit', 'test/a11y'].flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`)
        .filter((path) => /\bstep 28\b(?!'s)/.test(readFileSync(join(ROOT, path), 'utf8').split('\n').slice(0, 25).join('\n'))),
    )
    expect(ofStep.length).toBeGreaterThanOrEqual(5)
    for (const path of ofStep) expect(files, path).toContain(`\`${path}\``)
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 28.**')
    for (const path of [
      'src/components/StatusBadge.tsx',
      'docs/redesign/REDESIGN_SPEC.md',
      'test/unit/brand-placements.test.tsx',
      'test/unit/fixtures/brand-today.ts',
      'test/unit/status-badge.test.tsx',
      'test/unit/browser-test-wiring.test.ts',
      'test/unit/redesign-status-step28.test.ts',
    ]) expect(beyond, path).toContain(`\`${path}\``)
  })

  it('reports the build before and after, and the browser runs as measured', () => {
    const build = bullet('- **Build.**', HEADING)
    expect(build).toMatch(/CSS 127,854 and [\d,]+ bytes \(one file, [\d,]+ more\)/)
    expect(build).toMatch(/JavaScript 2,583,381 and [\d,]+ bytes \([\d,]+ more\) in 104 and 104 files; 127 and 127 files in all/)
    expect(build).toMatch(/the CSS is [\d,]+ bytes before and [\d,]+ after/)
    expect(build).toContain('`md:size-[30px]`')
    expect(build).toContain('`npm run check:bundle` finds no zod')
    expect(block).not.toMatch(/\{[A-Z_0-9]+\}/)
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const piece of ['`test/a11y/brand.spec.ts`', '14.81:1', 'Louisiana Chess Association Louisiana Chess Association', 'rgb(17, 26, 44)', '`image/webp`', 'first run on `/about`']) {
      expect(runs, piece).toContain(piece)
    }
    expect(block).toContain('"Baseline matches: no colour or font changed."')
    expect(block).toContain('`SQLITE_BUSY`')
    for (const route of ['/', '/tournaments', '/membership']) expect(block).toContain(`axe in dark mode on ${route}:`)
    expect(block).toMatch(/\d{3} passed and \d{2} skipped \(260 and 51 before;/)
    expect(block).toContain('`brand.spec.ts` adds 10 tests that run on `a11y-on` and 6 on `a11y-off`')
    expect(block).toContain('`brand-edges.spec.ts` adds 9 tests that run on `a11y-on` and 6 on `a11y-off`')
    for (const piece of ['`test/a11y/brand-edges.spec.ts`', 'forced colours', '13.99:1', '19.56:1', '`/about` does not scroll sideways at 390 pixels', 'Pages wider than a phone']) expect(runs, piece).toContain(piece)
    expect(runs).not.toContain('no page scrolls sideways')
  })

  it('states the unit and integration counts the tree holds', () => {
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toMatch(/unit \d{4} tests in 141 files \(3741 in 137 before;/)
    expect(checks).toContain('integration 790 in 58 (unchanged)')
  })
})

describe('REDESIGN_STATUS.md, step 28: decisions, deviations, verify items and follow-ups', () => {
  it('records the brand decisions, none of them under step 27\'s name', () => {
    expect(decisions).toHaveLength(2)
    const text = decisions.join('\n')
    for (const piece of ['`LcaMark`', '`LcaLogo`', '`src/components/LcaMark.tsx`', '`src/components/LcaLogo.tsx`', 'never recoloured', 'no plate', '`data-slot="lca-logo-mat"`', 'read once']) {
      expect(text, piece).toContain(piece)
    }
    for (const d of decisions) expect(d).not.toContain('(step 27)')
  })

  it('keeps the planned line for steps 21 and 28 word for word, with what was built after it', () => {
    expect(appearance).toContain('- **Appearance control and the rook mark (steps 21 and 28).** Until WS02 rebuilds the footer, the Appearance control (System, Light, Dark) sits in the current footer behind `newLook`, and the script that applies the choice before the page paints is included only when `newLook` is on (done in step 21). The current header shows the rook mark under `newLook`. The full-colour logo goes on `/about`; the AC10 placements whose pages do not exist yet (the identity band, membership card, certificates, the print kit cover and the Champions page) wait for WS03, WS10 and WS12. Done in step 28:')
    for (const piece of ['`LcaMark`', '`LcaLogo`', 'every width', 'WS14', 'D1\'s other placements (step 28)']) expect(appearance, piece).toContain(piece)
  })

  it('keeps step 26\'s deviation about the LCA tag word for word, with Done in step 28 after it', () => {
    const step26 = bullet('- **Step 26.**')
    expect(step26).toContain('The LCA tag has no mark until step 28\'s `LcaMark`, where the tile draws the rook. Done in step 28: the LCA tag draws the rook of `LcaMark`')
  })

  it('lists the step 28 deviations from the brief and the plan', () => {
    for (const piece of ['`src/components/StatusBadge.tsx`', 'without the switch', '`data-slot="status-mark"`', 'surface token', 'no plate', '`aria-label`', '`className` and a `slot`', 'whose `text-white` it inherits', 'forced colours', 'follow-up', 'spec line 587', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('resolves the three verify items it was given, and the ones it found', () => {
    for (const name of [
      'Which logo file is current',
      'Rook mark source',
      'D1 placements in WS01 scope',
      'The header today',
      'The footer today',
      'About today',
      'The LCA tag',
      'The image files',
      'The email preview\'s logo',
      'The unit pins',
      'The baseline',
      'The checker on /about',
      'Names',
      'Records',
      'Lint, build and the browser runs',
      'Counts',
      'Forced colours',
      'Sideways scroll on a phone',
    ]) expect(verify, name).toContain(`- **${name} (step 28).**`)
    const current = line('- **Which logo file is current (step 28).**')
    for (const piece of ['16,468 bytes', '2,403,503 bytes', '18,914 bytes', 'line 45', 'line 164', '`emailLogoUrl`', 'no transparency']) expect(current, piece).toContain(piece)
    const source = line('- **Rook mark source (step 28).**')
    for (const piece of ['420 bytes', '196 characters', '`#1a2744`', '`#ffd54a`', '`index.html` line 5']) expect(source, piece).toContain(piece)
    const files = line('- **The image files (step 28).**')
    for (const piece of ['14 files', '`hero.png`', '`react.svg`', '`vite.svg`', '`icons.svg`', '127 files']) expect(files, piece).toContain(piece)
  })

  it('closes the LCA tag\'s rook under its old name and adds its sentences to the open ones it meets', () => {
    const rook = line('- **The LCA tag\'s rook (step 26).**')
    expect(rook).toContain('The tile draws the LCA tag with the rook mark before its words; step 28 adds it through `LcaMark`. Done in step 28:')
    for (const name of ['Classes only docs and tests name reach the CSS (step 23)', 'The a11y servers share one database (step 23)']) {
      expect(line(`- **${name}.**`), name).toContain('Step 28')
    }
    // Still open: the step adds to them and closes neither.
    expect(line('- **The a11y servers share one database (step 23).**')).not.toContain('Done in step 28')
    expect(line('- **The baseline sampler waits for content (step 27).**')).not.toContain('Done in step 28')
  })

  it('lists what it leaves as follow-ups headed with step 28, D1\'s other placements in one with their owners', () => {
    for (const name of [
      'K reviews the step 28 judgement calls (step 28)',
      'D1\'s other placements (step 28)',
      'The email preview\'s logo file (step 28; older than the step)',
      'The header\'s brand link in WS02 (step 28)',
      'The About logo in the heritage layout (step 28)',
      'The seal from the rook (step 28)',
      'The About page\'s words (step 28; older than the step)',
      'Image files nothing uses (step 28; older than the step)',
      'Pages wider than a phone, and a main inside a main (step 28; older than the step)',
    ]) expect(followUps, name).toContain(`- **${name}.**`)
    const placements = line('- **D1\'s other placements (step 28).**')
    for (const piece of ['WS03', 'WS12', 'WS10', 'WS14', '`src/pages/ChampionsPage.tsx`', 'Board, Bylaws, Minutes and Annual meeting', 'certificates and the print kit cover', 'K places them']) {
      expect(placements, piece).toContain(piece)
    }
    const email = line('- **The email preview\'s logo file (step 28; older than the step).**')
    for (const piece of ['`src/pages/AdminEmailPage.tsx`', '`/email-logo.jpg`', 'WS08', 'K decides']) expect(email, piece).toContain(piece)
    expect(line('- **K reviews the step 28 judgement calls (step 28).**')).toContain('Q9')
    const wide = line('- **Pages wider than a phone, and a main inside a main (step 28; older than the step).**')
    for (const piece of ['`/clubs`', '393 pixels wide', '`/scholastic`', '334 wide', 'WCAG 1.4.10', 'WS09', 'WS11', '`GovLayout`', 'WS14', '`HeritageLayout`', '`src/pages/AdminPage.tsx`', 'WS08', 'known-violations.json']) expect(wide, piece).toContain(piece)
  })

  it('removes none: the 141 follow-ups before it are all still counted, beside the 9 it adds, and none says it was done in a step that did not do it', () => {
    const ofStep = (n: number) => headings.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = headings.filter((h) => /\(step (?:2[8-9]|3\d)[;)]/.test(h))
    expect(ofStep(28)).toHaveLength(9)
    expect(headings.length - later.length).toBe(141)
    expect(new Set(headings).size).toBe(headings.length)
    expect(followUpEntries.filter((l) => l.includes('Done in step 28'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 27'))).toHaveLength(0)
    expect(followUpEntries.filter((l) => l.includes('Done in step 26'))).toHaveLength(5)
    expect(followUpEntries.filter((l) => l.includes('Done in step 25'))).toHaveLength(3)
  })
})

describe('REDESIGN_STATUS.md, step 28: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    expect(tagged.length).toBeGreaterThanOrEqual(25)
    for (const text of [block, ac10, ...decisions, ...tagged, deviation, appearance, bullet('- **Step 26.**')]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 28 ')
  const end = ws01.indexOf('. ', at)
  const sentence = at < 0 ? '' : ws01.slice(at, end < 0 ? undefined : end + 1)

  it('has the step 28 sentence after step 27\'s, which still ends where it did', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 27 '))
    expect(ws01.slice(0, at)).toMatch(/not on the event page, which draws neither table\. $/)
    expect(sentence.length).toBeGreaterThan(200)
    expect(sentence.startsWith('Step 28 (recorded in step 28) adds `LcaMark`')).toBe(true)
  })

  it('names the two components, the three places, the LCA tag, the switch, the owners of the places left and the tests', () => {
    for (const piece of ['`src/components/LcaMark.tsx`', '`LcaLogo`', '`Navbar`', '`Footer`', '`AboutPage`', 'the LCA tag in `StatusBadge`', '`newLook`', 'WS03', 'WS10', 'WS12', 'WS14', '`test/unit/lca-mark.test.tsx`', '`test/a11y/brand.spec.ts`']) {
      expect(sentence, piece).toContain(piece)
    }
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
