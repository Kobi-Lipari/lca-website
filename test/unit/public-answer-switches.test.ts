// test/unit/public-answer-switches.test.ts
//
// The two switches of the Phase 0 trim each have a server half, since the
// functions cannot read src/lib/features.ts (brief 0.2): clubEmailHidden
// with CLUB_EMAIL_HIDDEN in functions/utils/clubs/publicAnswer.ts, and
// rosterShortNames with ROSTER_SHORT_NAMES in
// functions/utils/events/publicAnswer.ts. Each pair is turned on in the same
// change, so the two halves are held equal here twice over: as the modules
// export them, and as each file writes its value, once, the way
// vite.config.ts's switchInBuild reads src/lib/features.ts, since the site's
// own build can override a switch only in the accessibility test build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'
import { CLUB_EMAIL_HIDDEN } from '../../functions/utils/clubs/publicAnswer'
import { ROSTER_SHORT_NAMES } from '../../functions/utils/events/publicAnswer'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The switch's value as src/lib/features.ts writes it: the one `name: true,` or `name: false,` line. */
function switchWritten(name: string): boolean {
  const found = [...read('src/lib/features.ts').matchAll(new RegExp(`^\\s*${name}:\\s*(true|false),`, 'gm'))]
  expect(found, `${name} is set once in src/lib/features.ts`).toHaveLength(1)
  return found[0][1] === 'true'
}

/** The constant's value as its file writes it: the one `export const NAME = true` or `= false` line. */
function constantWritten(path: string, name: string): boolean {
  const found = [...read(path).matchAll(new RegExp(`^export const ${name} = (true|false)$`, 'gm'))]
  expect(found, `${name} is set once in ${path}`).toHaveLength(1)
  return found[0][1] === 'true'
}

const PAIRS = [
  { feature: 'clubEmailHidden', constant: 'CLUB_EMAIL_HIDDEN', file: 'functions/utils/clubs/publicAnswer.ts', value: CLUB_EMAIL_HIDDEN },
  { feature: 'rosterShortNames', constant: 'ROSTER_SHORT_NAMES', file: 'functions/utils/events/publicAnswer.ts', value: ROSTER_SHORT_NAMES },
] as const

describe('the trim\'s server constants follow their switches', () => {
  it.each(PAIRS)('$constant equals FEATURES.$feature', ({ feature, value }) => {
    expect(typeof value).toBe('boolean')
    expect(value).toBe(FEATURES[feature])
  })

  it.each(PAIRS)('$file writes $constant as src/lib/features.ts writes $feature', ({ feature, constant, file }) => {
    expect(constantWritten(file, constant)).toBe(switchWritten(feature))
  })

  it.each(PAIRS)('$constant says what it turns on and names its switch', ({ feature, constant, file }) => {
    const text = read(file)
    const at = text.indexOf(`export const ${constant} =`)
    const comment = text.slice(text.lastIndexOf('/**', at), at)
    expect(comment).toMatch(/^\/\*\*\n \* Set: /)
    expect(comment).toContain(feature)
    expect(comment).toContain('test/unit/public-answer-switches.test.ts')
  })

  it('reads no setting of the environment for either: a constant in the code alone', () => {
    for (const { file } of PAIRS) expect(read(file)).not.toMatch(/\benv\b|process\.|import\.meta/)
  })
})
