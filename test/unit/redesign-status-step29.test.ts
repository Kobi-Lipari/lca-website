// test/unit/redesign-status-step29.test.ts
//
// REDESIGN_STATUS.md records step 29 (the still hero picture, the image
// script and no auto-advance) and REDESIGN_SPEC.md's WS01 deviation list
// carries its sentence. The living parts are pinned: the AC4 and AC7 rows
// name their proofs and are no longer planned, AC7 with the lab score as a
// measurement and K's run on a preview still to do, a branch preview serving
// the site with newLook off, and the AC8 row is left as it was, since the
// fixture page's boxes did not change; the step block
// sits in order and describes the picture component, the image script and
// its quality table, the hero with newLook on and off, the timer test, the
// lab check, the places left for later, the judgement calls, the lint, the
// build and the browser runs, with the counts the tree holds; the three
// lines planned for this step under Decisions keep their words with Done in
// step 29 added; the deviation, the verify items and the follow-ups are
// there, none renamed or removed, the dark ground follow-up closed for the
// still hero and the carousel one given its sentence without being closed;
// and the plain-language rules hold (no em dash, none of the working words,
// no mention of an assistant, US Chess rather than its old initials).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')

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

const HEADING = '### Step 29: the still hero picture and nothing that moves on by itself'
const block = between(HEADING, '### Decisions')
const ac4 = line('| AC4 |')
const ac7 = line('| AC7 |')
const ac8 = line('| AC8 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 29)'))
const tagged = lines.filter((l) => /\(step 29[;)]/.test(l))
const deviation = bullet('- **Step 29.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))

describe('REDESIGN_STATUS.md, step 29: the acceptance rows', () => {
  it('fills the AC4 row for step 29: no longer planned, with the unit tests, the timer scan and the browser\'s clock and animations', () => {
    expect(ac4).toMatch(/^\| AC4 \| Nothing auto-advances; reduced motion stops animation \| 29 \| /)
    expect(ac4).not.toContain('Planned')
    for (const piece of [
      '`test/unit/hero-no-autoplay.test.tsx`',
      '`test/unit/fixtures/home-hero-today.ts`',
      '`c534742`',
      '60 seconds',
      '`test/unit/no-rotation.test.ts` (19)',
      'no dependency list',
      'made anew on every render',
      'a value in the list is read from',
      '`src/hooks/useNow.ts`',
      '`AdminEmailPage.tsx`',
      '`AnnualMeetingPage.tsx`',
      'WS03',
      'planted',
      '`test/a11y/home.spec.ts`',
      'page clock',
      '`document.getAnimations()`',
      'the fixture page',
      'test/a11y/baseline.json',
    ]) expect(ac4, piece).toContain(piece)
  })

  it('fills the AC7 row for step 29: the picture a phone takes, the 30 files, the lab score recorded with its runs, and K\'s run still to do', () => {
    expect(ac7).toMatch(/^\| AC7 \| Home hero image size and mobile performance \| 29 \| /)
    expect(ac7).not.toContain('Planned')
    for (const piece of [
      '`test/a11y/home.spec.ts`',
      '390 by 844 pixels and three times density',
      '`fetchpriority="high"`',
      '162,969',
      '2,171,020 bytes',
      '`test/unit/image-budget.test.ts`',
      '200,000 bytes or less',
      '2048 by 1237',
      '`npm run perf:home`',
      'Lighthouse 13.5.0',
      'median',
      'not a gate',
      'K\'s run on the preview is still to do',
    ]) expect(ac7, piece).toContain(piece)
    expect(ac7).toMatch(/scored \d{2,3}, \d{2,3} and \d{2,3} over three runs \(median \d{2,3}\)/)
  })

  it('leaves the AC8 row as it was: the fixture page\'s boxes did not change, so no sentence is added for step 29', () => {
    expect(ac8).not.toContain('step 29')
    expect(ac8).toMatch(/the status tags' boxes stay put in every look too\. \|$/)
  })
})

describe('REDESIGN_STATUS.md, step 29: the step block', () => {
  it('sits after step 28 and before the Decisions, and the date line names it first', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 28:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:3\d): [^;]+; )*step 29: [^;]+; step 28: [^;]+; step 27: [^;]+; /)
    // The record tests look for these steps in the file's first 400 characters.
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('records the component, the script, the hero both ways, the timer test, the lab check, the places left, the judgement calls, the lint, the build and the browser runs', () => {
    for (const part of ['**Files.**', '**ResponsiveImage**', '**The image script**', '**The hero under newLook.**', '**The hero with the switch off.**', '**The timer test.**', '**The lab check**', '**The places left for later.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**']) {
      expect(block, part).toContain(part)
    }
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    // The records name no fixture route by its path, no conflict marker and no placeholder.
    expect(block).not.toContain('__')
    expect(block).not.toContain('@@')
    expect(block).not.toMatch(/\{[A-Z_0-9]+\}/)
  })

  it('describes the picture component: both formats by width, sizes, the photo\'s own shape, priority or lazy, and its exports', () => {
    const part = bullet('- **ResponsiveImage**', HEADING)
    for (const piece of ['`<picture>`', 'AVIF', 'WebP', '`sizes`', 'width and height', '`fetchpriority="high"`', '`loading="lazy"`', 'only-export-components', 'one by one']) {
      expect(part, piece).toContain(piece)
    }
  })

  it('describes the image script with its quality table, every file at 200,000 bytes or less, and hero.png left out', () => {
    const part = bullet('- **The image script**', HEADING)
    for (const piece of ['`scripts/images.mjs`', 'sharp 0.34.5', '640, 1024 and 1600', '200,000 bytes or less', '4:2:0', 'hero.png', 'byte for byte', 'Display P3', '`npm run images`']) {
      expect(part, piece).toContain(piece)
    }
    // The quality table: the usual qualities and the four files that need less, each with its size.
    for (const piece of ['AVIF at 60', 'WebP at 75', 'slide 3 at 1600 pixels', 'slide 5', '55 (195,594 bytes)', '57 (188,139 bytes)', '48 (192,900 bytes)', '60 (191,364 bytes)', '162,969']) {
      expect(part, piece).toContain(piece)
    }
  })

  it('describes the hero under newLook: one still picture under the slide\'s darkening, the marker once, no timer, and the pins that moved', () => {
    const part = bullet('- **The hero under newLook.**', HEADING)
    for (const piece of ['`HomeHero`', '`HeroSlideshow`', 'not drawn', 'no timer', '`data-ground="dark"`', '`bg-brand-navy/55`', '`(max-width: 695px) 696px, 100vw`', 'Louisiana Chess Community', '`alt=""`', 'line 259', '`goldText.test.ts`']) {
      expect(part, piece).toContain(piece)
    }
  })

  it('describes the hero with the switch off as today\'s, to the attribute, and the baseline unchanged', () => {
    const part = bullet('- **The hero with the switch off.**', HEADING)
    for (const piece of ['`test/unit/fixtures/home-hero-today.ts`', 'to the attribute', '`c534742`', '5 seconds', 'test/a11y/baseline.json']) expect(part, piece).toContain(piece)
  })

  it('describes the timer test, its four entries with their counts and the cases it fails', () => {
    const part = bullet('- **The timer test.**', HEADING)
    for (const piece of ['`test/unit/no-rotation.test.ts`', '`.ts`', 'useNow', 'AdminEmailPage', 'AnnualMeetingPage', 'HomePage', 'planted', 'TypeScript parser', 'WS03']) expect(part, piece).toContain(piece)
    // The cases it fails and passes, each planted: the helper, the hooks and classes, the dispatch, the functions that call each other, and the effects that run again.
    for (const piece of [
      'a helper',
      '`useCallback`',
      'a class method or a class field',
      'dispatch',
      'two functions that call each other',
      'an effect with no dependency list',
      'a list that is not written out',
      'a value read from the state',
      '`useMemo`',
      'made anew on every render',
      'a debounce whose helper sets only what its effect does not depend on',
      'an effect with an empty list',
      'for review',
    ]) expect(part, piece).toContain(piece)
  })

  it('describes the lab check: the build it serves, the browser it starts and why, and its score as a measurement', () => {
    const part = bullet('- **The lab check**', HEADING)
    for (const piece of ['`scripts/perf-home.ts`', '`npm run perf:home`', 'Lighthouse 13.5.0', '`PW_CHROMIUM_PATH`', 'chrome-launcher', 'median', 'not a gate', '`npm run test:a11y`', '127.0.0.1']) {
      expect(part, piece).toContain(piece)
    }
    // It measures only a server it started, and stops what it started however the run ends.
    for (const piece of ['8801 and 8802, and their inspector ports 9231 and 9232', '`reuseExistingServer: false`', 'process groups of their own', 'SIGTERM', 'SIGHUP', 'Ctrl-C', '30 seconds', 'no process, port or profile folder']) {
      expect(part, piece).toContain(piece)
    }
  })

  it('names every file the step adds, and every test whose header says it is of step 29, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'scripts/images.mjs',
      'src/assets/generated',
      'src/components/ResponsiveImage.tsx',
      'scripts/perf-home.ts',
      'test/unit/image-budget.test.ts',
      'test/unit/no-rotation.test.ts',
      'test/unit/hero-no-autoplay.test.tsx',
      'test/unit/fixtures/home-hero-today.ts',
      'test/unit/redesign-status-step29.test.ts',
      'test/a11y/home.spec.ts',
      'src/pages/HomePage.tsx',
      'src/vite-env.d.ts',
      'test/unit/goldText.test.ts',
      'test/unit/browser-test-wiring.test.ts',
      'test/unit/brand-edges.test.tsx',
    ]) expect(files, name).toContain(`\`${name}\``)
    const ofStep = ['test/unit', 'test/a11y'].flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`)
        .filter((path) => /\bstep 29\b(?!'s)/.test(readFileSync(join(ROOT, path), 'utf8').split('\n').slice(0, 25).join('\n'))),
    )
    expect(ofStep.length).toBeGreaterThanOrEqual(5)
    for (const path of ofStep) expect(files, path).toContain(`\`${path}\``)
  })

  it('reports the build before and after, with the six image files the hero adds', () => {
    const build = bullet('- **Build.**', HEADING)
    expect(build).toMatch(/CSS 127,896 and [\d,]+ bytes \(one file/)
    expect(build).toMatch(/JavaScript 2,584,601 and [\d,]+ bytes \([\d,]+ more\) in 104 and 104 files; 127 and 133 files in all/)
    for (const piece of ['43,056', '88,982', '162,969', '44,420', '92,552', '175,804', '`import.meta.glob`', '`npm run check:bundle` finds no zod']) expect(build, piece).toContain(piece)
  })

  it('reports the browser runs: the new spec on each build, the baseline matched and the counts', () => {
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const piece of ['`test/a11y/home.spec.ts`', '`test/a11y/home-edges.spec.ts`', '163,269 bytes', 'image/avif', '2,171,020 bytes', 'getAnimations', 'known-violations.json', 'database is locked']) {
      expect(runs, piece).toContain(piece)
    }
    expect(block).toContain('"Baseline matches: no colour or font changed."')
    expect(block).toMatch(/389 tests, 308 that run and 81 that skip \(291 and 66 before;/)
    expect(block).toContain('`home.spec.ts` adds 7 tests that run on `a11y-on` and 5 on `a11y-off`')
    expect(block).toContain('`home-edges.spec.ts` adds 4 tests that run on `a11y-on` and 1 on `a11y-off`')
    for (const route of ['/', '/tournaments', '/membership']) expect(runs).toContain(`axe in dark mode on ${route}:`)
  })

  it('states the unit and integration counts the tree holds', () => {
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toMatch(/unit \d{4} tests in 146 files \(3849 in 141 before;/)
    expect(checks).toContain('integration 790 in 58 (unchanged)')
  })
})

