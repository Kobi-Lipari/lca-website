// src/areas/clubs/region.ts
//
// What My region's page (WS09 step 11, src/pages/MyRegionPage.tsx) works
// out from the server's answer without reading a clock: which clubs Confirm
// all marks, the answer once one club is marked, the words of the counts and
// of a run of Confirm all, and the browser's memory that the page's Help has
// opened by itself once. Every date and month the page shows comes from the
// server as words (lastCheckWords, thisMonth.nextCheck.date), so nothing
// here makes a date.
import type { ClubConfirmResponse, RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

/**
 * The clubs Confirm all marks, in the cards' order: each that needs a check
 * and has no open item. A card with an open item waits for its answer first,
 * once later steps give the list its rows.
 */
export function clubsToConfirm(clubs: readonly RegionClub[]): RegionClub[] {
  return clubs.filter((club) => club.needsCheck && club.openItems.length === 0)
}

/**
 * The answer once one club has been marked still accurate: its card takes
 * the stamp and the words the confirm answered, in the same place in the
 * list, and the bar's counts follow, a club that needed a check moving from
 * not checked to checked. Every other card is as it was.
 */
export function withConfirmed(answer: WorkspaceRegionResponse, confirmed: ClubConfirmResponse): WorkspaceRegionResponse {
  const before = answer.clubs.find((club) => club.id === confirmed.id)
  if (!before) return answer
  const moved = before.needsCheck ? 1 : 0
  return {
    ...answer,
    clubs: answer.clubs.map((club) => (club.id === confirmed.id
      ? { ...club, lastConfirmedAt: confirmed.lastConfirmedAt, lastCheckWords: confirmed.lastCheckWords, needsCheck: false }
      : club)),
    thisMonth: {
      ...answer.thisMonth,
      checked: answer.thisMonth.checked + moved,
      notChecked: Math.max(0, answer.thisMonth.notChecked - moved),
    },
  }
}

/**
 * A club's initials for its card when it has no logo, by the rule the
 * editor's share preview keeps (clubInitials in previews.ts, which only the
 * editor's own chunk may load): the first letter of each of the first two
 * words, or the first two letters of a name of one word, in capitals.
 */
export function initialsOf(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? [...words[0]].slice(0, 2).join('') : words.slice(0, 2).map((w) => [...w][0]).join('')
  return letters.toUpperCase()
}

/** "1 club" or "4 clubs". */
export function clubsWord(n: number): string {
  return `${n} ${n === 1 ? 'club' : 'clubs'}`
}

/** Names in a sentence: "A", "A and B", "A, B and C". */
export function namesInWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** What a run of Confirm all says once it is done: how many were marked and, if any were not, which by name. */
export function confirmAllWords(marked: number, failed: readonly string[]): string {
  const asked = marked + failed.length
  if (failed.length === 0) return `${clubsWord(marked)} marked still accurate.`
  const left = `Not marked: ${namesInWords(failed)}. ${failed.length === 1 ? 'It is' : 'They are'} as ${failed.length === 1 ? 'it was' : 'they were'}.`
  if (marked === 0) return `None of the ${clubsWord(asked)} could be marked still accurate. ${left}`
  return `${marked} of ${clubsWord(asked)} marked still accurate. ${left}`
}

/** The words of an error, as a sentence. */
export function errorWords(err: unknown): string {
  const text = err instanceof Error && err.message.trim() ? err.message.trim() : 'The server did not answer'
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/** The id of the part My region's Help opens, which its button controls. */
export const REGION_HELP_ID = 'my-region-help'

/** The one key My region keeps in the browser: that its Help has opened by itself once. The editor keeps its own. */
export const REGION_HELP_SHOWN_KEY = 'lca-my-region-help'

/**
 * Whether My region's Help has opened by itself in this browser before. As
 * the editor's Help reads its own key, a browser whose storage cannot be
 * read at all reads as yes, so Help opens from its button alone there.
 */
export function regionHelpShownBefore(): boolean {
  try {
    return window.localStorage.getItem(REGION_HELP_SHOWN_KEY) !== null
  } catch {
    return true
  }
}

export function rememberRegionHelpShown(): void {
  try {
    window.localStorage.setItem(REGION_HELP_SHOWN_KEY, 'shown')
  } catch {
    // Nothing is kept: where storage can still be read, Help opens by itself on the next visit too.
  }
}
