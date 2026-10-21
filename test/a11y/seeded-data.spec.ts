// test/a11y/seeded-data.spec.ts
//
// What the local servers (wrangler pages dev with the functions folder, on the
// database built from the migrations and scripts/seed/fixtures.sql) actually
// serve, checked through the real handlers and the real pages:
//
// - the seed shows up: events with object sections and early and late
//   prices, the older event with plain-name sections, the round times, the
//   finished event with its half-point standings and a tie, the pinned post,
//   the champions, the documents, the partner event
// - the partner event has no entry count and no registration state
// - nothing can sign in: the fake sign-in address is a closed port, so a
//   missing, forged or made-up token gets 401 and none of the data
// - the Facebook feed endpoint has no token and says so; it is the page-level
//   stub in support.ts that fills the homepage's feed
// - the pages that show the data draw it with no script error and reach no
//   host but the local server
//
// Reads only: nothing here writes to either project's local database, each
// seeded the same way.
import { expect, test } from './support'

interface SectionJson {
  name: string
  entryFee: number
  fees: { regular: number | null; early: number | null; late: number | null }
}
interface TournamentJson {
  id: string
  status: string
  date: string
  sections: SectionJson[]
  early_deadline: string | null
  early_discount: number
  late_after: string | null
  late_fee: number
  round_schedule: Array<{ round: number; date: string; time: string }>
  schedules: Array<{ isPrimary: boolean; rounds: Array<{ round: number; time: string }> }>
}

