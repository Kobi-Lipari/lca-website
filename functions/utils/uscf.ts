const RATING_CACHE_MS = 7 * 24 * 60 * 60 * 1000

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

export async function fetchUscfRatingFromWeb(
  uscfId: string,
): Promise<UscfLookupResult> {
  const normalizedId = uscfId.trim()
  if (!/^\d+$/.test(normalizedId)) {
    return { uscfId: normalizedId, rating: null, name: null }
  }

  const response = await fetch(
    `https://www.uschess.org/msa/MbrDtlMain.php?USCF_ID=${encodeURIComponent(normalizedId)}`,
    {
      headers: {
        'User-Agent': 'LouisianaChessAssociation/1.0',
      },
    },
  )

  if (!response.ok) {
    return { uscfId: normalizedId, rating: null, name: null }
  }

  const html = await response.text()

  const ratingMatch =
    html.match(/Regular\s+Rating[^0-9]*(\d{3,4})/i) ??
    html.match(/Rating[^0-9]*(\d{3,4})/i)

  const nameMatch =
    html.match(/Name:\s*<\/[^>]+>\s*([^<\n]+)/i) ??
    html.match(/<title>\s*([^<|]+)/i)

  return {
    uscfId: normalizedId,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    name: nameMatch ? nameMatch[1].trim() : null,
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
