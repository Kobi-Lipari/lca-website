// test/integration/media-manager-reach.test.ts
//
// WS16 step 6, the media manager's reach, swept: every handler file under
// functions/api/admin is loaded in the Workers runtime and every method it
// exports is called as the active holder of the Media manager seat, signed in
// with a second factor, with MAIL_LISTS_ON set. Beside the named cases of
// media-manager.test.ts this holds the grant to WS16's own endpoints as Admin
// grows: the three newsletter files under mail/ are the only handler files
// the holder may pass, and every other method answers 403 with nothing
// written and nothing sent, whatever the method, the address or the body. A
// handler file added to Admin later is swept at once; one a media manager
// should reach has to be named in ALLOWED here, in the same change.
//
// MAIL_LISTS_ON and the module's other constants are read through getters on
// the mocked functions/utils/mail/switches, set before every case. Nothing
// reaches an outside service: the harness answers every provider host. Every
// name here is made up but the seat's own title, "Media manager".
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { seedAdmin, seedMember, seedSeat, seedTournament } from './factories'
import { emailOutbox, invoke, resetHarness, type InvokeOptions } from './harness'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

type Handler = Parameters<typeof invoke>[0]

const modules = import.meta.glob('../../functions/api/admin/**/*.ts', { eager: true }) as Record<string, Record<string, unknown>>

/** The handler files the media manager may pass, by path under functions/api/admin. */
const ALLOWED = ['mail/newsletter.ts', 'mail/newsletter/stop.ts', 'mail/newsletter/test.ts']

const METHODS: Record<string, string> = { Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Delete: 'DELETE' }
const ID = 'sample-id'
/** The address params of every [id]-style segment; id is replaced with a real event's id in each case, so a refusal is the guard's and not a missing record's. */
const PARAMS = { id: ID, memberId: ID, newsId: ID, officerId: ID, gameId: ID, round: '1' }

/** Every method of every handler file outside ALLOWED, by file and method. */
const swept: Array<{ file: string; method: string; handler: Handler }> = []
for (const [path, mod] of Object.entries(modules)) {
  const file = path.replace('../../functions/api/admin/', '')
  if (ALLOWED.includes(file)) continue
  for (const [name, value] of Object.entries(mod)) {
    const method = METHODS[name.replace(/^onRequest/, '')]
    if (method && typeof value === 'function') swept.push({ file, method, handler: value as Handler })
  }
}

async function traces() {
  const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n
  return {
    campaigns: await count('SELECT COUNT(*) AS n FROM email_campaigns'),
    recipients: await count('SELECT COUNT(*) AS n FROM email_campaign_recipients'),
    audit: await count('SELECT COUNT(*) AS n FROM admin_audit_log'),
    posts: await count('SELECT COUNT(*) AS n FROM lca_posts'),
    banners: await count('SELECT COUNT(*) AS n FROM site_announcements'),
    tournaments: await count('SELECT COUNT(*) AS n FROM tournaments'),
    registrations: await count('SELECT COUNT(*) AS n FROM registrations'),
    clubs: await count('SELECT COUNT(*) AS n FROM clubs'),
    members: await count('SELECT COUNT(*) AS n FROM members'),
    roles: JSON.stringify((await env.DB.prepare('SELECT id, role FROM members ORDER BY id').all()).results),
    seats: await count('SELECT COUNT(*) AS n FROM board_members'),
    terms: await count('SELECT COUNT(*) AS n FROM board_seat_assignments'),
    tickets: await count('SELECT COUNT(*) AS n FROM support_tickets'),
    sent: emailOutbox.length,
  }
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
})

describe('the media manager\'s reach, swept over every handler of Admin', () => {
  it('finds the handler files, the newsletter\'s three among them, so a glob that finds nothing cannot pass', () => {
    const files = Object.keys(modules).map((p) => p.replace('../../functions/api/admin/', ''))
    for (const allowed of ALLOWED) expect(files).toContain(allowed)
    expect(files.filter((f) => !ALLOWED.includes(f)).length).toBeGreaterThanOrEqual(40)
    expect(swept.length).toBeGreaterThanOrEqual(60)
  })

  it('answers every method outside the newsletter\'s 403, the holder signed in with a second factor, with nothing written and nothing sent', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const event = await seedTournament({ name: 'Sample Winter Open' })
    const before = await traces()
    const answers: string[] = []
    for (const { file, method, handler } of swept) {
      const options: InvokeOptions = { method, params: { ...PARAMS, id: event }, path: '/api/test?section=Open', as: holder, body: method === 'GET' || method === 'DELETE' ? undefined : {} }
      const res = await invoke(handler, options)
      if (res.status !== 403) answers.push(`${method} ${file}: ${res.status}`)
    }
    expect(answers).toEqual([])
    expect(await traces()).toEqual(before)
  })

  it('answers none of them 2xx for the holder with the constant unset, either', async () => {
    flags.listsOn = false
    const holder = await seedMember({ fullName: 'Player One' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const event = await seedTournament({ name: 'Sample Winter Open' })
    const before = await traces()
    const passed: string[] = []
    for (const { file, method, handler } of swept) {
      const options: InvokeOptions = { method, params: { ...PARAMS, id: event }, path: '/api/test?section=Open', as: holder, body: method === 'GET' || method === 'DELETE' ? undefined : {} }
      const res = await invoke(handler, options)
      if (res.status < 300 || res.status >= 500) passed.push(`${method} ${file}: ${res.status}`)
    }
    expect(passed).toEqual([])
    expect(await traces()).toEqual(before)
  })

  it('is not a sweep that refuses everyone: an LCA admin signed in with a second factor passes the same calls on many handlers', async () => {
    const admin = await seedAdmin()
    const event = await seedTournament({ name: 'Sample Winter Open' })
    let passed = 0
    for (const { method, handler } of swept) {
      if (method !== 'GET') continue
      const res = await invoke(handler, { method, params: { ...PARAMS, id: event }, path: '/api/test?section=Open', as: admin })
      if (res.status === 200) passed++
    }
    expect(passed).toBeGreaterThanOrEqual(10)
  })
})
