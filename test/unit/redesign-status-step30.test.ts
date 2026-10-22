// test/unit/redesign-status-step30.test.ts
//
// REDESIGN_STATUS.md records step 30 (the heritage look's type, loaded only
// inside its scope) and REDESIGN_SPEC.md's WS01 deviation list carries its
// sentence. The living parts are pinned: the AC11 and AC12 rows stay
// planned for step 31, each with a sentence for step 30, AC11's in place of
// its old clause, and the AC13 and AC8 rows are left as they were; the step
// block sits in order and describes the faces, the fallback faces with
// their numbers, the tokens, the hooks, small capitals, the accent face,
// the guard and the layer, ThemeScope, the budget, the tests, the places
// left for later, the judgement calls, the lint, the build and the browser
// runs, with the counts the tree holds; the planned line for this step
// keeps its words with Done in step 30 added; the deviation, the verify
// items and the follow-ups are there, none renamed or removed, the glyph
// follow-up closed and the AC11 and AC12 one given its sentence without
// being closed; the files of the step hold no dash and name no tool; and
// the plain-language rules hold (no em dash, none of the working words, no
// mention of an assistant, US Chess rather than its old initials). The
// registration of the display size is recorded with the case it costs, and
// the devices with no Georgia (Android phones among them) with the second
// measurement step 31 makes for them.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')
const sheet = readFileSync(join(ROOT, 'src/styles/themes/heritage.css'), 'utf8')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
/** The names of the tools a record must not mention, split up so this file does not mention them either. */
const ASSISTANT = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'l' + 'lm', 'co-authored' + '-by'].join('|')})\\b`, 'i')
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

const HEADING = '### Step 30: the heritage look\'s type, loaded only inside its scope'
const block = between(HEADING, '### Decisions')
const ac8 = line('| AC8 |')
const ac11 = line('| AC11 |')
const ac12 = line('| AC12 |')
const ac13 = line('| AC13 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 30)'))
const tagged = lines.filter((l) => /\(step 30[;)]/.test(l))
const deviation = bullet('- **Step 30.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))

describe('REDESIGN_STATUS.md, step 30: the acceptance rows', () => {
  it('keeps AC11 planned for step 31, with step 30\'s half in place of its old clause', () => {
    expect(ac11).toMatch(/^\| AC11 \| Heritage fonts stay off `\/`; no layout shift from the font swap \| 31 \| Planned: /)
    expect(ac11).not.toContain('the heritage font chunk is step 30')
    for (const piece of ['Step 22 adds `src/styles/themes/live.css`', 'Step 30 lays the first half:', '`src/styles/themes/heritage.css`', 'lazy chunk', 'only `ThemeScope` imports', '`test/unit/theme-scope-wiring.test.ts`', 'not in the production build', 'as the stylesheet arrives after the scope\'s first paint', 'step 31']) {
      expect(ac11, piece).toContain(piece)
    }
  })

  it('keeps AC12 planned for step 31, with step 22\'s sentence and a sentence for step 30\'s type rules', () => {
    expect(ac12).toMatch(/^\| AC12 \| Editors and forms never render in the heritage look \| 31 \| Planned: /)
    for (const piece of ['Step 22 lays the first half:', 'Step 30 adds', '`test/unit/heritage-css.test.ts`', 'Instrument Serif', '`[data-theme="heritage"]`', 'Caslon', '`--font-display`', 'step 31']) {
      expect(ac12, piece).toContain(piece)
    }
  })

  it('leaves the AC13 and AC8 rows as they were', () => {
    expect(ac13).toMatch(/^\| AC13 \| Controls look identical inside heritage \| 31 \| Planned: /)
    for (const row of [ac13, ac8]) expect(row).not.toMatch(/step 30/i)
    expect(ac8).toMatch(/the status tags' boxes stay put in every look too\. \|$/)
  })
})

describe('REDESIGN_STATUS.md, step 30: the step block', () => {
  it('sits after step 29 and before the Decisions, and the date line names it first', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 29:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:3\d): [^;]+; )*step 30: [^;]+; step 29: [^;]+; step 28: [^;]+; /)
    // The record tests look for these steps in the file's first 400 characters.
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('records every part, the lint, the build and the browser runs, and nothing left to fill in', () => {
    for (const part of ['**Files.**', '**The faces.**', '**The fallback faces.**', '**The tokens.**', '**The hooks.**', '**Small capitals.**', '**The accent face.**', '**The guard and the layer.**', '**ThemeScope.**', '**The budget.**', '**The rules test.**', '**The glyphs.**', '**The places left for later.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**']) {
      expect(block, part).toContain(part)
    }
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    // No fixture route by its path, no conflict marker, no placeholder.
    expect(block).not.toContain('__')
    expect(block).not.toContain('@@')
    expect(block).not.toMatch(/\{[A-Z_0-9]+\}/)
    expect(block).not.toMatch(/\b(?:RUNS|CHECKS|BROWSERRUNS|STEP30TESTS)\b/)
  })

  it('names every file the step adds or changes, and every test whose header says it is of step 30, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'src/styles/themes/heritage.css',
      'src/components/ThemeScope.tsx',
      'test/unit/heritage-css.test.ts',
      'test/unit/heritage-budget.test.ts',
      'test/unit/heritage-glyphs.test.ts',
      'test/unit/helpers/woff2.ts',
      'test/unit/helpers/heritageFaces.ts',
      'test/unit/redesign-status-step30.test.ts',
      'test/unit/theme-scope-wiring.test.ts',
      'test/unit/theme-scope.test.tsx',
      'test/unit/theme-scope-edges.test.tsx',
      'test/unit/redesign-status-step24.test.ts',
      'package.json',
      'package-lock.json',
      'docs/redesign/REDESIGN_SPEC.md',
    ]) expect(files, name).toContain(`\`${name}\``)
    for (const piece of ['`@fontsource/libre-caslon-display` 5.3.0', '`@fontsource-variable/source-serif-4` 5.3.0', 'Sunday, July 19, 2026', '5.3.1', 'Sunday, October 11, 2026', '--save-exact']) expect(files, piece).toContain(piece)
    const ofStep = ['test/unit', 'test/a11y'].flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`)
        .filter((path) => /\bstep 30\b(?!'s)/.test(readFileSync(join(ROOT, path), 'utf8').split('\n').slice(0, 25).join('\n'))),
    )
    expect(ofStep.length).toBeGreaterThanOrEqual(7)
    for (const path of ofStep) expect(files, path).toContain(`\`${path}\``)
  })

  it('describes the faces: the latin files only, Source Serif named by its package path, the optical size file left out', () => {
    const part = bullet('- **The faces.**', HEADING)
    for (const piece of ['`@fontsource/libre-caslon-display/latin-400.css`', '`@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2`', 'exports', 'optical size', '122,360', 'italic']) {
      expect(part, piece).toContain(piece)
    }
  })

  it('gives the fallback faces\' source and numbers, the same numbers the stylesheet holds', () => {
    const part = bullet('- **The fallback faces.**', HEADING)
    for (const piece of ['`@capsizecss/metrics` 4.3.0', '`@capsizecss/unpack` 4.0.1', '2048 units per em', '1878', '449', '913', '931', '970', '266', '1036', '335', '374', '479', '441', 'not measured', 'Georgia is not installed', 'step 31', 'Android phones, ChromeOS and most Linux systems have no Georgia either', '"Georgia on the test computers (step 30)"']) {
      expect(part, piece).toContain(piece)
    }
    const percents = [...sheet.matchAll(/(?:size-adjust|ascent-override|descent-override): ([\d.]+%)/g)].map((m) => m[1])
    expect(percents).toHaveLength(9)
    for (const value of percents) expect(part, value).toContain(value)
  })

  it('describes the hooks, small capitals, the accent face, the guard and ThemeScope', () => {
    const hooks = bullet('- **The hooks.**', HEADING)
    for (const piece of ['`data-heritage`', '`display`', '`figure`', '`reader`', '`card`', '`table`', '`mat`', '`data-slot="lca-logo-mat"`', '2rem', '37em', '1.125rem', 'No rule reaches a control', '`@property`', 'bare number', 'rem or px']) expect(hooks, piece).toContain(piece)
    const caps = bullet('- **Small capitals.**', HEADING)
    for (const piece of ['`.small-caps`', '0.85em', '0.07em', 'smcp', 'c2sc', '`font-variant-caps`']) expect(caps, piece).toContain(piece)
    const accent = bullet('- **The accent face.**', HEADING)
    for (const piece of ['Instrument Serif', '`font-accent`', '`--font-accent`', '`--font-text`', '`test/unit/tokens.test.ts`']) expect(accent, piece).toContain(piece)
    const guard = bullet('- **The guard and the layer.**', HEADING)
    for (const piece of [':root[data-look="new"] [data-theme="heritage"]', '`newLook`', 'no cascade layer', 'the registration of `--display-size`', 'sets nothing on an element']) expect(guard, piece).toContain(piece)
    const scope = bullet('- **ThemeScope.**', HEADING)
    expect(scope).toContain('`SCOPE_FONTS`')
    // A stylesheet that failed is not fetched again in a built site, and the record says so rather than promising a retry.
    for (const piece of ['calls `import()` again', 'preload helper', 'the file stays missing until the page is reloaded', 'The retry after a failed load (step 30)']) expect(scope, piece).toContain(piece)
    expect(scope).not.toMatch(/is tried again/)
  })

  it('records the registration of the display size: the token, the hook, the rules test, the judgement call with the case it costs, the decision and the verify items', () => {
    expect(bullet('- **The tokens.**', HEADING)).toContain('`--display-size`, 2.25rem')
    const rules = bullet('- **The rules test.**', HEADING)
    for (const piece of ['registered as a length or a percentage', 'from 36px', '`setProperty`', 'rem or px or a percentage', 'every rule but the faces and the registration waits for `newLook`']) expect(rules, piece).toContain(piece)
    const call = line('  - `--display-size` is registered with `@property`')
    for (const piece of ['outside the guard', 'bare number', '16 pixels', '36px', '2.25rem', 'em, ex, ch, cap or lh', 'where the unregistered property gave 48', '`test/unit/heritage-css.test.ts`']) expect(call, piece).toContain(piece)
    expect(line('- **Heritage hooks (step 30).**')).toContain('a length registered with `@property`')
    expect(line('- **The 32 px floor (step 30).**')).toContain('the property is registered with `@property` as a length or a percentage')
    expect(line('- **Heritage waits for newLook (step 30).**')).toContain('the registration of `--display-size`, which sets nothing on an element')
    expect(line('- **Georgia is not installed (step 30).**')).toContain('Android phones, ChromeOS and most Linux systems have no Georgia either')
  })

  it('reports the budget from the files, and the planted cases it fails on', () => {
    const part = bullet('- **The budget.**', HEADING)
    for (const piece of ['75,060 bytes', '24,236', '50,824', '51,516', '20,048', '126,576', '110,000', 'planted']) expect(part, piece).toContain(piece)
  })

  it('reports the build before and after, the same byte for byte, and the browser-test builds\' heritage files', () => {
    const build = bullet('- **Build.**', HEADING)
    expect(build).toContain('CSS 127,940 and 127,940 bytes (one file, the same file byte for byte)')
    expect(build).toContain('JavaScript 2,586,164 and 2,586,164 bytes in 104 and 104 files; 133 and 133 files in all')
    for (const piece of ['127,896', '44 bytes', '`test/a11y/baseline.ts`', '`dist-a11y-on`', '`dist-a11y-off`', '2,836 bytes', '185 files', '`npm run check:bundle` finds no zod']) {
      expect(build, piece).toContain(piece)
    }
    expect(build).toMatch(/`heritage-\w+\.css`/)
  })

  it('reports the browser runs: no spec added, the check in Chromium, the baseline matched and the counts', () => {
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const piece of ['No browser spec is added', 'Chromium', '`a11y-on`', '`a11y-off`', '666 pixel', '13.6 pixels']) expect(runs, piece).toContain(piece)
    expect(block).toContain('"Baseline matches: no colour or font changed."')
    expect(block).toMatch(/389 tests, 308 that run and 81 that skip \(389, 308 and 81 before;/)
    for (const route of ['/', '/tournaments', '/membership']) expect(block).toContain(`axe in dark mode on ${route}:`)
  })

  it('states the unit and integration counts the tree holds', () => {
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toMatch(/unit \d{4} tests in 152 files \(4000 in 146 before;/)
    expect(checks).toContain('integration 790 in 58 (unchanged)')
  })
})

