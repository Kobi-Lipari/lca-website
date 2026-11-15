// The words My region, a club's page in My region and the LCA admin's
// button for the monthly check say when a call fails (WS09 checkpoint U's
// review), in src/areas/clubs/region.ts. An answer from the server is said
// in its own words; a call that got no answer at all, a dropped connection
// whose message is the browser's own, reads in plain words that say what to
// do. A press of "Send this month's check now" says "Not sent" only for a
// refusal the server gave in its own words with a status below 500, which
// comes before any email goes; anything else may have stopped part way
// through the sends, and the words say so. Asking how many people the check
// goes to claims nothing about sending.
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/http'
import { SEND_UNSURE, SITE_UNREACHED, askFailedWords, errorWords, sendFailedWords } from '@/areas/clubs/region'

/** What each browser's fetch says when the connection drops. */
const DROPPED = ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']

describe('errorWords', () => {
  it('reads an error that is not an answer from the server, a dropped connection among them, in plain words', () => {
    expect(SITE_UNREACHED).toBe('The site could not be reached. Check your connection, then try again.')
    for (const message of DROPPED) expect(errorWords(new TypeError(message)), message).toBe(SITE_UNREACHED)
    expect(errorWords(new Error('Something inside the page'))).toBe(SITE_UNREACHED)
    expect(errorWords('not an error at all')).toBe(SITE_UNREACHED)
    expect(errorWords(undefined)).toBe(SITE_UNREACHED)
  })

  it('passes a server\'s words through unchanged, ending them with a full stop only when they have none', () => {
    expect(errorWords(new ApiError('Forbidden', 403))).toBe('Forbidden.')
    expect(errorWords(new ApiError('This club\'s page was saved after you opened it.', 409))).toBe('This club\'s page was saved after you opened it.')
    expect(errorWords(new ApiError('Are you sure?', 400))).toBe('Are you sure?')
    expect(errorWords(new ApiError('  Request failed (500)  ', 500))).toBe('Request failed (500).')
    expect(errorWords(new ApiError('', 500))).toBe('The server did not answer.')
  })

  it('reads well in every sentence the pages build from it', () => {
    const dropped = new TypeError('Failed to fetch')
    expect(`My region could not be loaded: ${errorWords(dropped)}`).toBe('My region could not be loaded: The site could not be reached. Check your connection, then try again.')
    expect(`Not marked: ${errorWords(dropped)} Nothing changed.`).toBe('Not marked: The site could not be reached. Check your connection, then try again. Nothing changed.')
    expect(`The news was not posted: ${errorWords(dropped)}`).toBe('The news was not posted: The site could not be reached. Check your connection, then try again.')
    for (const sentence of [
      `My region could not be loaded: ${errorWords(dropped)}`,
      `The club could not be loaded: ${errorWords(dropped)}`,
      `The club's news could not be loaded: ${errorWords(dropped)}`,
    ]) expect(sentence).not.toMatch(/fetch|NetworkError|Load failed/)
  })
})

describe('the button\'s words when a press of Send fails', () => {
  it('says "Not sent" with the server\'s words for a refusal below 500, a missing second factor among them', () => {
    expect(sendFailedWords(new ApiError('Forbidden', 403))).toBe('Not sent: Forbidden.')
    expect(sendFailedWords(new ApiError('Two-factor authentication is required for admin access. Set it up in your account security settings.', 403)))
      .toBe('Not sent: Two-factor authentication is required for admin access. Set it up in your account security settings.')
    expect(sendFailedWords(new ApiError('Invalid request body', 400))).toBe('Not sent: Invalid request body.')
  })

  it('says the send may not have finished for a dropped connection', () => {
    expect(SEND_UNSURE).toBe('The send may not have finished, so some people may already have the email. Pressing again sends it to everyone again.')
    for (const message of DROPPED) expect(sendFailedWords(new TypeError(message)), message).toBe(SEND_UNSURE)
  })

  it('says the send may not have finished for a 5xx, the signing key\'s 503 and the edge\'s own pages among them', () => {
    expect(sendFailedWords(new ApiError('Request failed (500)', 500))).toBe(SEND_UNSURE)
    expect(sendFailedWords(new ApiError('The monthly check can\'t be sent: the site\'s signing key is not set yet.', 503))).toBe(SEND_UNSURE)
    expect(sendFailedWords(new ApiError('Request failed (524)', 524))).toBe(SEND_UNSURE)
  })

  it('says the send may not have finished for an answer that could not be read, whatever its status', () => {
    expect(sendFailedWords(new ApiError('The server returned an unreadable response.', 200))).toBe(SEND_UNSURE)
    expect(sendFailedWords(new ApiError('Request failed (404)', 404))).toBe(SEND_UNSURE)
    expect(sendFailedWords(new Error('Unexpected end of JSON input'))).toBe(SEND_UNSURE)
  })
})

describe('the button\'s words when asking how many people fails', () => {
  it('says plainly that it could not be asked, with the reason, and claims nothing about sending', () => {
    const cases: Array<[unknown, string]> = [
      [new ApiError('Forbidden', 403), 'Could not ask how many people the check goes to: Forbidden.'],
      [new TypeError('Failed to fetch'), `Could not ask how many people the check goes to: ${SITE_UNREACHED}`],
      [new ApiError('Request failed (500)', 500), 'Could not ask how many people the check goes to: Request failed (500).'],
    ]
    for (const [err, words] of cases) {
      expect(askFailedWords(err)).toBe(words)
      expect(askFailedWords(err)).not.toMatch(/\bsent\b|\bsend\b|may already have/i)
    }
  })
})
