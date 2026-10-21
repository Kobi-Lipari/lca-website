// test/unit/redesign-status-step24.test.ts
//
// REDESIGN_STATUS.md records step 24 (the status colours, greys and raw hex
// colours on the tokens) and REDESIGN_SPEC.md's WS01 deviation list carries
// its sentence (the step's acceptance criterion 5). The living parts are
// pinned: the T2 row names the proofs, the step block's counts are the
// status map's and the allowlist's, the judgement calls, decisions,
// deviations, verify items and follow-ups are there, the step 23 follow-ups
// this step closes say so under their old names, and the plain-language
// rules hold (no em dash, none of the working words, no mention of an
// assistant, US Chess rather than its old initials).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STATUS_MAP, loadMap, planRewrite } from '../../scripts/codemods/semantic-colours'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')
const allowlist = (JSON.parse(readFileSync(join(ROOT, 'test/unit/fixtures/raw-colours-allowlist.json'), 'utf8')) as {
  entries: Array<{ file: string; class: string; count: number; reason: string }>
}).entries

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

const HEADING = '### Step 24: status colours, greys and raw hex on the tokens'
const block = between(HEADING, '### Decisions')
const row = line('| T2 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 24)'))
const tagged = lines.filter((l) => l.includes('(step 24)'))
const deviation = bullet('- **Step 24.**')
const followUps = between('### Follow-ups', '\n## WS02')

const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

