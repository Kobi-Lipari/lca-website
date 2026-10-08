// test/unit/contracts-status.test.ts
// REDESIGN_STATUS.md records step 7 (K1d, the ratchet). Only the living parts
// are held to the code: the K1d row's pending count and the sum of contracted
// and pending methods. The dated step 7 notes are history and later slices
// that shrink the pending list or add handlers must not have to rewrite them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts'
import { PENDING_CONTRACTS, PENDING_COUNT } from './contracts-pending'
import { collectRouteFiles, exportedMethods } from './routes'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const functionsDir = join(ROOT, 'functions')

const apiMethods = collectRouteFiles(functionsDir)
  .filter((r) => r.segments[0] === 'api')
  .flatMap((r) => exportedMethods(readFileSync(r.file, 'utf8')).filter((m) => m !== 'OPTIONS'))
const contracted = Object.values(contracts).reduce((n, methods) => n + Object.keys(methods).length, 0)

describe('REDESIGN_STATUS.md, step 7', () => {
  const k1d = status.split('\n').find((l) => l.startsWith('| K1d')) ?? ''

  it('has a K1d row for step 7 that says partial: ratchet', () => {
    expect(k1d).toMatch(/^\| K1d \| .* \| 7 \| \*\*Partial: ratchet\.\*\*/)
  })

  it('states the pending count the file pins', () => {
    expect(k1d).toContain(`${PENDING_COUNT} lines, count pinned`)
    expect(PENDING_CONTRACTS.length).toBe(PENDING_COUNT)
  })

  it('accounts for every api method: contracted plus pending', () => {
    expect(contracted + PENDING_COUNT).toBe(apiMethods.length)
  })

  it('names each page route outside functions/api as excluded', () => {
    const pageFiles = collectRouteFiles(functionsDir)
      .filter((r) => r.segments[0] !== 'api' && r.segments[0] !== 'utils' && r.segments[0] !== 'db')
      .map((r) => r.file.slice(ROOT.length + 1).split('\\').join('/'))
      .filter((f) => exportedMethods(readFileSync(join(ROOT, f), 'utf8')).length > 0)
    expect(pageFiles.sort()).toEqual(['functions/clubs/[id].ts', 'functions/news/[slug].ts', 'functions/tournaments/[id].ts'])
    for (const f of pageFiles) expect(status, f).toContain(`\`${f}\``)
  })

  it('records the deviations and verify items it resolved', () => {
    expect(status).toContain('**Page routes (step 7).**')
    expect(status).toContain('**Client types (step 7).**')
    for (const item of ['Endpoint count and naming', 'Error response shape', 'Methods on the admin tournament endpoint']) {
      expect(status, item).toContain(`**${item} (step 7).**`)
    }
  })
})
