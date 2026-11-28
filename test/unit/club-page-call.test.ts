// test/unit/club-page-call.test.ts
// The one call the new club page will make (getClubPage in
// src/areas/clubs/api.ts, WS09 step 20): a GET to /api/clubs/{address}/page
// with the address encoded, the session's token when there is one and none
// when there is not, no body, the answer as it came, and a 404 or any other
// refusal read as an ApiError carrying its status and the server's words.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ token: 'token-1' as string | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }) } },
}))

const { getClubPage } = await import('@/areas/clubs/api')
const { ApiError } = await import('@/lib/http')

interface Sent { url: string; init: RequestInit }
let sent: Sent[] = []
let answer: () => Response

beforeEach(() => {
  sent = []
  session.token = 'token-1'
  answer = () => new Response(JSON.stringify({ club: { id: 'example-club' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    sent.push({ url, init })
    return answer()
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('getClubPage', () => {
  it('asks GET /api/clubs/{address}/page with no body and the session\'s token', async () => {
    const body = await getClubPage('example-club')
    expect(body).toEqual({ club: { id: 'example-club' } })
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('/api/clubs/example-club/page')
    expect(sent[0].init.method ?? 'GET').toBe('GET')
    expect(sent[0].init.body).toBeUndefined()
    expect((sent[0].init.headers as Record<string, string>).Authorization).toBe('Bearer token-1')
  })

  it('sends no token for a visitor who is signed out', async () => {
    session.token = null
    await getClubPage('example-club')
    expect((sent[0].init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('encodes an address so a space, a slash or a question mark stays inside the one path part', async () => {
    await getClubPage('Example Club/x?y=1#z')
    expect(sent[0].url).toBe('/api/clubs/Example%20Club%2Fx%3Fy%3D1%23z/page')
  })

  it('reads a 404 as an ApiError with its status and the server\'s words', async () => {
    answer = () => new Response(JSON.stringify({ error: 'Club not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    const refused = await getClubPage('example-club').catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(ApiError)
    expect((refused as InstanceType<typeof ApiError>).status).toBe(404)
    expect((refused as Error).message).toBe('Club not found')
  })

  it('reads an answer that is not JSON as an ApiError with the status, not a parse error', async () => {
    answer = () => new Response('<html>Bad gateway</html>', { status: 502 })
    const refused = await getClubPage('example-club').catch((e: unknown) => e)
    expect(refused).toBeInstanceOf(ApiError)
    expect((refused as InstanceType<typeof ApiError>).status).toBe(502)
    expect((refused as Error).message).not.toMatch(/Unexpected token/)
  })
})
