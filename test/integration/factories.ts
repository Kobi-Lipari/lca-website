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
        status, registration_status, registration_closes_at, is_rated, is_visible, club_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

export async function seedTournamentDirector(
  tournamentId: string,
  memberId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO tournament_directors (tournament_id, member_id) VALUES (?, ?)`,
  ).bind(tournamentId, memberId).run()
}