describe('REDESIGN_STATUS.md, step 30: decisions, deviations, verify items and follow-ups', () => {
  it('keeps the line planned for this step word for word, with Done in step 30 after it', () => {
    const planned = line('- **Small caps (step 30)**')
    expect(planned).toContain('- **Small caps (step 30)** use uppercase at 0.85em, because the Source Serif 4 and Libre Caslon Display files have no true small capitals. Source Serif 4 uses its weight-only file (51 KB) rather than the optical-size one (122 KB), to stay under the 110 KB font budget. Done in step 30:')
    for (const piece of ['`.small-caps`', '`test/unit/heritage-budget.test.ts`', '75,060']) expect(planned, piece).toContain(piece)
  })

  it('records the step\'s own decisions, none of them under an earlier step\'s name', () => {
    expect(decisions).toHaveLength(5)
    const text = decisions.join('\n')
    for (const piece of ['`src/styles/themes/heritage.css`', '`--font-display`', '`--font-text`', '`data-heritage`', '`.small-caps`', '`--font-accent`', 'Georgia', '75,060']) expect(text, piece).toContain(piece)
    for (const d of decisions) for (const older of ['(step 29)', '(step 28)', '(step 27)']) expect(d).not.toContain(older)
  })

  it('lists the step 30 deviations from the spec\'s words, the files beyond the step\'s list and the pins moved', () => {
    for (const piece of ['`font-variant-caps: all-small-caps`', '75,060 bytes', 'italic', 'do not exist yet', 'accent utility', '37em', 'production build', 'AC11 and AC12', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
    // The font tokens and type rules sit in the lazy file, against the brief's and the plan's words, and arrive after the first paint.
    const lazy = deviation.split('\n').find((l) => l.startsWith('  - The brief\'s typography list says "All scope token blocks')) ?? ''
    for (const piece of ['"All scope token blocks live in `src/index.css`"', '`docs/redesign/DESIGN_REPLAN_phase0.md`', '"Only the `@font-face` chunks are lazy"', '`--font-display`', '`src/styles/themes/heritage.css`', 'after the scope\'s first paint', '0.0145', '0.0964', 'The heritage stylesheet before the first paint (step 30)']) {
      expect(lazy, piece).toContain(piece)
    }
    expect(lazy).not.toBe('')
    expect(deviation.indexOf(lazy)).toBeLessThan(deviation.indexOf('  - Files beyond the step\'s list:'))
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 30.**')
    for (const path of [
      'docs/redesign/REDESIGN_SPEC.md',
      'test/unit/helpers/woff2.ts',
      'test/unit/helpers/heritageFaces.ts',
      'test/unit/heritage-glyphs.test.ts',
      'test/unit/theme-scope-wiring.test.ts',
      'test/unit/theme-scope.test.tsx',
      'test/unit/theme-scope-edges.test.tsx',
      'test/unit/redesign-status-step24.test.ts',
      'test/unit/redesign-status-step30.test.ts',
    ]) expect(beyond, path).toContain(`\`${path}\``)
    // It follows step 29's deviation.
    const steps = between('### Deviations from the brief', '### Verify items resolved').split('\n').filter((l) => /^- \*\*Step \d+\.\*\*/.test(l)).map((l) => Number(l.match(/Step (\d+)/)![1]))
    expect(steps.slice(steps.indexOf(29), steps.indexOf(29) + 2)).toEqual([29, 30])
  })

  it('resolves the three verify items it was given, and the ones it found', () => {
    for (const name of [
      'Latin subset and smcp / c2sc',
      'Heritage font budget',
      'Font package names',
      'The newest Source Serif',
      'What each package ships',
      'No font token for heritage',
      'The hooks',
      'The 32 px floor',
      'Heritage waits for newLook',
      'Georgia is not installed',
      'No acceptance row',
      'The glyph pin',
      'Production and the browser-test builds',
      'The tests that move',
      'index.css',
      'The date line',
      'The planned line\'s place',
      'The production stylesheet before the step',
      'The baseline',
      'Lint, build and the browser runs',
      'Counts',
      'The retry after a failed load',
    ]) expect(verify, name).toContain(`- **${name} (step 30).**`)
    const smcp = line('- **Latin subset and smcp / c2sc (step 30).**')
    for (const piece of ['Confirmed: no', 'dnom, frac, liga and numr', 'ccmp, dnom, frac, liga, locl, numr, pnum and tnum']) expect(smcp, piece).toContain(piece)
    const budget = line('- **Heritage font budget (step 30).**')
    for (const piece of ['24,236', '50,824', '51,516', '122,360', '75,060']) expect(budget, piece).toContain(piece)
    expect(line('- **The date line (step 30).**')).toContain('398')
    expect(line('- **The baseline (step 30).**')).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    const retry = line('- **The retry after a failed load (step 30).**')
    for (const piece of ['Found:', '`import()`', 'preload helper', 'until the page is reloaded', 'Unable to preload CSS for', '`test/unit/heritage-edges.test.ts`', 'The live file has the same gap', 'Step 22\'s Fonts line is left as it was written']) {
      expect(retry, piece).toContain(piece)
    }
    // The step 27 verify item on the marker glyphs keeps its words.
    expect(line('- **Marker glyph coverage (step 27).**')).toContain('Libre Caslon Display and Source Serif 4 are not installed')
  })

  it('closes the glyph follow-up, gives the AC11 and AC12 one its sentence without closing it, and adds its sentences to the open ones it meets', () => {
    const glyphs = line('- **The heritage faces\' glyphs (step 27).**')
    expect(glyphs).toContain('Done in step 30: `test/unit/heritage-glyphs.test.ts`')
    const halves = line('- **AC11 and AC12 second halves (step 22).**')
    expect(halves).toContain('Step 30:')
    expect(halves).not.toContain('Done in step 30')
    for (const [name, piece] of [
      ['Base inside heritage in a browser (step 22)', 'Step 30 draws no heritage page'],
      ['The About logo in the heritage layout (step 28)', 'Step 30:'],
      ['Classes only docs and tests name reach the CSS (step 23)', 'Step 30'],
    ]) expect(line(`- **${name}.**`), name).toContain(piece)
    // Left as they were: the two the commit before the step answered ("Done before step 30"), and two the step does not reach.
    for (const name of ['The a11y servers share one database (step 23)', 'The baseline sampler waits for content (step 27)', 'Heritage on a muted panel (step 24)', 'Binding the live fonts (step 22)']) {
      expect(line(`- **${name}.**`), name).not.toMatch(/\bStep 30\b|Done in step 30/)
    }
  })

  it('lists what it leaves as follow-ups headed with step 30', () => {
    for (const name of [
      'K reviews the step 30 judgement calls (step 30)',
      'The fallback faces measured (step 30)',
      'Hooks for the heritage pages (step 30)',
      'Georgia on the test computers (step 30)',
      'Source Serif 4 5.3.1 (step 30)',
      'Letters outside the latin files (step 30)',
      'The heritage stylesheet before the first paint (step 30)',
    ]) expect(followUps, name).toContain(`- **${name}.**`)
    expect(line('- **Source Serif 4 5.3.1 (step 30).**')).toContain('Sunday, October 25, 2026')
    for (const piece of ['`HeritageLayout`', '`PageHero`', 'WS14', 'WS10', '`.small-caps`']) expect(line('- **Hooks for the heritage pages (step 30).**'), piece).toContain(piece)
    expect(line('- **The fallback faces measured (step 30).**')).toContain('AC11')
    const georgia = line('- **Georgia on the test computers (step 30).**')
    for (const piece of ['Android phones, ChromeOS and most Linux systems', 'Noto Serif', 'section 2.4', 'measures AC11 twice', 'once with no Georgia', "`local('Noto Serif')`"]) expect(georgia, piece).toContain(piece)
    for (const piece of ['Android phones', 'measures AC11 twice', '"Georgia on the test computers (step 30)"']) expect(line('- **The fallback faces measured (step 30).**'), piece).toContain(piece)
    for (const piece of ['`--display-size`', 'rem or px', 'bare number']) expect(line('- **Hooks for the heritage pages (step 30).**'), piece).toContain(piece)
    expect(line('- **K reviews the step 30 judgement calls (step 30).**')).toContain('the display size registered with `@property` outside the guard')
    expect(line('- **The fallback faces measured (step 30).**')).toContain('The heritage stylesheet before the first paint (step 30)')
    const early = line('- **The heritage stylesheet before the first paint (step 30).**')
    for (const piece of ['`ThemeScope`', 'after the scope\'s first paint', '0.0145', '0.0964', 'from the start of the navigation', '`HeritageLayout`', '`react-refresh/only-export-components`', '`test/unit/theme-scope-wiring.test.ts`', '`/about`', '`/governance/bylaws`', '`newLook` off', 'handle a failed load itself', '`?url`', 'WS07']) {
      expect(early, piece).toContain(piece)
    }
  })

  it('removes none: the 157 follow-ups before it are all still counted, and none says it was done in a step that did not do it', () => {
    const ofStep = (n: number) => headings.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = headings.filter((h) => /\(step (?:3\d)[;)]/.test(h))
    expect(ofStep(30).length).toBeGreaterThanOrEqual(7)
    expect(headings.length - later.length).toBe(157)
    expect(new Set(headings).size).toBe(headings.length)
    expect(followUpEntries.filter((l) => l.includes('Done in step 30'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 29'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 28'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 27'))).toHaveLength(0)
  })
})

describe('REDESIGN_STATUS.md, step 30: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    expect(tagged.length).toBeGreaterThanOrEqual(30)
    for (const text of [block, ac11, ac12, ...decisions, ...tagged, deviation]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('the files of the step', () => {
  it.each([
    'src/styles/themes/heritage.css',
    'src/components/ThemeScope.tsx',
    'test/unit/heritage-css.test.ts',
    'test/unit/heritage-budget.test.ts',
    'test/unit/heritage-glyphs.test.ts',
    'test/unit/helpers/woff2.ts',
    'test/unit/helpers/heritageFaces.ts',
  ])('%s has no em dash, no en dash and no reference to a tool that wrote it', (file) => {
    const text = readFileSync(join(ROOT, file), 'utf8')
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(/\bAI\b/)
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 30 ')
  const end = ws01.indexOf('. ', at)
  const sentence = at < 0 ? '' : ws01.slice(at, end < 0 ? undefined : end + 1)

  it('has the step 30 sentence after step 29\'s, which still ends where it did', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 29 '))
    expect(ws01.slice(0, at)).toMatch(/and `test\/a11y\/home\.spec\.ts`\. $/)
    expect(sentence.length).toBeGreaterThan(200)
    expect(sentence.startsWith('Step 30 (recorded in step 30) adds `src/styles/themes/heritage.css`')).toBe(true)
  })

  it('names the stylesheet, the packages, ThemeScope, the tokens, the class, the switch, the layout and the tests', () => {
    for (const piece of [
      '`@fontsource/libre-caslon-display`',
      '`@fontsource-variable/source-serif-4`',
      '`src/components/ThemeScope.tsx`',
      '`--font-display`',
      '`.small-caps`',
      '`newLook`',
      '`HeritageLayout`',
      '`test/unit/heritage-css.test.ts`',
      '`test/unit/heritage-budget.test.ts`',
      '`test/unit/heritage-glyphs.test.ts`',
      'after the scope\'s first paint',
      'registered as a length',
    ]) expect(sentence, piece).toContain(piece)
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
