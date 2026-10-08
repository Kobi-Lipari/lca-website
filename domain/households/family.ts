// domain/households/family.ts
//
// Family membership rules that need no database. The queries that read and
// update family accounts (listChildren, canActFor, syncFamilyCoverage) stay
// in functions/utils/family.ts; src/lib/family.ts re-exports this file.

/** How many children one family membership covers, besides the adult who buys it. */
export const FAMILY_MEMBERSHIP_CHILDREN = 3