describe('REDESIGN_STATUS.md, step 29: decisions, deviations, verify items and follow-ups', () => {
  it('keeps the three lines planned for this step word for word, each with Done in step 29 after it', () => {
    for (const [start, words] of [
      ['- **Homepage hero (step 29).**', '- **Homepage hero (step 29).** With `newLook` on, the homepage hero shows one still, responsive picture instead of the slideshow. WS03 replaces the hero entirely. Done in step 29:'],
      ['- **`hero.png` is left out of the image pipeline (step 29)**', '- **`hero.png` is left out of the image pipeline (step 29)**, because nothing uses it. Done in step 29:'],
      ['- **AC7\'s Lighthouse score is recorded, not enforced (step 29).**', '- **AC7\'s Lighthouse score is recorded, not enforced (step 29).** The mobile score of 90 or more is a lab measurement (`npm run perf:home`, plus K\'s run on the preview) written down here. The 200 KB limit on the largest image is enforced by a test. Done in step 29:'],
    ]) expect(line(start), start).toContain(words)
  })

  it('records the step\'s own decisions, none of them under an earlier step\'s name', () => {
    expect(decisions).toHaveLength(4)
    const text = decisions.join('\n')
    for (const piece of ['`scripts/images.mjs`', 'committed', 'sharp', '`test/unit/no-rotation.test.ts`', 'allowlist']) expect(text, piece).toContain(piece)
    // The timer rule says what the test reads and what it leaves to review, and claims no more.
    const timers = line('- **Repeating timers (step 29).**')
    expect(timers).not.toContain('however it is written')
    for (const piece of ['no dependency list', 'read from', 'another file, a prop or a context', 'for review']) expect(timers, piece).toContain(piece)
    for (const d of decisions) {
      expect(d).not.toContain('(step 28)')
      expect(d).not.toContain('(step 27)')
    }
  })

  it('lists the step 29 deviations: the three from the spec\'s words, the files beyond the step\'s list and the pins moved', () => {
    for (const piece of ['`hero.png`', '`HeroSlideshow`', 'only under `newLook`', 'vite-imagetools', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 29.**')
    for (const path of [
      'src/vite-env.d.ts',
      'docs/redesign/REDESIGN_SPEC.md',
      'test/unit/fixtures/home-hero-today.ts',
      'test/unit/goldText.test.ts',
      'test/unit/browser-test-wiring.test.ts',
      'test/unit/brand-edges.test.tsx',
      'test/unit/redesign-status-step29.test.ts',
      'test/unit/hero-images-edges.test.tsx',
      'test/a11y/home-edges.spec.ts',
    ]) expect(beyond, path).toContain(`\`${path}\``)
    // It follows step 28's deviation.
    const steps = between('### Deviations from the brief', '### Verify items resolved').split('\n').filter((l) => /^- \*\*Step \d+\.\*\*/.test(l)).map((l) => Number(l.match(/Step (\d+)/)![1]))
    expect(steps.slice(steps.indexOf(28), steps.indexOf(28) + 2)).toEqual([28, 29])
  })

  it('resolves the three verify items it was given, and the ones it found', () => {
    for (const name of [
      'Hero weight and auto-advance',
      'Other timers',
      'PageHero without any slideshow',
      'The hero\'s photos are backgrounds',
      'The slides\' shapes and sizes',
      'sharp is already installed',
      'The lab check\'s package',
      'The avif declaration',
      'What ships',
      'The HomePage pins',
      'The third interval',
      'The img elements on /',
      'The known-violations list',
      'The picture before the script runs',
      'The baseline',
      'Records',
      'Lint, build and the browser runs',
      'Counts',
    ]) expect(verify, name).toContain(`- **${name} (step 29).**`)
    const weight = line('- **Hero weight and auto-advance (step 29).**')
    for (const piece of ['569,165', '2,171,020', 'lines 53 and 56', 'hero.png', '13,057']) expect(weight, piece).toContain(piece)
    const timers = line('- **Other timers (step 29).**')
    for (const piece of ['`AdminEmailPage.tsx` line 196', '`AnnualMeetingPage.tsx` line 80', '`src/hooks/useNow.ts` line 17']) expect(timers, piece).toContain(piece)
    expect(line('- **sharp is already installed (step 29).**')).toContain('0.35.5')
  })

  it('closes the dark ground follow-up for the still hero, gives the carousel one its sentence without closing it, and adds its sentences to the open ones it meets', () => {
    const dark = line('- **Dark grounds that are not a navy band (step 21).**')
    expect(dark).toContain('Step 29\'s still hero keeps the marker on the element that holds its controls. Done in step 29:')
    const carousel = line('- **Hero carousel and the known-violations list (step 20).**')
    expect(carousel).toContain('Step 29:')
    expect(carousel).not.toContain('Done in step 29')
    expect(line('- **Classes only docs and tests name reach the CSS (step 23).**')).toContain('Step 29')
    expect(line('- **The baseline sampler waits for content (step 27).**')).not.toContain('Done in step 29')
    expect(line('- **The a11y servers share one database (step 23).**')).not.toContain('Done in step 29')
  })

  it('lists what it leaves as follow-ups headed with step 29', () => {
    for (const name of [
      'K reviews the step 29 judgement calls (step 29)',
      'K\'s lab run on the preview (step 29)',
      'What the lab check found beyond the hero (step 29)',
      'WS03 deletes HeroSlideshow (step 29)',
      'The Facebook band\'s image with no width or height (step 29; older than the step)',
      'The header\'s and the footer\'s images with newLook off (step 29; older than the step)',
      'Making the hero pictures again (step 29)',
    ]) expect(followUps, name).toContain(`- **${name}.**`)
    const beyond = line('- **What the lab check found beyond the hero (step 29).**')
    for (const piece of ['WS03', '`/api/clearinghouse?upcoming=true`', '`/api/clubs`', 'layout shift', 'discoverable', 'unused']) expect(beyond, piece).toContain(piece)
    const again = line('- **Making the hero pictures again (step 29).**')
    for (const piece of ['`npm run images`', '0.34.5', '0.35.5']) expect(again, piece).toContain(piece)
    const deletes = line('- **WS03 deletes HeroSlideshow (step 29).**')
    for (const piece of [
      '`test/unit/no-rotation.test.ts`',
      'known-violations.json',
      'raw-colours-allowlist.json',
      '`test/unit/fixtures/home-hero-today.ts`',
      '`test/unit/hero-images-edges.test.tsx`',
      '`test/a11y/home-edges.spec.ts`',
      '`test/a11y/baseline.json`',
      'sha256',
    ]) expect(deletes, piece).toContain(piece)
  })

  it('says a branch preview serves the site with newLook off, so K\'s run of the still hero waits for one that shows it', () => {
    const lab = line('- **Lab measurements (step 29).**')
    const run = line('- **K\'s lab run on the preview (step 29).**')
    const planned = line('- **AC7\'s Lighthouse score is recorded, not enforced (step 29).**')
    for (const [name, text] of [
      ['the AC7 row', ac7],
      ['the lab decision', lab],
      ['the follow-up', run],
      ['the planned line', planned],
    ]) expect(text, name).toContain('serves the site with `newLook` off')
    for (const [name, text] of [
      ['the AC7 row', ac7],
      ['the lab decision', lab],
      ['the follow-up', run],
    ]) {
      expect(text, name).toMatch(/a preview built with `newLook` on, or (?:for |before )?the switch (?:is |being )?turned on/)
      expect(text, name).toContain('the figure from before the step')
    }
    // Why: outside the accessibility test mode the build never reads VITE_FLAGS.
    expect(run).toContain('`--mode a11y`')
    expect(run).toContain('`VITE_FLAGS`')
    expect(readFileSync(join(ROOT, 'src/lib/features.ts'), 'utf8')).toMatch(/import\.meta\.env\.MODE === 'a11y'\s*\?\s*applyFlagOverrides\(SWITCHES, import\.meta\.env\.MODE, import\.meta\.env\.VITE_FLAGS\)\s*:\s*SWITCHES/)
  })

  it('says the lab measured the Facebook band in its error state, so its call to Facebook and its growth to five posts are in neither the score nor the layout shift', () => {
    const beyond = line('- **What the lab check found beyond the hero (step 29).**')
    const lab = line('- **Lab measurements (step 29).**')
    const run = line('- **K\'s lab run on the preview (step 29).**')
    for (const [name, text] of [
      ['the follow-up', beyond],
      ['the lab decision', lab],
    ]) {
      for (const piece of ['Facebook band in its error state', 'page token', '`/api/facebook-posts', '"Couldn\'t load posts right now."', 'five posts', 'the layout shift', 'WS03', 'K\'s']) {
        expect(text, `${name}: ${piece}`).toContain(piece)
      }
    }
    expect(ac7).toContain('the Facebook band in its error state')
    expect(run).toContain('Facebook band in its error state')
    expect(run).toContain('page token and page id')
    // Why: the test servers hold the Facebook settings empty, the seeded feed cache has no posts, and with no token the function answers from that cache or with an error.
    const setup = readFileSync(join(ROOT, 'test/a11y/global-setup.ts'), 'utf8')
    expect(setup.slice(setup.indexOf('export const A11Y_EMPTY_SECRETS'))).toMatch(/^[^\]]*'FACEBOOK_PAGE_TOKEN',\s*'FACEBOOK_PAGE_ID',/)
    expect(readFileSync(join(ROOT, 'migrations/0023_facebook_feed_cache.sql'), 'utf8')).toContain("VALUES (1, '[]', NULL);")
    expect(readFileSync(join(ROOT, 'functions/api/facebook-posts.ts'), 'utf8')).toMatch(/if \(!env\.FACEBOOK_PAGE_TOKEN \|\| !env\.FACEBOOK_PAGE_ID\) \{\s*return await servedFromCacheOrError\(/)
  })

  it('removes none: the 150 follow-ups before it are all still counted, and none says it was done in a step that did not do it', () => {
    const ofStep = (n: number) => headings.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = headings.filter((h) => /\(step (?:29|3\d)[;)]/.test(h))
    expect(ofStep(29).length).toBeGreaterThanOrEqual(7)
    expect(headings.length - later.length).toBe(150)
    expect(new Set(headings).size).toBe(headings.length)
    expect(followUpEntries.filter((l) => l.includes('Done in step 29')).length).toBeGreaterThanOrEqual(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 28'))).toHaveLength(1)
    expect(followUpEntries.filter((l) => l.includes('Done in step 27'))).toHaveLength(0)
  })
})

describe('REDESIGN_STATUS.md, step 29: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    expect(tagged.length).toBeGreaterThanOrEqual(30)
    for (const text of [block, ac4, ac7, ...decisions, ...tagged, deviation]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 29 ')
  const end = ws01.indexOf('. ', at)
  const sentence = at < 0 ? '' : ws01.slice(at, end < 0 ? undefined : end + 1)

  it('has the step 29 sentence after step 28\'s, which still ends where it did', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 28 '))
    expect(ws01.slice(0, at)).toMatch(/and `test\/a11y\/brand\.spec\.ts`\. $/)
    expect(sentence.length).toBeGreaterThan(200)
    expect(sentence.startsWith('Step 29 (recorded in step 29) adds `scripts/images.mjs`')).toBe(true)
  })

  it('names the script, the component, the files, the hero both ways, the lab check, the tests and WS03', () => {
    for (const piece of [
      '`src/components/ResponsiveImage.tsx`',
      '`src/assets/generated`',
      '`HomePage`',
      '`HeroSlideshow`',
      '`newLook`',
      '`hero.png`',
      '`scripts/perf-home.ts`',
      '`test/unit/no-rotation.test.ts`',
      '`test/unit/hero-no-autoplay.test.tsx`',
      '`test/unit/image-budget.test.ts`',
      '`test/a11y/home.spec.ts`',
      'WS03',
    ]) expect(sentence, piece).toContain(piece)
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
