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

    // Name — MSA format: <font size=+1><b>31334465: KOBI LIPARI</b></font>
    const nameMatch = html.match(/<font size=\+1><b>\d+:\s*([^<]+)<\/b><\/font>/i)
    let fullName: string | null = nameMatch ? nameMatch[1].trim() : null

    // Capitalize: "KOBI LIPARI" → "Kobi Lipari"
    if (fullName) {
      fullName = fullName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }

    // MSA format is "LAST FIRST" — last word is the first name
    const nameParts = fullName ? fullName.split(' ') : []
    const firstName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const lastName = nameParts.length > 1
      ? nameParts.slice(0, -1).join(' ')
      : (nameParts[0] ?? '')

    // Rating
    const ratingMatch =
      html.match(/Regular\s+Rating[^0-9]*(\d{3,4})/i) ??
      html.match(/Rating[^0-9]*(\d{3,4})/i)
    const rating = ratingMatch ? Number(ratingMatch[1]) : null

    // Provisional flag
    const isProvisional = /provisional/i.test(html)

    // State — "State Ranking (LA)"
    const stateMatch = html.match(/State Ranking \(([A-Z]{2})\)/)
    const state = stateMatch ? stateMatch[1] : null

    // Expiration
    const expiryMatch =
      html.match(/Membership Expires?:?\s*<[^>]*>\s*([^<]+)/i) ??
      html.match(/Expir[^:]*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i)
    const expirationDate = expiryMatch ? expiryMatch[1].trim() : null

    const status = expirationDate
      ? new Date(expirationDate) >= new Date() ? 'Active' : 'Expired'
      : null

    const player: UscfPlayer = {
      uscfId: normalizedId,
      firstName,
      lastName,
      fullName: fullName ?? normalizedId,
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
  const query = firstName
    ? `${lastName.trim()}, ${firstName.trim()}`
    : lastName.trim()

  try {
    const url = `https://www.uschess.org/datapage/player-search.php?name=${encodeURIComponent(query)}&state=&rating=&order=alpha`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LouisianaChessAssociation/1.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return { players: [], scraperDown: true }

    const html = await response.text()

    if (!html.includes('Player Search Results')) {
      return { players: [], scraperDown: true }
    }

    // Each row: <tr><td valign=top>ID &nbsp;&nbsp;</td><td valign=top>RATING &nbsp;&nbsp;</td>
    // ... 5 more td's ... <td valign=top>STATE &nbsp;&nbsp;</td>
    // <td valign=top>EXPDATE &nbsp;&nbsp;</td>
    // <td valign=top><a href=...?ID >NAME</a></td></tr>
    const rowRegex = /<tr><td valign=top>(\d+)\s*&nbsp;&nbsp;\s*<\/td><td valign=top>([^<]*?)\s*&nbsp;&nbsp;\s*<\/td>(?:<td valign=top>[^<]*?<\/td>){5}<td valign=top>([A-Z]{2})\s*&nbsp;&nbsp;\s*<\/td><td valign=top>([^<]*?)\s*&nbsp;&nbsp;\s*<\/td><td valign=top><a href=[^>]+>([^<]+)<\/a><\/td>/gi

    const players: UscfPlayer[] = []
    let match: RegExpExecArray | null

    while ((match = rowRegex.exec(html)) !== null && players.length < 20) {
      const uscfId = match[1].trim()
      const ratingRaw = match[2].trim()
      const state = match[3].trim()
      const expirationDate = match[4].trim() === 'Non-Member' ? null : match[4].trim()
      const rawName = match[5].trim() // "LIPARI, KOBI"

      // Parse rating — strip provisional info like "1517" or "1150/4"
      const ratingNum = ratingRaw.match(/^(\d+)/)
      const rating = ratingNum ? Number(ratingNum[1]) : null

      // Parse name — MSA format "LAST, FIRST"
      const nameParts = rawName.split(',')
      const last = nameParts[0]?.trim() ?? ''
      const first = nameParts[1]?.trim() ?? ''

      // Capitalize properly
      const capitalize = (s: string) =>
        s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

      const lastName = capitalize(last)
      const firstName = capitalize(first)
      const fullName = firstName ? `${firstName} ${lastName}` : lastName

      const status = expirationDate
        ? new Date(expirationDate) >= new Date() ? 'Active' : 'Expired'
        : 'Non-Member'

      players.push({
        uscfId,
        firstName,
        lastName,
        fullName,
        rating,
        ratingType: rating ? 'Regular' : null,
        isProvisional: ratingRaw.includes('/'),
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