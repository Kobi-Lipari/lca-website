// test/unit/redesign-status-step23.test.ts
//
// REDESIGN_STATUS.md records step 23 (the pages' ink and grounds on the
// tokens) and REDESIGN_SPEC.md's WS01 deviation list carries its sentence
// (the step's acceptance criterion 5). The living parts are pinned: the T1
// row names the proofs, the step block sits in order and its counts are the
// map's and the tree's, every lint fix in a touched file is listed, each
// verify item is resolved, the decisions, deviations and follow-ups are
// there, the WS01 header names the open pull request, and the plain-language
// rules hold for the parts written for readers (no em dash, none of the
// working words, no mention of an assistant).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP, loadMap, parseToken, planRewrite } from '../../scripts/codemods/semantic-colours'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
const ASSISTANT = /\b(claude|anthropic|AI-generated|generated with|co-authored)\b/i

const lines = status.split('\n')
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
const between = (from: string, to: string) => {
  const start = status.indexOf(from)
  if (start < 0) return ''
  const end = status.indexOf(to, start + from.length)
  return status.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it. */
function bullet(start: string): string {
  const at = lines.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}

const HEADING = "### Step 23: the pages' ink and grounds on the tokens"
const block = between(HEADING, '### Decisions')
const row = line('| T1 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 23)'))
const tagged = lines.filter((l) => /\(step 23[;)]/.test(l))
const deviation = bullet('- **Step 23.**')

const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

describe('REDESIGN_STATUS.md, step 23: the acceptance row', () => {
  it('has a T1 row for step 23, after the AC and K rows, and the table says what T1 is', () => {
    expect(row).toMatch(/^\| T1 \| The existing pages follow dark mode: navy text, white grounds and navy bands \| 23 \|/)
    expect(row).not.toContain('Planned')
    // After every AC and K row; a later step of the plan adds its own T row after it.
    const table = lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Item'))
    const at = table.indexOf(row)
    expect(at).toBeGreaterThan(0)
    expect(table.slice(0, at).every((l) => /^\| (AC|K)\d/.test(l))).toBe(true)
    expect(table.slice(at + 1).every((l) => /^\| T\d+ \| /.test(l))).toBe(true)
    expect(status).toMatch(/T1 is a step of the plan that neither names/)
  })

  it('names the proofs: the script and its map, the identity test, the unchanged baseline and the dark run', () => {
    for (const piece of [
      'scripts/codemods/semantic-colours.ts',
      'scripts/codemods/semantic-colours.map.json',
      'test/unit/semantic-map.test.ts',
      'test/a11y/baseline.json',
      'test/a11y/dark-spot.spec.ts',
      'test/a11y/dark-grounds.spec.ts',
      'test/unit/semantic-map-cascade.test.ts',
      'test/unit/semantic-map-grounds.test.ts',
      '`/`, `/tournaments` and `/membership`',
    ]) expect(row, piece).toContain(piece)
  })

  it('states the kept counts the map and the tree hold', () => {
    const map = loadMap(DEFAULT_MAP)
    const kept = planRewrite(ROOT, map, 'check').kept
    const veils = kept.filter((k) => parseToken(k.token).modifier !== '').length
    const mats = kept.length - veils
    expect(row).toContain(`the ${kept.length} \`bg-white\` left are keep entries with a reason`)
    expect(row).toContain(`${WORDS[mats] ?? mats} white mats`)
    expect(row).toContain(`${veils} translucent veils on navy`)
  })
})

