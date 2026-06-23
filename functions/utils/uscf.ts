// functions/utils/uscf.ts

const RATING_CACHE_MS = 7 * 24 * 60 * 60 * 1000
const MSA_BASE = 'https://www.uschess.org/msa'
const PLAYER_SEARCH_URL = 'https://www.uschess.org/datapage/player-search.php'

export interface UscfPlayer {
  uscfId: string
  firstName: string
  lastName: string
  fullName: string
  rating: number | null
  ratingType: string | null
  isProvisional: boolean
  expirationDate: string | null
  state: string | null
  status: string | null
}

export interface UscfSearchResult {
  players: UscfPlayer[]
  scraperDown?: boolean
}

export interface UscfLookupResult {
  uscfId: string
  rating: number | null
  name: string | null
}

export function isRatingCacheStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true
  const updated = Date.parse(updatedAt)
  if (Number.isNaN(updated)) return true
  return Date.now() - updated > RATING_CACHE_MS
}

export async function fetchUscfById(
  uscfId: string,
): Promise<{ player: UscfPlayer | null; scraperDown: boolean }> {
  const normalizedId = uscfId.trim()
  if (!/^\d+$/.test(normalizedId)) return { player: null, scraperDown: false }

  try {
    const response = await fetch(
      `${MSA_BASE}/MbrDtlMain.php?${encodeURIComponent(normalizedId)}`,
      {
        headers: { 'User-Agent': 'LouisianaChessAssociation/1.0' },
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!response.ok) return { player: null, scraperDown: true }

    const html = await response.text()

    if (html.includes('No such member') || html.includes('Invalid member')) {
      return { player: null, scraperDown: false }
    }

    // Name
    const nameMatch =
      html.match(/Name:\s*<\/[^>]+>\s*([^<\n]+)/i) ??
      html.match(/<title>\s*([^<|]+)/i)
    const fullName = nameMatch ? nameMatch[1].trim() : null

    // Split "LAST, FIRST" format MSA uses
    let firstName = ''
    let lastName = ''
    if (fullName) {
      const parts = fullName.split(',')
      lastName = parts[0]?.trim() ?? fullName
      firstName = parts[1]?.trim() ?? ''
    }

    // Rating
    const ratingMatch =
      html.match(/Regular\s+Rating[^0-9]*(\d{3,4})/i) ??
      html.match(/Rating[^0-9]*(\d{3,4})/i)
    const rating = ratingMatch ? Number(ratingMatch[1]) : null

    // Provisional flag
    const isProvisional = /provisional/i.test(html)

    // Expiration date — MSA shows "Expires: MM/DD/YYYY" or "Expiration Date: ..."
    const expiryMatch =
      html.match(/Expir(?:es|ation Date)[^0-9]*(\d{1,2}\/\d{1,2}\/\d{4})/i) ??
      html.match(/Expir(?:es|ation Date)[^0-9]*(\d{4}-\d{2}-\d{2})/i)
    const expirationDate = expiryMatch ? expiryMatch[1] : null

    // State — MSA shows state code in member details
    const stateMatch = html.match(/State:\s*<\/[^>]+>\s*([A-Z]{2})/i)
    const state = stateMatch ? stateMatch[1] : null

    // Active/expired status
    const status = expirationDate
      ? new Date(expirationDate) >= new Date()
        ? 'Active'
        : 'Expired'
      : null

    const player: UscfPlayer = {
      uscfId: normalizedId,
      firstName,
      lastName,
      fullName: firstName ? `${firstName} ${lastName}` : lastName,
      rating,
      ratingType: rating ? 'Regular' : null,
      isProvisional,
      expirationDate,
      state,
      status,
    }

    return { player, scraperDown: false }
  } catch {
    return { player: null, scraperDown: true }
  }
}

export async function searchUscfByName(
  lastName: string,
  firstName?: string,
): Promise<UscfSearchResult> {
  // MSA prefers "Last, First" format
  const query = firstName
    ? `${lastName.trim()}, ${firstName.trim()}`
    : lastName.trim()

  try {
    const url = `${PLAYER_SEARCH_URL}?name=${encodeURIComponent(query)}&state=&rating=&order=alpha`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LouisianaChessAssociation/1.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return { players: [], scraperDown: true }

    const html = await response.text()

    // Each result row links to MbrDtlMain.php?ID and contains name, state, rating, expiry
    const rowRegex =
      /MbrDtlMain\.php\?(\d+)[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/gi

    const players: UscfPlayer[] = []
    let match: RegExpExecArray | null

    while ((match = rowRegex.exec(html)) !== null && players.length < 20) {
      const uscfId = match[1].trim()
      const rawName = match[2].trim()
      const state = match[3].trim() || null
      const ratingRaw = match[4].trim()
      const expirationDate = match[5].trim() || null

      // MSA name format is "LAST, FIRST"
      const nameParts = rawName.split(',')
      const last = nameParts[0]?.trim() ?? ''
      const first = nameParts[1]?.trim() ?? ''
      const fullName = first ? `${first} ${last}` : last

      const rating =
        ratingRaw && /^\d+$/.test(ratingRaw) ? Number(ratingRaw) : null

      const status = expirationDate
        ? new Date(expirationDate) >= new Date()
          ? 'Active'
          : 'Expired'
        : null

      players.push({
        uscfId,
        firstName: first,
        lastName: last,
        fullName,
        rating,
        ratingType: rating ? 'Regular' : null,
        isProvisional: false,
        expirationDate,
        state,
        status,
      })
    }

    return { players, scraperDown: false }
  } catch {
    return { players: [], scraperDown: true }
  }
}

// Legacy-compatible — keeps existing callers working unchanged
export async function fetchUscfRatingFromWeb(
  uscfId: string,
): Promise<UscfLookupResult> {
  const { player } = await fetchUscfById(uscfId)
  return {
    uscfId,
    rating: player?.rating ?? null,
    name: player?.fullName ?? null,
  }
}

export async function refreshMemberUscfRating(
  db: D1Database,
  memberId: string,
  uscfId: string,
): Promise<number | null> {
  const lookup = await fetchUscfRatingFromWeb(uscfId)
  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE members SET uscf_rating = ?, uscf_rating_updated_at = ? WHERE id = ?`,
    )
    .bind(lookup.rating, now, memberId)
    .run()
  return lookup.rating
}