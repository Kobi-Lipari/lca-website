// test/unit/redesign-status-step21.test.ts
//
// REDESIGN_STATUS.md records step 21 (the design tokens, dark mode, focus
// ring and motion behind newLook) and REDESIGN_SPEC.md's WS01 deviation list
// carries its sentence (WS01 acceptance criterion 9 of the step). The living
// parts are pinned: the AC3 row names the proof, the step block sits in order,
// each verify item is resolved, and the plain-language rules hold for the
// parts written for readers (no em dash, none of the working words, no
// mention of an assistant).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
const ASSISTANT = /\b(claude|anthropic|AI-generated|generated with|co-authored)\b/i

const line = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(start)) ?? ''
const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}

const STEP_HEADING = '### Step 21: tokens, dark mode, focus ring and motion'
const block = between(status, STEP_HEADING, '### Decisions')
const row = line(status, '| AC3 |')
/** The Decisions bullets that name step 21. */
const decisions = between(status, '### Decisions', '\n### ')
  .split('\n')
  .filter((l) => l.startsWith('- ') && l.includes('(step 21)'))
/** The acceptance table, which the working words stay out of. */
const table = status.split('\n').filter((l) => l.startsWith('| '))

describe('REDESIGN_STATUS.md, step 21', () => {
  it('has the step block after step 20 and before the Decisions', () => {
    const at = status.indexOf(STEP_HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 20:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(status.slice(0, 400)).toContain('step 21')
  })

  it('fills the AC3 row for step 21 with the two proofs: the contrast test and the browser test', () => {
    expect(row).toMatch(/^\| AC3 \| Focus ring reaches 3:1 in every look \| 21 \|/)
    expect(row).not.toContain('Planned')
    for (const piece of ['test/unit/contrast.test.ts', 'test/a11y/tokens.spec.ts', 'base', 'dark', 'live', 'scholastic', 'heritage']) {
      expect(row, piece).toContain(piece)
    }
  })

  it('records the token, Appearance and focus decisions', () => {
    expect(decisions.length).toBeGreaterThanOrEqual(2)
    const text = decisions.join('\n')
    expect(text).toMatch(/semantic token utilities/)
    expect(text).toContain(':root[data-look="new"]')
    expect(text).toMatch(/System, Light and Dark/)
    expect(text).toMatch(/only when the build has `newLook` on/)
  })

  it('resolves each verify item the step was given', () => {
    for (const name of ['Current token state', 'Button focus', 'Mono font', 'theme-color metas', 'Utilities need the token at `:root`']) {
      expect(status, name).toContain(`- **${name} (step 21).**`)
    }
  })

  it('lists the step 21 deviations and follow-ups', () => {
    expect(status).toContain('- **Step 21.**')
    expect(status).toContain('The Badge keeps')
    for (const name of ['Dark mode on pages not converted yet', 'The browser bar colour when the choice differs from the device', 'Dark, live and heritage under axe']) {
      expect(status, name).toContain(`- **${name} (step 21).**`)
    }
  })

  it('keeps the working words out of the block, the AC3 row and the decisions', () => {
    expect(block).not.toBe('')
    for (const text of [block, row, ...decisions]) expect(text).not.toMatch(BANNED)
  })

  it('uses no em dash in the block, the table, the decisions or the verify items', () => {
    const verify = status.split('\n').filter((l) => l.includes('(step 21)'))
    for (const text of [block, ...table, ...decisions, ...verify]) expect(text).not.toContain('—')
  })

  it('does not mention an assistant', () => {
    for (const text of [block, row, ...decisions]) expect(text).not.toMatch(ASSISTANT)
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = line(spec, '- WS01:')
  const at = ws01.indexOf('Step 21 ')
  const next = ws01.indexOf('. ', at)
  const sentence = at < 0 ? '' : next < 0 ? ws01.slice(at) : ws01.slice(at, next + 1)

  it('has the step 21 sentence', () => {
    expect(at).toBeGreaterThan(-1)
    expect(sentence).not.toBe('')
  })

  it('names the Badge ring, the tile values, the gold ring in navy bands and the build reading newLook', () => {
    for (const piece of ['Badge', '`ring-ring`', '#705718', '#b23e1a', '#2563c9', '`--field`', 'gold inside a navy band', 'vite.config.ts', 'src/lib/features.ts']) {
      expect(sentence, piece).toContain(piece)
    }
  })

  it('keeps to the plain-language rules', () => {
    expect(sentence).not.toContain('—')
    expect(sentence).not.toMatch(ASSISTANT)
  })
})
