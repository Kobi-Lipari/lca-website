// test/unit/helpers/heritageAnswers.ts
//
// Made-up answers for the requests the six heritage pages make (WS01 step
// 31), kept apart from the pages themselves so a test's mock of @/lib/api
// can import them without importing a page, which imports @/lib/api back.
// Every name and date here is made up.
import type { ApiBoardMember, ApiBoardSeat, ApiChampion, ApiChampionshipEvent, ApiGovernanceDocument } from '@/lib/api'

const seat = (id: string, role: string, category: ApiBoardSeat['category'], name: string, sort: number): ApiBoardSeat => ({
  id, slug: id, role, category, sort_order: sort, is_shared: 0, holder_name: name, holder_count: name === 'TBD' ? 0 : 1, photo_url: null,
  holders: name === 'TBD' ? [] : [{ member_id: `m-${id}`, name, photo_url: null }],
})

/** Two officers and two representatives, one seat open. */
export const SEATS: ApiBoardSeat[] = [
  seat('fx-president', 'President', 'officer', 'Player One', 1),
  seat('fx-treasurer', 'Treasurer', 'officer', 'Player Two', 2),
  seat('fx-rep-north', 'North Representative', 'regional_rep', 'Player Three', 3),
  seat('fx-rep-south', 'South Representative', 'regional_rep', 'TBD', 4),
]

export const MEMBERS: ApiBoardMember[] = SEATS.map((s) => ({
  id: s.id, role: s.role, name: s.holder_name, email: null, sort_order: s.sort_order, created_at: '2026-01-05T12:00:00Z', slug: s.slug, category: s.category, is_active: 1,
}))

const doc = (id: string, category: ApiGovernanceDocument['category'], title: string, content: string | null): ApiGovernanceDocument => ({
  id, category, title, filename: content ? null : `${id}.pdf`, file_url: null, doc_date: '2026-09-06', year: 2026, created_at: '2026-09-07T12:00:00Z', content,
})

/** One list with a written document, one with a file only, and the rest empty. */
export const DOCUMENTS: Partial<Record<ApiGovernanceDocument['category'], ApiGovernanceDocument[]>> = {
  bylaws: [doc('fx-bylaws', 'bylaws', 'Fixture bylaws', '<p>Article I. The name of the association.</p>')],
  minutes: [doc('fx-minutes', 'minutes', 'Fixture board meeting', '<p>The board met at 7:00 PM.</p>')],
  treasurer: [doc('fx-report', 'treasurer', 'Fixture treasurer\'s report', null)],
}

const champion = (id: string, year: number, title: string, name: string, kind: ApiChampion['kind'] = 'state'): ApiChampion => ({ id, year, title, champion: name, notes: null, tournament_id: null, tournament_name: null, kind, photo_url: null })

export const CHAMPIONS: { champions: ApiChampion[]; upcoming: ApiChampionshipEvent[] } = {
  champions: [
    champion('fx-c1', 2026, 'State Champion', 'Player One'),
    champion('fx-c2', 2025, 'State Champion', 'Player Two'),
    champion('fx-c3', 2026, 'Scholastic Champion', 'Player Three', 'scholastic'),
  ],
  upcoming: [{ id: 'fx-t-state', name: 'Fixture State Championship', date: '2026-11-07', end_date: '2026-11-08', location: 'Fixture City', status: 'upcoming' as ApiChampionshipEvent['status'] }],
}

/** The answers the pages ask for, as @/lib/api would give them. */
export const heritageApi = {
  getBoardSeats: async () => SEATS,
  getBoardMembers: async () => MEMBERS,
  getGovernanceDocuments: async (category: ApiGovernanceDocument['category']) => DOCUMENTS[category] ?? [],
  getChampions: async () => CHAMPIONS,
}
