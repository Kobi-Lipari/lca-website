// Cloudflare Worker: Gulf South Clearinghouse Sync
// Runs daily via cron trigger
// Fetches JSON from Google Apps Script, upserts into D1 clearinghouse table

export interface Env {
  DB: D1Database
  CLEARINGHOUSE_JSON_URL: string
}

interface SheetRow {
  name: string
  start_date: string
  end_date: string
  organizer: string
  city: string
  state: string
  venue: string
  rating_system: string
  eligibility: string
  contact: string
  link: string
  status: string
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function makeId(name: string, startDate: string): string {
  return `${slugify(name)}-${startDate}`
}

function isLCA(link: string): boolean {
  return typeof link === 'string' && link.includes('louisianachess.org')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/sync') {
      return new Response('LCA Clearinghouse Worker. POST /sync to trigger.', { status: 200 })
    }
    const result = await runSync(env)
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    })
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runSync(env)
  },
}

async function runSync(env: Env): Promise<Record<string, unknown>> {
  const url = env.CLEARINGHOUSE_JSON_URL
  if (!url) throw new Error('CLEARINGHOUSE_JSON_URL not set')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch sheet JSON: ${res.status}`)

  const rows: SheetRow[] = await res.json()

  let upserted = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.name || (row.status || '').toLowerCase() === 'tentative') {
      skipped++
      continue
    }

    if (!row.start_date || row.start_date === 'Invalid Date') {
      skipped++
      continue
    }

    const id = makeId(row.name, row.start_date)

    await env.DB.prepare(`
      INSERT INTO clearinghouse (
        id, name, start_date, end_date, organizer, city, state,
        venue, rating_system, eligibility, contact, link, is_lca, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name          = excluded.name,
        start_date    = excluded.start_date,
        end_date      = excluded.end_date,
        organizer     = excluded.organizer,
        city          = excluded.city,
        state         = excluded.state,
        venue         = excluded.venue,
        rating_system = excluded.rating_system,
        eligibility   = excluded.eligibility,
        contact       = excluded.contact,
        link          = excluded.link,
        is_lca        = excluded.is_lca,
        synced_at     = datetime('now')
    `).bind(
      id,
      row.name,
      row.start_date,
      row.end_date || null,
      row.organizer || null,
      row.city || null,
      row.state || null,
      row.venue || null,
      row.rating_system || null,
      row.eligibility || null,
      row.contact || null,
      row.link || null,
      isLCA(row.link) ? 1 : 0,
    ).run()

    upserted++
  }

  // Remove stale rows (not synced in last 2 hours, not LCA-hosted)
  await env.DB.prepare(`
    DELETE FROM clearinghouse
    WHERE synced_at < datetime('now', '-2 hours')
    AND is_lca = 0
  `).run()

  return { upserted, skipped, timestamp: new Date().toISOString() }
}