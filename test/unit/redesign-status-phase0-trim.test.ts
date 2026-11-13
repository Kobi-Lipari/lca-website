// test/unit/redesign-status-phase0-trim.test.ts
//
// The record of the Phase 0 public-answer trim in REDESIGN_STATUS.md: its
// own section after WS15, and the lines the trim wrote elsewhere: the date
// line's Phase 0 piece, the two WS01 follow-ups it closes, the sentence it
// added to the WS01 follow-up on minor names on the entrants list and the
// WS02 follow-up it answers; and, since the merge-safety review, the lines
// that record WS02 step 9's merge, which the trim's change wrote ahead of
// WS02 step 10: the date line's "and step 9", the WS02 PR line, step 9's
// bullet on its merge, the sentence that ends step 9's follow-up on
// checkpoint G's pull request and the WS02 follow-up on the one-reload mark.
// It reads this section and those lines alone, never every table row or
// heading of the file, and the record alone, never the code, so a later
// workstream that changes a file the trim touched changes nothing here.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const lines = status.split('\n')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in, this record's own names among them. */
const UNFILLED = new RegExp(
  `${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'to be ' + 'measured'}` +
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'RECORD' + 'CASES', 'LINT' + 'FILES', 'BROWSER' + 'RUN', 'CHECKS' + 'LINE', 'CLOSING' + 'SEARCH'].join('|')})\\b`,
)
/** The merge-pending phrase, of which the whole file holds one line, WS01 step 32's. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)
/** A date written out, which must carry its weekday. */
const DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g
const WEEKDAY = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), $/

const HEADING = '## Phase 0: the public-answer trim'
// The trim's section runs to the next "## " heading: it was the last of the
// file, and read to the end, until the News posts' cleaner's section came
// after it.
const trimStart = status.indexOf(HEADING)
const afterTrim = status.indexOf('\n## ', trimStart + HEADING.length)
const section = afterTrim < 0 ? status.slice(trimStart) : status.slice(trimStart, afterTrim)
const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
const subsection = (name: string) => between(section, `### ${name}\n`, '\n### ')
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
/** A bullet and the indented lines under it. */
function bullet(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
const dateLine = line('Last updated:')
const PIECE = 'the Phase 0 public-answer trim is built on its own branch from step 9 and not merged yet'
const DONE = 'Done in the Phase 0 trim (Tuesday, November 3, 2026): see the Phase 0 section.'
const ws01FollowUps = between(status, '### Follow-ups', '\n## WS02')
const ws02FollowUps = between(status, '### WS02 follow-ups', '\n## ')
const ws01Entry = (head: string) => entries(ws01FollowUps).find((l) => l.startsWith(`- **${head}`)) ?? ''
const trimFollowUp = entries(ws02FollowUps).find((l) => l.startsWith('- **The public-answer trim still to merge (WS02 step 1).**')) ?? ''
/** The sentence the trim added to the WS01 follow-up on minor names, which says where `publicName` is wired and leaves the follow-up open. */
const MINOR_NAMES = 'Wired in the Phase 0 trim (Tuesday, November 3, 2026), behind `ROSTER_SHORT_NAMES`, with `members.guardian_id` and `registrations.grade` as the signs: see the Phase 0 section.'
const minorNames = ws01Entry('Minor names on the entrants list (step 4).')

/** The WS02 section, and in it the lines that record WS02 step 9's merge, which the trim's change wrote ahead of WS02 step 10. */
const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const prLine = ws02.split('\n').find((l) => l.startsWith('**PR:**')) ?? ''
/** The PR line from checkpoint G on, which names pull request 119 and its merge. */
const prPiece = prLine.includes('checkpoint G (steps 9 to 11)') ? prLine.slice(prLine.indexOf('checkpoint G (steps 9 to 11)')) : ''
const step9Merge = bullet(between(ws02, '\n### WS02 step 9: the listing rule and the search endpoint\n', '\n### '), '- **This step\'s merge.**')
const RECORDED = 'The Phase 0 trim\'s change to this file has since recorded the merge, ahead of WS02 step 10:'
const checkpointG = entries(ws02FollowUps).find((l) => l.startsWith('- **Checkpoint G\'s section and its pull request (WS02 step 9).**')) ?? ''
const recorded = checkpointG.includes(RECORDED) ? checkpointG.slice(checkpointG.indexOf(RECORDED)) : ''
const reloadMark = entries(ws02FollowUps).find((l) => l.startsWith('- **From the review of WS02 step 9: one reload a tab, not one a deploy (WS02 step 18).**')) ?? ''
/** The date line's piece that says step 9 is merged, with no semicolon or bracket, as the WS02 record tests allow a piece. */
const MERGED = 'WS02, checkpoints E and F and step 9 are merged'

/** Every text this change wrote in the record. */
const written = [
  section, PIECE, ws01Entry('Public responses expose personal and internal fields'), ws01Entry('Name suffixes'), minorNames, trimFollowUp,
  MERGED, prPiece, step9Merge, recorded, reloadMark,
]

describe('REDESIGN_STATUS.md, the Phase 0 trim: where its section stands', () => {
  it('is one section, after WS15, and followed by the News posts\' cleaner\'s section', () => {
    expect(status.split(HEADING)).toHaveLength(2)
    expect(status.indexOf(HEADING)).toBeGreaterThan(status.indexOf('\n## WS15: Scanner 2.0'))
    expect(status.slice(afterTrim + 1).startsWith('## Phase 0: the News posts\' cleaner\n')).toBe(true)
  })

  it('opens with its status, branch and pull request, not merged yet, in words other than the merge-pending phrase', () => {
    const statusLine = section.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
    expect(statusLine.startsWith('**Status:** built on branch `phase0/public-answer-trim` on Tuesday, November 3, 2026, from WS02 step 9\'s commit `b7c11e6`; not merged yet.')).toBe(true)
    // WS02 step 9's pull request merged first; then main was merged into the branch and the trim's own pull request opened.
    for (const piece of [
      'pull request, 119, merged into `main` as `27fe278` on Tuesday, November 3, 2026 at 11:46 AM UTC', '`main` was then merged into this branch as `157ecd2`',
      'draft pull request 120 was opened from the branch on Tuesday, November 3, 2026 at 4:00 PM UTC',
      '**Branch:** `phase0/public-answer-trim`, cut from `b7c11e6`, with `2da1513`, the trim; `157ecd2`, the merge of `main`; `190e118`',
      '**PR:** draft pull request 120, not merged into `main` yet.',
    ]) expect(statusLine, piece).toContain(piece)
    expect(statusLine).not.toContain('none yet')
    expect(statusLine).not.toContain('is opened once')
  })

  it('holds its four sections in order, each heading starting "### Phase 0 ", and every entry in them tagged (Phase 0)', () => {
    const headings = section.split('\n').filter((l) => l.startsWith('### '))
    expect(headings).toEqual(['### Phase 0 decisions', '### Phase 0 deviations from the brief', '### Phase 0 verify items resolved', '### Phase 0 follow-ups'])
    for (const name of ['Phase 0 decisions', 'Phase 0 deviations from the brief', 'Phase 0 verify items resolved', 'Phase 0 follow-ups']) {
      const own = entries(subsection(name))
      expect(own.length, name).toBeGreaterThanOrEqual(4)
      for (const entry of own) expect(entry, name).toMatch(/^- \*\*[^*]+ \(Phase 0\)\.\*\* \S/)
    }
  })
})

describe('REDESIGN_STATUS.md, the Phase 0 trim: what it records', () => {
  const opening = between(section, '\n\n', '\n\n- **Files.**')

  it('says what a visitor sees by switch, nothing with every switch off', () => {
    expect(opening).toContain('What a visitor sees, by switch: with every switch off, nothing')
    for (const piece of ['`clubEmailHidden`', '`CLUB_EMAIL_HIDDEN`', '`rosterShortNames`', '`ROSTER_SHORT_NAMES`', '"Contact this club through LCA"', 'D15 and D29', 'Q14 and Q38', 'the standings, the prizes and the pairings keep full names for everyone (D3), before the event\'s first result as after it']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('names every file it adds and changes, and says src/lib/features.ts is not touched', () => {
    const files = bullet(section, '- **Files.**')
    for (const name of [
      'functions/utils/events/publicAnswer.ts', 'functions/utils/clubs/publicAnswer.ts', 'test/unit/public-answer.test.ts', 'test/unit/public-answer-switches.test.ts',
      'test/unit/club-email-hidden.test.tsx', 'test/integration/public-answer-trim.test.ts', 'test/unit/redesign-status-phase0-trim.test.ts',
      'functions/api/clubs/[id].ts', 'functions/api/tournaments.ts', 'functions/api/tournaments/[id].ts', 'domain/contracts/clubs.ts', 'domain/contracts/events.ts',
      'domain/households/publicName.ts', 'src/pages/ClubDetailPage.tsx', 'src/areas/clubs/api.ts', 'src/areas/events/api.ts', 'test/integration/contracts/tournaments.test.ts',
      'test/integration/contracts/tournaments-list.test.ts', 'test/integration/contracts/tournaments-readers.test.ts', 'test/unit/goldText.test.ts',
      'test/unit/public-name.test.ts', 'test/unit/sweep-fixes.test.tsx', 'test/unit/public-answer-rules.test.ts', 'test/unit/club-email-hidden-edges.test.tsx',
      'test/unit/public-answer-config.test.ts', 'test/integration/public-answer-trim-edges.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
    expect(files).toContain('`src/lib/features.ts` is not touched')
    for (const [name, cases] of [
      ['public-answer.test.ts', 26], ['public-answer-switches.test.ts', 7], ['club-email-hidden.test.tsx', 7], ['public-answer-trim.test.ts', 11],
      ['public-answer-rules.test.ts', 22], ['club-email-hidden-edges.test.tsx', 4], ['public-answer-config.test.ts', 3], ['public-answer-trim-edges.test.ts', 15],
    ] as const) {
      expect(files, name).toMatch(new RegExp(`/${name.replace(/\./g, '\\.')}\` \\(${cases}: `))
    }
  })

  it('gives the manager rule, the rule for under 18 and the testing of the constants', () => {
    const managers = bullet(section, '- **The three fields and the manager rule.**')
    for (const piece of ['`publicTournamentAnswer(answer, manages)`', '`canManageTournament`', '`lca_observer`', '`lca_officer`', 'anyone but a guest', '`eventsManagedBy`', '`getDirectedTournamentIds`', 'never one query an event']) {
      expect(managers, piece).toContain(piece)
    }
    const roster = bullet(section, '- **The roster\'s names (`rosterShortNames`, `ROSTER_SHORT_NAMES`).**')
    for (const piece of [
      '`members.guardian_id` set', '`registrations.grade` set', '`IS NOT NULL`', '`computeStandings`', '(D3)', '"Leo Robichaux V" and "Leo Robichaux 3rd" are "Leo R."', '`v`, `2nd` and `3rd`',
      'the roster alone is shortened, as the notes for this change, brief line 1184 and Q38 have it', 'before the event\'s first result as after it',
      'The roster rule leaves two questions for K, each a follow-up below',
    ]) {
      expect(roster, piece).toContain(piece)
    }
    const constants = bullet(section, '- **Testing the constants.**')
    for (const piece of ['`vi.mock`', 'getter', 'no setting of the environment, no binding and no second export']) expect(constants, piece).toContain(piece)
  })

  it('keeps the contracts\' rules: the three optional on the public answers, required on the admin\'s, and PENDING_COUNT at 110', () => {
    const contracts = bullet(section, '- **The contracts.**')
    for (const piece of ['`MANAGER_ONLY_TOURNAMENT_KEYS`', '`tournamentListItemSchema`', '`tournamentDetailSchema`', '`adminTournamentSchema`', '45 keys', '`PENDING_COUNT` stays 110', 'retired member price']) {
      expect(contracts, piece).toContain(piece)
    }
  })

  it('lists every pin that moved with its reason, and the ones held unchanged', () => {
    const pins = bullet(section, '- **Pins moved.**')
    for (const piece of [
      '`test/integration/contracts/tournaments-readers.test.ts`', 'absent there and equal to the row', '`test/unit/goldText.test.ts`', '239, 293 and 335, now 248, 302 and 349',
      '`test/unit/sweep-fixes.test.tsx`', '`test/integration/contracts/tournaments-list-edges.test.ts` 152 to 158', 'an optional key stays in the schema\'s shape',
      '`test/integration/sections-client-readers.test.ts`', '`test/unit/contracts-status.test.ts`', '`test/unit/no-member-price-surface.test.ts`', '`test/unit/sections-reader-audit.test.ts`',
    ]) expect(pins, piece).toContain(piece)
    const inline = bullet(section, '- **The listing rule\'s inline lines.**')
    for (const piece of ['`functions/api/tournaments.ts` 40 and 46 to 41 and 47', '`functions/api/clubs/[id].ts` 38 to 40', '`functions/api/tournaments/[id].ts` 24 to 41', '`ed03823`']) {
      expect(inline, piece).toContain(piece)
    }
  })

  it('gives its judgement calls, its lint, its build against b7c11e6, its browser run, its checks and what the merge does', () => {
    const calls = bullet(section, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    const lint = bullet(section, '- **Lint.**')
    expect(lint).toContain('13 errors and 13 warnings over 770 files')
    expect(lint).toMatch(/the same 13 errors and 13 warnings over \d{3} files, the eleven new files among them, none in a file this change touches/)
    const build = bullet(section, '- **Build.**')
    for (const piece of ['`b7c11e6`', '227 files in `dist` and 189 in `dist/assets`', '141,376', '130,227', '2,656,536', '2,656,876', '9,254 bytes to 9,591', '549,796 bytes to 549,799', 'No zod in the site bundle: 189 files in dist/assets checked.']) {
      expect(build, piece).toContain(piece)
    }
    const browser = bullet(section, '- **The browser run.**')
    for (const piece of ['ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef', 'Baseline matches: no colour or font changed.', 'a11y-off']) expect(browser, piece).toContain(piece)
    const checks = bullet(section, '- Checks:')
    for (const piece of ['13 errors and 13 warnings', '`npm run typecheck:functions`', '`npm run check:bundle`', '`npm run test:a11y`']) expect(checks, piece).toContain(piece)
    const merge = bullet(section, '- **What the merge does.**')
    for (const piece of [
      'No migration', '`deploy-worker.yml`', '`lca-daily-emails`', '`git revert -m 1 <merge sha>`', 'since pull request 119 merged as `27fe278`',
      '`190e118` removes the link', '`pages-build-deployment`', 'it undoes the repair as well', 'revert the revert commit',
    ]) expect(merge, piece).toContain(piece)
  })

  it('records the verify items the notes asked for and the follow-ups for K, WS09, WS05 and the next WS02 step', () => {
    const verify = subsection('Phase 0 verify items resolved')
    for (const head of [
      'The officers\' email had no reader', 'The three fields had no public reader', 'The club\'s address had two readers', 'The roster had one reader',
      'The guardian and eligibility columns',
    ]) {
      expect(entries(verify).some((l) => l.startsWith(`- **${head}`)), head).toBe(true)
    }
    const followUps = subsection('Phase 0 follow-ups')
    for (const piece of ['Q14', 'Q38', 'WS09', 'WS05', 'The next WS02 step records this merge', 'US Chess ID', 'its print page\'s standings', 'K answers the two questions the roster rule leaves']) {
      expect(followUps, piece).toContain(piece)
    }
    expect(section).not.toMatch(/\bone question\b/)
    const deviations = subsection('Phase 0 deviations from the brief')
    for (const piece of ['brief line 3295', '`test/unit/contracts-pending.ts`', '`registrations.grade`', '`publicName`']) {
      expect(deviations, piece).toContain(piece)
    }
    const decisions = subsection('Phase 0 decisions')
    expect(entries(decisions).length).toBeGreaterThanOrEqual(5)
  })

  it('keeps the standings in full and puts the standings before an event\'s first result to K, with Q38, as a follow-up', () => {
    const standings = entries(subsection('Phase 0 follow-ups')).find((l) => l.startsWith('- **The standings before an event\'s first result keep full names (Phase 0).**')) ?? ''
    for (const piece of ['Q38\'s default', 'brief line 1184', '(D3)', '`computeStandings`', '`src/pages/TournamentPrintPage.tsx`', 'K\'s to decide with Q38', 'until K says, they keep full names']) {
      expect(standings, piece).toContain(piece)
    }
    // No decision or deviation of this change has the standings follow the roster.
    const heads = [...entries(subsection('Phase 0 decisions')), ...entries(subsection('Phase 0 deviations from the brief'))]
    expect(heads.filter((l) => /^- \*\*[^*]*standings/i.test(l))).toEqual([])
  })
})

describe('REDESIGN_STATUS.md, the Phase 0 trim: the lines it wrote elsewhere', () => {
  it('gives the date line a Phase 0 piece inside its WS02 part, after the piece that says step 9 is merged and before step 9, keeping its pinned start and end', () => {
    expect(dateLine).toContain(`; ${MERGED}; ${PIECE}; step 9: `)
    expect(dateLine.endsWith('step 1: record and brief 1.4)')).toBe(true)
    expect(dateLine).toMatch(/^Last updated: \S+ \(WS01, step 32: /)
  })

  it('closes the two WS01 follow-ups it does, with one sentence each, and ends the one on minor names with a sentence that leaves it open', () => {
    for (const head of ['Public responses expose personal and internal fields', 'Name suffixes']) {
      expect(ws01Entry(head).endsWith(` ${DONE}`), head).toBe(true)
      expect(ws01Entry(head).split(DONE), head).toHaveLength(2)
    }
    expect(ws01FollowUps.split(DONE)).toHaveLength(3)
    // WS01's words stay, and the one sentence says where publicName is wired, not that the follow-up is done.
    expect(minorNames.startsWith('- **Minor names on the entrants list (step 4).** `publicName` is ready but unused.')).toBe(true)
    expect(minorNames.endsWith(` ${MINOR_NAMES}`)).toBe(true)
    expect(minorNames.split(MINOR_NAMES)).toHaveLength(2)
    expect(minorNames).not.toContain(DONE)
    // The section names this edit among the lines the trim wrote elsewhere.
    expect(bullet(section, '- **Closing search.**')).toContain('the sentence the WS01 follow-up "Minor names on the entrants list (step 4)" gains')
  })

  it('answers the WS02 follow-up with a sentence, every word WS02 step 1 pinned kept, and records WS02 step 9\'s merge in the WS02 section', () => {
    for (const piece of ['`clubEmailHidden`', '`rosterShortNames`', 'as WS02 step 1 declared them']) expect(trimFollowUp, piece).toContain(piece)
    expect(trimFollowUp.endsWith('The trim is built on a branch of its own, `phase0/public-answer-trim`, from WS02 step 9 (Tuesday, November 3, 2026), and keeps both switches as declared, adding only their server halves, `CLUB_EMAIL_HIDDEN` and `ROSTER_SHORT_NAMES`: see the Phase 0 section.')).toBe(true)
    // WS02 step 9's merge, in the PR line, the step's own bullet and the end of its follow-up on checkpoint G's pull request.
    expect(prPiece).toContain('draft pull request 119 carried WS02 step 9 alone, merged into `main` as `27fe278` on Tuesday, November 3, 2026')
    for (const piece of [
      'Merged into `main` as `27fe278` on Tuesday, November 3, 2026 at 11:46 AM UTC', 'a merge commit on head `e58891c`', 'green at 11:44 AM UTC', 'run 41630254243',
      'from 11:47 AM to 12:00 PM UTC', '`index-BP5ORuyk.css`', '`features--b6t5tBm.js`', 'all 42 switches off', 'no `build-date` meta',
      '`GET /api/search?q=chess` answered 200', '`Cache-Control: public, max-age=60`', 'with no `q` answered 400',
    ]) expect(step9Merge, piece).toContain(piece)
    for (const piece of ['pull request 119', '`27fe278`']) expect(recorded, piece).toContain(piece)
    // The mark that keeps the stale-tab reload to once, which the review of WS02 step 9 carried to WS02 step 18.
    for (const piece of ['`sessionStorage`', 'never cleared', 'Refresh button', 'two deploys in one tab']) expect(reloadMark, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the Phase 0 trim: plain words', () => {
  it('reads every piece it means to, and holds no dash, working word, tool, bare letters, old initials, unfilled name or merge-pending phrase', () => {
    for (const text of written) expect(text).not.toBe('')
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(text).not.toMatch(PENDING)
    }
  })

  it('gives every date its weekday', () => {
    for (const text of written) {
      for (const m of text.matchAll(DATE)) expect(text.slice(Math.max(0, (m.index ?? 0) - 12), m.index), m[0]).toMatch(WEEKDAY)
    }
  })

  it('leaves the merge-pending phrase on the one line of the file that held it', () => {
    expect(lines.filter((l) => PENDING.test(l))).toHaveLength(1)
  })
})
