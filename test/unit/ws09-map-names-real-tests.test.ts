// test/unit/ws09-map-names-real-tests.test.ts
//
// The WS09 criteria map in REDESIGN_STATUS.md names, for each of the 16
// acceptance criteria and for D17, D24, D26 and D29, the tests that hold it.
// A map is only as good as its names, so this file reads the map and checks
// each named test file against the tree: it exists, and the item names at
// least one test, or names by its title a follow-up of the section's own list
// that owns what no test holds yet. It counts no file of the whole tree.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

const start = status.indexOf('\n### WS09 map: what proves each acceptance criterion and decision\n')
const end = status.indexOf('\n### ', start + 5)
const map = start < 0 ? '' : status.slice(start, end)
const items = map.split('\n').filter((l) => l.startsWith('- **'))
const idOf = (item: string) => item.slice(4, item.indexOf('.**'))

const WANTED = [...Array.from({ length: 16 }, (_, i) => `Criterion ${i + 1}`), 'D17', 'D24', 'D26', 'D29']
const TEST_PATH = /`((?:test|src|functions|domain)\/[A-Za-z0-9_./\-[\]]+\.(?:test|spec)\.tsx?)`/g
const namedPaths = (item: string) => [...item.matchAll(TEST_PATH)].map((m) => m[1])
/**
 * What an item may name as owed where it names no test: a follow-up of the section's own list, by its title as
 * "### WS09 follow-ups" gives it, without its tag. Words alone, such as the planned step every item ends with, do not
 * count (WS09 checkpoint Z's review).
 */
const followStart = status.indexOf('\n### WS09 follow-ups\n')
const followEnd = status.indexOf('\n## WS10:', followStart)
const FOLLOW_UPS = (followStart < 0 ? '' : status.slice(followStart, followEnd < 0 ? undefined : followEnd))
  .split('\n')
  .filter((l) => l.startsWith('- **'))
  .map((l) => l.slice(4, l.indexOf('**', 4)).replace(/ \([^)]*\)\.$/, '').replace(/\.$/, ''))
const namesFollowUp = (item: string) => FOLLOW_UPS.some((title) => item.toLowerCase().includes(title.toLowerCase()))
/** Whether an item names a test, or a follow-up that owns what no test holds yet. */
const namesOneOrOwed = (item: string) => namedPaths(item).length > 0 || namesFollowUp(item)
/** Every test file an item names in the dependencies or the plan folder, read from the item's own text. */
const OUTSIDE = /`((?:node_modules|docs)\/[^`\s]*\.(?:test|spec)\.tsx?)`/g
const namedOutside = (item: string) => [...item.matchAll(OUTSIDE)].map((m) => m[1])

describe('the WS09 map names real tests', () => {
  it('has an item for each of the 16 criteria and for D17, D24, D26 and D29, once each', () => {
    expect(items.map(idOf).filter((id) => WANTED.includes(id)).sort()).toEqual([...WANTED].sort())
  })

  it.each(WANTED)('%s: every test file it names is in the tree, and it names one or says what is owed', (id) => {
    const item = items.find((l) => idOf(l) === id) ?? ''
    expect(item, `${id} has no item`).not.toBe('')
    const paths = namedPaths(item)
    for (const path of paths) expect(existsSync(join(ROOT, path)), `${id} names ${path}, which is not in the tree`).toBe(true)
    expect(namesOneOrOwed(item), `${id} names no test and no follow-up`).toBe(true)
    // A made-up item that names no test and no follow-up fails the same check, though it ends with its planned step.
    expect(namesOneOrOwed('- **Criterion 99.** Nothing holds this yet. Planned: WS09 step 38.')).toBe(false)
    expect(FOLLOW_UPS.length).toBeGreaterThan(0)
    expect(namesOneOrOwed(`- **Criterion 99.** Owed to ${FOLLOW_UPS[0]}. Planned: WS09 step 38.`)).toBe(true)
  })

  it('names no test from the dependencies or the plan folder', () => {
    for (const item of items) expect(namedOutside(item), idOf(item)).toEqual([])
    // A made-up item that names such a file is found.
    expect(namedOutside('- **Criterion 99.** Held by `docs/redesign/old.test.ts` and `node_modules/x/y.spec.ts`. Planned: WS09 step 38.')).toEqual(['docs/redesign/old.test.ts', 'node_modules/x/y.spec.ts'])
  })

  it('names, for the criteria this step closes, the specs and unit tests it added', () => {
    const item = (id: string) => items.find((l) => idOf(l) === id) ?? ''
    expect(namedPaths(item('Criterion 15'))).toContain('test/a11y/clubs-matrix.spec.ts')
    expect(namedPaths(item('Criterion 15'))).toContain('test/a11y/clubs-reflow.spec.ts')
    expect(namedPaths(item('Criterion 1'))).toContain('test/unit/club-pages-no-dates-more.test.tsx')
    expect(namedPaths(item('Criterion 1'))).toContain('test/unit/club-pages-no-dates.test.tsx')
  })
})
