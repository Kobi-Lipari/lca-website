// test/unit/creation-switch.test.ts
//
// standingDirectors, the switch for the first part of tournament creation,
// has a server half, since the functions cannot read src/lib/features.ts
// (brief 0.2): CREATION_ROLES_ON in functions/utils/events/creation.ts. The
// two are turned on in the same change, so they are held equal here in the
// four ways test/unit/public-answer-switches.test.ts holds the trim's pairs:
// as the modules export them; as each file writes its value, once, the way
// vite.config.ts's switchInBuild reads src/lib/features.ts; by the comment
// above the constant, which says what it turns on and names the switch and
// this file; and by the constant's file reading no setting of its
// environment, so nothing outside the code can turn it on.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'
import { CREATION_ROLES_ON } from '../../functions/utils/events/creation'

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

const PAIR = { feature: 'standingDirectors', constant: 'CREATION_ROLES_ON', file: 'functions/utils/events/creation.ts', value: CREATION_ROLES_ON } as const

describe('CREATION_ROLES_ON follows standingDirectors', () => {
  it('CREATION_ROLES_ON equals FEATURES.standingDirectors', () => {
    expect(typeof PAIR.value).toBe('boolean')
    expect(PAIR.value).toBe(FEATURES[PAIR.feature])
  })

  it('functions/utils/events/creation.ts writes CREATION_ROLES_ON as src/lib/features.ts writes standingDirectors', () => {
    expect(constantWritten(PAIR.file, PAIR.constant)).toBe(switchWritten(PAIR.feature))
  })

  it('CREATION_ROLES_ON says what it turns on and names its switch and this file', () => {
    const text = read(PAIR.file)
    const at = text.indexOf(`export const ${PAIR.constant} =`)
    expect(at).toBeGreaterThan(0)
    const comment = text.slice(text.lastIndexOf('/**', at), at)
    expect(comment).toMatch(/^\/\*\*\n \* Set: /)
    expect(comment).toContain(PAIR.feature)
    expect(comment).toContain('test/unit/creation-switch.test.ts')
  })

  it('reads no setting of the environment: a constant in the code alone', () => {
    expect(read(PAIR.file)).not.toMatch(/\benv\b|process\.|import\.meta/)
  })
})
