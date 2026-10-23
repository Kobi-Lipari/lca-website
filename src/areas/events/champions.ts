// src/areas/events/champions.ts
//
// The honor roll's shapes: reading pasted champion lines (Admin → State
// champions), and turning one row per win into one entry per person, which
// is how the public page lists them.

import type { ApiChampion } from './api'

/** Which list a row is on: the state championship or the scholastic sections. */
export type ChampionKind = ApiChampion['kind']

export interface PastedChampion { year: number; title: string; champion: string; notes: string | null }

/** "2019, Louisiana State Champion, Jane Doe, co-champion" → a row; tabs work too (pasted from a spreadsheet). */
export function parsePasted(text: string): { rows: PastedChampion[]; bad: number[] } {
  const rows: PastedChampion[] = []
  const bad: number[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return
    const parts = (line.includes('\t') ? line.split('\t') : line.split(',')).map((p) => p.trim())
    const [year, title, champion, ...rest] = parts
    if (!/^\d{4}$/.test(year ?? '') || !title || !champion) { bad.push(i + 1); return }
    rows.push({ year: Number(year), title, champion, notes: rest.join(', ') || null })
  })
  return { rows, bad }
}

/** One win: a year, the title or section it was won in, and whether it was shared. */
export interface ChampionWin {
  id: string
  year: number
  title: string
  notes: string | null
  /** True when another person holds the same year and title: a tie. */
  shared: boolean
  tournamentId: string | null
  tournamentName: string | null
}

/** One person on the honor roll, placed at the year they first won. */
export interface ChampionEntry {
  /** A stable anchor for the entry: the list and the person's name as a slug. */
  anchor: string
  name: string
  firstYear: number
  lastYear: number
  photoUrl: string | null
  /** Every win, newest first. */
  wins: ChampionWin[]
}

/** "Rene' Phillips" → "rene-phillips": the key that joins a person's wins and names their anchor. */
export function personSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * One entry per person, newest first winner at the top: each person sits at
 * the year of their FIRST win, so a champion who kept winning is listed once,
 * where their story starts, with every later win under their name. Ties
 * are marked on the win, not split into more entries.
 */
export function groupByPerson(rows: ApiChampion[], kind: ChampionKind): ChampionEntry[] {
  const mine = rows.filter((r) => r.kind === kind)
  const holders = new Map<string, number>()
  for (const r of mine) {
    const key = `${r.year}\u0000${r.title}`
    holders.set(key, (holders.get(key) ?? 0) + 1)
  }
  const byPerson = new Map<string, ChampionEntry>()
  for (const r of mine) {
    const slug = personSlug(r.champion)
    const win: ChampionWin = {
      id: r.id,
      year: r.year,
      title: r.title,
      notes: r.notes,
      shared: (holders.get(`${r.year}\u0000${r.title}`) ?? 0) > 1,
      tournamentId: r.tournament_id,
      tournamentName: r.tournament_name,
    }
    const entry = byPerson.get(slug)
    if (!entry) {
      byPerson.set(slug, {
        anchor: `${kind}-${slug}`,
        name: r.champion,
        firstYear: r.year,
        lastYear: r.year,
        photoUrl: r.photo_url,
        wins: [win],
      })
      continue
    }
    entry.wins.push(win)
    entry.firstYear = Math.min(entry.firstYear, r.year)
    entry.lastYear = Math.max(entry.lastYear, r.year)
    // The newest photo on file is the one shown.
    if (r.photo_url && (!entry.photoUrl || r.year >= Math.max(...entry.wins.filter((w) => w.id !== r.id).map((w) => w.year)))) {
      entry.photoUrl = r.photo_url
    }
  }
  const entries = [...byPerson.values()]
  for (const e of entries) e.wins.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
  return entries.sort((a, b) => b.firstYear - a.firstYear || a.name.localeCompare(b.name))
}

/** Every year with a winner on this list, newest first. */
export function yearsWon(rows: ApiChampion[], kind: ChampionKind): number[] {
  return [...new Set(rows.filter((r) => r.kind === kind).map((r) => r.year))].sort((a, b) => b - a)
}

/** The winners of one year on one list, by title, each pointing at the person's entry. */
export function winnersOfYear(rows: ApiChampion[], kind: ChampionKind, year: number): Array<{ title: string; name: string; anchor: string; notes: string | null }> {
  return rows
    .filter((r) => r.kind === kind && r.year === year)
    .sort((a, b) => a.title.localeCompare(b.title) || a.champion.localeCompare(b.champion))
    .map((r) => ({ title: r.title, name: r.champion, anchor: `${kind}-${personSlug(r.champion)}`, notes: r.notes }))
}
