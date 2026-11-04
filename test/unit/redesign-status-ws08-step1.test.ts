// test/unit/redesign-status-ws08-step1.test.ts
//
// REDESIGN_STATUS.md records WS08 step 1: the WS08 section opened, with its
// Status, Branch and PR lines, its map of what proves each acceptance
// criterion and decision of the first part, tournament creation, the step's
// block and the four lists, each opened with this step's entries; and the
// date at the start of the date line. Like the record tests of WS02, this
// file reads only the WS08 section and the one piece the step wrote
// elsewhere, the date, never every table row or heading of the file, and it
// reads no count or figure from the code. Pinned here: the heading word for
// word; the Status line's fixed prefix, which every step keeps; the Branch
// and PR lines in forms the next steps keep; each checkpoint named in full,
// and the checkpoint sections later steps add let stand in the form WS02's
// take; the map, each item with exactly
// one planned step or one part it waits for, and the sentences this step
// added to eight of them; the block's parts in order and its figures, which
// must agree with each other; the tagged entries of the four lists; no table
// row and no merge called pending; the plain-language rules over everything
// the step wrote; and the date, on or after the day of this step. The new
// files are read only to find them and to hold them to the plain-language
// rules.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

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
/** What a draft would hold before its figures were filled in: the marks of the earlier records' drafts and their capitalised names. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}` +
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH', 'RELOAD' + 'TESTS', 'RECORD' + 'TESTS', 'SETUP' + 'TESTS', 'FEATURES' + 'TESTS', 'STEP32' + 'TESTS'].join('|')})\\b`,
)
/** The merge-pending phrase, which the file holds once, in WS01 step 32's line, and this section never. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it. */
function bullet(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS08 step 1).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const HEADING = '## WS08: Director and admin tools (TD console, setup checklist, admin home and queues)'
/** The WS08 section, from its heading to the WS09 heading. */
const ws08 = between(status, `\n${HEADING}\n`, '\n## WS09:')
const sectionLines = ws08.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws08.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws08.slice(at + 1), heading, '\n### ')
}
const MAP = '### WS08 map: what proves each acceptance criterion and decision'
const STEP = '### WS08 step 1: the record and the creation rules'
const LISTS = ['### WS08 decisions', '### WS08 deviations from the brief', '### WS08 verify items resolved', '### WS08 follow-ups']
const map = part(MAP)
const block = part(STEP)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last part, to its end. */
const followUps = ws08.includes(`\n${LISTS[3]}\n`) ? ws08.slice(ws08.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const branchLine = sectionLines.find((l) => l.startsWith('**Branch:**')) ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
/** The date at the start of the date line, the one piece of that line this step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''

/** The Status line up to and including its last fixed words: every step of the part keeps it, and writes only what follows. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '

/**
 * A checkpoint named in full, in a sentence or at the head of its own section, or two or more named together in the plural, as the record
 * writes "checkpoints E and F".
 */
const IN_FULL = /\b[Cc]heckpoints [JKL](?:, [JKL])* and [JKL]\b|\b[Cc]heckpoint [JKL]\b/g
/** A checkpoint's own section, which the step that closes it adds after its block, in the form WS02's take: "### Checkpoint J: WS08 steps 1 to 3". */
const isCheckpoint = (h: string) => /^### Checkpoint [JKL]: WS08 steps \d+ to \d+$/.test(h)
/** The headings of a section that are neither WS08's own nor a checkpoint's section. */
const strayHeadings = (section: string) => section.split('\n').filter((l) => l.startsWith('### ') && !l.startsWith('### WS08 ') && !isCheckpoint(l))
/** Text with what sits in backticks taken out, since code is not prose: a board's name such as `Work-L` is not a checkpoint's letter. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/**
 * What is left of the prose once every checkpoint is named in full: a J or an L on its own, with no hyphen or word character on either side,
 * or a K in the place a checkpoint's letter takes.
 */
const bareLetters = (section: string) =>
  [...proseOf(section).replace(IN_FULL, 'checkpoint').matchAll(/(?<![\w-])[JL](?![\w-])|(?<![\w-])K (?:for (?:steps )?\d|\(steps? \d)/g)].map((m) => m[0])

/** The plan's mapping, item by item, in its order, with the step planned to prove each. */
const PLANNED: ReadonlyArray<readonly [string, number]> = [
  ['AC12', 3], ['AC13', 6], ['AC14', 5], ['AC15', 10], ['The creation-switch test', 1], ['`standingDirectors` in `test/unit/features.test.ts`', 1],
  ['D20', 3], ['D21', 5], ['D22', 6], ['D23', 1], ['D24', 4], ['Q2', 3], ['Q4', 8], ['Q11', 9], ['Q37', 4],
  ['WS01\'s follow-up on the LCA membership requirement', 4], ['WS01\'s three follow-ups on section prices', 4],
  ['WS01\'s follow-up on schedules, and the wizard\'s move', 10], ['WS02\'s follow-up on signed-in pages in the browser tests', 9],
  ['WS02\'s follow-up on the Admin row', 10], ['WS02\'s hand-ons to WS08', 10], ['Q3', 10],
]
/** The items this step proves, each with the sentence it adds. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['The creation-switch test', 'Proved in WS08 step 1 by `test/unit/creation-switch.test.ts`: the constant and the switch equal four ways.'],
  ['`standingDirectors` in `test/unit/features.test.ts`', 'Proved in WS08 step 1 by `test/unit/features.test.ts`: '],
  ['D23', 'Proved in WS08 step 1 by `test/unit/creation-rules.test.ts`: '],
]
/** The items later steps prove that this step built a part of. */
const BUILT = ['AC12', 'AC14', 'D20', 'D21', 'D24']
const BUILT_SENTENCE = 'Built in WS08 step 1: the rule, in `domain/events/creation.ts`.'

/**
 * The files this step adds: the rules, their database half, their two tests and this record's test; and the five files of tests written once
 * the rules were built, four of them unit tests and one an integration test.
 */
const NEW_FILES = [
  'domain/events/creation.ts', 'functions/utils/events/creation.ts', 'test/unit/creation-rules.test.ts', 'test/unit/creation-switch.test.ts',
  'test/unit/redesign-status-ws08-step1.test.ts',
  'test/unit/creation-rules-matrix.test.ts', 'test/unit/creation-fees-raised.test.ts', 'test/unit/creation-modules.test.ts',
  'test/unit/redesign-status-ws08-step1-claims.test.ts', 'test/integration/creation-grant.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The unit test file this step changes, with its count written in the block. */
const CHANGED_TESTS = ['test/unit/features.test.ts']
/** The unit test file whose count grows with no change of its own. */
const GROWN = ['test/unit/domain-boundaries.test.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS08 step 1: the section and its three lines', () => {
  it('keeps the WS08 heading word for word, once, with the section running to the WS09 heading', () => {
    expect(status.split(`\n${HEADING}\n`)).toHaveLength(2)
    expect(ws08).not.toBe('')
    expect(ws08.slice(1).includes('\n## ')).toBe(false)
  })

  it('opens with the Status, Branch and PR lines, one after another under the heading', () => {
    expect(sectionLines.slice(1, 6)).toEqual([HEADING, '', statusLine, branchLine, prLine])
    for (const line of [statusLine, branchLine, prLine]) expect(line).not.toBe('')
  })

  it('keeps the Status line\'s fixed prefix and gives it a tail of its own that says which steps are built', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('names the branch and the commit of main it was cut from', () => {
    expect(branchLine).toBe('**Branch:** `redesign/ws08-creation-roles`, cut from `main` at `0018039`.')
  })

  it('names the three checkpoints in the PR line, each in full, and never calls a merge pending', () => {
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    for (const piece of ['checkpoint J (steps 1 to 3)', 'checkpoint K (steps 4 to 6)', 'checkpoint L (steps 7 to 10)']) expect(prLine, piece).toContain(piece)
    expect(prLine.replace(IN_FULL, '')).not.toMatch(/\b[JKL]\b/)
    expect(prLine).not.toContain('is pending')
  })

  it('writes the checkpoint letters in full everywhere, the Status line\'s fixed prefix included', () => {
    expect(STATUS_PREFIX).toContain('(checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10)')
    expect(bareLetters(ws08)).toEqual([])
  })

  it('keeps K, in what this step wrote, to K the person, never in a place a checkpoint\'s letter takes', () => {
    const own = [STATUS_PREFIX, block, ...[decisions, deviations, verify, followUps].flatMap((list) => tagged(list))]
    for (const text of own) expect(text.replace(IN_FULL, 'checkpoint')).not.toMatch(/\bK (?:for|after|opens|merges|carries|holds) /)
  })

  it('lets a later step\'s checkpoint section stand, in the form WS02\'s take, and still finds a stray heading or a letter alone', () => {
    // The section WS08 step 3 adds before the lists, opened as its plan writes it.
    const checkpointJ = '### Checkpoint J: WS08 steps 1 to 3\n\n**Not merged yet: checkpoint J waits for its merge into `main`** (a draft pull request to be opened).\n\n'
    const later = ws08.replace(`\n${LISTS[0]}\n`, `\n${checkpointJ}${LISTS[0]}\n`)
    expect(later).toContain(`\n${checkpointJ}${LISTS[0]}\n`)
    expect(strayHeadings(later)).toEqual([])
    expect(bareLetters(later)).toEqual([])
    expect(strayHeadings(later.replace('### Checkpoint J: WS08', '### Step 3: WS08'))).toEqual(['### Step 3: WS08 steps 1 to 3'])
    expect(bareLetters(later.replace('checkpoint J waits', 'J waits'))).toEqual(['J'])
    expect(bareLetters(later.replace('checkpoint K for 4 to 6', 'K for 4 to 6'))).toEqual(['K for 4'])
  })

  it('reads a board\'s name in backticks and checkpoints named together as no letter alone, and still finds a K in a checkpoint\'s place', () => {
    for (const text of [
      'The setup checklist from `Work-L` replaces the wizard.',
      'the admin home (`Work-J`)',
      'Checkpoints J and K are merged into `main`.',
      'checkpoints J, K and L',
    ]) expect(bareLetters(text), text).toEqual([])
    expect(bareLetters('K for steps 4 to 6')).toEqual(['K for steps 4'])
    expect(bareLetters('Checkpoints J and K are merged; L waits.')).toEqual(['L'])
  })
})

describe('REDESIGN_STATUS.md, WS08 step 1: the map', () => {
  it('maps the 22 items of the plan as a list, in its order', () => {
    expect(map).not.toBe('')
    expect(mapItems.map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PLANNED.map(([id]) => id))
    expect(ws08.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('ends each item with exactly one planned step or one part it waits for, the step the plan gives it', () => {
    for (const [id, step] of PLANNED) {
      const item = mapItem(id)
      const planned = item.match(/Planned: WS08 step (?:[1-9]|10)\./g) ?? []
      const waits = item.match(/Waits for the (?:console|admin home|Phase 4) part\./g) ?? []
      expect(planned.length + waits.length, id).toBe(1)
      expect(item, id).toMatch(/(?:Planned: WS08 step (?:[1-9]|10)|Waits for the (?:console|admin home|Phase 4) part)\.$/)
      if (planned.length === 1) expect(item.endsWith(`Planned: WS08 step ${step}.`), id).toBe(true)
    }
  })

  it('says what this step proves of three items, each sentence once, ahead of the planned step', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS08 step 1.'))
    }
    expect(mapItems.filter((l) => l.includes('Proved in WS08 step 1 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
    expect(mapItem('`standingDirectors` in `test/unit/features.test.ts`')).toContain('`standingDirectors` present, a boolean and off')
    expect(mapItem('D23')).toContain('`lcaAffiliateAllowed` answers true')
  })

  it('says what this step built of five items later steps prove, each once, ahead of their planned steps', () => {
    for (const id of BUILT) {
      const item = mapItem(id)
      expect(item.split(BUILT_SENTENCE), id).toHaveLength(2)
      expect(item.indexOf(BUILT_SENTENCE), id).toBeLessThan(item.search(/Planned: WS08 step \d+\.$/))
    }
    expect(mapItems.filter((l) => l.includes('Built in WS08 step 1:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT)
  })

  it('names the halves of AC12 to AC15 that wait for later parts in their own words, and Q4\'s visible line', () => {
    for (const [id, piece] of [
      ['AC12', 'A member organizer\'s first director row waits for the Phase 4 part'], ['AC12', 'the former creator\'s 403 on the console for the console part'],
      ['AC13', 'Its email half:'], ['AC13', '`published_review`'], ['AC13', 'waits for the admin home part'], ['AC13', 'the publish on its date (`publish_at`) for the console part'],
      ['AC14', 'The director using the console waits for the console part'], ['AC14', 'the table\'s representative and member organizer columns for WS09 and the Phase 4 part'],
      ['AC15', 'An LCA admin\'s refused fee on a member-created event waits for the Phase 4 part'], ['AC15', 'the Fees step itself, the panel on the setup checklist, for the console part'],
      ['Q4', 'visible help text beside the role choice and never as a title attribute'],
    ] as const) expect(mapItem(id), `${id}: ${piece}`).toContain(piece)
  })

  it('gives Q2 the plan\'s words: a club rep who holds the seat keeps its path, the seat adding nothing on create', () => {
    expect(mapItem('Q2')).toContain('a club rep who holds the President seat keeps that path, the seat adding nothing on create.')
    expect(mapItem('Q2')).not.toContain('the president\'s rights')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 1: the step block', () => {
  it('sits after the map and before the four lists, once, and every heading of the section is WS08\'s or a checkpoint\'s section', () => {
    const at = [MAP, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    const headings = sectionLines.filter((l) => l.startsWith('### '))
    // The six parts this step opened, once each; every other heading is a later step's block or a checkpoint's section.
    const FIXED = [MAP, STEP, ...LISTS]
    for (const fixed of FIXED) expect(headings.filter((h) => h === fixed), fixed).toHaveLength(1)
    for (const h of headings.filter((l) => !FIXED.includes(l))) expect(/^### WS08 step (?:[1-9]|10): \S/.test(h) || isCheckpoint(h), h).toBe(true)
    expect(strayHeadings(ws08)).toEqual([])
    expect(headings.filter((h) => /^### Step\b/.test(h))).toEqual([])
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **The rules.**', '- **The constant.**', '- **The map.**', '- **The branch.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(checksLine).not.toBe('')
  })

  it('names every file it adds and changes, each test with its count', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED_TESTS, ...GROWN, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
  })

  it('gives the rules each function and what it answers, repClubId beside the grant, and the two refusals\' words', () => {
    const rules = bullet(block, '- **The rules.**')
    for (const piece of [
      '`CreationPerson`', '`CreationGrant`', '`repClubId`', '`canCreate(person, clubId, rolesOn)`', '`canChargeFees(person, event, rolesOn)`',
      '`canAssignDirectors(person, event, rolesOn)`', '`canDeleteDraft(person, event, rolesOn)`', '`lcaAffiliateAllowed(event)`', '`feesRaised(before, after)`',
      '`holdsPresidentSeat(db, memberId)`', '`creationGrant(db, member, rolesOn)`', '`creationPerson`', '`creatorGrant(db, tournamentId, rolesOn)`',
      '`FEES_NEED_PAYOUT_ACCOUNT`, "Entry fees need a payout account first. Until then, your event can run at $0."',
      '`LCA_RUN_ONLY`, "Standing directors and the president create LCA-run events, not a club\'s."', 'none has a default for `rolesOn`',
    ]) expect(rules, piece).toContain(piece)
  })

  it('gives the constant its file, its comment and its test, the map its count, and the branch its cut', () => {
    const constant = bullet(block, '- **The constant.**')
    for (const piece of ['`export const CREATION_ROLES_ON = false`', '`functions/utils/events/creation.ts`', '"Set: "', '`standingDirectors`', '`test/unit/creation-switch.test.ts`', 'four ways']) {
      expect(constant, piece).toContain(piece)
    }
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['22 items', 'none waits whole for a later part', 'AC12 to AC15']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws08-creation-roles`', '`0018039`', 'pull request 120', 'no merge of the trim was needed']) expect(branch, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and moves no pin', () => {
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears')).toBe(true)
    expect(block).toContain('what a visitor sees, by switch, is nothing new')
    expect(bullet(block, '- **Pins moved.**').startsWith('- **Pins moved.** None')).toBe(true)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
  })

  it('gives the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`0018039`', 'the main script', 'the stylesheet', 'the switches chunk', 'bytes']) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 1: the lists', () => {
  it('tags every entry of the four lists in the form the record keeps', () => {
    for (const list of [decisions, deviations, verify, followUps]) {
      expect(entries(list).length).toBeGreaterThan(0)
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
  })

  it('records the decisions this step takes, Q2\'s in the words set for it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Ten steps in three checkpoints (WS08 step 1).',
      'The seat is the grant (WS08 step 1).',
      'Q37 on its default: a standing director\'s and the president\'s events are LCA-run (WS08 step 1).',
      'Q2 keeps club reps as today (WS08 step 1).',
      'Q4: the role is today\'s tournament_director (WS08 step 1).',
      'Q11 first, on today\'s pages (WS08 step 1).',
      'D23 noted (WS08 step 1).',
    ])
    const q2 = tagged(decisions).find((l) => head(l).startsWith('Q2 ')) ?? ''
    expect(q2).toContain('Q2 keeps club reps as today: no step widens or removes a club rep\'s creation or naming; the delete of an unpublished draft they created is new, for every creator, once CREATION_ROLES_ON is set.')
  })

  it('records the deviations of this step', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'This part first, ahead of WS03 to WS07 (WS08 step 1).',
      'No WS08 piece in the date line (WS08 step 1).',
      'Five grants, two more rules and the club a rep manages (WS08 step 1).',
      'The seat wins over a role, and a club rep\'s right stays beside the grant (WS08 step 1).',
      'A raise is a rise in what an entrant pays (WS08 step 1).',
      'The WS08 list holds standingDirectors alone (WS08 step 1).',
    ])
  })

  it('resolves the verify items, each confirmed in the code', () => {
    expect(tagged(verify).map(head)).toEqual([
      'The President seat (WS08 step 1).',
      'The WS08 heading (WS08 step 1).',
      'The date line is pinned end to end (WS08 step 1).',
      'TierFees and tierFees (WS08 step 1).',
      'The switch and its comment (WS08 step 1).',
      'The trim\'s switch test as the model (WS08 step 1).',
      'The rules today (WS08 step 1).',
      'An officer president and the entrants\' email (WS08 step 1).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(tagged(verify)[0]).toContain('Production was not read')
  })

  it('records its own follow-ups, the one it hands to WS08 step 3, then those it carries, each once and with the step that takes it, K\'s reads in K\'s hands', () => {
    const own = [
      'K\'s two production reads before standingDirectors goes on (WS08 step 1).',
      'K\'s questions for WS08, with their defaults (WS08 step 1).',
      'An officer president in the console part (WS08 step 1).',
    ]
    /** WS08's own follow-up this step hands on, tagged with the step that takes it. */
    const handed = ['A club rep who holds the seat creates its own club\'s draft (WS08 step 3).']
    const carried = [
      'From WS01: the LCA membership requirement (WS08 step 4).',
      'From WS01: the three follow-ups on section prices (WS08 step 4).',
      'From WS01: schedules and the wizard\'s move (WS08 step 10).',
      'From WS02: signed-in pages in the browser tests (WS08 step 9).',
      'From WS02: the Admin row without a count (WS08 step 10).',
      'From WS02: the hand-ons to WS08 (WS08 step 10).',
    ]
    expect(tagged(followUps).map(head)).toEqual(own)
    const heads = entries(followUps).map(head)
    expect(heads.slice(0, own.length + handed.length + carried.length)).toEqual([...own, ...handed, ...carried])
    for (const name of [...own, ...handed, ...carried]) expect(heads.filter((h) => h === name), name).toHaveLength(1)
    const club = entries(followUps).find((l) => head(l) === handed[0]) ?? ''
    for (const piece of [
      '`canCreate` answers yes for a club rep who holds the President seat on an LCA-run event', 'it takes a club rep\'s own club first', 'the seat adds nothing on create',
    ]) expect(club, piece).toContain(piece)
    const reads = entries(followUps)[0]
    for (const piece of [
      'K runs them with K\'s own credentials', 'never a write', 'reports names, never emails',
      '`SELECT id, full_name, membership_status, club_id FROM members WHERE role = \'tournament_director\' ORDER BY full_name;`',
      'WHERE s.slug = \'president\';`',
    ]) expect(reads, piece).toContain(piece)
    expect(reads).not.toMatch(/SELECT[^`]*\bemail\b/)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 1: plain language', () => {
  /** Everything this step wrote: the section, and the date line's date. */
  const written = [ws08, date?.[0] ?? '']
  /** The same, with what sits in backticks taken out, since code is not prose. */
  const prose = written.map(proseOf)

  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
    for (const text of [map, block, decisions, deviations, verify, followUps]) expect(text).not.toBe('')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrase out of what the step wrote', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(text).not.toMatch(PENDING)
      expect(text).not.toContain('is pending')
    }
    // The CI files are named by their file names alone.
    expect(ws08).not.toMatch(/\.github\//)
  })

  it('names steps as "WS08 step N", never with the bare "(step N)" WS01\'s tests look for', () => {
    expect(ws08).not.toMatch(/\(step \d+[;),]/)
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of prose) {
      for (const found of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 1: the date', () => {
  it('dates the record on a real day, on or after Tuesday, November 3, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-03').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 1: its claims against the files', () => {
  it('lists as new only files that exist, each free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of NEW_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of [...CHANGED_TESTS, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed file\'s gain and the grown file\'s growth', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([6772, 254])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    const gains = CHANGED_TESTS.map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    const grown = [...bullet(files, '  - Grown with no change:').matchAll(/`[^`]+` \((\d+), (\d+) before: /g)].map((m) => Number(m[1]) - Number(m[2]))
    expect(grown).toHaveLength(GROWN.length)
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + [...fresh, ...gains, ...grown].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the new integration file\'s tests', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([897, 65])
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    expect(fresh).toHaveLength(1)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as one run whose counts add up', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
  })

  it('gives the lint figures as the base\'s with the new files added', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })
})
