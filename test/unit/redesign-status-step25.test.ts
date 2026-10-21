// test/unit/redesign-status-step25.test.ts
//
// REDESIGN_STATUS.md records step 25 (gold text off light grounds) and
// REDESIGN_SPEC.md's WS01 deviation list carries its sentence (the step's
// acceptance criterion 7). The living parts are pinned: the AC2 row names the
// proofs and its counts are the tree's, the step block sits in order and
// describes the script, the map, the tokens, the meaningful icons, the
// judgement calls, the guard, the lint, the build and the dark run; the
// decisions, deviations, verify items and follow-ups are there, the earlier
// follow-ups this step closes say so under their old names, and the
// plain-language rules hold (no em dash, none of the working words, no
// mention of an assistant, US Chess rather than its old initials).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GOLD, GOLD_MAP, planGold } from '../../scripts/codemods/gold-ink'
import { loadMap } from '../../scripts/codemods/semantic-colours'
import { GOLD_ALLOWLIST, GOLD_BADGE_ALLOWLIST, WS02_GOLD } from './fixtures/goldAllowlist'

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
/** A bullet and the indented lines under it, from the first line that starts with `start` after `after`. */
function bullet(start: string, after = ''): string {
  const from = after ? lines.findIndex((l) => l.startsWith(after)) : 0
  const at = lines.findIndex((l, i) => i >= from && l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}

const HEADING = '### Step 25: gold text off light grounds'
const block = between(HEADING, '### Decisions')
const row = line('| AC2 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 25)'))
const tagged = lines.filter((l) => /\(step 25[;)]/.test(l))
const deviation = bullet('- **Step 25.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')

const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

describe('REDESIGN_STATUS.md, step 25: the AC2 row', () => {
  it('fills the AC2 row for step 25: no longer planned', () => {
    expect(row).toMatch(/^\| AC2 \| No light-gold text on a light ground \| 25 \| /)
    expect(row).not.toContain('Planned')
  })

  it('names the proofs: the script and the map, the guard and its allowlist, identity, tokens, contrast, the baseline, the dark run and the News page', () => {
    for (const piece of [
      'scripts/codemods/gold-ink.ts',
      'scripts/codemods/semantic-colours.ts',
      'scripts/codemods/semantic-colours.gold.map.json',
      'test/unit/goldText.test.ts',
      'test/unit/fixtures/goldAllowlist.ts',
      'test/unit/gold-ink.test.ts',
      'test/unit/semantic-map.test.ts',
      'test/unit/tokens.test.ts',
      'test/unit/contrast.test.ts',
      'test/a11y/baseline.json',
      'test/a11y/dark-spot.spec.ts',
      'test/unit/news-pinned.test.tsx',
      'test/unit/news-pinned-off.test.tsx',
      '`clubTextColor`',
    ]) expect(row, piece).toContain(piece)
  })

  it('states the counts the tree holds now: the brand gold left is the navy uses and the allowlist\'s', () => {
    const plan = planGold(ROOT, GOLD_ALLOWLIST, 'check')
    expect(plan.problems).toEqual([])
    const gold = plan.uses.filter((u) => u.utility === GOLD)
    const navy = gold.filter((u) => u.ground === 'navy').length
    const allowed = GOLD_ALLOWLIST.reduce((n, e) => n + e.count, 0)
    expect(gold.length).toBe(navy + allowed)
    expect(row).toContain(`the ${navy} on navy or a dark ground stay, and so do the ${allowed} in objects of strings`)
    // The run itself: 135 in 43 files, 82 rewritten, and the 34 hex classes in 20 files.
    expect(row).toContain('every `text-lca-gold` (135 in 43 TSX files) and rewrote the 82 on a light ground, 2 of them in commented-out code')
    expect(row).toContain('moved the 34 gold hex text classes in 20 files')
    expect(gold.length + 82).toBe(135)
  })
})

