// src/areas/clubs/index.ts
//
// The clubs area's library code: club colours, the club map pins, what the
// club maps share (their style, the whole-state view, a club's spot, the
// directions link and the Maps script loader), reading a pasted map
// location, and the region rules from domain/clubs/regions (the same module
// src/lib/regions.ts re-exports). Re-exports this area's own modules and the
// shared region rules only, so importing it never pulls in another area.
export * from './clubColors'
export * from './clubMap'
export * from './clubMapData'
export * from './mapLocation'
export * from '@domain/clubs/regions'
