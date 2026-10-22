// test/unit/api-section-bodies.test.ts
//
// The bodies src/lib/api.ts puts on the wire for the setup screens. A section
// loaded from the server keeps its id in the PATCH body (adminUpdateTournament)
// so the server matches it by id and a rename keeps its entries; a section
// added in the form goes without one; a create (adminCreateTournament) sends
// what it is given. test/integration/sections-rename-ui-path.test.ts sends
// bodies of this shape to the real handlers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token-1' } } }) } },
}))

const { adminCreateTournament, adminUpdateTournament } = await import('@/lib/api')
type Draft = NonNullable<Parameters<typeof adminUpdateTournament>[1]['sections']>[number]

interface Sent { url: string; method: string; headers: Record<string, string>; body: unknown }
let sent: Sent[] = []

beforeEach(() => {
  sent = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, method: String(init.method), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) })
    return new Response(JSON.stringify({ tournament: { id: 't1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})
afterEach(() => vi.unstubAllGlobals())

const loaded: Draft[] = [
  { id: 'sec-a', name: 'Open', entryFee: 40, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: false, cap: 30, fees: { regular: 40, early: 35, late: 50 } },
  { id: 'sec-b', name: 'U1600', entryFee: 30, ratingMax: 1599, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: true, cap: null, fees: { regular: 30, early: null, late: null } },
]

describe('PATCH /api/admin/tournaments/[id] from adminUpdateTournament', () => {
  it('sends every section with its id, in order, and a renamed one under its new name with the same id', async () => {
    const edited = loaded.map((s) => (s.id === 'sec-a' ? { ...s, name: 'Championship' } : s))
    await adminUpdateTournament('t1', { sections: edited })
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('/api/admin/tournaments/t1')
    expect(sent[0].method).toBe('PATCH')
    expect(sent[0].headers.Authorization).toBe('Bearer token-1')
    const body = sent[0].body as { sections: Array<{ id?: string; name: string; entryFee: number }> }
    expect(body.sections.map((s) => [s.id, s.name, s.entryFee])).toEqual([['sec-a', 'Championship', 40], ['sec-b', 'U1600', 30]])
  })

  it('sends a section added in the form with no id, next to the loaded ones that keep theirs', async () => {
    await adminUpdateTournament('t1', { sections: [...loaded, { name: 'U1000', entryFee: 0 }] })
    const body = sent[0].body as { sections: Array<Record<string, unknown>> }
    expect(body.sections.map((s) => s.id)).toEqual(['sec-a', 'sec-b', undefined])
    expect(body.sections[2]).toEqual({ name: 'U1000', entryFee: 0 })
  })

  it('sends only the keys it is given, so a save of other fields does not touch the sections', async () => {
    await adminUpdateTournament('t1', { name: 'Fall Open', rounds: 5 })
    expect(sent[0].body).toEqual({ name: 'Fall Open', rounds: 5 })
  })

  it('sends the section fields it loaded as they were (cap, rules, fees), which the server reads as unchanged', async () => {
    await adminUpdateTournament('t1', { sections: loaded })
    expect((sent[0].body as { sections: unknown[] }).sections).toEqual(loaded)
  })
})

describe('POST /api/admin/tournaments from adminCreateTournament', () => {
  it('sends the sections it is given and creates at the collection URL', async () => {
    await adminCreateTournament({ name: 'Copied Open', location: 'Kenner, LA', date: '2026-11-07', entryFee: 40, sections: [{ name: 'Open', entryFee: 40 }] })
    expect(sent[0].url).toBe('/api/admin/tournaments')
    expect(sent[0].method).toBe('POST')
    expect((sent[0].body as { sections: unknown[] }).sections).toEqual([{ name: 'Open', entryFee: 40 }])
  })
})