describe('REDESIGN_STATUS.md, step 25: the step block', () => {
  it('sits after step 24 and before the Decisions, and the date line names it, after any later step', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 24:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:2[6-9]|3\d): [^;]+; )*step 25: /)
  })

  it('records the files, the script, the tokens, a club\'s colour, the icons, the judgement calls, the guard, the lint, the build and the dark run', () => {
    for (const part of ['**Files.**', '**The script.**', '**Tokens.**', '**A club\'s colour as words.**', '**Meaningful icons.**', '**Judgement calls.**', '**The guard.**', '**Lint.**', '**Build.**', '**The dark spot run.**']) {
      expect(block, part).toContain(part)
    }
    const calls = bullet('- **Judgement calls.**', HEADING)
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
    for (const piece of ['`text-gold-ink`', '`text-gold-ink-badge`', '4.42:1', '`--status-soon`', '`#f0d07a`', '`#8a6d1f`', 'StatusBadge', '`GOLD_BUTTON`', '`text-brand-navy`']) {
      expect(calls, piece).toContain(piece)
    }
    expect(calls).toContain('K reviews these calls, with step 23\'s and step 24\'s, before `newLook` is turned on')
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    expect(block).not.toContain('__')
  })

  it('names every file the step adds, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'scripts/codemods/gold-ink.ts',
      'scripts/codemods/semantic-colours.gold.map.json',
      'test/unit/goldText.test.ts',
      'test/unit/fixtures/goldAllowlist.ts',
      'test/unit/gold-ink.test.ts',
      'test/unit/news-pinned.test.tsx',
      'test/unit/news-pinned-off.test.tsx',
      'test/unit/redesign-status-step25.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
  })

  it('describes the gold map with the counts it has, and the run with the counts it gave', () => {
    const map = loadMap(GOLD_MAP)
    const word = (n: number) => WORDS[n] ?? String(n)
    expect(block).toContain(`The map watches ${word(map.watch.length)} classes and has ${word(map.rules.length)} rules, no site and no keep entry`)
    expect(map.sites).toEqual([])
    expect(map.keep).toEqual([])
    expect(block).toContain('The run rewrote 34 classes in 20 files')
    expect(block).toContain('82 became `text-gold-ink` in 32 files')
    expect(block).toContain('51 are kept on navy or a dark ground, in 20 files')
  })

  it('says nothing relies on colour alone, and names what is left', () => {
    const icons = bullet('- **Meaningful icons.**', HEADING)
    expect(icons).toContain('Nothing relies on colour alone')
    expect(icons).toContain('"State champions"')
    expect(icons).toContain('lucide-react 1.25.0')
    expect(icons).toContain('Nothing was added')
  })

  it('names WS02\'s entries and their files in the guard', () => {
    const guard = bullet('- **The guard.**', HEADING)
    for (const w of WS02_GOLD) expect(guard, w.file).toContain(`\`${w.file.split('/').pop()}\``)
    expect(guard).toContain('`HERITAGE_ROUTES`')
  })

  it('names the badge and pill tokens, their allowlist with its count, the on prop and an icon\'s paint in the guard and the AC2 row', () => {
    const guard = bullet('- **The guard.**', HEADING)
    const entries = GOLD_BADGE_ALLOWLIST.reduce((n, e) => n + e.count, 0)
    expect(entries).toBe(12)
    for (const piece of ['`text-gold-ink-badge`', '`text-gold-on-dark-badge`', '`GOLD_BADGE_ALLOWLIST`', '`FilterDropdown`', '`MultiSelectDropdown`', '`StatusBadge`', '`color`', '`fill`', '`stroke`']) {
      expect(guard, piece).toContain(piece)
    }
    expect(guard).toContain(`The ${entries} uses it cannot place are entries of \`GOLD_BADGE_ALLOWLIST\``)
    expect(row).toContain(`with the ${entries} uses it cannot place in \`GOLD_BADGE_ALLOWLIST\``)
  })
})

