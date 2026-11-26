// test/unit/ws09-map-names-real-tests.test.ts
//
// The WS09 criteria map in REDESIGN_STATUS.md names, for each of the 16
// acceptance criteria and for D17, D24, D26 and D29, the tests that hold it.
// A map is only as good as its names, so this file reads the map and checks
// each named test file against the tree: it exists, and the item names at
// least one test, or says in its own words that a follow-up or a later step
// owns what no test holds yet. It counts no file of the whole tree.
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
/** The words by which an item says that no test holds a part yet. */
const OWED = /follow-up|Follow-ups|Planned: WS09 step|waits for|Waits for|step 36|not built|is not built|is not drawn/i

describe('the WS09 map names real tests', () => {
  it('has an item for each of the 16 criteria and for D17, D24, D26 and D29, once each', () => {
    expect(items.map(idOf).filter((id) => WANTED.includes(id)).sort()).toEqual([...WANTED].sort())
  })

  it.each(WANTED)('%s: every test file it names is in the tree, and it names one or says what is owed', (id) => {
    const item = items.find((l) => idOf(l) === id) ?? ''
    expect(item, `${id} has no item`).not.toBe('')
    const paths = namedPaths(item)
    for (const path of paths) expect(existsSync(join(ROOT, path)), `${id} names ${path}, which is not in the tree`).toBe(true)
    expect(paths.length > 0 || OWED.test(item), `${id} names no test and says nothing is owed`).toBe(true)
  })

  it('names no test from the dependencies or the plan folder', () => {
    for (const item of items) {
      for (const path of namedPaths(item)) expect(path.startsWith('node_modules/') || path.startsWith('docs/'), `${idOf(item)} names ${path}`).toBe(false)
    }
  })

  it('names, for the criteria this step closes, the specs and unit tests it added', () => {
    const item = (id: string) => items.find((l) => idOf(l) === id) ?? ''
    expect(namedPaths(item('Criterion 15'))).toContain('test/a11y/clubs-matrix.spec.ts')
    expect(namedPaths(item('Criterion 15'))).toContain('test/a11y/clubs-reflow.spec.ts')
    expect(namedPaths(item('Criterion 1'))).toContain('test/unit/club-pages-no-dates-more.test.tsx')
    expect(namedPaths(item('Criterion 1'))).toContain('test/unit/club-pages-no-dates.test.tsx')
  })
})
