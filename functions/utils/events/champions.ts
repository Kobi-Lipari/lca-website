// functions/utils/events/champions.ts — validation shared by the champions endpoints.

export const CHAMPION_KINDS = ['state', 'scholastic'] as const
export type ChampionKind = (typeof CHAMPION_KINDS)[number]

export interface ChampionInput {
  year?: number | string
  title?: string
  champion?: string
  notes?: string | null
  tournamentId?: string | null
  /** Which list: 'state' (default) or 'scholastic'. */
  kind?: string | null
  /** A photo of the champion: a path on this site (/champions/photos/...) or an https address. */
  photoUrl?: string | null
}

export interface CleanChampion {
  year: number
  title: string
  champion: string
  notes: string | null
  tournamentId: string | null
  kind: ChampionKind
  photoUrl: string | null
}

export function cleanChampion(r: ChampionInput): { ok: true; row: CleanChampion } | { ok: false; error: string } {
  const year = Number(r.year)
  const thisYear = new Date().getFullYear()
  if (!Number.isInteger(year) || year < 1900 || year > thisYear + 1) return { ok: false, error: `Year must be between 1900 and ${thisYear + 1}` }
  const title = (r.title ?? '').trim().slice(0, 100)
  const champion = (r.champion ?? '').trim().slice(0, 200)
  if (!title) return { ok: false, error: 'Title is required (e.g. Louisiana State Champion)' }
  if (!champion) return { ok: false, error: 'Champion is required' }
  const notes = (r.notes ?? '').trim().slice(0, 300) || null
  const kind = (r.kind ?? 'state').trim() || 'state'
  if (!(CHAMPION_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'List must be state or scholastic' }
  const photoUrl = (r.photoUrl ?? '').trim() || null
  if (photoUrl && (photoUrl.length > 500 || !/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(photoUrl))) {
    return { ok: false, error: 'Photo must be a path on this site (/champions/photos/name.jpg) or an https address' }
  }
  return { ok: true, row: { year, title, champion, notes, tournamentId: r.tournamentId || null, kind: kind as ChampionKind, photoUrl } }
}
