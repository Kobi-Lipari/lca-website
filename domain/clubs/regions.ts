// domain/clubs/regions.ts
//
// The LCA's club regions. A club belongs to one; a regional representative's
// board seat covers one or more, and the seat's holder manages every club in
// them. This is the one definition; functions/utils/regions.ts and
// src/lib/regions.ts re-export it.
export const REGIONS = [
  'North Louisiana',
  'Central Louisiana',
  'North of Lake Pontchartrain',
  'New Orleans Metro',
  'Southwest Louisiana',
  'South Central Louisiana',
  'Bayou Region',
] as const

export type Region = (typeof REGIONS)[number]

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (REGIONS as readonly string[]).includes(value)
}
