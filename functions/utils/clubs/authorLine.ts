// functions/utils/clubs/authorLine.ts
//
// The told line a club page writes under the club's meeting words (the
// brief's "When and where"), built here on the server and answered as words
// alone.
//
// The line reads "Last checked {month}", the month in words with its year,
// as "Last checked November 2026" (K's decision 12, which replaced the
// brief's two forms of the line and the rule that a public page shows no
// month of a check). The month is that of the later of the listing's last
// save, told_updated_at (functions/utils/clubs/save.ts), and its last Still
// accurate, last_confirmed_at (functions/utils/clubs/stillAccurate.ts), each
// read in Central time as monthInWords reads a stored stamp. A value that is
// no date is set aside; with no date left there is no line, and the answer
// carries an empty string. The time of the request never enters it.
//
// told_updated_at counts as a save only when a save made it: a save sets it
// with told_by and last_confirmed_at, while migration 0067 stamps it on every
// club with neither. A stamp with no saver and no check is not a save, as
// YourClubPage's last save and My region's cards already read it. A saver
// whose account is later deleted loses told_by but keeps last_confirmed_at,
// so that save still counts.
//
// Who keeps a club is not on the page or in its answer (K's decision 12):
// this file once built that line too, and no longer does.

import { monthInWords } from '../../../domain/clubs/monthlyCheck'
import { zonedParts } from '../../../domain/format/date'

/** A stored stamp's month as one number that grows with time, read as monthInWords reads it; null for none or a value that is no date. */
function monthNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parts = zonedParts(value, { stored: 'utc' })
  return parts ? parts.year * 12 + (parts.month - 1) : null
}

/**
 * The told line's words from the last save and the last Still accurate:
 * "Last checked {month}" with the month of the later of the two, or an
 * empty string when neither is a date.
 */
export function toldWords(saved: string | null | undefined, checked: string | null | undefined): string {
  const savedMonth = monthNumber(saved)
  const checkedMonth = monthNumber(checked)
  if (savedMonth === null && checkedMonth === null) return ''
  const later = checkedMonth === null || (savedMonth !== null && savedMonth >= checkedMonth) ? saved : checked
  const month = monthInWords(later)
  return month ? `Last checked ${month}` : ''
}

/** The club's told line, from the two stamps its row holds; a told_updated_at with no saver and no check is set aside. */
export function clubToldLine(club: { told_updated_at: string | null; told_by: string | null; last_confirmed_at: string | null }): string {
  const saved = club.told_by || club.last_confirmed_at ? club.told_updated_at : null
  return toldWords(saved, club.last_confirmed_at)
}
