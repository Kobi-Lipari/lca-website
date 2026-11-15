// test/integration/club-save-notice-limit.test.ts
//
// The save notice at most once an hour for one club and one person saving,
// by K's decision 7 of Sunday, November 15, 2026, through the real handlers:
// PATCH /api/admin/clubs/[id] and PUT /api/admin/clubs/[id]/places. The
// hour counts from the last notice, read from the activity log's club_edit
// rows by their created_at, and each row says in its detail whether its
// save's notice went. No clock is moved: a case moves a row's created_at
// back instead. The last group reads the activity log's endpoint with the
// new key in a row's detail. CLUB_KEEPERS_ON is false in the tree; here it is read
// through a getter on the mocked module, as in
// test/integration/club-save.test.ts. Every club, region and person here is
// made up ("Example Chess Club", example.org), and each case makes its own
// region, so the seats of one case never cover another's club.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPatch as adminClubPatch, KEEPER_FIELDS_CLOSED } from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as placesPut, PLACES_CLOSED } from '../../functions/api/admin/clubs/[id]/places'
import { onRequestGet as auditGet } from '../../functions/api/admin/audit'
import { emailBehavior, emailOutbox, flushWaitUntil, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

const flags = vi.hoisted(() => ({ keepersOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
})
afterEach(() => {
  flags.keepersOn = false
})

const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

/** A regional seat covering the region, held by the member, as the seat screens write one. */
async function regionalSeat(memberId: string, region: string): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, NULL)').bind(id, memberId).run()
}

/** A made up club in a region of its own, with its own rep and two representatives for the region; `seated: false` leaves the region with none. */
async function exampleClub(opts: { seated?: boolean } = {}) {
  const region = newRegion()
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, slug = ? WHERE id = ?').bind(region, clubId, clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Player One', email: `rep.${clubId}@example.org` })
  const holder = await seedMember({ fullName: 'Player Two', email: `holder.${clubId}@example.org` })
  const second = await seedMember({ fullName: 'Player Three', email: `second.${clubId}@example.org` })
  if (opts.seated !== false) {
    await regionalSeat(holder, region)
    await regionalSeat(second, region)
  }
  return { clubId, region, rep, holder, second, told: [`holder.${clubId}@example.org`, `second.${clubId}@example.org`].sort() }
}

const patch = (as: string, clubId: string, body: unknown) =>
  invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body })
const put = (as: string, clubId: string, places: unknown) =>
  invoke(placesPut, { method: 'PUT', as, aal: 'aal2', params: { id: clubId }, body: { places } })

/** One save and its background work, answering the addresses told, A to Z. */
async function saved(response: Promise<Response>): Promise<string[]> {
  emailOutbox.length = 0
  expect((await response).status).toBe(200)
  await flushWaitUntil()
  return emailOutbox.map((m) => m.to).sort()
}

interface EditRow { id: string; actor_id: string; detail: string; created_at: string }
/** The club's club_edit rows, oldest first. */
async function editRows(clubId: string): Promise<EditRow[]> {
  const { results } = await env.DB.prepare('SELECT id, actor_id, detail, created_at FROM admin_audit_log WHERE action = \'club_edit\' AND detail LIKE ? ORDER BY rowid')
    .bind(`%"club_id":"${clubId}"%`).all<EditRow>()
  return results
}
const details = async (clubId: string) => (await editRows(clubId)).map((r) => JSON.parse(r.detail) as Record<string, unknown>)
const last = async (clubId: string) => (await details(clubId)).at(-1)

/** Puts every club_edit row of the club, or one row by its id, the given number of seconds back from now by the database's clock. */
async function moveBack(clubId: string, seconds: number, rowId?: string): Promise<void> {
  const shift = `-${seconds} seconds`
  if (rowId) {
    await env.DB.prepare('UPDATE admin_audit_log SET created_at = datetime(\'now\', ?) WHERE id = ?').bind(shift, rowId).run()
  } else {
    await env.DB.prepare('UPDATE admin_audit_log SET created_at = datetime(\'now\', ?) WHERE action = \'club_edit\' AND detail LIKE ?').bind(shift, `%"club_id":"${clubId}"%`).run()
  }
}

/**
 * Waits for the database's clock to be early in a second, so a row moved
 * back and the save that follows read the same second. created_at keeps
 * whole seconds, so a case at 59 minutes 59 seconds would otherwise cross a
 * tick now and then and read the full hour.
 */
