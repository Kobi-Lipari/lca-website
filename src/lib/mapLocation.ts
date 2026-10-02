// src/lib/mapLocation.ts
//
// Reading a map location out of whatever someone pastes on a club's admin
// page.

export type LatLng = { lat: number; lng: number }

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Coordinates out of whatever someone pastes: "30.45, -91.18", a Google Maps
 * link with @30.45,-91.18 or ?q=30.45,-91.18 in it, or the !3d…!4d… form
 * Google uses for a place's own link.
 */
export function parseLocation(text: string): LatLng | null {
  const t = text.trim()
  if (!t) return null
  const pair = (a: string, b: string): LatLng | null => {
    const lat = Number(a)
    const lng = Number(b)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
    return { lat: round6(lat), lng: round6(lng) }
  }
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)'
  const place = t.match(new RegExp(`!3d${num}!4d${num}`))
  if (place) return pair(place[1], place[2])
  const at = t.match(new RegExp(`@${num},\\s*${num}`))
  if (at) return pair(at[1], at[2])
  const query = t.match(new RegExp(`[?&](?:q|query|ll|destination)=${num}(?:,|%2C)\\s*${num}`, 'i'))
  if (query) return pair(query[1], query[2])
  const plain = t.match(new RegExp(`^${num}\\s*[,\\s]\\s*${num}$`))
  if (plain) return pair(plain[1], plain[2])
  return null
}
