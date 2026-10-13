// src/areas/clubs/index.ts
//
// The clubs area's library code: club colours, the club map pins, reading a
// pasted map location, and the region rules from domain/clubs/regions (the
// same module src/lib/regions.ts re-exports). Re-exports this area's own
// modules and the shared region rules only, so importing it never pulls in
// another area.
export * from './clubColors'
export * from './clubMapData'
export * from './mapLocation'
export * from '@domain/clubs/regions'
