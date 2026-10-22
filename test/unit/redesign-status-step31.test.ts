// test/unit/redesign-status-step31.test.ts
//
// REDESIGN_STATUS.md records step 31 (the heritage layout on its six pages)
// and REDESIGN_SPEC.md's WS01 deviation list carries its sentence. The
// living parts are pinned: the AC11, AC12 and AC13 rows are filled, AC11
// and AC12 keeping the sentences of steps 22 and 30, and the AC8 row is left
// as it was; the step block sits after step 30's and describes the layout,
// the routes, the stylesheet before the first paint, the loading box, the
// hooks, the ornaments, the base reset, the switches, GovLayout's column,
// the colour layer for AC13, ThemeScope, the fixture page, the tests, the
// places left for later, the judgement calls, the lint, the build and the
// browser runs, with the counts the tree holds; the date line names the
// step first and still holds the older steps in its first 400 characters;
// the planned line for AC13 keeps its words with Done in step 31 added; the
// decisions, the deviation, the verify items and the follow-ups are there,
// none renamed or removed, the ones the step answers closed or given a
// sentence; the files of the step hold no dash and name no tool; and the
// plain-language rules hold (no em dash, none of the working words, no
// mention of an assistant, US Chess rather than its old initials).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')

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

const HEADING = '### Step 31: the heritage layout on its six pages'
const block = between(HEADING, '### Decisions')
const ac8 = line('| AC8 |')
const ac11 = line('| AC11 |')
const ac12 = line('| AC12 |')
const ac13 = line('| AC13 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 31)'))
const tagged = lines.filter((l) => /\(step 31[;)]/.test(l))
const deviation = bullet('- **Step 31.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))

describe('REDESIGN_STATUS.md, step 31: the acceptance rows', () => {
  it('fills the AC11 row: the network log of /, the build, and the swap measured apart from the page\'s arrival, keeping the sentences of steps 22 and 30', () => {
    expect(ac11).toMatch(/^\| AC11 \| Heritage fonts stay off `\/`; no layout shift from the font swap \| 31 \| `test\/a11y\/heritage\.spec\.ts` on both builds: /)
    expect(ac11).not.toContain('Planned:')
    for (const piece of ['"/ on a11y-on: 17 requests, 0 of them for the heritage look"', '`test/unit/heritage-edges.test.ts`', '`src/lib/scopeStylesheets.ts`', 'from the start of the navigation', '0.0000', 'no Georgia on this computer', 'The Georgia run (step 31)', 'apart', '0.6718', '0.3811', '0.7369', '0.2869', '0.2494', '0.2281', '0.5832', '3,342 ms']) {
      expect(ac11, piece).toContain(piece)
    }
    // Step 22's and step 30's sentences are kept as they were written.
    for (const piece of ['Step 22 adds `src/styles/themes/live.css`', 'Step 30 lays the first half:', 'only `ThemeScope` imports', 'not in the production build', 'are proved in step 31.']) expect(ac11, piece).toContain(piece)
  })

  it('fills the AC12 row: the route test, the render test and the faces on the rendered pages, keeping the sentences of steps 22 and 30', () => {
    expect(ac12).toMatch(/^\| AC12 \| Editors and forms never render in the heritage look \| 31 \| `test\/unit\/themeScopes\.test\.ts` \(24\) /)
    expect(ac12).not.toContain('Planned:')
    for (const piece of ['TypeScript parser', '`HERITAGE_ROUTES`', 'no other route', '`test/unit/governanceEditors.test.tsx` (5)', '`RichTextEditor`', 'is `""`', 'no `ThemeScope` wrapper', '`test/unit/governanceEditors-bylaws.test.tsx` (3)', '`test/unit/governanceEditors-board.test.tsx` (4)', 'Add a board seat card', 'every form on the six pages is in the base look', 'Instrument Serif', 'Libre Caslon Display', 'never a control']) {
      expect(ac12, piece).toContain(piece)
    }
    for (const piece of ['Step 22 lays the first half:', 'Step 30 adds', '`test/unit/heritage-css.test.ts`', '`--font-display`']) expect(ac12, piece).toContain(piece)
  })

  it('fills the AC13 row with the same-run shots, light and dark, the planted difference and the colour layer, and leaves AC8 as it was', () => {
    expect(ac13).toMatch(/^\| AC13 \| Controls look identical inside heritage \| 31 \| `test\/a11y\/heritage\.spec\.ts` on `a11y-on`, light and dark/)
    expect(ac13).not.toContain('Planned:')
    for (const piece of ['33 controls in all', 'room for the ring', '"light: 33 controls shot in each look, 33 the same byte for byte."', '"dark: 33 controls shot in each look, 33 the same byte for byte."', 'one step off the navy', '20 of the 33', '`src/index.css`']) {
      expect(ac13, piece).toContain(piece)
    }
    for (const row of [ac13, ac8]) expect(row).not.toMatch(/step 30/i)
    expect(ac8).toMatch(/the status tags' boxes stay put in every look too\. \|$/)
    // Four cells in each row: no bar inside the words.
    for (const row of [ac11, ac12, ac13]) expect(row.split(' | ')).toHaveLength(4)
  })
})

describe('REDESIGN_STATUS.md, step 31: the step block', () => {
  it('sits after step 30 and before the Decisions, and the date line names it first with the older steps still in its first 400 characters', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 30:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:3[2-9]): [^;]+; )*step 31: [^;]+; step 30: [^;]+; step 29: [^;]+; step 28: [^;]+; /)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('records every part, the lint, the build and the browser runs, and nothing left to fill in', () => {
    for (const part of ['**Files.**', '**The layout.**', '**The routes.**', '**The stylesheet before the first paint.**', '**The loading box.**', '**The hooks.**', '**The ornaments.**', '**GovernanceDocuments and the base reset.**', '**The switches.**', '**GovLayout\'s column.**', '**The colour layer for AC13.**', '**ThemeScope.**', '**The fixture page.**', '**The tests.**', '**The places left for later.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**']) {
      expect(block, part).toContain(part)
    }
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    // No fixture route by its path, no conflict marker, no placeholder.
    expect(block).not.toContain('__')
    expect(block).not.toContain('@@')
    expect(block).not.toMatch(/\{[A-Z_0-9]+\}/)
    expect(block).not.toMatch(/\[\[[A-Z0-9-]+\]\]/)
  })

  it('names every file the step adds or changes, and every test whose header says it is of step 31, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'src/layouts/HeritageLayout.tsx',
      'src/contexts/heritage-layout.ts',
      'src/lib/scopeStylesheets.ts',
      'src/components/ThickThinRule.tsx',
      'src/components/Seal.tsx',
      'src/App.tsx',
      'src/components/ThemeScope.tsx',
      'src/components/PageHero.tsx',
      'src/areas/governance/components/GovLayout.tsx',
      'src/areas/governance/components/GovernanceDocuments.tsx',
      'src/pages/AboutPage.tsx',
      'src/pages/BoardPage.tsx',
      'src/pages/BylawsPage.tsx',
      'src/pages/MinutesPage.tsx',
      'src/pages/AnnualMeetingPage.tsx',
      'src/pages/ChampionsPage.tsx',
      'src/pages/fixtures/ScopeFixturePage.tsx',
      'src/index.css',
      'docs/redesign/REDESIGN_SPEC.md',
      'test/unit/helpers/heritagePages.tsx',
      'test/unit/helpers/heritageAnswers.ts',
      'test/unit/fixtures/heritage-pages-today.ts',
      'test/unit/redesign-status-step31.test.ts',
      'test/unit/app-routes.test.tsx',
      'test/unit/lca-mark.test.tsx',
      'test/unit/brand-edges.test.tsx',
      'test/unit/goldText.test.ts',
      'test/unit/tokens.test.ts',
      'test/unit/theme-scope.test.tsx',
      'test/unit/browser-test-wiring.test.ts',
      'test/a11y/brand.spec.ts',
      'test/a11y/brand-edges.spec.ts',
      'test/unit/governanceEditors-board.test.tsx',
      'test/unit/heritage-hooks.test.tsx',
      'test/unit/heritage-controls-tokens.test.tsx',
      'test/unit/heritage-app-routes.test.tsx',
      'test/unit/scope-stylesheets-edges.test.tsx',
      'test/unit/governanceEditors-bylaws.test.tsx',
    ]) expect(files, name).toContain(`\`${name}\``)
    const ofStep = ['test/unit', 'test/a11y'].flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`)
        .filter((path) => /\bstep 31\b(?!'s)/.test(readFileSync(join(ROOT, path), 'utf8').split('\n').slice(0, 25).join('\n'))),
    )
    expect(files).toContain('`test/a11y/heritage.spec.ts` (45 tests on each build; 45 run on `a11y-on` and 21 on `a11y-off`')
    expect(ofStep.length).toBeGreaterThanOrEqual(12)
    for (const path of ofStep) expect(files, path).toContain(`\`${path}\``)
  })

  it('describes the layout, the routes and the stylesheet before the first paint', () => {
    const layout = bullet('- **The layout.**', HEADING)
    for (const piece of ['`ThemeScope scope="heritage"`', '`layout="box"`', '`data-layout="heritage"`', '`<main>`', '`bg-ground`', 'shadow', 'runs down to the footer', 'outside the box']) expect(layout, piece).toContain(piece)
    const routes = bullet('- **The routes.**', HEADING)
    for (const piece of ['`HERITAGE_PAGES`', '`<Route element={<HeritageLayout />}>`', '`FEATURES.themeHeritage`', 'today\'s', '`/state-champions`', 'names no `ThemeScope`']) expect(routes, piece).toContain(piece)
    const early = bullet('- **The stylesheet before the first paint.**', HEADING)
    for (const piece of ['`src/lib/scopeStylesheets.ts`', 'one promise', '`ScopeStylesheetReady`', '36 pixels', '`?retry=1`', '`RETRY_AFTER_MS`', 'The retry after a failed load (step 30)', 'three seconds at most (`HOLD_AT_MOST_MS`)', 'under `newLook` only']) expect(early, piece).toContain(piece)
    const box = bullet('- **The loading box.**', HEADING)
    for (const piece of ['`min-h-screen`', '0.0000', '0.7011', '1.3436', 'first visit']) expect(box, piece).toContain(piece)
  })

  it('describes the hooks, the ornaments, the base reset, the switches and the colour layer', () => {
    const hooks = bullet('- **The hooks.**', HEADING)
    for (const piece of ['`useInHeritageLayout`', '`useHeritageHook`', '`useHeritageOrnaments`', '`display`', '`card`', '`table`', '`data-slot="lca-logo-mat"`', '`figure`', '`.small-caps`', 'nine other importers']) expect(hooks, piece).toContain(piece)
    const ornaments = bullet('- **The ornaments.**', HEADING)
    for (const piece of ['`h-1.5 border-t-[3px] border-b`', '`border-ink`', '`on="navy"`', '`fill-brand-navy`', '`stroke-lca-gold`', '`LcaMark`', '`src/components/LcaMark.tsx`', '34 units', '`text-white`', 'hidden from screen readers', '`hidden sm:block`']) expect(ornaments, piece).toContain(piece)
    const reset = bullet('- **GovernanceDocuments and the base reset.**', HEADING)
    for (const piece of ['`ThemeScope scope="base"`', '`data-theme=""`', '`display: contents`', '`RichTextEditor`', 'stays in the heritage look', '`src/areas/admin/components/PostsPanel.tsx`', '`src/pages/AdminEmailPage.tsx`', 'The Board page does the same', 'every form on the six pages is in the base look']) expect(reset, piece).toContain(piece)
    expect(bullet('- **The places left for later.**', HEADING)).not.toContain('Add a board seat')
    expect(line('- **The hooks WS14 and WS10 put on (step 31).**')).not.toContain('Add a board seat')
    const switches = bullet('- **The switches.**', HEADING)
    for (const piece of ['`themeHeritage`', '`newLook`', 'look as they do today', '`test/a11y/global-setup.ts`']) expect(switches, piece).toContain(piece)
    const colour = bullet('- **The colour layer for AC13.**', HEADING)
    for (const piece of ['20 of the 33', 'in dark mode none', '`--primary-foreground`', '`--surface-2`', '`--ink-muted`', '`bg-muted`', '`text-muted-foreground`', '`inherit`', '`test/unit/tokens-scopes.test.ts`', '`test/a11y/scope-switch.spec.ts`', '1,723 bytes']) expect(colour, piece).toContain(piece)
  })

  it('reports the build before and after, every new file and what names it, and the browser-test builds\' heritage files', () => {
    const build = bullet('- **Build.**', HEADING)
    for (const piece of [
      'CSS 127,940 bytes in one file and 141,280 in three',
      'JavaScript 2,586,164 and 2,594,198 bytes in 104 and 109 files',
      '133 and 186 files in all (139 and 192 in `dist`)',
      '130,131 bytes, 2,191 more',
      '119,799 bytes at `0cc7c30` to 122,032',
      '2,836 bytes',
      '24,236', '20,048', '50,824', '51,516',
      '`ThemeScope-*.js`',
      '`live-m7TjVD57.css` (8,313 bytes)',
      '42 Barlow files',
      '`HeritageLayout-*.js` (1,030 bytes)',
      '`ThickThinRule-*.js` (383)',
      '`heritage-layout-*.js` (373',
      '`utils-*.js` (27,261)',
      '`dist-a11y-on`', '`dist-a11y-off`', '190 files where it held 185',
      '`npm run check:bundle` finds no zod in 186 files',
    ]) expect(build, piece).toContain(piece)
    expect(build).toMatch(/`heritage-\w+\.css`/)
    // What names each of the small chunks, and what that costs a page with every switch off.
    for (const piece of [
      '`ThickThinRule-*.js` (383), imported by `GovLayout-*.js` and the six pages\' chunks',
      'imported by `PageHero-*.js`, `GovLayout-*.js`, `GovernanceDocuments-*.js`, `HeritageLayout-*.js` and the six pages\' chunks',
      'named by `index.html`\'s list of files to preload and imported by the main chunk',
      '`index.html` names seven where it named six',
      '28,716', '1,429',
      'fetch `heritage-layout-*.js` as one more file',
      '`ThemeScope-*.js` (2,737 bytes) as well, which `BoardPage-*.js` and `GovernanceDocuments-*.js` import',
    ]) expect(build, piece).toContain(piece)
    // The classes the step is the first to use; `bg-ground` was in the site's stylesheet before it.
    const firstToUse = build.match(/the first to use \(([^)]*)\)/)?.[1] ?? ''
    expect(firstToUse).toContain('`sm:block`')
    expect(firstToUse).toContain('`bg-ground`, which the layout uses too, was in it already')
    expect(firstToUse.split(';')[0]).not.toContain('`bg-ground`')
    // Built from the site's files alone, its rule is new, since only the documents, tests and records named it before.
    expect(build).toContain('2,233 more, the same rules and `bg-ground`\'s (42 bytes)')
    const files = line('- **Both looks\' files in the production build (step 31).**')
    for (const piece of ['`utils-*.js`', '`heritage-layout-*.js` (373 bytes)', '`ThickThinRule-*.js` (383)', '`ThemeScope-*.js` (2,737)']) expect(files, piece).toContain(piece)
  })

  it('reports the browser runs, the baseline matched and the counts', () => {
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const piece of ['"/ on a11y-off: 21 requests, 0 of them for the heritage look"', 'the faces\' swap 0.0000', 'the heading entered the page 3342 ms after the navigation began', 'Moving inside the site', '0.4117', '0.4621', '"light: 33 controls shot in each look, 33 the same byte for byte."', '"dark: 33 controls shot in each look, 33 the same byte for byte."', 'gap below the scope 613 pixels', '"axe on /champions at 390 pixels, dark (a11y-on): 26 rules passed, 0 with findings."']) {
      expect(runs, piece).toContain(piece)
    }
    expect(block).toContain('"Baseline matches: no colour or font changed."')
    for (const route of ['/', '/tournaments', '/membership']) expect(block).toContain(`axe in dark mode on ${route}:`)
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toMatch(/unit 4379 tests in 163 files \(4128 in 152 before;/)
    expect(checks).toContain('integration 790 in 58 (unchanged)')
    expect(checks).toMatch(/479 tests, 374 that run and 105 that skip \(389, 308 and 81 before;/)
    expect(checks).toContain('`heritage.spec.ts` adds 45 tests on each build, 90 in all, 45 that run on `a11y-on` and 21 on `a11y-off`')
    expect(checks).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
  })
})

