// src/areas/clubs/directoryRows.ts
//
// How the site tells the list's two answers apart (WS09 step 33). GET
// /api/clubs sends today's rows, or, with CLUB_PAGES_ON set on the server,
// the same rows with the directory's keys after them (WS09 step 32); the
// answer carries no flag, so a row is read by its keys. Plain code with no
// zod, so the site's bundle carries no schema.
import type { ClubDirectoryItem } from '@domain/contracts'

const textOrNull = (v: unknown) => v === null || typeof v === 'string'

/** Whether a point is two numbers, a latitude and a longitude. */
function isPoint(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return typeof p.latitude === 'number' && typeof p.longitude === 'number'
}

/** Whether a row of the list carries the directory's keys, each of its kind, as the server writes them with CLUB_PAGES_ON set. */
export function isDirectoryRow(row: unknown): row is ClubDirectoryItem {
  if (typeof row !== 'object' || row === null) return false
  const r = row as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.name === 'string' && typeof r.slug === 'string'
    && textOrNull(r.statement) && textOrNull(r.description)
    && (r.point === null || isPoint(r.point))
    && typeof r.weekend_play === 'boolean' && typeof r.scholastic_friendly === 'boolean'
}

/**
 * The list's rows as the directory's when every one has the directory's keys,
 * and null when the answer is today's, so the page draws today's Clubs page
 * whole. An empty list is taken as the directory's, since it has no row of
 * either shape.
 */
export function directoryRowsOf(rows: readonly unknown[]): ClubDirectoryItem[] | null {
  return rows.every(isDirectoryRow) ? [...rows] : null
}