test.describe('the seed, through the API', () => {
  test('lists the four fixture events in date order, the finished one first', async ({ request }) => {
    const res = await request.get('/api/tournaments')
    expect(res.status()).toBe(200)
    const { tournaments } = (await res.json()) as { tournaments: TournamentJson[] }
    const fixtures = tournaments.filter((t) => t.id.startsWith('fx-'))
    expect(fixtures.map((t) => t.id)).toEqual(['fx-t-done', 'fx-t-quads', 'fx-t-open', 'fx-t-legacy'])
    const dates = tournaments.map((t) => t.date)
    expect(dates).toEqual([...dates].sort())
    expect(fixtures.map((t) => [t.id, t.status])).toEqual([
      ['fx-t-done', 'completed'],
      ['fx-t-quads', 'upcoming'],
      ['fx-t-open', 'upcoming'],
      ['fx-t-legacy', 'upcoming'],
    ])
  })

  test('the open event has object sections with regular, early and late prices', async ({ request }) => {
    const { tournaments } = (await (await request.get('/api/tournaments')).json()) as { tournaments: TournamentJson[] }
    const open = tournaments.find((t) => t.id === 'fx-t-open')!
    expect(open.sections.map((s) => [s.name, s.fees])).toEqual([
      ['Open', { regular: 40, early: 32, late: 50 }],
      ['Under 1600', { regular: 35, early: 30, late: 45 }],
      ['Scholastic', { regular: 20, early: 15, late: 30 }],
    ])
    // The early price comes before the late one, and both bracket the regular price.
    for (const s of open.sections) {
      expect(s.fees.early!).toBeLessThan(s.fees.regular!)
      expect(s.fees.regular!).toBeLessThan(s.fees.late!)
    }
    expect(open.early_deadline).toBeTruthy()
    expect(open.late_after).toBeTruthy()
    expect(open.early_deadline! < open.late_after!).toBe(true)
    expect(open.late_after! < open.date).toBe(true)
  })

  test('the older event keeps plain-name sections, priced by the event fee', async ({ request }) => {
    const { tournaments } = (await (await request.get('/api/tournaments')).json()) as { tournaments: TournamentJson[] }
    const legacy = tournaments.find((t) => t.id === 'fx-t-legacy')!
    expect(legacy.sections.map((s) => s.name)).toEqual(['Open', 'Reserve', 'Novice'])
    for (const s of legacy.sections) expect(s.fees).toEqual({ regular: 25, early: null, late: null })
    expect(legacy.early_deadline).toBeNull()
    expect(legacy.late_after).toBeNull()
  })

  test('the quads event carries its round times, in the event and in its primary schedule', async ({ request }) => {
    const { tournaments } = (await (await request.get('/api/tournaments')).json()) as { tournaments: TournamentJson[] }
    const quads = tournaments.find((t) => t.id === 'fx-t-quads')!
    expect(quads.round_schedule.map((r) => [r.round, r.time])).toEqual([[1, '10:00'], [2, '11:30'], [3, '13:00']])
    for (const r of quads.round_schedule) expect(r.date).toBe(quads.date)
    const primary = quads.schedules.filter((s) => s.isPrimary)
    expect(primary).toHaveLength(1)
    expect(primary[0].rounds.map((r) => [r.round, r.time])).toEqual([[1, '10:00'], [2, '11:30'], [3, '13:00']])
    // The others have no round times, which is the empty case.
    const done = tournaments.find((t) => t.id === 'fx-t-done')!
    expect(done.round_schedule).toEqual([])
  })

  test('one event by id: the finished event, and a 404 for an id that is not there', async ({ request }) => {
    const res = await request.get('/api/tournaments/fx-t-done')
    expect(res.status()).toBe(200)
    expect(((await res.json()) as { tournament: { id: string; status: string } }).tournament).toMatchObject({ id: 'fx-t-done', status: 'completed' })
    const missing = await request.get('/api/tournaments/fx-t-nope')
    expect(missing.status()).toBe(404)
  })

  test('the feed marks the partner event as not ours: no entry count, no registration state', async ({ request }) => {
    const { tournaments } = (await (await request.get('/api/clearinghouse')).json()) as { tournaments: Array<Record<string, unknown>> }
    const partner = tournaments.find((t) => t.id === 'fx-partner-1')!
    expect(partner).toMatchObject({ is_lca: 0, source: 'clearinghouse', state: 'MS', link: 'https://example.org/fixture-gulf-coast-open', rating_system: 'US Chess' })
    expect(partner.registration_status).toBeNull()
    expect(partner.registered_count ?? null).toBeNull()
    expect(partner.entry_fee).toBeNull()
    expect(partner.sections ?? []).toEqual([])
    // An event of ours in the same feed does have them.
    const ours = tournaments.find((t) => t.id === 'fx-t-open')!
    expect(ours).toMatchObject({ is_lca: 1, source: 'lca', registered_count: 3, max_players: 120 })
  })

  test('the champions carry half points as ½, the newest first, with the finished event linked', async ({ request }) => {
    const { champions } = (await (await request.get('/api/champions')).json()) as { champions: Array<{ id: string; year: number; champion: string; notes: string | null; tournament_id: string | null }> }
    const mine = champions.filter((c) => c.id.startsWith('fx-'))
    expect(mine.map((c) => c.id)).toEqual(['fx-champ-1', 'fx-champ-2'])
    expect(mine[0]).toMatchObject({ champion: 'Avery Fixture', notes: 'Won with 2½ of 3.', tournament_id: 'fx-t-done' })
    expect(mine[1].tournament_id).toBeNull()
    expect(mine[0].year).toBeGreaterThan(mine[1].year)
  })

  test('the pinned post comes first, and only published posts are listed', async ({ request }) => {
    const { posts } = (await (await request.get('/api/posts')).json()) as { posts: Array<{ id: string; pinned: number; status: string }> }
    expect(posts[0]).toMatchObject({ id: 'fx-post-pinned', pinned: 1 })
    expect(posts.filter((p) => p.pinned === 1)).toHaveLength(1)
    for (const p of posts) expect(p.status).toBe('published')
  })

  test('the governance documents are there in the three categories, newest first within each', async ({ request }) => {
    const { documents } = (await (await request.get('/api/governance/documents')).json()) as { documents: Array<{ id: string; category: string; doc_date: string }> }
    const mine = documents.filter((d) => d.id.startsWith('fx-'))
    expect(mine.map((d) => d.category).sort()).toEqual(['bylaws', 'minutes', 'treasurer'])
    const dates = documents.map((d) => d.doc_date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  test('the board seats and the clubs of the seed are listed', async ({ request }) => {
    const seats = (await (await request.get('/api/board/seats')).json()) as { seats: Array<{ id: string; role: string; category: string }> }
    const mine = seats.seats.filter((s) => s.id.startsWith('fx-'))
    expect(mine.map((s) => [s.id, s.category])).toEqual([['fx-seat-officer', 'officer'], ['fx-seat-rep', 'regional_rep']])
    const { clubs } = (await (await request.get('/api/clubs')).json()) as { clubs: Array<{ id: string; name: string; meeting_schedule: string | null }> }
    const fixtures = clubs.filter((c) => c.id.startsWith('fx-'))
    expect(fixtures.map((c) => c.name).sort()).toEqual(['Fixture Capital Chess Club', 'Fixture North Chess Club'])
    expect(fixtures.map((c) => c.meeting_schedule).sort()).toEqual(['Fridays at 6:30 PM', 'Tuesdays at 7:00 PM'])
  })
})

test.describe('role safety: nobody signs in against the fake service', () => {
  const PROTECTED = ['/api/me', '/api/admin/members', '/api/admin/audit', '/api/admin/campaigns', '/api/board/tickets', '/api/board/my-seats']

  for (const path of PROTECTED) {
    test(`${path} refuses a request with no token, with a made-up token and with the fake service key`, async ({ request }) => {
      const tokens: Array<Record<string, string>> = [
        {},
        { Authorization: 'Bearer not.a.token' },
        // A token that claims to be the service role and an admin.
        { Authorization: `Bearer ${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"role":"service_role","sub":"fx-m-p1","app_metadata":{"role":"lca_admin"}}').toString('base64url')}.sig` },
        { Authorization: 'Bearer fake-service-role-key-for-a11y-tests' },
        { Authorization: 'Basic ZnhAZXhhbXBsZS5vcmc6cGFzc3dvcmQ=' },
      ]
      for (const headers of tokens) {
        const started = Date.now()
        const res = await request.get(path, { headers })
        // 401 or 403, never the data, and without waiting on a service that is not there.
        expect([401, 403], `${path} with ${Object.values(headers)[0] ?? 'no token'}`).toContain(res.status())
        expect(Date.now() - started).toBeLessThan(5_000)
        const body = await res.text()
        expect(body).not.toMatch(/example\.org|Fixture|fx-/)
        expect(res.headers()['content-type']).toMatch(/application\/json/)
      }
    })
  }

  test('a write with no token is refused as well', async ({ request }) => {
    for (const [method, path] of [['POST', '/api/admin/members'], ['PATCH', '/api/admin/tournaments'], ['POST', '/api/registrations'], ['POST', '/api/admin/posts']] as const) {
      const res = await request.fetch(path, { method, data: {}, headers: { 'Content-Type': 'application/json' } })
      expect([401, 403, 404, 405], `${method} ${path}`).toContain(res.status())
      expect(await res.text()).not.toMatch(/Fixture|fx-/)
    }
  })

  test('the Facebook feed endpoint has no token to use and says so', async ({ request }) => {
    const res = await request.get('/api/facebook-posts')
    expect(res.status()).toBe(502)
    expect(await res.json()).toEqual({ error: 'Facebook feed is not configured' })
  })
})

test.describe('the pages that show it', () => {
  test('/tournaments lists the fixture events by name, with no script error and no outside request', async ({ page, external }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/tournaments')
    await page.waitForLoadState('networkidle')
    const main = page.locator('main')
    for (const name of ['Fixture Saturday Quads', 'Fixture Fall Open', 'Fixture Winter Swiss']) await expect(main).toContainText(name)
    await expect(main).toContainText('3 of 120 spots filled')
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })

  test('the finished event\'s results page shows the standings with a tie, in order', async ({ page }) => {
    await page.goto('/tournaments/fx-t-done/pairings')
    await expect(page.getByRole('heading', { name: 'Pairings & results' })).toBeVisible()
    const rows = page.locator('main table').first().locator('tbody tr')
    await expect(rows).toHaveCount(5)
    // Header cells and data cells in order: under the new look the player's name is the row's header cell (step 27).
    const standings = await rows.evaluateAll((trs) =>
      trs.map((tr) => {
        const cells = Array.from(tr.querySelectorAll(':scope > th, :scope > td')).map((cell) => (cell.textContent ?? '').trim())
        return { place: cells[0], player: cells[1], points: cells[3] }
      }),
    )
    // Today's page writes the score with a point or a ½; the order and the totals are what the seed fixes.
    const value = (p: string) => Number(p.replace('½', '.5').replace(/^\.5$/, '0.5').replace(/^(\d)\.5$/, '$1.5'))
    expect(standings.map((s) => s.player)).toEqual(['Avery Fixture', 'Riley Fixture', 'Casey Fixture', 'Morgan Fixture', 'Jordan Fixture'])
    expect(standings.map((s) => value(s.points))).toEqual([2.5, 2, 1.5, 1.5, 0.5])
    expect(standings.map((s) => s.place)).toEqual(['1', '2', '3', '4', '5'])
  })

  test('an event with no pairings yet says so', async ({ page }) => {
    await page.goto('/tournaments/fx-t-open/pairings')
    await expect(page.getByText('No pairings published yet')).toBeVisible()
  })

  test('the champions page shows the score with ½', async ({ page }) => {
    await page.goto('/champions')
    await expect(page.getByText('Won with 2½ of 3.').first()).toBeVisible()
  })

  test('the news page lists the pinned notice first', async ({ page }) => {
    await page.goto('/news')
    await page.waitForLoadState('networkidle')
    const text = await page.locator('main').innerText()
    const pinned = text.indexOf('Fixture notice: the annual meeting moves online')
    const recap = text.indexOf('Fixture Summer Championship recap')
    expect(pinned).toBeGreaterThanOrEqual(0)
    expect(recap).toBeGreaterThan(pinned)
  })

  test('a regional event shows its link to the organizer and no spot count', async ({ page }) => {
    await page.goto('/tournaments')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Louisiana \(3\)/ }).click()
    await page.getByText('Mississippi (1)').last().click()
    const main = page.locator('main')
    await expect(main).toContainText('Fixture Gulf Coast Open')
    await expect(main).not.toContainText(/spots filled|\d+ registered/)
    await expect(main.locator('a[href="https://example.org/fixture-gulf-coast-open"]')).toHaveCount(1)
  })
})
