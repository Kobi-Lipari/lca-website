// test/unit/rep-request-words.test.ts
//
// The plain-language rules over every sentence of Ask to be its named rep
// (WS09's thirty-first step): the rules file's words, the keeper's rows, the
// three emails and the sources that hold them. No long dash, "US Chess" and
// never its old initials, a weekday on every full date, times as "7:00 PM",
// one half written as one half and never as a decimal; what the member's
// side may not say (a person, a region or a seat); and what the two emails
// to the member may not say (who decided, a region or a seat). Every name is
// made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as words from '../../domain/clubs/repRequest'
import { REP_REQUEST_ROWS_HEADING, REP_REQUEST_ROWS_HELP } from '../../src/areas/clubs/repRequestRows'
import { repDeclinedEmail, repNamedEmail, repRequestKeeperEmail } from '../../functions/utils/clubs/emails'
import { REGIONS } from '../../domain/clubs/regions'

const OLD_NAME = new RegExp(`\\b${'US' + 'CF'}\\b`)
const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const SOURCES = [
  'domain/clubs/repRequest.ts',
  'domain/contracts/clubRepRequests.ts',
  'functions/api/clubs/[id]/rep-requests.ts',
  'functions/api/admin/clubs/[id]/rep-requests/[requestId].ts',
  'functions/utils/clubs/nameRep.ts',
  'functions/utils/clubs/repRequests.ts',
  'src/areas/clubs/components/RepRequestLink.tsx',
  'src/areas/clubs/components/RepRequestSheet.tsx',
  'src/areas/clubs/components/RepRequestRows.tsx',
  'src/areas/clubs/repRequestRows.ts',
]

/** Every string the rules file exports, from its constants and the sentences its functions build for a made-up club and person. */
function everySentence(): string[] {
  const out: string[] = []
  for (const value of Object.values(words)) {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) for (const item of value) out.push(typeof item === 'string' ? item : JSON.stringify(item))
    else if (value && typeof value === 'object') out.push(...Object.values(value).filter((v): v is string => typeof v === 'string'))
  }
  const club = 'Example Knights Club'
  const other = 'Example Rooks Club'
  const name = 'Player One'
  out.push(
    words.repRequestTitle(club), words.nameQuestion(name, club), words.declineQuestion(name), words.namedWords(name, club), words.declinedWords(name),
    words.movesWords(name, other, club), words.replacesWords(name, 'club_rep', other), words.replacesWords(name, 'tournament_director', null),
    words.adminsDecideWords(name, 'club_rep', other), words.adminsDecideWords(name, 'lca_officer', null), words.adminsDecideRow(name, 'lca_auditor', null),
    words.adminsDecideRow(name, 'club_rep', null), words.neverNamed(name, 'lca_admin') ?? '', words.neverNamed(name, 'guest') ?? '',
    words.repRequestRowHeading({ clubName: club, memberName: name, connection: 'runs_it', sentOn: 'Wed, Nov 25' }),
    REP_REQUEST_ROWS_HEADING, ...REP_REQUEST_ROWS_HELP.flat(),
  )
  return out.filter((s) => s.length > 0)
}