describe('REDESIGN_STATUS.md, step 23: the step block', () => {
  it('sits after step 22 and before the Decisions, and the date line names it', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 22:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(status.slice(0, 400)).toContain('step 23')
  })

  it('describes the map with the counts it has', () => {
    const map = loadMap(DEFAULT_MAP)
    const word = (n: number) => WORDS[n] ?? String(n)
    expect(block).toContain(`${word(map.rules.length)} rules tried in order`)
    expect(block).toContain(`${word(map.sites.length)} sites`)
    expect(block).toContain(`${word(map.keep.length)} keep entries`)
    expect(block).toMatch(/`text-lca-navy`: 381 to none/)
    expect(block).toMatch(/`bg-lca-navy`: 102 to none/)
  })

  it('records the judgement calls, the lint, the build sizes and the dark run', () => {
    for (const part of ['**Files.**', '**The script and the map.**', '**The brand navy.**', '**Dark grounds marked.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The dark spot run.**']) {
      expect(block, part).toContain(part)
    }
    const calls = bullet('- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const piece of ['text-brand-navy', 'GOLD_BUTTON', 'gold tint', 'Navy tints keep the brand navy', 'Safari 15.4 to 16.1', 'dark:text-white', 'White mats stay white', 'border-gray-300', 'bg-gray-100', 'border-lca-navy', '`FilterDropdown`', '`bg-popover`']) {
      expect(calls, piece).toContain(piece)
    }
    // The review is not said to be a person's: the brief asks for one, and K's is a follow-up.
    expect(calls).not.toMatch(/a person reviewed/i)
    expect(calls).toContain('K reviews these calls before `newLook` is turned on')
  })

  it('names every file the step adds, in its Files and in the deviations', () => {
    const files = block.slice(block.indexOf('- **Files.**'), block.indexOf('- **The script and the map.**'))
    expect(files).not.toBe('')
    const unit = ['semantic-map', 'semantic-map-cascade', 'semantic-map-grounds', 'semantic-colours-edges', 'redesign-status-step23']
    const tsx = ['announcement-banner-ground', 'moved-modules', 'posts-panel-load', 'scoresheet-photos']
    for (const name of [...unit.map((n) => `test/unit/${n}.test.ts`), ...tsx.map((n) => `test/unit/${n}.test.tsx`), 'test/unit/helpers/jsxClasses.ts', 'test/a11y/dark-spot.spec.ts', 'test/a11y/dark-grounds.spec.ts']) {
      expect(files, name).toContain(`\`${name}\``)
    }
    for (const name of [...unit.slice(1), ...tsx, 'test/unit/helpers/jsxClasses.ts', 'dark-grounds.spec.ts']) expect(deviation, name).toContain(name)
  })

  it('lists the fix for every lint error in a file the step touches', () => {
    const lint = bullet('- **Lint.**')
    expect(lint).toMatch(/34 errors and 13 warnings before, \d+ errors and 13 warnings after/)
    for (const file of ['LCAMap.tsx', 'ClubLocationPicker.tsx', 'PostsPanel.tsx', 'ResultsEntry.tsx', 'UsChessMembership.tsx', 'FacebookFeed.tsx', 'src/lib/viewOnly.tsx', 'ContactPage.tsx', 'SupportPage.tsx', 'ScannerPage.tsx']) {
      expect(lint, file).toContain(`\`${file}\``)
    }
  })

  it('names the files beyond the step\'s list that the lint fixes needed', () => {
    for (const file of ['src/areas/clubs/clubMap.ts', 'src/areas/membership/usChess.ts', 'src/hooks/useViewOnly.ts']) {
      expect(block, file).toContain(file)
      expect(deviation, file).toContain(file)
    }
  })
})

