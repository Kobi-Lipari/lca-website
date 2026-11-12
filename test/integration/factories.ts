// test/integration/factories.ts
import { env } from 'cloudflare:test'
import { getDb } from '../../functions/db/client'
import { saveSections } from '../../functions/utils/events/sectionsRepo'
import { normalizeLegacySections } from '../../domain/events/sections'

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}-${Date.now().toString(36)}`

export interface SeedMemberOptions {
  id?: string
  role?: string
  fullName?: string
  email?: string
  uscfId?: string | null
  uscfRating?: number | null
  membershipStatus?: string
  clubId?: string | null
}

export async function seedMember(opts: SeedMemberOptions = {}): Promise<string> {
  const id = opts.id ?? nextId('mem')
  await env.DB.prepare(
    `INSERT INTO members (id, email, full_name, uscf_id, uscf_rating, membership_status, role, club_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    opts.email ?? `${id}@test.lca`,
    opts.fullName ?? `Member ${id}`,
    opts.uscfId ?? null,
    opts.uscfRating ?? null,
    opts.membershipStatus ?? 'active',
    opts.role ?? 'member',
    opts.clubId ?? null,
  ).run()
  return id
}

export const seedAdmin = () => seedMember({ role: 'lca_admin' })
export const seedDirector = () => seedMember({ role: 'tournament_director' })

export async function seedClub(opts: { id?: string; name?: string; city?: string } = {}): Promise<string> {
  const id = opts.id ?? nextId('club')
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city) VALUES (?, ?, ?)`,
  ).bind(id, opts.name ?? `Club ${id}`, opts.city ?? 'Baton Rouge').run()
  return id
}

export interface SeedTournamentOptions {
  id?: string
  name?: string
  date?: string
  sections?: Array<{ name: string; entryFee: number; [rule: string]: unknown }>
  entryFee?: number
  rounds?: number
  maxPlayers?: number | null
  status?: 'upcoming' | 'active' | 'completed'
  registrationStatus?: 'draft' | 'open' | 'closed'
  registrationClosesAt?: string | null
  isRated?: boolean
  isVisible?: boolean
  clubId?: string | null
  /** The member written as the event's creator (created_by); none by default. */
  createdBy?: string | null
}

/**
 * A tournament, with its sections written the way the admin endpoints write
 * them: the row first, then the one section writer (sectionsRepo), which
 * adds the section rows and the legacy JSON together. Plain string sections
 * are taken as names.
 */
export async function seedTournament(opts: SeedTournamentOptions = {}): Promise<string> {
  const id = opts.id ?? nextId('tour')
  const sections = opts.sections ?? [
    { name: 'Open', entryFee: opts.entryFee ?? 25 },
    { name: 'U1200', entryFee: 0 },
  ]
  await env.DB.prepare(
    `INSERT INTO tournaments
       (id, name, location, date, entry_fee, rounds, max_players,
        status, registration_status, registration_closes_at, is_rated, is_visible, club_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    opts.name ?? `Tournament ${id}`,
    'Kenner, LA',
    opts.date ?? '2026-09-12',
    opts.entryFee ?? 25,
    opts.rounds ?? 4,
    opts.maxPlayers ?? null,
    opts.status ?? 'upcoming',
    opts.registrationStatus ?? 'open',
    opts.registrationClosesAt ?? null,
    opts.isRated ? 1 : 0,
    opts.isVisible === false ? 0 : 1,
    opts.clubId ?? null,
    opts.createdBy ?? null,
  ).run()
  const saved = await saveSections(getDb(env.DB), id, normalizeLegacySections(sections), { reportSettings: null })
  if (!saved.ok) throw new Error(`seedTournament: ${saved.error}`)
  return id
}

