// src/areas/live/api.ts
//
// The live area's calls to the site's API: pairings, results and the
// scoresheet scanner, with the game, pairing and standings types.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

import type { RawScan } from '@/lib/scanner/types'
import { authHeaders, handleResponse } from '@/lib/http'

export interface ApiTournamentPairing {
  id: string
  tournament_id: string
  round: number
  board: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
  white_name?: string
  black_name?: string
  white_rating?: number | null
  black_rating?: number | null
}

export interface ApiStanding {
  member_id: string
  full_name: string
  section: string
  rating: number | null
  score: number
  wins: number
  draws: number
  losses: number
  /** Place in the section; tied players share it. */
  place: number
  /** "3" or "3-5" for a shared place. */
  placeLabel: string
  tiebreaks: {
    modifiedMedian: number
    solkoff: number
    cumulative: number
    oppCumulative: number
    blacks: number
  }
}

export interface ApiTournamentGame {
  id: string
  tournament_id: string
  round: number
  board: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
  white_name?: string
  black_name?: string
}

export async function adminCreatePairings(
  tournamentId: string,
  body: {
    round: number
    section: string
    pairings: Array<{
      board?: number
      whiteMemberId?: string | null
      blackMemberId?: string | null
    }>
    confirmReplace?: boolean
  },
) {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/games`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<{ games: ApiTournamentGame[]; warnings: string[] }>(response)
}

export async function adminGeneratePairings(
  tournamentId: string,
  body: { round: number; section: string; onlyCheckedIn?: boolean; allowExtraRound?: boolean },
) {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/generate-pairings`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    },
  )
  return handleResponse<{
    round: number
    section: string
    pairings: ApiTournamentGame[]
    count: number
    /** Plain-language notes for the director (rematch, repeat bye, skipped players). */
    warnings: string[]
  }>(response)
}

export async function adminDeleteRoundPairings(
  tournamentId: string,
  round: number,
  section: string,
): Promise<{ deleted: number; round: number; section: string }> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/rounds/${round}?section=${encodeURIComponent(section)}`,
    {
      method: 'DELETE',
      headers: await authHeaders(),
    },
  )
  return handleResponse(response)
}

export async function adminUpdateGameResult(
  tournamentId: string,
  gameId: string,
  result: string,
) {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/games/${gameId}`,
    {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ result }),
    },
  )
  return handleResponse<{ game: ApiTournamentGame }>(response)
}

// ── Scoresheet scanner ─────────────────────────────────────────────

/** Send a photo already shrunk with downscaleImage (resizeImage.ts). */
export async function scanScoresheet(
  photo: Blob,
): Promise<{ scan: RawScan; scansLeftToday: number }> {
  const headers = await authHeaders()
  const response = await fetch('/api/scan', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': photo.type || 'image/jpeg' },
    body: photo,
  })
  return handleResponse(response)
}
