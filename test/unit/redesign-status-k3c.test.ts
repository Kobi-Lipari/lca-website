// test/unit/redesign-status-k3c.test.ts
//
// REDESIGN_STATUS.md records step 18 (K3c, the API client split by area) and
// REDESIGN_SPEC.md's WS01 deviation list carries its sentence. Only the
// living parts are pinned: the row, the placement decision and the sentence
// name what the code does, and the plain-language rules for those parts hold
// (no em dash, none of the working words the acceptance table and Decisions
// are written without).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')
const map = JSON.parse(readFileSync(join(ROOT, 'scripts/moves/api-split.json'), 'utf8')) as Record<string, string>

const line = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(start)) ?? ''
/** The decision bullet and its indented sub-bullets. */
function decision(): string {
  const lines = status.split('\n')
  const at = lines.findIndex((l) => l.startsWith('- **API client by area (step 18).**'))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}
const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i

describe('REDESIGN_STATUS.md, step 18', () => {
  const row = line(status, '| K3c |')
  const rule = decision()

  it('has the K3c row for step 18, saying what is done and with what', () => {
    expect(row).toMatch(/^\| K3c \| API client split by area \| 18 \|/)
    expect(row).not.toContain('Planned')
    for (const piece of ['scripts/moves/api-split.json', 'scripts/split-api.ts', 'src/lib/http.ts', 'api-exports.test.ts', 'route-audit.test.ts', 'api-exports.json', 'api-fetch-paths.json', 'check:bundle']) {
      expect(row, piece).toContain(piece)
    }
  })

  it('states the name count the committed map has', () => {
    expect(row).toContain(`(${Object.keys(map).length} names)`)
  })

  it('has the step 18 block, and its heading is in the order of the other steps', () => {
    const at = status.indexOf('### Step 18: API client split by area')
    expect(at).toBeGreaterThan(status.indexOf('### Step 17:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(status.slice(0, 400)).toContain('step 18')
  })

  it('records the placement decision with every area, the scan choice and the barrels', () => {
    expect(rule).not.toBe('')
    for (const area of ['events', 'registration', 'households', 'live', 'membership', 'clubs', 'admin', 'governance']) {
      expect(rule, area).toContain(`\`${area}\`:`)
    }
    expect(rule).toMatch(/Scan and scoresheet calls go to `live`, because scanning records a game/)
    expect(rule).toMatch(/Each area's `index\.ts` stays as it was and does not re-export `api\.ts`/)
    expect(rule).toContain('`exportQuery`')
    expect(rule).toContain('`import type`')
    expect(rule).toContain('never from `@/lib/api`')
  })

  it('keeps the working words out of the row, the decision and the step block', () => {
    const start = status.indexOf('### Step 18: API client split by area')
    const block = status.slice(start, status.indexOf('### Decisions'))
    expect(row).not.toMatch(BANNED)
    expect(rule).not.toMatch(BANNED)
    expect(block).not.toMatch(BANNED)
  })

  it('uses no em dash in the row, the decision or the step block', () => {
    const start = status.indexOf('### Step 18: API client split by area')
    const block = status.slice(start, status.indexOf('### Decisions'))
    for (const text of [row, rule, block]) expect(text).not.toContain('—')
  })

  it('records the follow-ups the split leaves and does not mention an assistant', () => {
    expect(status).toContain('**Importers onto area paths (step 18).**')
    expect(status).toContain('**Section headers in the area modules (step 18).**')
    expect(status).toContain('**Three fetches the route audit cannot see (step 18; predates the step).**')
    const start = status.indexOf('### Step 18: API client split by area')
    const mine = [row, rule, status.slice(start, status.indexOf('### Decisions'))].join('\n')
    expect(mine).not.toMatch(/\b(claude|anthropic|AI-generated|generated with)\b/i)
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = line(spec, '- WS01:')

  it('has the step 18 sentence, naming the modules, the barrel and the map', () => {
    const at = ws01.indexOf('Step 18 ')
    expect(at).toBeGreaterThan(-1)
    const next = ws01.indexOf('. ', at)
    const sentence = next < 0 ? ws01.slice(at) : ws01.slice(at, next + 1)
    for (const piece of ['src/lib/api.ts', 'src/lib/http.ts', 'scripts/moves/api-split.json', 'barrel']) expect(sentence, piece).toContain(piece)
    expect(sentence).not.toContain('—')
  })

  it('keeps the list a single WS01 bullet', () => {
    expect(spec.split('\n').filter((l) => l.startsWith('- WS01:'))).toHaveLength(1)
  })
})
