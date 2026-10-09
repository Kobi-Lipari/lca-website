// The player registration readers and writers (slice 10): the contracts see
// the bodies src/lib/api.ts really sends, the three routes have left the
// pending list, and the three handlers no longer read tournaments.sections.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { createBatchRegistration, createRegistration, updateRegistration } from '../../src/lib/api'
import { PENDING_CONTRACTS } from './contracts-pending'

const ROOT = join(__dirname, '../..')

/** Runs an api.ts call with fetch stubbed, and returns what it sent. */
async function sentBy(call: () => Promise<unknown>): Promise<{ url: string; method: string | undefined; body: unknown }> {
  let seen: { url: string; method: string | undefined; body: unknown } | null = null
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    seen = { url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  await call()
  if (!seen) throw new Error('api.ts sent nothing')
  return seen
}

afterEach(() => vi.unstubAllGlobals())

describe('request contracts take the bodies api.ts sends', () => {
  const single = contracts['registrations'].POST.request
  const family = contracts['registrations/batch'].POST.request
  const edit = contracts['registrations/[id]'].PATCH.request

  it('createRegistration, with and without the optional parts', async () => {
    for (const call of [
      () => createRegistration('t-1', 'Open'),
      () => createRegistration('t-1', 'K-8', [1, 3], { gradeRange: '0-8' }),
      () => createRegistration('t-1', 'K-8', [], { gradeRange: null, waitlist: true }),
    ]) {
      const sent = await sentBy(call)
      expect(sent).toMatchObject({ url: '/api/registrations', method: 'POST' })
      expect(single.safeParse(sent.body).success, JSON.stringify(sent.body)).toBe(true)
    }
  })

  it('createBatchRegistration, for a parent and children', async () => {
    const sent = await sentBy(() => createBatchRegistration('t-1', [
      { section: 'Open', byeRounds: [] },
      { memberId: 'kid-1', section: 'K-5', byeRounds: [2], gradeRange: '0-5' },
      { memberId: 'kid-2', section: 'K-5', gradeRange: null },
    ]))
    expect(sent).toMatchObject({ url: '/api/registrations/batch', method: 'POST' })
    expect(family.safeParse(sent.body).success).toBe(true)
  })

  it('updateRegistration, one key at a time and together', async () => {
    for (const body of [
      { byeRounds: [] }, { byeRounds: [2, 4] }, { section: 'U1200' }, { paymentStatus: 'paid' as const },
      { paymentStatus: 'pending' as const }, { paymentStatus: 'refunded' as const }, { withdrawn: true },
      { withdrawn: false }, { checkedIn: true }, { section: 'Reserve', byeRounds: [1] },
    ]) {
      const sent = await sentBy(() => updateRegistration('reg-1', body))
      expect(sent).toMatchObject({ url: '/api/registrations/reg-1', method: 'PATCH' })
      expect(edit.safeParse(sent.body).success, JSON.stringify(body)).toBe(true)
    }
  })

  it('refuse a body of the wrong shape, with a plain message', () => {
    const noSection = single.safeParse({ tournamentId: 't-1' })
    expect(noSection.success).toBe(false)
    expect(single.safeParse({ tournamentId: 't-1', section: 'Open', byeRounds: 'none' }).success).toBe(false)
    expect(single.safeParse({ tournamentId: 't-1', section: 'Open', waitlist: 'yes' }).success).toBe(false)
    expect(single.safeParse(null).success).toBe(false)
    expect(family.safeParse({ tournamentId: 't-1', entries: 'Open' }).success).toBe(false)
    expect(family.safeParse({ tournamentId: 't-1', entries: ['Open'] }).success).toBe(false)
    expect(edit.safeParse({ paymentStatus: 'comped' }).success).toBe(false)
    expect(edit.safeParse({ byeRounds: ['1'] }).success).toBe(false)
    expect(edit.safeParse([]).success).toBe(false)
  })
})

describe('the contracts ratchet', () => {
  it('has the three registration routes in the registry and out of the pending list', () => {
    expect(Object.keys(contracts['registrations'])).toEqual(['POST'])
    expect(Object.keys(contracts['registrations/batch'])).toEqual(['POST'])
    expect(Object.keys(contracts['registrations/[id]'])).toEqual(['PATCH'])
    for (const line of ['POST registrations', 'POST registrations/batch', 'PATCH registrations/[id]']) {
      expect(PENDING_CONTRACTS, line).not.toContain(line)
    }
  })

  it('leaves the registration routes this slice did not touch on the pending list', () => {
    // pay.ts reads the amount from the payment row and is not part of this change.
    expect(PENDING_CONTRACTS.filter((l) => l.includes('registrations'))).toEqual(
      expect.arrayContaining(['POST registrations/[id]/pay']),
    )
  })
})

describe('the registration handlers read sections from the table', () => {
  const files = [
    'functions/api/registrations.ts',
    'functions/api/registrations/batch.ts',
    'functions/api/registrations/[id].ts',
  ]

  for (const file of files) {
    it(`${file} does not read tournaments.sections`, () => {
      // Comments say what the code does; only the code is held to this.
      const code = readFileSync(join(ROOT, file), 'utf8')
        .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(code).not.toMatch(/\bparseSection/)
      expect(code).not.toMatch(/\b(?:t|tour|tournament)\.sections\b/)
      expect(code).not.toMatch(/\bsections:\s*string\b/)
      expect(code).not.toMatch(/tournaments\.sections\b/)
      expect(code).not.toMatch(/SELECT[^`'"]*\bsections\b/i)
      expect(code).toMatch(/loadSections/)
    })
  }

  it('the pay handler still takes its amount from the payment row, not from sections', () => {
    const code = readFileSync(join(ROOT, 'functions/api/registrations/[id]/pay.ts'), 'utf8')
    expect(code).not.toMatch(/\bsections\b/)
  })
})