export async function seedRegistration(opts: {
  tournamentId: string
  memberId: string
  section?: string
  paymentStatus?: 'pending' | 'paid' | 'refunded'
  byeRounds?: number[]
}): Promise<string> {
  const id = nextId('reg')
  await env.DB.prepare(
    `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, bye_rounds)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    opts.tournamentId,
    opts.memberId,
    opts.section ?? 'Open',
    opts.paymentStatus ?? 'paid',
    opts.byeRounds && opts.byeRounds.length > 0 ? JSON.stringify(opts.byeRounds) : null,
  ).run()
  return id
}

export interface SeedMailContactOptions {
  /** The address, as mail_contacts keeps it: trimmed and lowercased. */
  address: string
  /** When the person stopped all optional mail; not stopped by default. */
  optionalOffAt?: string | null
  /** When a spam report marked the address; never by default. */
  complainedAt?: string | null
  /** The person's choices by list id, each from the source given ('link' by default), written at the time given or now. */
  choices?: Record<string, { choice: 'in' | 'out'; source?: string; at?: string }>
}

/**
 * A mail contact as WS16's tables hold one (migration 0060): one row per address, a member's or not, with its id of
 * 32 random hex characters, its marks and its choices.
 */
export async function seedMailContact(opts: SeedMailContactOptions): Promise<string> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
  await env.DB.prepare(
    `INSERT INTO mail_contacts (id, address, optional_off_at, complained_at) VALUES (?, ?, ?, ?)`,
  ).bind(id, opts.address, opts.optionalOffAt ?? null, opts.complainedAt ?? null).run()
  for (const [listId, c] of Object.entries(opts.choices ?? {})) {
    await env.DB.prepare(
      `INSERT INTO mail_list_choices (contact_id, list_id, choice, source, updated_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`,
    ).bind(id, listId, c.choice, c.source ?? 'link', c.at ?? null).run()
  }
  return id
}

export async function seedTournamentDirector(
  tournamentId: string,
  memberId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO tournament_directors (tournament_id, member_id) VALUES (?, ?)`,
  ).bind(tournamentId, memberId).run()
}

/**
 * Gives the member a current term on the President seat, the board_members
 * row whose slug is 'president' (migration 0025 derives it from the seat
 * 0011 seeds): one board_seat_assignments row with no end. It adds that term
 * and ends none, unlike the seats page, which ends the sitting holder's term
 * before seating someone on an unshared seat, so a test that models a
 * handover ends the old term itself. The seat's row is added, active, if the
 * database lacks it. holdsPresidentSeat in functions/utils/events/creation.ts
 * reads the same.
 */
export async function seedPresident(memberId: string): Promise<void> {
  let seat = await env.DB.prepare(`SELECT id FROM board_members WHERE slug = 'president'`).first<{ id: string }>()
  if (!seat) {
    seat = { id: nextId('seat') }
    await env.DB.prepare(
      `INSERT INTO board_members (id, role, name, slug, category, is_active) VALUES (?, 'President', 'TBD', 'president', 'officer', 1)`,
    ).bind(seat.id).run()
  }
  await env.DB.prepare(
    `INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES (?, ?, ?, datetime('now'))`,
  ).bind(nextId('term'), seat.id, memberId).run()
}

export interface SeedSeatOptions {
  /** The seat's link name, unique among seats (idx_board_members_slug), written exactly as given. */
  slug: string
  /** The seat's title, as the public Board page shows it; a plainly made-up one by default. */
  role?: string
  /** Whether the seat is active; it is by default. */
  isActive?: boolean
}

/**
 * A board seat with the link name given, and a current term on it for each
 * member given, started now with no end: the columns
 * test/integration/nav-personas.test.ts writes, as the seat screens add a
 * seat (functions/api/governance/board.ts) and start a term
 * (functions/api/admin/board-seats.ts). A term is ended as those screens end
 * one, UPDATE board_seat_assignments SET ended_at = datetime('now'). Answers
 * the seat's id.
 */
export async function seedSeat(opts: SeedSeatOptions, holders: string[] = []): Promise<string> {
  const id = nextId('seat')
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active, is_shared) VALUES (?, ?, ?, ?, ?, 'officer', ?, 0)`,
  ).bind(id, opts.role ?? 'Sample seat', 'Player One', 900, opts.slug, opts.isActive === false ? 0 : 1).run()
  for (const memberId of holders) {
    await env.DB.prepare(
      `INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES (?, ?, ?, datetime('now'))`,
    ).bind(nextId('term'), id, memberId).run()
  }
  return id
}