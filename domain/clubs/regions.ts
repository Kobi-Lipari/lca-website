// domain/clubs/regions.ts
//
// The LCA's club regions. A club belongs to one; a regional representative's
// board seat covers one or more, and the seat's holder manages every club in
// them. This is the one definition; functions/utils/regions.ts and
// src/lib/regions.ts re-export it.
//
// The five names are the titles of the five regional representatives' seats.
export const REGIONS = [
  'New Orleans Metro',
  'Baton Rouge / East Central',
  'Lafayette / South Central',
  'Lake Charles / Southwestern',
  'North Louisiana',
] as const

export type Region = (typeof REGIONS)[number]

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (REGIONS as readonly string[]).includes(value)
}