describe('REDESIGN_STATUS.md, step 31: decisions, deviations, verify items and follow-ups', () => {
  it('keeps the line planned for this step word for word, with Done in step 31 after it', () => {
    const planned = line('- **AC13 compares screenshots from the same run (step 31)**')
    expect(planned).toContain('- **AC13 compares screenshots from the same run (step 31)**, base against heritage, rather than against stored reference images. Done in step 31:')
    for (const piece of ['`test/a11y/heritage.spec.ts`', 'byte for byte', 'no reference picture is stored']) expect(planned, piece).toContain(piece)
  })

  it('records the step\'s own decisions, none of them under an earlier step\'s name', () => {
    expect(decisions).toHaveLength(5)
    const text = decisions.join('\n')
    for (const piece of ['`HeritageLayout`', '`HERITAGE_ROUTES`', '`useHeritageHook`', '`useHeritageOrnaments`', '`ThemeScope scope="base"`', '`src/index.css`', '`ScopeStylesheetReady`', '`src/lib/scopeStylesheets.ts`']) expect(text, piece).toContain(piece)
    for (const d of decisions) for (const older of ['(step 30)', '(step 29)', '(step 28)', '(step 27)']) expect(d).not.toContain(older)
  })

  it('lists the step 31 deviations from the spec\'s words and the files beyond the step\'s list, after step 30\'s', () => {
    for (const piece of ['`data-theme="heritage"` on `<main>`', 'four of them draw it', '`src/contexts/heritage-layout.ts`', '`src/lib/scopeStylesheets.ts`', 'apart from the page\'s own arrival', 'Georgia', 'colour layer', '42 Barlow files', '`test/a11y/scopes.spec.ts`', '`/governance/minutes`', 'reskin', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 31.**')
    for (const path of [
      'src/contexts/heritage-layout.ts',
      'src/lib/scopeStylesheets.ts',
      'src/components/ThemeScope.tsx',
      'src/components/PageHero.tsx',
      'src/areas/governance/components/GovLayout.tsx',
      'src/index.css',
      'docs/redesign/REDESIGN_SPEC.md',
      'test/unit/helpers/heritagePages.tsx',
      'test/unit/helpers/heritageAnswers.ts',
      'test/unit/fixtures/heritage-pages-today.ts',
      'test/unit/heritage-layout.test.tsx',
      'test/unit/heritage-ornaments.test.tsx',
      'test/unit/scope-stylesheets.test.tsx',
      'test/unit/redesign-status-step31.test.ts',
      'test/unit/theme-scope-wiring.test.ts',
      'test/unit/theme-scope.test.tsx',
      'test/unit/theme-scope-edges.test.tsx',
      'test/unit/app-routes.test.tsx',
      'test/unit/heritage-edges.test.ts',
      'test/unit/heritage-scope-edges.test.tsx',
      'test/unit/lca-mark.test.tsx',
      'test/unit/brand-edges.test.tsx',
      'test/unit/goldText.test.ts',
      'test/unit/tokens.test.ts',
      'test/unit/browser-test-wiring.test.ts',
      'test/unit/redesign-status-step30.test.ts',
      'test/a11y/brand.spec.ts',
      'test/a11y/brand-edges.spec.ts',
      'test/unit/heritage-hooks.test.tsx',
      'test/unit/heritage-controls-tokens.test.tsx',
      'test/unit/heritage-app-routes.test.tsx',
      'test/unit/scope-stylesheets-edges.test.tsx',
      'test/unit/governanceEditors-bylaws.test.tsx',
      'test/unit/governanceEditors-board.test.tsx',
    ]) expect(beyond, path).toContain(`\`${path}\``)
    const steps = between('### Deviations from the brief', '### Verify items resolved').split('\n').filter((l) => /^- \*\*Step \d+\.\*\*/.test(l)).map((l) => Number(l.match(/Step (\d+)/)![1]))
    expect(steps.slice(steps.indexOf(30), steps.indexOf(30) + 2)).toEqual([30, 31])
  })

  it('resolves the verify item it was given, and the ones it found', () => {
    for (const name of [
      'Pages and editors exist',
      'The layout\'s place and the routes\' shape',
      'GovLayout and the four pages',
      'The scope\'s ground',
      'The hooks',
      'The stylesheet before the first paint',
      'The layout shift beyond the font swap',
      'The flags',
      'GovernanceDocuments',
      'AC13 and the tokens',
      'The route test that already exists',
      'The tests that move',
      'Production against the browser-test builds',
      'The fixture page',
      'The ornaments',
      'The boards and the spec\'s words',
      'The acceptance rows',
      'The browser spec',
      'The date line',
      'Lint and counts',
      'The baseline',
    ]) expect(verify, name).toContain(`- **${name} (step 31).**`)
    const pages = line('- **Pages and editors exist (step 31).**')
    for (const piece of ['Confirmed in part', '`src/areas/admin/components/PostsPanel.tsx`', '`src/pages/AdminEmailPage.tsx`', 'three times by Bylaws']) expect(pages, piece).toContain(piece)
    for (const piece of ['398', '424', '394']) expect(line('- **The date line (step 31).**'), piece).toContain(piece)
    expect(line('- **The baseline (step 31).**')).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(line('- **AC13 and the tokens (step 31).**')).toContain('20 of the 33')
    expect(line('- **The browser spec (step 31).**')).toContain('479 tests, 374 of them and 105 skipped')
    expect(line('- **The browser spec (step 31).**')).toContain('45 tests on each build, 90 in all; 45 run on `a11y-on` and 21 on `a11y-off`, where 24 skip')
  })

  it('closes the follow-ups it answers and adds its sentence to the ones it meets', () => {
    for (const name of [
      'ThemeScope as a page\'s main (step 22)',
      'Base inside heritage in a browser (step 22)',
      'AC11 and AC12 second halves (step 22)',
      'The About logo in the heritage layout (step 28)',
      'The seal from the rook (step 28)',
      'The heritage stylesheet before the first paint (step 30)',
    ]) expect(line(`- **${name}.**`), name).toContain('Done in step 31')
    for (const name of [
      'Pages wider than a phone, and a main inside a main (step 28; older than the step)',
      'Classes only docs and tests name reach the CSS (step 23)',
      'Hooks for the heritage pages (step 30)',
      'The fallback faces measured (step 30)',
      'Georgia on the test computers (step 30)',
      'Binding the live fonts (step 22)',
    ]) {
      expect(line(`- **${name}.**`), name).toContain('Step 31')
      expect(line(`- **${name}.**`), name).not.toContain('Done in step 31')
    }
    // Only the run with no Georgia was made, and no figure is claimed for the other.
    expect(line('- **Georgia on the test computers (step 30).**')).toContain('Step 31 made the second of the two runs only')
  })

  it('lists what it leaves as follow-ups headed with step 31, and removes none', () => {
    for (const name of [
      'K reviews the step 31 judgement calls (step 31)',
      'The layout shift as measured (step 31)',
      'The Georgia run (step 31)',
      'The hooks WS14 and WS10 put on (step 31)',
      'The Champions page\'s own toggles (step 31)',
      'The controls the rule names (step 31)',
      'Both looks\' files in the production build (step 31)',
      'The editor\'s link extension named twice (step 31; older than the step)',
    ]) expect(followUps, name).toContain(`- **${name}.**`)
    const measured = line('- **The layout shift as measured (step 31).**')
    for (const piece of ['no Georgia installed', '0.0000', '0.6718', '0.3811', '0.7369', '0.2869', '0.2494', '0.7209', '0.2330', '0.4215', '0.4045', '0.0548', '0.0801']) expect(measured, piece).toContain(piece)
    const ofStep = (n: number) => headings.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = headings.filter((h) => /\(step (?:3[1-9])[;)]/.test(h))
    expect(ofStep(31).length).toBeGreaterThanOrEqual(8)
    expect(headings.length - later.length).toBe(164)
    expect(new Set(headings).size).toBe(headings.length)
    expect(followUpEntries.filter((l) => l.includes('Done in step 31'))).toHaveLength(6)
    expect(followUpEntries.filter((l) => l.includes('Done in step 30'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 29'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 28'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 27'))).toHaveLength(0)
  })
})

describe('REDESIGN_STATUS.md, step 31: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    expect(tagged.length).toBeGreaterThanOrEqual(30)
    for (const text of [block, ac11, ac12, ac13, ...decisions, ...tagged, deviation]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('the files of the step', () => {
  it.each([
    'src/layouts/HeritageLayout.tsx',
    'src/contexts/heritage-layout.ts',
    'src/lib/scopeStylesheets.ts',
    'src/components/ThickThinRule.tsx',
    'src/components/Seal.tsx',
    'test/unit/governanceEditors.test.tsx',
    'test/unit/governanceEditors-board.test.tsx',
    'test/unit/heritage-layout.test.tsx',
    'test/unit/heritage-ornaments.test.tsx',
    'test/unit/scope-stylesheets.test.tsx',
    'test/unit/helpers/heritagePages.tsx',
    'test/unit/helpers/heritageAnswers.ts',
    'test/unit/fixtures/heritage-pages-today.ts',
    'test/a11y/heritage.spec.ts',
  ])('%s has no em dash, no en dash and no reference to a tool that wrote it', (file) => {
    const text = readFileSync(join(ROOT, file), 'utf8')
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(/\bAI\b/)
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 31 ')
  const end = ws01.indexOf('. ', at)
  const sentence = at < 0 ? '' : ws01.slice(at, end < 0 ? undefined : end + 1)

  it('has the step 31 sentence after step 30\'s, which still ends where it did', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 30 '))
    expect(ws01.slice(0, at)).toMatch(/and `test\/unit\/heritage-glyphs\.test\.ts`\. $/)
    expect(sentence.length).toBeGreaterThan(200)
    expect(sentence.startsWith('Step 31 (recorded in step 31) adds `src/layouts/HeritageLayout.tsx`')).toBe(true)
  })

  it('names the layout, the ornaments, the base reset, ThemeScope, the switches and the tests', () => {
    for (const piece of [
      '`src/components/ThickThinRule.tsx`',
      '`src/components/Seal.tsx`',
      '`src/areas/governance/components/GovernanceDocuments.tsx`',
      '`src/components/ThemeScope.tsx`',
      '`themeHeritage`',
      '`newLook`',
      '`test/unit/governanceEditors.test.tsx`',
      '`test/a11y/heritage.spec.ts`',
      '`<main>`',
      '`test/a11y/scopes.spec.ts`',
    ]) expect(sentence, piece).toContain(piece)
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
