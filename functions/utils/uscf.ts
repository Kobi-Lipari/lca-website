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

    // The ONLY reliable indicator the member exists is this exact pattern:
    // <font size=+1><b>31334465: KOBI LIPARI</b></font>
    // If the ID doesn't match, MSA shows a generic page without this line
    const nameMatch = html.match(
      new RegExp(`<font size=\\+1><b>${normalizedId}:\\s*([^<]+)<\\/b><\\/font>`, 'i')
    )

    if (!nameMatch) {
      // ID not found on MSA — not a valid USCF ID
      return { player: null, scraperDown: false }
    }

    let fullName: string | null = nameMatch[1].trim()

    // Capitalize: "KOBI LIPARI" → "Kobi Lipari"
    fullName = fullName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

    // MSA format is "LAST FIRST" — last word is first name
    const nameParts = fullName.split(' ')
    const firstName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const lastName = nameParts.length > 1
      ? nameParts.slice(0, -1).join(' ')
      : (nameParts[0] ?? '')

    // Rating — only match after confirmed valid member page
    const ratingMatch = html.match(/Regular\s+Rating[^0-9]*(\d{3,4})/i)
    const rating = ratingMatch ? Number(ratingMatch[1]) : null
    const isProvisional = /provisional/i.test(html)

    // State
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

    return {
      player: {
        uscfId: normalizedId,
        firstName,
        lastName,
        fullName,
        rating,
        ratingType: rating ? 'Regular' : null,
        isProvisional,
        expirationDate,
        state,
        status,
      },
      scraperDown: false,
    }
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

    // Parse each data row
    const rowMatches = html.match(/<tr><td valign=top>[\s\S]*?<\/tr>/gi) ?? []

    const capitalize = (s: string) =>
      s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

    const players: UscfPlayer[] = []

    for (const row of rowMatches) {
      const cells = row.match(/<td valign=top>([\s\S]*?)<\/td>/gi) ?? []
      if (cells.length < 10) continue

      const val = (i: number) =>
        cells[i].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()

      const uscfId = val(0)
      if (!/^\d+$/.test(uscfId)) continue // skip non-data rows

      const ratingRaw = val(1)
      const state = val(7)
      const expirationDate = val(8) === 'Non-Member' ? null : val(8)
      const rawName = val(9) // "LIPARI, KOBI"

      // Parse rating — strip provisional suffix like "1150/4"
      const ratingNum = ratingRaw.match(/^(\d+)/)
      const rating = ratingNum ? Number(ratingNum[1]) : null
      const isProvisional = ratingRaw.includes('/')

      // Parse name — "LAST, FIRST" or "LAST, FIRST MIDDLE"
      const commaIdx = rawName.indexOf(',')
      const last = commaIdx >= 0 ? rawName.slice(0, commaIdx).trim() : rawName
      const first = commaIdx >= 0 ? rawName.slice(commaIdx + 1).trim() : ''

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
        isProvisional,
        expirationDate,
        state,
        status,
      })

      if (players.length >= 20) break
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