async function earlyInASecond(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const at = await env.DB.prepare('SELECT CAST(substr(strftime(\'%f\', \'now\'), 4) AS INTEGER) AS ms').first<{ ms: number }>()
    if ((at?.ms ?? 0) < 300) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('The database clock was never caught early in a second: a timing miss on a loaded machine, not a counting fault.')
}

describe('the save notice at most once an hour, with CLUB_KEEPERS_ON set', () => {
  it('a save that changes a field sends one notice to each representative, and its row says so', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
    expect(emailOutbox).toHaveLength(2)
    const rows = await editRows(clubId)
    expect(rows).toHaveLength(1)
    expect(rows[0].actor_id).toBe(rep)
    expect(rows[0].detail).toBe(JSON.stringify({ club_id: clubId, fields: ['cost_text'], notice: true }))
    for (const notice of emailOutbox) {
      for (const text of [notice.html, notice.text ?? '']) expect(text).toContain('If Player One saves again within the hour, no second email follows; the link shows the listing as it stands.')
    }
  })

  it('a second save ten minutes later sends none, and still lands, stamps the club and writes its row with its fields and no notice', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
    await moveBack(clubId, 600)
    await env.DB.prepare('UPDATE clubs SET told_updated_at = NULL, last_confirmed_at = NULL WHERE id = ?').bind(clubId).run()

    expect(await saved(patch(rep, clubId, { costText: 'Five dollars', weekendPlay: true }))).toEqual([])
    const club = await env.DB.prepare('SELECT cost_text, weekend_play, told_by, told_updated_at, confirmed_by, last_confirmed_at FROM clubs WHERE id = ?')
      .bind(clubId).first<Record<string, unknown>>()
    expect(club).toMatchObject({ cost_text: 'Five dollars', weekend_play: 1, told_by: rep, confirmed_by: rep })
    expect(club?.told_updated_at).toEqual(expect.any(String))
    expect(club?.last_confirmed_at).toEqual(expect.any(String))
    expect(await details(clubId)).toEqual([
      { club_id: clubId, fields: ['cost_text'], notice: true },
      { club_id: clubId, fields: ['cost_text', 'weekend_play'], notice: false },
    ])
  })

  it('a save 59 minutes 59 seconds after the notice sends none, and one at 60 minutes sends one', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
    const [first] = await editRows(clubId)

    await earlyInASecond()
    await moveBack(clubId, 3599, first.id)
    expect(await saved(patch(rep, clubId, { costText: 'Five dollars' }))).toEqual([])

    await moveBack(clubId, 3600, first.id)
    expect(await saved(patch(rep, clubId, { costText: 'Ten dollars' }))).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice)).toEqual([true, false, true])
  })

  it('a chain of saves 50 minutes apart sends at the first, not the second, and at the third: the hour counts from the last notice, not the last save', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(patch(rep, clubId, { costText: 'First' }))).toEqual(told)
    const [first] = await editRows(clubId)
    await moveBack(clubId, 3000, first.id)

    expect(await saved(patch(rep, clubId, { costText: 'Second' }))).toEqual([])
    const [, second] = await editRows(clubId)
    await moveBack(clubId, 6000, first.id)
    await moveBack(clubId, 3000, second.id)

    expect(await saved(patch(rep, clubId, { costText: 'Third' }))).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice)).toEqual([true, false, true])
  })

  it('another saver on the same club within the hour sends, and the same saver on another club sends', async () => {
    const one = await exampleClub()
    const admin = await seedAdmin()
    expect(await saved(patch(one.rep, one.clubId, { costText: 'Free' }))).toEqual(one.told)
    expect(await saved(patch(admin, one.clubId, { costText: 'Five dollars' }))).toEqual(one.told)

    const two = await exampleClub()
    expect(await saved(patch(admin, two.clubId, { costText: 'Free' }))).toEqual(two.told)
    expect((await details(one.clubId)).map((d) => d.notice)).toEqual([true, true])
    expect((await details(two.clubId)).map((d) => d.notice)).toEqual([true])
  })

  it('an LCA admin\'s saves are counted as anyone\'s: one notice in the hour', async () => {
    const { clubId, told } = await exampleClub()
    const admin = await seedAdmin()
    expect(await saved(patch(admin, clubId, { costText: 'Free' }))).toEqual(told)
    expect(await saved(patch(admin, clubId, { name: 'Example Chess Club of Example City' }))).toEqual([])
    expect(await saved(put(admin, clubId, [{ name: 'Example Hall' }]))).toEqual([])
    expect((await details(clubId)).map((d) => d.notice)).toEqual([true, false, false])
  })

  it('an LCA admin who moves a club from no region into a seated one tells that region\'s representatives once', async () => {
    const { clubId, region, told } = await exampleClub()
    await env.DB.prepare('UPDATE clubs SET region = NULL WHERE id = ?').bind(clubId).run()
    const admin = await seedAdmin()
    expect(await saved(patch(admin, clubId, { region, costText: 'Free' }))).toEqual(told)
    expect(await env.DB.prepare('SELECT region FROM clubs WHERE id = ?').bind(clubId).first<{ region: string }>()).toEqual({ region })
    expect(await last(clubId)).toEqual({ club_id: clubId, fields: ['region', 'cost_text'], notice: true })
    expect(await saved(patch(admin, clubId, { costText: 'Five dollars' }))).toEqual([])
  })

  it('an LCA admin who moves a club out of a seated region into one with no representative tells no one and starts no hour', async () => {
    const { clubId, region, told } = await exampleClub()
    const admin = await seedAdmin()
    expect(await saved(patch(admin, clubId, { region: newRegion(), costText: 'Free' }))).toEqual([])
    expect(await last(clubId)).toMatchObject({ notice: false })
    // Moved back within the minute, the seated region hears of it: the move away started no hour.
    expect(await saved(patch(admin, clubId, { region, costText: 'Five dollars' }))).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice)).toEqual([false, true])
  })

  it('a places save within the hour of a listing save\'s notice sends none', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
    expect(await saved(put(rep, clubId, [{ name: 'Example Hall', street: '1 Example Road' }]))).toEqual([])
    expect(await details(clubId)).toEqual([
      { club_id: clubId, fields: ['cost_text'], notice: true },
      { club_id: clubId, fields: ['places', 'location'], notice: false },
    ])
  })

  it('a listing save within the hour of a places save\'s notice sends none, the places sent with the listing included', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(put(rep, clubId, [{ name: 'Example Hall' }]))).toEqual(told)
    expect(await saved(patch(rep, clubId, { costText: 'Free', places: [{ name: 'Example Annex' }] }))).toEqual([])
    expect((await details(clubId)).map((d) => d.notice)).toEqual([true, false])
  })

  it('two saves by one saver on one club started together send one notice between them', async () => {
    const { clubId, rep, told } = await exampleClub()
    emailOutbox.length = 0
    const [a, b] = await Promise.all([patch(rep, clubId, { costText: 'Free' }), patch(rep, clubId, { welcomeText: 'Everyone is welcome.' })])
    expect([a.status, b.status]).toEqual([200, 200])
    await flushWaitUntil()
    expect(emailOutbox.map((m) => m.to).sort()).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice).sort()).toEqual([false, true])
  })

  it('a places save and a listing save started together send one notice between them', async () => {
    const { clubId, rep, told } = await exampleClub()
    emailOutbox.length = 0
    const [a, b] = await Promise.all([put(rep, clubId, [{ name: 'Example Hall' }]), patch(rep, clubId, { costText: 'Free' })])
    expect([a.status, b.status]).toEqual([200, 200])
    await flushWaitUntil()
    expect(emailOutbox.map((m) => m.to).sort()).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice).sort()).toEqual([false, true])
  })

  it('a save by one of the region\'s representatives sends none, its row says so, and it starts no hour for anyone', async () => {
    const { clubId, rep, holder, second, told } = await exampleClub()
    expect(await saved(patch(holder, clubId, { costText: 'Free' }))).toEqual([])
    expect(await last(clubId)).toEqual({ club_id: clubId, fields: ['cost_text'], notice: false })
    // The other representative saving next is told nothing either, being one of them; the rep is the first notice of the hour.
    expect(await saved(patch(second, clubId, { costText: 'Five dollars' }))).toEqual([])
    expect(await saved(patch(rep, clubId, { costText: 'Ten dollars' }))).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice)).toEqual([false, false, true])
  })

  it('a region with no representative sends none and its row says so, so a seat filled within the hour hears of the next save', async () => {
    const { clubId, region, rep, holder } = await exampleClub({ seated: false })
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual([])
    expect(await last(clubId)).toEqual({ club_id: clubId, fields: ['cost_text'], notice: false })
    await regionalSeat(holder, region)
    expect(await saved(patch(rep, clubId, { costText: 'Five dollars' }))).toEqual([`holder.${clubId}@example.org`])
  })

  it('a save that changes no field writes no row and sends nothing, and leaves the hour as it was', async () => {
    const { clubId, rep, told } = await exampleClub()
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual([])
    expect(await editRows(clubId)).toHaveLength(1)
    await moveBack(clubId, 3600)
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual([])
    expect(await editRows(clubId)).toHaveLength(1)
  })

  it('a send that fails is not tried again within the hour: its row says the notice went', async () => {
    const { clubId, rep, told } = await exampleClub()
    emailBehavior.succeed = false
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual([])
    expect(await last(clubId)).toEqual({ club_id: clubId, fields: ['cost_text'], notice: true })
    emailBehavior.succeed = true
    expect(await saved(patch(rep, clubId, { costText: 'Five dollars' }))).toEqual([])
    await moveBack(clubId, 3600)
    expect(await saved(patch(rep, clubId, { costText: 'Ten dollars' }))).toEqual(told)
  })

  it('role safety: a person the save refuses writes no row and starts no hour', async () => {
    const { clubId, rep, told } = await exampleClub()
    const member = await seedMember({ fullName: 'Player Four', email: `member.${clubId}@example.org` })
    expect((await patch(member, clubId, { costText: 'Free' })).status).toBe(403)
    expect((await put(member, clubId, [{ name: 'Example Hall' }])).status).toBe(403)
    expect(await editRows(clubId)).toEqual([])
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
  })
})

