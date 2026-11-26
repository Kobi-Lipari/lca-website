// test/unit/club-list-callers.test.ts
//
// Every caller of GET /api/clubs reads today's fields and passes the
// directory's new keys by (WS09 step 32): with CLUB_PAGES_ON set the list's
// rows carry more keys, and nothing the site draws today may change.
// - getClubs() is the one call to the list (src/areas/clubs/api.ts): it
//   still asks the plain address, is typed by today's ApiClubListItem, which
//   is as it was, and hands a wider answer's rows on as the server sent them;
// - the callers, ClubsPage, HomePage, the admin's pages and the three admin
//   parts typed by ApiClubListItem, take the list by getClubs() or by that
//   type alone, and none spreads, serialises or lists the keys of a row, so
//   no new key reaches anything they draw or send. The site's search reads
//   the clubs table itself (functions/utils/search.ts), not this list.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClubs } from '../../src/areas/clubs/api'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

/** Each file that calls getClubs() or holds a row of the list by its type. */
const CALLERS = ['src/pages/ClubsPage.tsx', 'src/pages/HomePage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminEmailPage.tsx']
const TYPE_HOLDERS = ['src/areas/admin/components/TournamentWizard.tsx', 'src/areas/admin/components/TournamentList.tsx', 'src/areas/admin/components/MembersTable.tsx']

/** A spread, a serialising or a listing of the keys of a row of the list. */
const WHOLE_ROW = /\.\.\.\s*(club|clubs|row)\b(?!\.)|JSON\.stringify\(\s*(club|clubs)\b|Object\.(keys|entries|values|assign)\(\s*(club|clubs)\b/

/** A made-up wider answer, as the server sends it with CLUB_PAGES_ON set. */
const WIDE = {
  clubs: [{
    id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays, 7:00 PM', color: '#1f3a5f', image_url: null,
    region: 'North Louisiana', latitude: 30.45, longitude: -91.15, slug: 'example-chess-club', statement: 'Tuesdays at 7:00 PM.', description: null,
    point: { latitude: 30.45, longitude: -91.15 }, weekend_play: true, scholastic_friendly: false,
  }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the one call to the list', () => {
  it('asks the plain address and hands a wider answer\'s rows on as they came, today\'s fields among them', async () => {
    const asked: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url)
      return new Response(JSON.stringify(WIDE), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const clubs = await getClubs()
    expect(asked).toEqual(['/api/clubs'])
    expect(clubs).toEqual(WIDE.clubs)
    const [club] = clubs
    expect([club.id, club.name, club.city, club.meeting_schedule, club.color, club.image_url, club.region, club.latitude, club.longitude]).toEqual(
      ['example-chess-club', 'Example Chess Club', 'Example City', 'Tuesdays, 7:00 PM', '#1f3a5f', null, 'North Louisiana', 30.45, -91.15],
    )
  })

  it('keeps today\'s type, ApiClubListItem, as it was, and types getClubs() by it', () => {
    const api = read('src/areas/clubs/api.ts')
    const start = api.indexOf('export interface ApiClubListItem {')
    const block = api.slice(start, api.indexOf('\n}\n', start) + 2)
    expect(block).toBe([
      'export interface ApiClubListItem {',
      '  id: string',
      '  name: string',
      '  city: string',
      '  meeting_schedule: string',
      '  color: string | null',
      '  image_url: string | null',
      '  region: string | null',
      '  /** The club\'s pin on the map, when one has been set. */',
      '  latitude?: number | null',
      '  longitude?: number | null',
      '}',
    ].join('\n'))
    expect(api).toContain('export async function getClubs(): Promise<ApiClubListItem[]> {')
    expect(api).toContain('const data = await handleResponse<{ clubs: ApiClubListItem[] }>(response)')
    expect(api).toContain('export type ApiClubDirectoryItem = ClubDirectoryItem')
    expect(api.match(/fetch\('\/api\/clubs'\)/g)).toHaveLength(1)
  })
})

describe('the callers', () => {
  it('each caller takes the list through getClubs() and holds its rows by today\'s type', () => {
    for (const file of CALLERS) {
      const source = read(file)
      expect(source, file).toMatch(/\bgetClubs\(\)/)
      expect(source, file).toMatch(/\bApiClubListItem\b/)
      expect(source, file).not.toMatch(/ApiClubDirectoryItem|ClubDirectoryItem/)
    }
    for (const file of TYPE_HOLDERS) {
      expect(read(file), file).toMatch(/\bApiClubListItem\b/)
      expect(read(file), file).not.toMatch(/ApiClubDirectoryItem|ClubDirectoryItem/)
    }
  })

  it('no caller spreads, serialises or lists the keys of a row of the list, so a new key reaches nothing it draws or sends', () => {
    for (const file of [...CALLERS, ...TYPE_HOLDERS]) expect(WHOLE_ROW.test(read(file)), file).toBe(false)
  })

  it('no other file of the site asks the list\'s address, and the search reads the clubs table, not the list', () => {
    const asking = filesUnder('src').filter((file) => /fetch\(\s*['"`]\/api\/clubs['"`?]/.test(read(file)))
    expect(asking).toEqual(['src/areas/clubs/api.ts'])
    expect(read('functions/utils/search.ts')).not.toMatch(/['"`]\/api\/clubs['"`?]/)
  })
})