describe('REDESIGN_STATUS.md, step 23: decisions, deviations, verify items and follow-ups', () => {
  it('records the ink and ground, brand navy and script decisions', () => {
    expect(decisions).toHaveLength(3)
    const text = decisions.join('\n')
    for (const piece of ['`text-ink`', '`text-brand-navy`', '`bg-surface`', '`bg-brand-navy`', '`bg-brand-navy/5`', '`dark:text-white`', '`--color-brand-navy`', 'scripts/codemods/semantic-colours.ts', '`--check`', '`--map`']) {
      expect(text, piece).toContain(piece)
    }
  })

  it('lists the step 23 deviations from the plan', () => {
    expect(deviation).not.toBe('')
    for (const piece of ['`text-brand-navy`', '`bg-brand-navy/5`', 'Safari 15.4 to 16.1', '`text-ink/80`', '`bg-surface/90`', '`dark:text-white`', '`border-gray-300`', '`--color-brand-navy`', '`.bg-brand-navy`', 'data-ground="dark"', 'dark-spot.spec.ts']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('resolves each verify item the step was given, and the ones it found', () => {
    for (const name of [
      'Hardcoded colour counts',
      'Dark usage today',
      'The mapped classes on the plain `:root`',
      '`bg-brand-navy` and the gold ring',
      'Navy text on gold',
      'Opaque white',
      'Navy grounds outside class strings',
      'The step 21 follow-ups this step meets',
      'Lint in touched files',
      'Baseline and the dark run',
      'Build size',
      'New files',
      'Records',
    ]) expect(status, name).toContain(`- **${name} (step 23).**`)
  })

  it('lists what it leaves for later as follow-ups', () => {
    for (const name of [
      'Navy borders and rings',
      'Selected navy controls in dark mode',
      'Gold grounds in dark mode',
      'Light islands that stay light in dark mode',
      'Club colours in dark mode',
      'The a11y servers share one database',
      '`GOLD_BUTTON` keeps `text-lca-navy`',
      'Navy tints in dark mode',
      'Classes only docs and tests name reach the CSS',
      'K reviews the step 23 judgement calls',
    ]) expect(status, name).toContain(`- **${name} (step 23).**`)
    const followUps = between('### Follow-ups', '\n## WS02')
    for (const t of tagged.filter((l) => /^- \*\*(Navy borders|Navy tints|Classes only|Selected navy|Gold grounds|Light islands|Club colours|The a11y servers|`GOLD_BUTTON`|K reviews)/.test(l))) {
      expect(followUps, t.slice(0, 60)).toContain(t)
    }
  })

  it('records the light menu in the /tournaments hero under the step 21 follow-up, not a clean check', () => {
    const card = bullet('- **A light card inside a navy band (step 21).**')
    expect(card).toContain('`FilterDropdown`')
    expect(card).toContain('2.28:1')
    expect(card).not.toMatch(/none holds a focusable control/)
  })

  it('updates the WS01 header: the branch is pushed and checkpoint D is draft pull request 108', () => {
    const header = between('## WS01:', '### What each acceptance criterion')
    expect(header).toContain('draft pull request 108')
    expect(header).not.toMatch(/not pushed yet/)
    expect(header).not.toMatch(/\*\*PR:\*\* none yet/)
  })
})

describe('REDESIGN_STATUS.md, step 23: plain language', () => {
  it('keeps the working words out of the block, the T1 row, the decisions and the step\'s other entries', () => {
    expect(block).not.toBe('')
    for (const text of [block, row, ...decisions, ...tagged, deviation]) expect(text).not.toMatch(BANNED)
  })

  it('uses no em dash and does not mention an assistant', () => {
    for (const text of [block, row, ...decisions, ...tagged, deviation]) {
      expect(text).not.toContain('\u2014')
      expect(text).not.toMatch(ASSISTANT)
    }
  })

  it('writes "US Chess", never USCF, in what it adds', () => {
    for (const text of [block, row, ...decisions, ...tagged, deviation]) expect(text).not.toMatch(/\bUSCF\b/)
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 23 ')
  const sentence = at < 0 ? '' : ws01.slice(at, ws01.indexOf('. ', at) < 0 ? undefined : ws01.indexOf('. ', at) + 1)

  it('has the step 23 sentence', () => {
    expect(at).toBeGreaterThan(-1)
    expect(sentence.length).toBeGreaterThan(200)
  })

  it('names the script, the two extra rewrites, the brand navy, the greys left to step 24, the kept white and the markers', () => {
    for (const piece of ['scripts/codemods/semantic-colours.ts', '`text-brand-navy`', '`--color-brand-navy`', '`.bg-brand-navy`', '`dark:text-white`', 'step 24', 'data-ground="dark"']) {
      expect(sentence, piece).toContain(piece)
    }
  })

  it('keeps to the plain-language rules', () => {
    expect(sentence).not.toContain('\u2014')
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
