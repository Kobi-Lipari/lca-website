// test/unit/suggestion-domain.test.ts
//
// The rules and words of Suggest an update (WS09's twenty-eighth step) in
// domain/clubs/suggestion.ts, which the endpoint's contract, the sheet and
// the keeper's rows all read: the six choices by fixed key, the caps at their
// edge, the send button's words for each place a suggestion goes (the longest
// region's name whole), the age in whole days, and the plain-language rules
// over every sentence the file and the keeper's email carry. Every name and
// address is made up.
import { describe, expect, it } from 'vitest'
import {
  ANSWER_FIRST, CONFIRM_WAITS, LINK_WAITS, RESOLVED_WORDS, SUGGESTION_CHOICES, SUGGESTION_FIELD_WORDS, SUGGESTION_GOES_TO,
  SUGGESTION_LIMITS, SUGGESTION_NOT_SENT, SUGGESTION_SENT, SUGGEST_LINK, ageWords, openSuggestionsWords, suggestSendLabel,
  suggestTitle, suggestionFieldError, suggestionLabel,
} from '../../domain/clubs/suggestion'
import { wholeDaysSince } from '../../domain/clubs/regionCards'
import {
  SUGGESTION_ADDRESS_LEFT, SUGGESTION_ANSWER_LINE, SUGGESTION_FOOTER, SUGGESTION_HEADING, SUGGESTION_NO_ADDRESS, clubRepSignOff,
  suggestionKeeperEmail, suggestionOpening,
} from '../../functions/utils/clubs/emails'
import { REGIONS } from '../../domain/clubs/regions'

const LONG_DASH = /[\u2013\u2014]/
const DAY = 24 * 60 * 60 * 1000

describe('the six choices', () => {
  it('are six, by short lower-case keys, each with its label, in the sheet\'s order', () => {
    expect(SUGGESTION_CHOICES.map((c) => c.key)).toEqual(['meets', 'venue', 'cost', 'contact', 'closed', 'other'])
    expect(SUGGESTION_CHOICES.map((c) => c.label)).toEqual([
      'Meeting day or time', 'Venue or address', 'Cost or who it\'s for', 'Contact', 'The club has closed or moved', 'Something else',
    ])
    for (const choice of SUGGESTION_CHOICES) {
      expect(choice.key).toMatch(/^[a-z]{1,8}$/)
      expect(choice.key).toBe(choice.key.toLowerCase())
      expect(suggestionLabel(choice.key)).toBe(choice.label)
    }
    expect(suggestionLabel('unknown')).toBe('unknown')
  })
})

describe('suggestionFieldError', () => {
  it('holds each part to its rule and says so in the field\'s words', () => {
    expect(suggestionFieldError('field', '')).toBe(SUGGESTION_FIELD_WORDS.fieldMissing)
    expect(suggestionFieldError('field', 'Venue or address')).toBe(SUGGESTION_FIELD_WORDS.fieldMissing)
    expect(suggestionFieldError('field', 'venue')).toBeNull()
    expect(suggestionFieldError('message', '')).toBe(SUGGESTION_FIELD_WORDS.messageMissing)
    expect(suggestionFieldError('message', ' \n\t ')).toBe(SUGGESTION_FIELD_WORDS.messageMissing)
    expect(suggestionFieldError('message', 'x'.repeat(SUGGESTION_LIMITS.message))).toBeNull()
    expect(suggestionFieldError('message', 'x'.repeat(SUGGESTION_LIMITS.message + 1))).toBe(SUGGESTION_FIELD_WORDS.messageLong)
    expect(suggestionFieldError('email', '')).toBeNull()
    expect(suggestionFieldError('email', '   ')).toBeNull()
    expect(suggestionFieldError('email', 'player@example.org')).toBeNull()
    expect(suggestionFieldError('email', 'player@example')).toBe(SUGGESTION_FIELD_WORDS.emailForm)
    expect(suggestionFieldError('email', 'a@example.org\nb@example.org')).toBe(SUGGESTION_FIELD_WORDS.emailForm)
    expect(suggestionFieldError('email', `${'a'.repeat(SUGGESTION_LIMITS.email)}@example.org`)).toBe(SUGGESTION_FIELD_WORDS.emailLong)
  })

  it('says the cap with a thousands comma and the address cap as a plain number', () => {
    expect(SUGGESTION_FIELD_WORDS.messageLong).toBe('What changed can be at most 2,000 characters.')
    expect(SUGGESTION_FIELD_WORDS.emailLong).toBe('Your email address can be at most 254 characters.')
  })
})

describe('the send button', () => {
  it('is worded by where the suggestion goes and names nobody', () => {
    expect(SUGGESTION_GOES_TO).toEqual(['club_rep', 'region', 'lca'])
    expect(suggestSendLabel('club_rep', 'Example Region')).toBe('Send to the club\'s representative')
    expect(suggestSendLabel('lca', 'Example Region')).toBe('Send to LCA')
    expect(suggestSendLabel('region', 'Example Region')).toBe('Send to the Example Region representative')
    expect(suggestSendLabel('region', null)).toBe('Send to the region\'s representative')
    expect(suggestSendLabel('region', '   ')).toBe('Send to the region\'s representative')
  })

  it('carries each of the five regions\' names whole', () => {
    for (const region of REGIONS) expect(suggestSendLabel('region', region)).toBe(`Send to the ${region} representative`)
  })
})

