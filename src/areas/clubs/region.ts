// src/areas/clubs/region.ts
//
// What My region's page (WS09 step 11, src/pages/MyRegionPage.tsx) works
// out from the server's answer without reading a clock: which clubs Confirm
// all marks, the answer once one club is marked, and the words of the counts
// and of a run of Confirm all. The page keeps nothing in the browser. Every
// date and month the page shows comes from the
// server as words (lastCheckWords, thisMonth.nextCheck.date), so nothing
// here makes a date.
import { ApiError } from '@/lib/http'
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

/** "1 person" or "4 people", for the LCA admin's button for the monthly check (WS09 step 14). */
export function peopleWord(n: number): string {
  return `${n} ${n === 1 ? 'person' : 'people'}`
}

/** What a press of "Send this month's check now" did, in numbers: how many were sent, how many not, and any not reached. */
export function sentWords(done: { sent: number; notSent: number; notReached: number }): string {
  const parts = [`This month's check was sent to ${peopleWord(done.sent)}; ${done.notSent} not sent.`]
  if (done.notReached > 0) parts.push(`${peopleWord(done.notReached)} not reached by this press.`)
  return parts.join(' ')
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

/** What the page says when no answer came at all, a dropped connection among them. */
export const SITE_UNREACHED = 'The site could not be reached. Check your connection, then try again.'

/**
 * The words of an error, as a sentence. An answer from the server is said
 * in its own words; anything else, a dropped connection whose message is the
 * browser's own ("Failed to fetch", "Load failed"), reads as SITE_UNREACHED.
 */
export function errorWords(err: unknown): string {
  if (!(err instanceof ApiError)) return SITE_UNREACHED
  const text = err.message.trim() || 'The server did not answer'
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/** What a press of "Send this month's check now" says when the send may have stopped part way. */
export const SEND_UNSURE = 'The send may not have finished, so some people may already have the email. Pressing again sends it to everyone again.'

/**
 * A refusal the server gave in its own words, with a status below 500,
 * which the server gives before any email is sent. An answer with no words
 * of its own (the fetch helper's "Request failed (404)") could not be read,
 * so it is not one.
 */
function refusedBeforeSending(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message !== `Request failed (${err.status})`
}

/** The button's status line when a press of Send failed: "Not sent" only for a refusal before sending. */
export function sendFailedWords(err: unknown): string {
  return refusedBeforeSending(err) ? `Not sent: ${errorWords(err)}` : SEND_UNSURE
}

/** The button's status line when asking how many people the check goes to failed: nothing is claimed about sending. */
export function askFailedWords(err: unknown): string {
  return `Could not ask how many people the check goes to: ${errorWords(err)}`
}