describe('the save notice at most once an hour: what the count reads and who is refused', () => {
  /** A made-up activity row, as another path of the site might have written one. */
  async function plantRow(actor: string, action: string, detail: string): Promise<void> {
    await env.DB.prepare('INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(`aud-plant-${crypto.randomUUID().slice(0, 8)}`, actor, 'player.one@example.org', action, 'Example Chess Club', detail).run()
  }

  it('a row whose detail is not JSON, or that says a notice went under another action, is passed over and never counted', async () => {
    const { clubId, rep, told } = await exampleClub()
    await plantRow(rep, 'club_edit', 'not json at all')
    await plantRow(rep, 'club_update', JSON.stringify({ club_id: clubId, fields: ['cost_text'], notice: true }))
    await plantRow(rep, 'club_edit', JSON.stringify({ club_id: clubId, fields: ['cost_text'], notice: false }))
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
  })

  it('a notice row of the same saver on a club that only shares the id\'s start is not this club\'s hour', async () => {
    const { clubId, rep, told } = await exampleClub()
    await plantRow(rep, 'club_edit', JSON.stringify({ club_id: `${clubId}-2`, fields: ['cost_text'], notice: true }))
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
  })

  it('a notice row of another saver on the same club is not this saver\'s hour', async () => {
    const { clubId, rep, holder, told } = await exampleClub()
    await plantRow(holder, 'club_edit', JSON.stringify({ club_id: clubId, fields: ['cost_text'], notice: true }))
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
  })

  it('a notice row inside the hour makes the save send none, by the row\'s own created_at', async () => {
    const { clubId, rep, told } = await exampleClub()
    await plantRow(rep, 'club_edit', JSON.stringify({ club_id: clubId, fields: ['cost_text'], notice: true }))
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual([])
    await env.DB.prepare('UPDATE admin_audit_log SET created_at = datetime(\'now\', \'-3601 seconds\') WHERE action = \'club_edit\' AND detail LIKE ? AND actor_id = ?')
      .bind(`%"notice":true%`, rep).run()
    expect(await saved(patch(rep, clubId, { costText: 'Five dollars' }))).toEqual(told)
  })

  it('role safety: signed out, both saves answer 401 with no row and no notice, and a member who is no keeper of the club gets 403', async () => {
    const { clubId } = await exampleClub()
    const other = await exampleClub()
    emailOutbox.length = 0
    const out = await invoke(adminClubPatch, { method: 'PATCH', params: { id: clubId }, body: { costText: 'Free' } })
    expect(out.status).toBe(401)
    const outPlaces = await invoke(placesPut, { method: 'PUT', params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })
    expect(outPlaces.status).toBe(401)
    expect((await patch(other.rep, clubId, { costText: 'Free' })).status).toBe(403)
    expect((await put(other.rep, clubId, [{ name: 'Example Hall' }])).status).toBe(403)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect(await editRows(clubId)).toEqual([])
  })
})

describe('the save notice at most once an hour: today\'s save and every switch off', () => {
  it('today\'s save writes its row as before, with no notice key, and its rows are never counted', async () => {
    const { clubId, rep, told } = await exampleClub()
    flags.keepersOn = false
    expect(await saved(invoke(adminClubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body: { description: 'Tuesdays at 7:00 PM' } }))).toEqual([])
    const [today] = await editRows(clubId)
    expect(today.detail).toBe(JSON.stringify({ club_id: clubId, fields: ['description'] }))

    flags.keepersOn = true
    expect(await saved(patch(rep, clubId, { costText: 'Free' }))).toEqual(told)
    expect((await details(clubId)).map((d) => d.notice)).toEqual([undefined, true])
  })

  it('with CLUB_KEEPERS_ON unset the listing save and the places save are refused as before, and nothing is sent or counted', async () => {
    const { clubId, rep } = await exampleClub()
    flags.keepersOn = false
    emailOutbox.length = 0
    const listing = await patch(rep, clubId, { costText: 'Free' })
    expect(listing.status).toBe(403)
    expect(await listing.json()).toEqual({ error: KEEPER_FIELDS_CLOSED })
    const places = await put(rep, clubId, [{ name: 'Example Hall' }])
    expect(places.status).toBe(403)
    expect(await places.json()).toEqual({ error: PLACES_CLOSED })
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect(await editRows(clubId)).toEqual([])
  })
})