describe('ages and the card\'s line', () => {
  it('reads whole days of 24 hours, never below 0, and 0 for a stamp that cannot be read', () => {
    const now = Date.UTC(2026, 10, 25, 12, 0, 0)
    expect(wholeDaysSince('2026-11-25 12:00:00', now)).toBe(0)
    expect(wholeDaysSince('2026-11-24 12:00:01', now)).toBe(0)
    expect(wholeDaysSince('2026-11-24 12:00:00', now)).toBe(1)
    expect(wholeDaysSince('2026-11-16 12:00:00', now)).toBe(9)
    expect(wholeDaysSince('2026-11-26 12:00:00', now)).toBe(0)
    expect(wholeDaysSince('', now)).toBe(0)
    expect(wholeDaysSince('garbage', now)).toBe(0)
    expect(wholeDaysSince(null, now)).toBe(0)
    expect(wholeDaysSince('2026-11-24 12:00:00', now + 3 * DAY - 1)).toBe(3)
  })

  it('says it in words, with the middle dot the card uses and no long dash', () => {
    expect(ageWords(0)).toBe('today')
    expect(ageWords(1)).toBe('1 day')
    expect(ageWords(14)).toBe('14 days')
    expect(openSuggestionsWords(1, 9)).toBe('1 suggestion · 9 days')
    expect(openSuggestionsWords(4, 1)).toBe('4 suggestions · 1 day')
    expect(openSuggestionsWords(2, 0)).toBe('2 suggestions · today')
  })
})

describe('the plain-language rules, over every sentence this step writes', () => {
  const sentences = [
    ...Object.values(SUGGESTION_FIELD_WORDS), ...Object.values(RESOLVED_WORDS), ...SUGGESTION_CHOICES.map((c) => c.label),
    SUGGEST_LINK, SUGGESTION_SENT, SUGGESTION_NOT_SENT, ANSWER_FIRST, CONFIRM_WAITS, LINK_WAITS, suggestTitle('Example Chess Club'),
    suggestSendLabel('club_rep', null), suggestSendLabel('lca', null), openSuggestionsWords(1, 9),
    SUGGESTION_ADDRESS_LEFT, SUGGESTION_NO_ADDRESS, SUGGESTION_ANSWER_LINE, SUGGESTION_FOOTER, SUGGESTION_HEADING,
    suggestionOpening('Example Chess Club', 'club_rep', null, 'no_keeper'), suggestionOpening('Example Chess Club', 'region', 'Example Region', 'unreachable'),
    suggestionOpening('Example Chess Club', 'lca', null, 'no_keeper'), suggestionOpening('Example Chess Club', 'lca', null, 'unreachable'),
    clubRepSignOff('Example Chess Club'),
  ]

  it('has no long dash, none of US Chess\'s old initials and no half written as a point-five', () => {
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(LONG_DASH)
      expect(sentence).not.toContain('US' + 'CF')
      expect(sentence).not.toMatch(/\d\.5\b/)
    }
  })

  it('names the service as the sentences say it: Answer it, then confirm, and the reply line to LCA', () => {
    expect(CONFIRM_WAITS).toContain('Answer it, then confirm')
    expect(LINK_WAITS).toContain('Log in to My region')
    expect(SUGGESTION_SENT).toBe('Sent. Whoever keeps this club\'s listing checks it before anything changes.')
    expect(SUGGESTION_FOOTER).toBe('A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.')
    expect(suggestTitle('Example Chess Club')).toBe('Suggest an update to Example Chess Club')
  })

  it('writes none of the entry\'s banner sentence about 14 days, which is not true until the next step', () => {
    for (const sentence of sentences) expect(sentence).not.toMatch(/14 days|also reaches/i)
  })
})

describe('the keeper\'s email', () => {
  const base = {
    siteUrl: 'https://www.louisianachess.org', clubName: 'Example Chess Club', region: 'Example Region', kind: 'region' as const, reason: 'unreachable' as const,
    choice: 'Venue or address', message: 'Player One says: <b>moved</b>', hasAddress: true, link: 'https://www.louisianachess.org/workspace/region/clubs/club-1#suggestion-7',
  }

  it('carries the choice, the quoted words, the link and the last line, and says only whether an address was left', () => {
    const mail = suggestionKeeperEmail(base)
    expect(mail.to).toBe('')
    expect(mail.subject).toBe('A suggestion for Example Chess Club\'s listing on the LCA website')
    expect(mail.text).toContain('What changed: Venue or address')
    expect(mail.text).toContain('Player One says: <b>moved</b>')
    expect(mail.html).toContain('&lt;b&gt;moved&lt;/b&gt;')
    expect(mail.html).not.toContain('<b>moved</b>')
    expect(mail.text).toContain(`Open the suggestion: ${base.link}`)
    expect(mail.text).toContain(SUGGESTION_ADDRESS_LEFT)
    expect(mail.text!.trimEnd().endsWith(SUGGESTION_FOOTER)).toBe(true)
    expect(suggestionKeeperEmail({ ...base, hasAddress: false }).text).toContain(SUGGESTION_NO_ADDRESS)
    expect(mail.text).not.toMatch(LONG_DASH)
  })

  it('puts a club name with a line break on one line, so the subject cannot be split', () => {
    const mail = suggestionKeeperEmail({ ...base, clubName: 'Example\r\nBcc: other@example.org Club' })
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })

  it('signs a club\'s own rep by the role and the club alone', () => {
    expect(clubRepSignOff('Example Chess Club')).toBe('Example Chess Club representative')
    expect(clubRepSignOff('Example\nChess Club')).toBe('Example Chess Club representative')
  })
})