describe('the words of Ask to be its named rep', () => {
  it('has the sentences it should: the rules file gives more than a dozen', () => {
    expect(everySentence().length).toBeGreaterThan(30)
  })

  it('has no long dash in any sentence, any source file or any email', () => {
    for (const sentence of everySentence()) expect(sentence).not.toMatch(/[\u2013\u2014]/)
    for (const file of SOURCES) expect(read(file), file).not.toMatch(/[\u2013\u2014]/)
    for (const mail of mails()) expect(mail.subject + mail.html + (mail.text ?? '')).not.toMatch(/[\u2013\u2014]/)
  })

  it('never writes the old initials, never writes one half as a decimal, and writes no clock time but as "7:00 PM", in any sentence or email', () => {
    const all = [...everySentence(), ...mails().map((m) => `${m.subject}\n${m.html}\n${m.text ?? ''}`)]
    for (const file of SOURCES) expect(read(file), file).not.toMatch(OLD_NAME)
    for (const text of all) {
      expect(text).not.toMatch(OLD_NAME)
      expect(text).not.toMatch(/(^|[^\d])\.5\b|\b\d+\.5\b/)
      expect(text).not.toMatch(/\b\d{1,2}\s?(am|pm|a\.m\.|p\.m\.)\b/)
      expect(text).not.toMatch(/\b\d{1,2}:\d{2}\s?(am|pm)\b/)
    }
  })

  it('writes every date on a row with its weekday', () => {
    const heading = words.repRequestRowHeading({ clubName: 'Example Knights Club', memberName: 'Player One', connection: 'keeps_page', sentOn: 'Wed, Nov 25' })
    expect(heading).toBe('Rep request · Example Knights Club · Player One · Would keep the page · Wed, Nov 25')
    expect(heading).toMatch(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}$/)
  })

  it('says the sentence a member reads once sent without a person, a region or a seat, and the form words in frame D\'s order', () => {
    for (const sentence of [words.REP_REQUEST_SENT, words.REP_SIGNED_OUT_LINE, words.REP_REQUEST_HELP, words.REP_NOTE_LABEL, words.REP_CONNECTION_QUESTION]) {
      for (const region of REGIONS) expect(sentence).not.toContain(region)
      expect(sentence).not.toMatch(/\b(seat|representative|regional|admin)\b/i)
    }
    expect(words.REP_REQUEST_SENT).toBe('Request sent. LCA has it, and you\'ll get an email with the answer. The page doesn\'t change until then.')
    expect(words.REP_CONNECTIONS.map((c) => c.label)).toEqual(['I run it', 'I help run it', 'I\'d keep the page for the club', 'Something else'])
  })

  it('the two emails to the member name no one who decided, no region and no seat, and carry LCA\'s own reply line', () => {
    for (const mail of [repNamedEmail({ siteUrl: 'https://example.org', clubName: 'Example Knights Club' }), repDeclinedEmail({ siteUrl: 'https://example.org', clubName: 'Example Knights Club' })]) {
      const whole = `${mail.subject}\n${mail.html}\n${mail.text ?? ''}`
      for (const region of REGIONS) expect(whole).not.toContain(region)
      expect(whole).not.toMatch(/\b(seat|representative|regional rep|decided by)\b/i)
      expect(whole).toContain('Example Knights Club')
    }
    expect(repDeclinedEmail({ siteUrl: 'https://example.org', clubName: 'Example Knights Club' }).text).toContain(
      'Your request to be named Example Knights Club\'s rep was not approved. If you think this is a mistake, reply to this email.',
    )
  })

  it('the keeper\'s email quotes the note escaped, and carries neither a name nor an address of the member', () => {
    const mail = repRequestKeeperEmail({
      siteUrl: 'https://example.org', reason: 'admin', region: null, clubName: 'Example Knights Club', connection: 'Runs it',
      note: '<script>alert(1)</script> & more', link: 'https://example.org/workspace/region#rep-request-4',
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
    expect(mail.text).toContain('<script>alert(1)</script> & more')
    expect(`${mail.html}${mail.text}`).not.toMatch(/Player One|@example\.org/)
  })
})

function mails() {
  const base = { siteUrl: 'https://example.org', clubName: 'Example Knights Club' }
  return [
    repNamedEmail(base),
    repDeclinedEmail(base),
    repRequestKeeperEmail({ ...base, reason: 'region', region: 'North Louisiana', connection: 'Helps run it', note: 'Example note', link: 'https://example.org/workspace/region#rep-request-1' }),
    repRequestKeeperEmail({ ...base, reason: 'admin', region: null, connection: 'Something else', note: '', link: 'https://example.org/workspace/region#rep-request-2' }),
  ]
}