describe('REDESIGN_STATUS.md, step 25: decisions, deviations, verify items and follow-ups', () => {
  it('records the gold text and ground-aware move decisions', () => {
    expect(decisions).toHaveLength(2)
    const text = decisions.join('\n')
    for (const piece of ['`text-lca-gold`', '`text-gold-ink`', '`text-gold-ink-badge`', '`text-gold-on-dark-badge`', '`clubTextColor`', 'test/unit/goldText.test.ts', 'test/unit/fixtures/goldAllowlist.ts', 'scripts/codemods/gold-ink.ts', 'scripts/codemods/semantic-colours.ts']) {
      expect(text, piece).toContain(piece)
    }
  })

  it('lists the step 25 deviations from the plan', () => {
    for (const piece of ['34 uses in 20 files', '`#8a6d1f`', '`--gold-ink-badge`', '`--gold-ink-badge-club`', '`--gold-on-dark-badge`', 'reminder bell', '`clubTextColor`', '`GOLD_BUTTON`', 'WS02', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('resolves each verify item the step was given, and the ones it found', () => {
    for (const name of [
      'About 135 uses of `text-lca-gold`',
      'Meaningful gold icons',
      'Other gold-ish text',
      'Tokens for the gold hex colours',
      'Club colours as words',
      'The guard\'s subjects',
      'Gold that is not text',
      'The State champions link',
      '`GOLD_BUTTON`',
      'StatusBadge',
      'The maps and the ratchet',
      'Lint, build and the browser runs',
    ]) expect(verify, name).toContain(`- **${name} (step 25).**`)
  })

  it('closes the follow-ups it meets under their old names, and lists what it leaves', () => {
    for (const name of [
      'Dark mode on pages not converted yet (step 21)',
      '`GOLD_BUTTON` keeps `text-lca-navy` (step 23)',
      'Gold hex text is step 25\'s, every use of it (step 24)',
    ]) {
      const entry = line(`- **${name}.**`)
      expect(entry, name).toContain('Done in step 25')
      expect(followUps, name).toContain(entry)
    }
    for (const name of [
      'K reviews the step 25 judgement calls',
      'Gold that is not text',
      'The club page\'s Upcoming badge in today\'s look',
      'The pin in the admin list of posts',
      'A club\'s own colour as words',
      'WS02\'s gold',
      'What the gold guard\'s reading leaves out',
    ]) expect(followUps, name).toContain(`- **${name} (step 25).**`)
    expect(followUps).toContain('- **The State champions link (step 25; older than the step).**')
  })

  it('removes none: the 116 follow-ups step 24 left are all still counted, beside the 8 step 25 adds, and the three it closes keep their names', () => {
    const entries = followUps.split('\n').filter((l) => l.startsWith('- **')).map((l) => l.slice(4, l.indexOf('**', 4)))
    const ofStep = (n: number) => entries.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = entries.filter((h) => /\(step (?:2[5-9]|3\d)[;)]/.test(h))
    expect(ofStep(25)).toHaveLength(8)
    expect(entries.length - later.length).toBe(116)
    expect(new Set(entries).size).toBe(entries.length)
    // The three it closes keep their names, and say so in their text.
    for (const name of ['Dark mode on pages not converted yet (step 21).', '`GOLD_BUTTON` keeps `text-lca-navy` (step 23).', 'Gold hex text is step 25\'s, every use of it (step 24).']) {
      expect(entries, name).toContain(name)
    }
    expect(followUps.split('\n').filter((l) => l.startsWith('- **') && l.includes('Done in step 25'))).toHaveLength(3)
  })
})

describe('REDESIGN_STATUS.md, step 25: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    for (const text of [block, row, ...decisions, ...tagged, deviation]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toContain('—')
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 25 ')
  const sentence = at < 0 ? '' : ws01.slice(at, ws01.indexOf('. ', at) < 0 ? undefined : ws01.indexOf('. ', at) + 1)

  it('has the step 25 sentence after step 24\'s', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 24 '))
    expect(sentence.length).toBeGreaterThan(200)
  })

  it('names the script, the map, the tokens, the pin and the bell, the club colour, the gold button and the guard', () => {
    for (const piece of ['scripts/codemods/gold-ink.ts', 'scripts/codemods/semantic-colours.gold.map.json', '`--gold-ink-badge`', '`--gold-on-dark-badge`', 'reminder bell', '`clubTextColor`', '`GOLD_BUTTON`', 'test/unit/goldText.test.ts', 'WS02']) {
      expect(sentence, piece).toContain(piece)
    }
    expect(sentence).not.toContain('—')
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
