// src/lib/serverTime.ts
//
// The database stamps rows with SQLite's datetime('now'): UTC, written as
// "2026-10-04 21:05:00" with no zone. A browser reads that shape as local
// time, which showed every stamp five or six hours late in Louisiana. Say
// that it is UTC before parsing. A value that carries its own zone passes
// through unchanged.

export function serverTime(value: string): Date {
  const bare = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
  return new Date(bare ? `${value.replace(' ', 'T')}Z` : value)
}