describe('REDESIGN_STATUS.md, step 24: the acceptance row', () => {
  it('has a T2 row for step 24 right after T1, and the table says what T2 is', () => {
    expect(row).toMatch(/^\| T2 \| The existing pages follow dark mode: status colours, greys, navy lines and tints, and raw hex colours \| 24 \|/)
    expect(row).not.toContain('Planned')
    const table = lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Item'))
    expect(table.indexOf(row)).toBe(table.indexOf(line('| T1 |')) + 1)
    expect(status).toMatch(/T2 is its second half\./)
  })

  it('names the proofs: the script and its second map, the ratchet and its allowlist, identity, tokens, contrast, the baseline and the browser runs', () => {
    for (const piece of [
      'scripts/codemods/semantic-colours.ts',
      'scripts/codemods/semantic-colours.status.map.json',
      'test/unit/raw-colours.test.ts',
      'test/unit/fixtures/raw-colours-allowlist.json',
      'test/unit/semantic-map.test.ts',
      'test/unit/tokens.test.ts',
      'test/unit/contrast.test.ts',
      'test/a11y/baseline.json',
      'test/a11y/print-look.spec.ts',
      'test/a11y/dark-spot.spec.ts',
    ]) expect(row, piece).toContain(piece)
  })

  it('states the counts the map, the tree and the allowlist hold', () => {
    const plan = planRewrite(ROOT, loadMap(STATUS_MAP), 'check')
    expect(plan.edits).toEqual([])
    // The palette classes kept: every kept class but the one navy tint on the gold banner.
    const palette = plan.kept.filter((k) => !k.token.includes('brand-navy')).length
    expect(row).toContain(`the ${palette} kept in 5`)
    // The row records the allowlist as step 24 left it. Step 25 took out its
    // 23 gold text entries (34 uses: hex colours, every one), and step 26 the
    // 8 entries of StatusBadge's light tones and StatusDot's dot (8 uses),
    // which the status map now keeps each in its one string, so the numbers
    // are pinned here, and today's allowlist plus those gives them back.
    const STEP_24 = { uses: 91, files: 33, hex: 44, veils: 34 }
    const GOLD_RETIRED = 34
    const STATUS_BADGE_KEPT = 8
    const uses = allowlist.reduce((n, e) => n + e.count, 0)
    const hex = allowlist.filter((e) => /\[#/.test(e.class)).reduce((n, e) => n + e.count, 0)
    const veils = allowlist.filter((e) => /(^|:)bg-white\//.test(e.class)).reduce((n, e) => n + e.count, 0)
    expect([uses + GOLD_RETIRED + STATUS_BADGE_KEPT, hex + GOLD_RETIRED, veils]).toEqual([STEP_24.uses, STEP_24.hex, STEP_24.veils])
    expect(allowlist.filter((e) => e.file === 'src/components/StatusBadge.tsx').map((e) => e.class)).toEqual(['bg-white/10'])
    expect(row).toContain(`\`test/unit/fixtures/raw-colours-allowlist.json\` counts ${STEP_24.uses} uses in ${STEP_24.files} files`)
    // Its parts: the hex colours, the white veils and the classes the status map keeps for a whole file.
    expect(row).toContain(`hex colours from 51 in 30 files to ${STEP_24.hex} in`)
    expect(row).toContain(`the ${STEP_24.hex} hex colours, the ${STEP_24.veils} translucent white veils on navy that step 23's map keeps in every file, and the ${STEP_24.uses - STEP_24.hex - STEP_24.veils} classes the status map keeps for a whole file`)
  })
})

describe('REDESIGN_STATUS.md, step 24: the step block', () => {
  it('sits after step 23 and before the Decisions, and the date line names it, after any later step', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 23:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step 2[5-9]: [^;]+; )*step 24: /)
  })

  it('describes the status map with the counts it has, and the run with the counts it gave', () => {
    const map = loadMap(STATUS_MAP)
    const word = (n: number) => WORDS[n] ?? String(n)
    expect(block).toContain(`watches ${map.watch.length} classes and has ${map.rules.length} rules, ${word(map.sites.length)} sites and ${word(map.keep.length)} keep entries`)
    const kept = planRewrite(ROOT, map, 'check').kept.length
    expect(block).toContain(`The run rewrote 339 classes in 49 files and kept ${kept}`)
  })

  it('records the files, the script, the tokens, the fallback block, printing, the judgement calls, the lint, the build and the dark run', () => {
    for (const part of ['**Files.**', '**The script and the map.**', '**Tokens.**', '**Browsers that cannot mix colours.**', '**Printing.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The dark spot run.**']) {
      expect(block, part).toContain(part)
    }
    const calls = bullet('- **Judgement calls.**', HEADING)
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const piece of ['`text-bad`', '`text-ok`', 'Categories', 'scanner', 'check-in toggle', 'light tones on navy', 'StatusBadge', 'light islands', '`text-quiet-600`', '`border-gray-300`', 'slate', 'allowlist', '`#1668d8`']) {
      expect(calls, piece).toContain(piece)
    }
    expect(calls).toContain('K reviews these calls, with step 23\'s, before `newLook` is turned on')
    expect(block).toMatch(/16 errors and 13 warnings before, 13 errors and 13 warnings after/)
    expect(block).not.toContain('@@')
  })

  it('names every file the step adds, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'scripts/codemods/semantic-colours.status.map.json',
      'src/areas/events/gradeConfirm.ts',
      'test/unit/raw-colours.test.ts',
      'test/unit/fixtures/raw-colours-allowlist.json',
      'test/unit/dark-spot-later.test.ts',
      'test/unit/grade-confirm.test.tsx',
      'test/unit/redesign-status-step24.test.ts',
      'test/unit/helpers/tones.ts',
      'test/unit/helpers/tailwindRules.ts',
      'test/a11y/print-look.spec.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
  })
})

