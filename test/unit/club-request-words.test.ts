// test/unit/club-request-words.test.ts
//
// The plain-language rules over the words of Suggest a club and Start a club
// (WS09's thirtieth step), read from the source files that hold them:
// no long dash, "US Chess" and never its old name, times as "7:00 PM", a
// weekday on every full date, one half written as one half and never as a
// decimal; and what the public page may not say: the words of the form, its
// sentences and the switch's question mark name no region, no seat, no
// representative and no person, and say nothing of how the pages are made, of
// what may change later or of other pages' states.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import {
  CLUB_REQUEST_FIELD_WORDS, CLUB_REQUEST_LABELS, CLUB_REQUEST_NOT_SENT, CLUB_REQUEST_ROW_WORDS, CLUB_REQUEST_SEND, CLUB_REQUEST_SENT, CLUB_REQUEST_TITLES,
} from '../../domain/clubs/newClub'
import { SWITCH_HELP } from '../../src/areas/clubs/suggestClub'
import { CLUB_REQUEST_ROWS_HELP, MARKED_HANDLED, MARK_HANDLED_QUESTION } from '../../src/areas/clubs/clubRequestRows'
import { CLUB_REQUEST_SUBJECTS, CLUB_REQUEST_WHO_LINE, SUGGESTION_FOOTER } from '../../functions/utils/clubs/emails'

/** US Chess's old initials, built in two parts so this file does not spell them. */
const OLD_NAME = new RegExp(`\\b${'US' + 'CF'}\\b`)

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const NEW_FILES = [
  'domain/clubs/newClub.ts',
  'domain/clubs/placeNames.ts',
  'domain/clubs/parishRegions.ts',
  'domain/contracts/clubRequests.ts',
  'functions/api/clubs/reports.ts',
  'functions/api/admin/club-reports/[reportId].ts',
  'functions/utils/clubs/clubRequests.ts',
  'functions/utils/clubs/places.ts',
  'scripts/data/build-la-places.ts',
  'src/pages/SuggestClubPage.tsx',
  'src/areas/clubs/components/SuggestClubForm.tsx',
  'src/areas/clubs/components/ClubRequestRows.tsx',
  'src/areas/clubs/suggestClub.ts',
  'src/areas/clubs/clubRequestRows.ts',
]

const PUBLIC_WORDS: string[] = [
  ...Object.values(CLUB_REQUEST_TITLES),
  CLUB_REQUEST_LABELS.clubName, CLUB_REQUEST_LABELS.place, CLUB_REQUEST_LABELS.message.new_club, CLUB_REQUEST_LABELS.message.start_club,
  CLUB_REQUEST_LABELS.name, CLUB_REQUEST_LABELS.email, CLUB_REQUEST_SEND, ...Object.values(CLUB_REQUEST_SENT), CLUB_REQUEST_NOT_SENT,
  ...Object.values(CLUB_REQUEST_FIELD_WORDS), ...SWITCH_HELP.flat(),
]

