// How the shared-rules move is wired: the worker redeploys when domain/
// changes, the worker's type check covers domain/, the text-comparison test
// is gone, and the status file records the step.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('worker deploy', () => {
  const workflow = read('.github/workflows/deploy-worker.yml')
  const pathsBlock = /on:[\s\S]*?paths:\n((?:\s+-\s+'[^']+'\n)+)/.exec(workflow)?.[1] ?? ''
  const paths = [...pathsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1])

  it('runs when domain/ changes, as well as workers/ and functions/utils/', () => {
    expect(paths).toContain('domain/**')
    expect(paths).toContain('workers/**')
    expect(paths).toContain('functions/utils/**')
  })

  it('still runs on a manual dispatch', () => {
    expect(workflow).toMatch(/workflow_dispatch:/)
  })

  it('the worker reaches domain/ through functions/utils/time and type-checks it', () => {
    expect(read('workers/daily-emails/src/index.ts')).toContain("from '../../../functions/utils/time'")
    expect(read('functions/utils/time.ts').trim()).toBe("export * from '../../domain/format/centralTime'")
    expect(JSON.parse(read('workers/daily-emails/tsconfig.json')).include).toContain('../../domain')
  })
})

describe('the text-comparison test is gone', () => {
  it('mirrors.test.ts is removed and domain-shims.test.ts exists', () => {
    expect(existsSync(join(ROOT, 'test/unit/mirrors.test.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'test/unit/domain-shims.test.ts'))).toBe(true)
  })
})

describe('REDESIGN_STATUS.md', () => {
  const status = read('REDESIGN_STATUS.md')
  const step = /### Step 4[^\n]*\n([\s\S]*?)\n### /.exec(status)?.[1] ?? ''

  it('has a step 4 section that names the moved files and the proof', () => {
    expect(step.length).toBeGreaterThan(0)
    for (const needle of [
      'domain/events/sectionRules.ts', 'domain/format/centralTime.ts', 'domain/registration/pricing.ts',
      'domain/clubs/regions.ts', 'domain/households/family.ts', 'domain/membership/tiers.ts',
      'domain/households/publicName.ts', 'deploy-worker.yml', 'wrangler',
    ]) expect(step, needle).toContain(needle)
  })

  it('has a K1b row', () => {
    expect(status).toMatch(/K1b/)
  })

  it('records the MembershipPage change as a deviation', () => {
    expect(status).toMatch(/MembershipPage/)
  })
})
