// scripts/db/club-seed-sheet.ts
//
// Prints the check sheet of today's clubs as migration 0067 seeds them: for
// each club A to Z, its address and old address, its region, its statement
// of how it meets, its About text, its places with their pins and the told
// month. K checks the sheet before the seed merges.
//
// It reads the local database that scripts/db/build-local-sqlite.ts builds
// from migrations/*.sql (.drizzle/introspect.sqlite, gitignored), opened
// read-only, so the sheet is exactly what the migrations give and the file is
// never changed. npm run db:club-seed-sheet builds that file first.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/db/club-seed-sheet.ts [local.sqlite]
//
// It only reads a local file; it never talks to Cloudflare, and it refuses
// in words anything that names a remote database.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { DEFAULT_OUT } from './build-local-sqlite.ts'

/** What the sheet answers when it is asked for anything but a local file. */
export const REMOTE_REFUSAL =
  'This sheet reads only the local database built from the migrations (npm run db:local-sqlite). It never reads a remote database, the preview database or production. Run it with no argument, or with the path of a local database file.'

/** The words that name a remote database or the way to reach one. */
const REMOTE = /--remote|--env|--preview|:\/\/|\blca-db\b|wrangler/i

/**
 * Why the arguments cannot be run, in words, or null when they can: no
 * argument, or one that is the path of a local file.
 */
export function sheetRefusal(args: string[]): string | null {
  if (args.some((a) => REMOTE.test(a))) return REMOTE_REFUSAL
  if (args.length > 1) return 'This sheet takes one argument at most: the path of a local database file.'
  if (args.length === 1 && args[0].startsWith('-')) return 'This sheet takes no options: give the path of a local database file, or nothing.'
  return null
}

interface ClubRow {
  id: string
  name: string
  city: string | null
  region: string | null
  slug: string | null
  how_we_meet_text: string | null
  about_text: string | null
  told_updated_at: string | null
  told_by: string | null
}
interface PlaceRow {
  club_id: string
  name: string
  latitude: number | null
  longitude: number | null
  sort: number
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "As told to LCA, November 2026", as the club page reads a date with no keeper's name; the stored text when it is not a date. */
function told(at: string | null, by: string | null): string {
  if (!at) return 'None'
  const found = /^(\d{4})-(\d{2})-\d{2}/.exec(at)
  const month = found ? `${MONTHS[Number(found[2]) - 1]} ${found[1]}` : at
  return by ? `${month}, saved by a member` : `As told to LCA, ${month}`
}
const point = (p: PlaceRow) => (p.latitude === null || p.longitude === null ? 'no pin' : `pin at ${p.latitude}, ${p.longitude}`)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The sheet, as text, from the local database file at `path`. */
export function clubSeedSheet(path: string = DEFAULT_OUT): string {
  if (!existsSync(path)) {
    throw new Error(`There is no local database at ${path}. Run npm run db:local-sqlite first, or give the path of a local database built from the migrations.`)
  }
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const columns = (db.prepare(`SELECT name FROM pragma_table_info('clubs')`).all() as Array<{ name: string }>).map((c) => c.name)
    const seeded = columns.includes('slug')
      && Number((db.prepare('SELECT COUNT(*) AS n FROM clubs WHERE slug IS NOT NULL').get() as { n: number }).n) > 0
    if (!seeded) {
      throw new Error(`The database at ${path} has no club slugs, so migration 0067 has not run on it. Run npm run db:local-sqlite to build it again from the migrations.`)
    }
    const clubs = db.prepare(
      'SELECT id, name, city, region, slug, how_we_meet_text, about_text, told_updated_at, told_by FROM clubs',
    ).all() as unknown as ClubRow[]
    clubs.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'))
    const history = db.prepare('SELECT old_slug, club_id FROM club_slug_history ORDER BY old_slug').all() as Array<{ old_slug: string; club_id: string }>
    const places = db.prepare('SELECT club_id, name, latitude, longitude, sort FROM club_places ORDER BY club_id, sort, id').all() as unknown as PlaceRow[]

    const nameOf = new Map(clubs.map((c) => [c.id, c.name]))
    const sharing = new Map<string, string[]>()
    for (const p of places) {
      if (p.latitude === null || p.longitude === null) continue
      const key = `${p.latitude},${p.longitude}`
      sharing.set(key, [...(sharing.get(key) ?? []), p.club_id])
    }

    const count = (test: (c: ClubRow) => boolean) => clubs.filter(test).length
    const lines = [
      'Club check sheet: the clubs as migration 0067 seeds them',
      `Read from ${path}, a local database built from the migrations.`,
      '',
      `${plural(clubs.length, 'club', 'clubs')}, ${plural(count((c) => c.slug !== null), 'address', 'addresses')}, ${plural(history.length, 'old address', 'old addresses')}, `
        + `${plural(count((c) => c.how_we_meet_text !== null), 'statement', 'statements')} of how a club meets, ${plural(count((c) => c.about_text !== null), 'About text', 'About texts')}, `
        + `${plural(places.length, 'place', 'places')}.`,
      'The told month is the month the migrations ran on this database; on the live site it is the month of the merge.',
    ]
    for (const [i, club] of clubs.entries()) {
      lines.push('', `${i + 1}. ${club.name} (id ${club.id})`)
      lines.push(`   Address: ${club.slug ? `/clubs/${club.slug}` : 'None'}`)
      const old = history.filter((h) => h.club_id === club.id).map((h) => `/clubs/${h.old_slug}`)
      lines.push(`   Old address: ${old.length ? old.join(', ') : 'None'}`)
      lines.push(`   City: ${club.city ?? 'None'}. Region: ${club.region ?? 'None'}`)
      lines.push(`   How we meet: ${club.how_we_meet_text ?? 'None'}`)
      lines.push(`   About: ${club.about_text ?? 'None'}`)
      const own = places.filter((p) => p.club_id === club.id)
      if (own.length === 0) lines.push('   Places: None')
      for (const [n, p] of own.entries()) {
        const others = p.latitude === null || p.longitude === null
          ? []
          : (sharing.get(`${p.latitude},${p.longitude}`) ?? []).filter((id) => id !== club.id).map((id) => nameOf.get(id) ?? id)
        lines.push(`   Place ${n + 1}: ${p.name}, ${point(p)}${others.length ? `, the same pin as ${others.join(' and ')}` : ''}`)
      }
      lines.push(`   Told: ${told(club.told_updated_at, club.told_by)}`)
    }
    return `${lines.join('\n')}\n`
  } finally {
    db.close()
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const args = process.argv.slice(2)
  const refusal = sheetRefusal(args)
  if (refusal) {
    console.error(refusal)
    process.exitCode = 1
  } else {
    try {
      process.stdout.write(clubSeedSheet(args[0] ? resolve(args[0]) : DEFAULT_OUT))
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    }
  }
}