describe('the words, on the page and in the rows', () => {
  it('has no long dash in any word of the step, in its source or in its comments', () => {
    for (const file of NEW_FILES) expect(read(file), file).not.toMatch(/[\u2013\u2014]/)
    for (const words of [...PUBLIC_WORDS, ...Object.values(CLUB_REQUEST_ROW_WORDS), ...CLUB_REQUEST_ROWS_HELP.flat(), MARK_HANDLED_QUESTION, MARKED_HANDLED]) {
      expect(words).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('writes US Chess as US Chess and never by its old name', () => {
    for (const file of NEW_FILES) expect(read(file), file).not.toMatch(OLD_NAME)
    for (const words of [...PUBLIC_WORDS, ...Object.values(CLUB_REQUEST_SUBJECTS), CLUB_REQUEST_WHO_LINE, SUGGESTION_FOOTER]) expect(words).not.toMatch(OLD_NAME)
  })

  it('writes a time as 7:00 PM, never as 7pm, 7 PM or 19:00, and a half as one half, never as .5', () => {
    const shown = [...PUBLIC_WORDS, ...Object.values(CLUB_REQUEST_ROW_WORDS), ...CLUB_REQUEST_ROWS_HELP.flat(), MARK_HANDLED_QUESTION, MARKED_HANDLED, CLUB_REQUEST_WHO_LINE]
    for (const words of shown) {
      expect(words).not.toMatch(/\b\d{1,2}\s?(am|pm|a\.m\.|p\.m\.)\b/i)
      expect(words).not.toMatch(/\b\d{1,2}\s(AM|PM)\b/)
      expect(words).not.toMatch(/\b(1[3-9]|2[0-3]):\d\d\b/)
      expect(words).not.toMatch(/\d\.5\b/)
    }
    // Wherever the step's own words give a time, it is written the plain way.
    for (const file of NEW_FILES) {
      const times = read(file).match(/\b\d{1,2}:\d\d\s?(?:AM|PM|am|pm)\b/g) ?? []
      for (const time of times) expect(time, file).toMatch(/^\d{1,2}:\d\d (AM|PM)$/)
    }
  })

  it('gives no full date in the words of the page, the rows or the emails, so none can lack its weekday', () => {
    const month = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}(, \d{4})?\b/
    for (const words of [...PUBLIC_WORDS, ...Object.values(CLUB_REQUEST_ROW_WORDS), ...CLUB_REQUEST_ROWS_HELP.flat(), MARK_HANDLED_QUESTION, MARKED_HANDLED, CLUB_REQUEST_WHO_LINE]) {
      expect(words).not.toMatch(month)
      expect(words).not.toMatch(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)
    }
  })

  it('names the club and the person\'s sides plainly: the two titles, the two row words and the two sent sentences, each its own', () => {
    expect(CLUB_REQUEST_TITLES).toEqual({ new_club: 'Suggest a club', start_club: 'Start a club' })
    expect(CLUB_REQUEST_ROW_WORDS).toEqual({ new_club: 'New club suggested', start_club: 'Wants to start a club' })
    expect(CLUB_REQUEST_SENT).toEqual({
      new_club: 'Sent. LCA checks with you, then it goes on the map.',
      start_club: 'Sent. LCA checks with you about getting it started.',
    })
    expect(CLUB_REQUEST_LABELS.email).toBe('Your email (stays private)')
    expect(CLUB_REQUEST_SEND).toBe('Send to LCA')
  })

  it('has the email\'s two subjects fixed, naming no club, no place and no person', () => {
    expect(CLUB_REQUEST_SUBJECTS).toEqual({ new_club: 'Someone suggested a club for the map', start_club: 'Someone wants to start a club' })
  })
})

describe('what the public page may not say', () => {
  const lower = PUBLIC_WORDS.join('\n').toLowerCase()

  it('names no region, seat, representative, keeper, admin or person', () => {
    for (const region of REGIONS) expect(lower).not.toContain(region.toLowerCase())
    for (const word of ['representative', 'seat', 'keeper', 'admin', 'board', 'director', 'my region']) expect(lower, word).not.toContain(word)
  })

  it('says nothing of how the pages are made, of what may change later, of switches or of other pages\' states', () => {
    for (const word of ['switch is', 'flag', 'newclubs', 'feature', 'soon', 'for now', 'coming', 'not yet', 'will change', 'may change', 'in the future', 'turned on', 'turned off', 'beta', 'component', 'database']) {
      expect(lower, word).not.toContain(word)
    }
  })

  it('keeps the switch\'s question mark to a sentence or two for each side', () => {
    expect(SWITCH_HELP).toHaveLength(2)
    for (const [title, words] of SWITCH_HELP) {
      expect(Object.values(CLUB_REQUEST_TITLES)).toContain(title)
      expect(words.split(/(?<=\.)\s+/).length, title).toBeLessThanOrEqual(2)
      expect(words.length, title).toBeLessThan(160)
    }
  })

  it('gives the page\'s source no word of where a suggestion goes, apart from its own comments about what it leaves out', () => {
    for (const file of ['src/pages/SuggestClubPage.tsx', 'src/areas/clubs/components/SuggestClubForm.tsx']) {
      const code = read(file).split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')
      for (const region of REGIONS) expect(code, file).not.toContain(region)
      expect(code, file).not.toMatch(/representative|laPlaces|regionOfPlace|parishRegions/i)
    }
  })
})