async function plantEdit(clubId: string, actorId: string, notice?: boolean): Promise<string> {
  const detail = JSON.stringify(notice === undefined ? { club_id: clubId, fields: ['cost_text'] } : { club_id: clubId, fields: ['cost_text'], notice })
  await env.DB.prepare('INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label, detail) VALUES (?, ?, ?, \'club_edit\', ?, ?)')
    .bind(`aud-${crypto.randomUUID().slice(0, 8)}`, actorId, 'player.one@example.org', 'Example Chess Club', detail).run()
  return detail
}

describe('the save notice at most once an hour: the activity log\'s endpoint and the new key of a club_edit row', () => {
  it('hands the detail on whole to an admin, with the key or without it, and filters on the action as before', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub({ name: 'Example Chess Club' })
    const yes = await plantEdit(clubId, admin, true)
    const no = await plantEdit(clubId, admin, false)
    const before = await plantEdit(clubId, admin)
    const res = await invoke(auditGet, { as: admin, aal: 'aal2', path: '/api/admin/audit?action=club_edit&limit=200' })
    expect(res.status).toBe(200)
    const { entries } = await res.json<{ entries: Array<{ action: string; detail: string }> }>()
    // The log is shared by every case of this file, so this club's rows are picked out.
    expect(entries.filter((e) => e.detail.includes(`"club_id":"${clubId}"`)).map((e) => e.detail).sort()).toEqual([yes, no, before].sort())
    expect(entries.every((e) => e.action === 'club_edit')).toBe(true)
  })

  it('role safety: a club rep, a member and a signed-out caller never get the rows', async () => {
    const clubId = await seedClub({ name: 'Example Chess Club' })
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Player One', email: 'rep.one@example.org' })
    const member = await seedMember({ fullName: 'Player Two', email: 'member.two@example.org' })
    await plantEdit(clubId, rep, true)
    for (const who of [rep, member]) {
      const res = await invoke(auditGet, { as: who, aal: 'aal2', path: '/api/admin/audit?action=club_edit' })
      expect(res.status).toBe(403)
      expect(JSON.stringify(await res.json())).not.toContain('club_edit')
    }
    const out = await invoke(auditGet, { path: '/api/admin/audit?action=club_edit' })
    expect(out.status).toBe(401)
    expect(JSON.stringify(await out.json())).not.toContain('notice')
  })
})
