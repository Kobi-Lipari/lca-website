// test/unit/clubs-words-one-meaning.test.ts
//
// One word for one thing in everything a person reads of the club pages'
// public forms (WS09 checkpoint X, the review's D5): "representative" is the
// holder of a region's seat and nothing else, the club's own named person is
// its "rep", and "keeper", this code's own word, reaches no person. Read over
// every sentence the rules files of domain/clubs/ that checkpoint X added
// export, every string their code and functions/utils/clubs/emails.ts write,
// and the subject, text and HTML of every email of emails.ts that checkpoint X
// added, built for made-up clubs and people.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as contactMessage from '../../domain/clubs/contactMessage'
import * as newClub from '../../domain/clubs/newClub'
import * as pageWords from '../../domain/clubs/pageWords'
import * as regionCards from '../../domain/clubs/regionCards'
import * as repRequest from '../../domain/clubs/repRequest'
import * as replyMessage from '../../domain/clubs/replyMessage'
import * as slug from '../../domain/clubs/slug'
import * as suggestion from '../../domain/clubs/suggestion'
import * as emails from '../../functions/utils/clubs/emails'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The rules files of domain/clubs/ that checkpoint X added or changed, with words in them; the place lists hold names alone. */
const RULES_FILES = [
  'domain/clubs/contactMessage.ts', 'domain/clubs/newClub.ts', 'domain/clubs/pageWords.ts', 'domain/clubs/regionCards.ts',
  'domain/clubs/repRequest.ts', 'domain/clubs/replyMessage.ts', 'domain/clubs/slug.ts', 'domain/clubs/suggestion.ts',
]
const EMAILS_FILE = 'functions/utils/clubs/emails.ts'

/** Every string a module exports, in constants, lists and objects, however deep. */
function exportedStrings(module: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (value: unknown, depth: number) => {
    if (typeof value === 'string') out.push(value)
    else if (depth < 4 && Array.isArray(value)) for (const item of value) walk(item, depth + 1)
    else if (depth < 4 && value && typeof value === 'object') for (const item of Object.values(value)) walk(item, depth + 1)
  }
  for (const value of Object.values(module)) walk(value, 0)
  return out
}

/**
 * A file's code with its comments taken out, where a word a person reads stands as prose: "keeper" with a space or a
 * mark after it, never inside a name of the code (keeperOf, SuggestionKeeperKind, the key no_keeper).
 */
function codeOf(path: string): string {
  return read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const PROSE_KEEPER = /(?<![\w])keepers?(?=[\s.,;:!?'"`)])|['"`]\s*Keepers?\b/

/** Every email of emails.ts that checkpoint X added, for made-up clubs and people, in every kind and reason it takes. */
function everyEmail(): Array<{ subject: string; html: string; text?: string }> {
  const siteUrl = 'https://example.org'
  const clubName = 'Example Chess Club'
  const visitor = { name: 'Player One', email: 'player-one@example.org', message: 'Do you meet on Tuesdays?' }
  const out = [] as Array<{ subject: string; html: string; text?: string }>
  for (const kind of ['club', 'region', 'lca'] as const) {
    for (const reason of ['no_address', 'unreachable'] as const) {
      for (const region of ['North Louisiana', null]) out.push(emails.relayCopyEmail({ siteUrl, clubName, region, kind, reason, visitor, replyUrl: `${siteUrl}/clubs/reply/example` }))
    }
  }
  out.push(emails.clubReplyEmail({ siteUrl, clubName, clubUrl: `${siteUrl}/clubs/example`, firstName: 'Player', excerpt: 'Do you meet?', answer: 'Yes, at 7:00 PM.', signOff: emails.clubRepSignOff(clubName) }))
  out.push(emails.clubReplyEmail({ siteUrl, clubName, clubUrl: `${siteUrl}/clubs/example`, firstName: 'Player', excerpt: 'Do you meet?', answer: 'Yes.', signOff: emails.replySignOff({ kind: 'region', region: 'North Louisiana' }) }))
  for (const kind of ['club_rep', 'region', 'lca'] as const) {
    for (const reason of ['no_keeper', 'unreachable', 'rep_unreachable', 'region_unreachable'] as const) {
      out.push(emails.suggestionKeeperEmail({ siteUrl, clubName, region: 'North Louisiana', kind, reason, choice: 'Venue or address', message: 'The club meets at the Example Library now.', hasAddress: true, link: `${siteUrl}/my/club/example` }))
    }
  }
  for (const first of ['club_rep', 'region', 'lca'] as const) {
    for (const kind of ['region', 'lca'] as const) {
      out.push(emails.overdueSuggestionEmail({ siteUrl, clubName, region: 'North Louisiana', first, kind, choice: 'Cost', message: 'Free now.', hasAddress: false, waitedDays: 16, dueDays: 14, link: `${siteUrl}/workspace/region` }))
    }
  }
  for (const kind of ['new_club', 'start_club'] as const) {
    for (const reason of ['region', 'open_seat', 'not_found', 'unreachable'] as const) {
      out.push(emails.clubRequestKeeperEmail({ siteUrl, kind, reason, region: 'North Louisiana', clubName, place: 'Example Town', message: 'Saturdays at the library.', link: `${siteUrl}/workspace/region` }))
    }
  }
  for (const reason of ['region', 'admin'] as const) {
    out.push(emails.repRequestKeeperEmail({ siteUrl, reason, region: 'North Louisiana', clubName, connection: 'Runs it', note: 'Example note.', link: `${siteUrl}/workspace/region` }))
  }
  out.push(emails.repNamedEmail({ siteUrl, clubName }), emails.repDeclinedEmail({ siteUrl, clubName }))
  return out
}

/** Every sentence a person may read, from all three readings. */
function everything(): string[] {
  const modules = [contactMessage, newClub, pageWords, regionCards, repRequest, replyMessage, slug, suggestion, emails] as Array<Record<string, unknown>>
  return [
    ...modules.flatMap(exportedStrings),
    ...everyEmail().flatMap((mail) => [mail.subject, mail.html, mail.text ?? '']),
    emails.clubRepSignOff('Example Chess Club'),
  ]
}

describe('one word for one thing in what the forms and their emails say', () => {
  it('no sentence says "keeper", and "representative" never stands straight after "club\'s"', () => {
    const all = everything().filter((s) => s.length > 0)
    expect(all.length).toBeGreaterThan(200)
    for (const sentence of all) {
      expect(sentence).not.toMatch(/keeper/i)
      expect(sentence).not.toMatch(/club(?:'|&#39;|&#x27;|\\')s representative/i)
    }
    // And in the code that builds the sentences, wherever they are put together.
    for (const file of [...RULES_FILES, EMAILS_FILE]) {
      expect(codeOf(file), file).not.toMatch(PROSE_KEEPER)
      expect(codeOf(file), file).not.toMatch(/club(?:\\'|')s representative/i)
    }
    // The club's own person is its rep, by the club's name or as the club's.
    expect(emails.clubRepSignOff('Example Chess Club')).toBe('Example Chess Club\'s rep')
    expect(suggestion.suggestSendLabel('club_rep', 'North Louisiana')).toBe('Send to the club\'s rep')
    expect(repRequest.REP_DECIDE_OWN).toBe('This is your own request. Another representative of the region or an LCA admin decides it.')
  })
})
