// functions/utils/champions.ts — validation shared by the champions endpoints.

export interface ChampionInput {
  year?: number | string
  title?: string
  champion?: string
  notes?: string | null
  tournamentId?: string | null
}

export function cleanChampion(r: ChampionInput): { ok: true; row: { year: number; title: string; champion: string; notes: string | null; tournamentId: string | null } } | { ok: false; error: string } {
  const year = Number(r.year)
  const thisYear = new Date().getFullYear()
  if (!Number.isInteger(year) || year < 1900 || year > thisYear + 1) return { ok: false, error: `Year must be between 1900 and ${thisYear + 1}` }
  const title = (r.title ?? '').trim().slice(0, 100)
  const champion = (r.champion ?? '').trim().slice(0, 200)
  if (!title) return { ok: false, error: 'Title is required (e.g. Louisiana State Champion)' }
  if (!champion) return { ok: false, error: 'Champion is required' }
  const notes = (r.notes ?? '').trim().slice(0, 300) || null
  return { ok: true, row: { year, title, champion, notes, tournamentId: r.tournamentId || null } }
}