describe('REDESIGN_STATUS.md, step 24: decisions, deviations, verify items and follow-ups', () => {
  it('records the status colour, printing, fallback block and light island decisions', () => {
    expect(decisions).toHaveLength(4)
    const text = decisions.join('\n')
    for (const piece of ['`text-ok`', '`text-bad`', '`text-status-open`', 'test/unit/raw-colours.test.ts', '`@media screen`', '`@supports not (color: color-mix(in lab, red, red))`', '`:root[data-look="new"]`', '`text-muted-on-light`', '`bg-veil-on-light/30`']) {
      expect(text, piece).toContain(piece)
    }
  })

  it('says a keep entry allows a raw class in the ratchet only where it names its one string, and that the allowlist counts the rest', () => {
    const status = decisions.find((d) => d.startsWith('- **Status colours (step 24).**')) ?? ''
    expect(status).toContain('a keep entry with its reason in one of the two maps that names its one string')
    expect(status).toContain('allows nothing in the ratchet')
    expect(deviation).toContain('keep entries of both maps that name their one string')
    expect(between('### Verify items resolved', '### Follow-ups')).toContain('the ratchet reads the keep entries of both maps that name their one string')
    // And the light island the review found, in the judgement calls, the deviations and a follow-up for today's look.
    expect(bullet('- **Judgement calls.**', HEADING)).toContain('`text-muted-on-light`')
    expect(deviation).toContain('`--muted-on-light`')
    expect(followUps).toContain('- **The club map\'s loading note in today\'s look (step 24).**')
  })

  it('lists the step 24 deviations from the plan', () => {
    for (const piece of ['`--ink-muted`', '`--hairline`', 'Amber', '`text-[#7a5c00]`', '`text-[#f0d07a]`', 'step 25', 'ratchet', 'hex class', '`@media screen`', 'src/areas/events/gradeConfirm.ts', 'StatusBadge']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('resolves each verify item the step was given, and the ones it found', () => {
    for (const name of [
      'Legitimate raw colours',
      'Raw hex counts and the gold exception',
      'Status classes with a token of the same colour',
      'Status words on their own tint',
      'Greys and slates',
      'Families the plan does not name',
      'Light tones on navy',
      'StatusBadge',
      'Light islands',
      'Navy tints and lines',
      'Quoted strings in comment prose',
      'The map\'s grammar',
      'The ratchet and its allowlist',
      'Contrast',
      'The dark spot run',
      'Lint in touched files',
      'Tokens and records',
      'Build size',
      'Packages',
      'Printing',
    ]) expect(between('### Verify items resolved', '### Follow-ups'), name).toContain(`- **${name} (step 24).**`)
  })

  it('closes the step 23 follow-ups it meets under their old names, and lists what it leaves', () => {
    for (const name of ['Navy borders and rings', 'Navy tints in dark mode', 'Light islands that stay light in dark mode', 'Quoted strings in comment prose']) {
      const entry = line(`- **${name} (step 23).**`)
      expect(entry, name).toContain('Done in step 24')
      expect(followUps, name).toContain(entry)
    }
    for (const name of [
      'K reviews the step 24 judgement calls',
      'Gold hex text is step 25\'s, every use of it',
      'StatusBadge\'s tones',
      'Heritage on a muted panel',
      'The check-in toggle with `newLook` off',
      'What printing leaves',
      'Categories drawn in a tone\'s colour',
    ]) expect(followUps, name).toContain(`- **${name} (step 24).**`)
  })

  it('gives step 25 every gold hex text use the allowlist left it, with its count', () => {
    // The 23 entries that named step 25 left the allowlist in step 25, which
    // moved their 34 uses in 20 files to the gold tokens; the line keeps its count.
    expect(allowlist.filter((e) => /step 25/.test(e.reason))).toEqual([])
    expect(line('- **Gold hex text is step 25\'s, every use of it (step 24).**')).toContain('34 gold text classes in 20 files')
  })
})

describe('REDESIGN_STATUS.md, step 24: plain language', () => {
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
  const at = ws01.indexOf('Step 24 ')
  const sentence = at < 0 ? '' : ws01.slice(at, ws01.indexOf('. ', at) < 0 ? undefined : ws01.indexOf('. ', at) + 1)

  it('has the step 24 sentence after step 23\'s', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 23 '))
    expect(sentence.length).toBeGreaterThan(200)
  })

  it('names the second map, the shade tokens, what is kept, the ratchet, the fallback block and printing', () => {
    for (const piece of ['scripts/codemods/semantic-colours.status.map.json', '`--ink-muted`', 'step 25', 'step 26', 'test/unit/raw-colours.test.ts', 'names in its one string', 'cannot mix colours', '`@media screen`', '`GradeConfirm.tsx`', 'club map']) {
      expect(sentence, piece).toContain(piece)
    }
    expect(sentence).not.toContain('—')
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
