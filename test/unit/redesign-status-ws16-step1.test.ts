// test/unit/redesign-status-ws16-step1.test.ts
//
// REDESIGN_STATUS.md records WS16 step 1: the WS16 section opened, with its
// Status, Branch and PR lines and its opening paragraph, its map of what
// proves each acceptance criterion, decision and question of part one, the
// step's block and the four lists, each opened with this step's entries;
// and the date at the start of the date line. Like the record tests of
// WS02 and WS08, this file reads only the WS16 section, from its heading to
// the Phase 0 heading, and the date, never every table row or heading of
// the file, and it reads no count or figure from the code. The step's
// other piece of the record, checkpoint L's merge in WS08's section, is
// held here only through the block's part that names it; WS08's own record
// tests read those lines. Pinned here: the heading word for word; the
// Status line's fixed prefix, which every step of part one keeps, and its
// tail while this step is the latest; the Branch and PR lines in forms the
// next steps keep; each checkpoint named in full; the map, each item with
// exactly one planned step, and the sentences this step added to eleven of
// them; the block's parts in order and its figures, which must agree with
// each other; the tagged entries of the four lists; no table row and no
// merge called pending; the plain-language rules over everything the step
// wrote; and the date, on or after the day of this step. The new files are
// read only to find them and to hold them to the plain-language rules.
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
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i

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
const TAG = '(WS16 step 1).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
/** The WS16 section, from its heading to the Phase 0 heading. */
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const sectionLines = ws16.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws16.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws16.slice(at + 1), heading, '\n### ')
}
const MAP = '### WS16 map: what proves each acceptance criterion and decision'
const STEP = '### WS16 step 1: the record, the switches and one seam'
const LISTS = ['### WS16 decisions', '### WS16 deviations from the brief', '### WS16 verify items resolved', '### WS16 follow-ups']
/** The block of the change between checkpoint M's merge and the switch-on, at the section's end, its heading as written. */
const BEFORE_SWITCH_ON = '### Before the switch-on: the newsletter tab\'s last rough spots'
const map = part(MAP)
const block = part(STEP)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last list, to its end or to the block written after checkpoint M's merge, which follows them. */
const followUps = ws16.includes(`\n${LISTS[3]}\n`) ? between(ws16.slice(ws16.indexOf(`\n${LISTS[3]}\n`) + 1), LISTS[3], `\n${BEFORE_SWITCH_ON}\n`) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const branchLine = sectionLines.find((l) => l.startsWith('**Branch:**')) ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
/** The paragraph under the three lines, which says where WS16 comes from. */
const openingParagraph = sectionLines[7] ?? ''
/** The date at the start of the date line, the one piece of that line this step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/**
 * A map item's words as this step left them, up to the end of the sentence this step built into it: whatever a later step adds
 * to the item goes after that sentence, in front of the planned step.
 */
const asLeft = (item: string) => {
  const built = item.indexOf('Built in WS16 step 1: ')
  const end = built < 0 ? -1 : item.indexOf('. ', built)
  return end < 0 ? item : item.slice(0, end + 1)
}
/** The highest step of WS16 with a block of its own: this step's tail of the Status line holds only while it is the latest. */
const latestStep = Math.max(0, ...[...ws16.matchAll(/^### WS16 step (\d+): /gm)].map((m) => Number(m[1])))

/** The Status line up to and including its last fixed words: every step of part one keeps it, and writes only what follows. */
const STATUS_PREFIX =
  '**Status:** in progress: part one, the mail engine and the first LCA newsletter, twelve steps in three checkpoints (checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12); '
const TAIL = 'step 1 is built.'

/** A checkpoint named in full, in a sentence or at the head of its own section, or two or more named together in the plural. */
const IN_FULL = /\b[Cc]heckpoints [J-O](?:, [J-O])* and [J-O]\b|\b[Cc]heckpoint [J-O]\b/g
/** A checkpoint's own section, which the step that closes it adds after its block: "### Checkpoint M: WS16 steps 1 to 8", or one step's. */
const isCheckpoint = (h: string) => /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(h)
/** The headings of the section that are neither WS16's own, a checkpoint's section nor that block. */
const strayHeadings = (section: string) => section.split('\n').filter((l) => l.startsWith('### ') && !l.startsWith('### WS16 ') && !isCheckpoint(l) && l !== BEFORE_SWITCH_ON)
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** What is left of the prose once every checkpoint is named in full: a letter of WS08's or WS16's checkpoints on its own, K aside, who is the owner. */
const bareLetters = (section: string) => [...proseOf(section).replace(IN_FULL, 'checkpoint').matchAll(/(?<![\w-])[JLMNO](?![\w-])/g)].map((m) => m[0])

/** The plan's list of items, in its order, with the step planned to prove each; a question's is the step that builds its default. */
const PLANNED: ReadonlyArray<readonly [string, number]> = [
  ['AC1', 1], ['AC2', 7], ['AC3', 7], ['AC4', 8], ['AC5', 2], ['AC6', 3], ['AC7', 3], ['AC8', 7], ['AC9', 5], ['AC10', 4], ['AC11', 6],
  ['AC12', 4], ['AC13', 8], ['AC14', 8], ['AC15', 9], ['AC16', 12], ['AC17', 11],
  ['The switch-pair test', 1], ['`mailLists` in `test/unit/features.test.ts`', 1],
  ['D31', 1], ['D32', 1], ['D33', 7], ['D34', 3], ['D35', 8], ['D36', 4], ['D37', 4], ['D38', 4], ['D39', 6], ['D40', 5], ['D41', 3],
  ['Q40', 4], ['Q41', 4], ['Q42', 7], ['Q43', 6], ['Q44', 4], ['Q45', 5], ['Q46', 11], ['Q47', 8], ['Q48', 7], ['Q49', 12],
]
/** The items this step proves, each with the start of the sentence it adds. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC1', 'Proved in WS16 step 1 by `test/unit/mail-seam-bytes.test.ts`, `test/unit/mail-one-seam.test.ts`, `test/unit/published-review-notice.test.ts` and the thirteen integration files that read the harness\'s outbox: '],
  ['The switch-pair test', 'Proved in WS16 step 1 by `test/unit/mail-switches.test.ts`: the constant and the switch equal four ways'],
  ['`mailLists` in `test/unit/features.test.ts`', 'Proved in WS16 step 1 by `test/unit/features.test.ts`: its WS16 list holds `mailLists` present, a boolean and off'],
  ['D31', 'Proved in WS16 step 1 by `test/unit/mail-seam-bytes.test.ts`, `test/unit/mail-one-seam.test.ts` and `test/unit/mail-switches.test.ts`: '],
  ['D32', 'Proved in WS16 step 1 by `test/unit/redesign-status-ws16-step1.test.ts`: the branch is cut from `main` at `719abad`'],
]
/** The items later steps prove that this step built a part of. */
const BUILT = ['AC3', 'AC5', 'AC14', 'AC16', 'D36', 'Q44']

/**
 * The files this step adds: the seam's five files, the addresses, the five tests of the seam and this record's test. Two of them,
 * functions/utils/mail/resend.ts and test/unit/mail-seam-bytes.test.ts, go with Resend in WS16 step 12, so the checks that read a file
 * read those two only while they exist; the record still names them.
 */
const NEW_FILES = [
  'functions/utils/mail/switches.ts', 'functions/utils/mail/rules.ts', 'functions/utils/mail/send.ts', 'functions/utils/mail/resend.ts',
  'functions/utils/mail/outcome.ts', 'domain/mail/addresses.ts',
  'test/unit/mail-switches.test.ts', 'test/unit/mail-seam-bytes.test.ts', 'test/unit/mail-one-seam.test.ts', 'test/unit/mail-worker-closure.test.ts',
  'test/unit/mail-rules-outcome.test.ts', 'test/unit/redesign-status-ws16-step1.test.ts',
]
/** The two new files WS16 step 12 deletes with Resend. */
const GO_WITH_RESEND = ['functions/utils/mail/resend.ts', 'test/unit/mail-seam-bytes.test.ts']
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
/** The files of code this step changes. */
const CHANGED = ['functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'src/lib/features.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = ['test/unit/features.test.ts', 'test/unit/redesign-status-ws02-step2.test.ts', 'test/unit/preview-database.test.ts']
/** The unit test files whose counts grow with no change of their own. */
const GROWN = ['test/unit/domain-boundaries.test.ts', 'test/unit/test-setup.test.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS16 step 1: the section and its three lines', () => {
  it('keeps the WS16 heading word for word, once, after WS15\'s section and before the Phase 0 section', () => {
    expect(status.split(`\n${HEADING}\n`)).toHaveLength(2)
    expect(ws16).not.toBe('')
    expect(ws16.slice(1).includes('\n## ')).toBe(false)
    expect(status.indexOf('\n## WS15:')).toBeLessThan(status.indexOf(`\n${HEADING}\n`))
    expect(status.indexOf(`\n${HEADING}\n`)).toBeLessThan(status.indexOf('\n## Phase 0: the public-answer trim\n'))
  })

  it('quotes no other section\'s heading in its words, since the Phase 0 trim\'s record test finds its own heading by its text alone', () => {
    expect(ws16).not.toContain('## Phase 0:')
    expect(ws16.split('\n').filter((l) => !l.startsWith('#') && /(?:^|[^#`])#{2} [A-Z]/.test(l))).toEqual([])
  })

  it('opens with the Status, Branch and PR lines, one after another under the heading, and then its opening paragraph', () => {
    expect(sectionLines.slice(1, 7)).toEqual([HEADING, '', statusLine, branchLine, prLine, ''])
    for (const line of [statusLine, branchLine, prLine, openingParagraph]) expect(line).not.toBe('')
  })

  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(1)
    if (latestStep === 1) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('names the branch and the commit of main it was cut from, checkpoint L\'s merge', () => {
    expect(branchLine).toBe('**Branch:** `redesign/ws16-mail`, cut from `main` at `719abad`.')
  })

  it('names the three checkpoints in the PR line, each in full, checkpoint M waiting for its merge, by a pull request or merged, and never calls a merge pending', () => {
    expect(prLine.startsWith('**PR:** checkpoint M (steps 1 to 8) ')).toBe(true)
    for (const piece of ['checkpoint M (steps 1 to 8)', 'checkpoint N (steps 9 to 11)', 'checkpoint O (WS16 step 12)']) expect(prLine, piece).toContain(piece)
    expect(prLine).toMatch(/waits for its merge into `main`|pull request \d+|merged/)
    expect(prLine.replace(IN_FULL, '')).not.toMatch(/\b[MNO]\b/)
    expect(prLine).not.toContain('is pending')
    expect(prLine).not.toMatch(/\bnone yet\b/)
  })

  it('says in its opening paragraph where WS16 comes from: K\'s decisions of their day, and the section kept as its own file beside brief 1.4', () => {
    for (const piece of [
      'WS16 is new since brief 1.4', 'K\'s decisions of Tuesday, November 10, 2026', '`docs/redesign/ws16-brief-section.md`', '`redesign/docs-phase2`',
      'Brief 1.4 itself is not edited, since four record tests pin it as closed history',
      'Every step of part one merges with `mailLists` off, `MAIL_LISTS_ON` unset and `MAIL_SENDER` `\'resend\'`',
    ]) expect(openingParagraph, piece).toContain(piece)
  })

  it('writes the checkpoint letters in full everywhere, the Status line\'s fixed prefix included', () => {
    expect(STATUS_PREFIX).toContain('(checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12)')
    expect(bareLetters(ws16)).toEqual([])
  })

  it('lets a later step\'s checkpoint section stand, and still finds a stray heading or a letter alone', () => {
    const checkpointM = '### Checkpoint M: WS16 steps 1 to 8\n\n**Not merged yet: checkpoint M waits for its merge into `main`** (a draft pull request to be opened).\n\n'
    const later = ws16.replace(`\n${LISTS[0]}\n`, `\n${checkpointM}${LISTS[0]}\n`)
    expect(later).toContain(`\n${checkpointM}${LISTS[0]}\n`)
    expect(strayHeadings(later)).toEqual([])
    expect(bareLetters(later)).toEqual([])
    expect(isCheckpoint('### Checkpoint O: WS16 step 12')).toBe(true)
    expect(strayHeadings(later.replace('### Checkpoint M: WS16', '### Step 8: WS16'))).toEqual(['### Step 8: WS16 steps 1 to 8'])
    expect(bareLetters(later.replace('checkpoint M waits', 'M waits'))).toEqual(['M'])
    expect(bareLetters('Checkpoints M and N are merged; O waits.')).toEqual(['O'])
    expect(bareLetters('WS08\'s checkpoint L, and `Work-M` in backticks')).toEqual([])
  })
})

describe('REDESIGN_STATUS.md, WS16 step 1: the map', () => {
  it('maps the 40 items of the plan as a list, in its order, and says so', () => {
    expect(map).not.toBe('')
    expect(mapItems.map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PLANNED.map(([id]) => id))
    expect(ws16.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
    expect(map).toContain('40 in all')
    expect(map).toContain('The map is a list and not a table')
  })

  it('ends each item with exactly one planned step, the step the plan gives it', () => {
    for (const [id, step] of PLANNED) {
      const item = mapItem(id)
      const planned = item.match(/Planned: WS16 step (?:[1-9]|1[0-2])\./g) ?? []
      expect(planned.length, id).toBe(1)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
    }
  })

  it('says what this step proves of five items, each sentence once, ahead of the planned step', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 1.'))
    }
    expect(mapItems.filter((l) => l.includes('Proved in WS16 step 1 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
  })

  it('names the half of AC1 the one-seam test allows, the two launch scripts, and the halves of D31 that come later', () => {
    for (const piece of ['`scripts/provision-users.mjs`', '`scripts/send-launch-emails.mjs`', 'run by hand from a terminal', 'until WS16 step 12 takes their send halves out']) {
      expect(mapItem('AC1'), piece).toContain(piece)
    }
    for (const piece of ['Amazon SES sending comes with WS16 step 7', 'Resend\'s removal with WS16 step 12']) expect(mapItem('D31'), piece).toContain(piece)
  })

  it('says what this step built of six items later steps prove, each once, ahead of their planned steps', () => {
    for (const id of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 1: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS16 step 1: '), id).toBeLessThan(item.search(/Planned: WS16 step \d+\.$/))
    }
    expect(mapItems.filter((l) => l.includes('Built in WS16 step 1:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT)
  })

  it('keeps the section\'s words on the addresses in what this step wrote: nothing but today\'s forms decided, the recommended one named as recommended', () => {
    expect(mapItem('Q44')).toContain('Working assumption: Not decided')
    expect(mapItem('D36')).toContain('K had not decided them on Tuesday, November 10, 2026')
    const recommended = new RegExp(escape('newsletter@news.louisianachess.org'), 'g')
    /** The 40 characters in front of each mention of the recommended form in a text. */
    const before = (text: string) => [...text.matchAll(recommended)].map((m) => text.slice(Math.max(0, (m.index ?? 0) - 40), m.index))
    // Only this step's own words: the two items as this step left them, this block and this step's entries. A later step that
    // writes the address does so in its own words, which its own record test holds, so the whole section is read only while
    // this step is the latest, as the Status line's tail is.
    const own = [asLeft(mapItem('D36')), asLeft(mapItem('Q44')), block, ...[decisions, deviations, verify, followUps].flatMap(tagged)]
    expect(own.flatMap(before).length).toBeGreaterThan(0)
    for (const text of [...own, ...(latestStep === 1 ? [ws16] : [])]) {
      for (const words of before(text)) expect(words, 'each mention of the recommended form').toMatch(/recommended newsletter form is `?$/)
    }
  })

  it('gives the decisions and questions their settled words, and D41 no postal address', () => {
    for (const [id, piece] of [
      ['D31', 'Amazon SES, through one seam (settled by K, Tuesday, November 10, 2026)'], ['D32', 'right after WS08\'s checkpoint L merges, ahead of WS09'],
      ['D41', 'no postal address in any email'], ['Q40', '"you need to be active to get the newsletter"'], ['Q41', '(a), settled by K on Tuesday, November 10, 2026'],
      ['Q42', 'Yes, settled by K on Tuesday, November 10, 2026'], ['AC1', 'Every email goes through one seam'],
    ] as const) expect(mapItem(id), `${id}: ${piece}`).toContain(piece)
  })

  it('names the one step of part one that proves no item on its own', () => {
    expect(map).toContain('WS16 step 10 proves no item on its own')
  })
})

describe('REDESIGN_STATUS.md, WS16 step 1: the step block', () => {
  it('sits after the map and before the four lists, once, and every heading of the section is WS16\'s or a checkpoint\'s section', () => {
    const at = [MAP, STEP, ...LISTS].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const headings = sectionLines.filter((l) => l.startsWith('### '))
    const FIXED = [MAP, STEP, ...LISTS]
    for (const fixed of FIXED) expect(headings.filter((h) => h === fixed), fixed).toHaveLength(1)
    for (const h of headings.filter((l) => !FIXED.includes(l))) expect(/^### WS16 step (?:[1-9]|1[0-2]): \S/.test(h) || isCheckpoint(h) || h === BEFORE_SWITCH_ON, h).toBe(true)
    expect(strayHeadings(ws16)).toEqual([])
    expect(headings.filter((h) => /^### Step\b/.test(h))).toEqual([])
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **The seam.**', '- **The addresses.**', '- **The switches.**', '- **The record opened.**', '- **Checkpoint L\'s merge recorded.**',
      '- **What the merge does.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**',
      '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(checksLine).not.toBe('')
  })

  it('names every file it adds and changes, each test with its count', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS, ...GROWN, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_UNIT) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
  })

  it('gives the seam its function, its shapes, no fallback inside a send, the one file that names Resend\'s address, and today\'s words', () => {
    const seam = bullet(block, '- **The seam.**')
    for (const piece of [
      '`deliver(env, mail)`', '`functions/utils/mail/send.ts`', '`senderNow()`', '`OutgoingMail`', '`MailEnv`', '`SendResult`', '`SENDER_NAME`',
      'There is no fallback from one service to another inside a send', '`\'single\'`', '`\'campaign\'`', '`functions/utils/mail/resend.ts`',
      'the one file under `functions/` that names a mail service\'s address', '"Email send failed (<status>): <body>"', '"Resend <status>: <body>"',
      '`sendOne`', '`classifyToday`', '"Unknown send error"',
    ]) expect(seam, piece).toContain(piece)
  })

  it('gives the addresses their file, today\'s three values and nothing more, and the switches their words', () => {
    const addresses = bullet(block, '- **The addresses.**')
    for (const piece of [
      '`domain/mail/addresses.ts`', '`DEFAULT_FROM`', '`DEFAULT_REPLY_TO`', '`SENDER_NAME`', '"Louisiana Chess Association"', '`FROM_EMAIL`', '`REPLY_TO_EMAIL`',
      'WS16 step 4 adds each LCA list\'s From address and display name', 'from the address map',
      'No new address, subdomain or display name is written anywhere as if it were decided.',
    ]) expect(addresses, piece).toContain(piece)
    const switches = bullet(block, '- **The switches.**')
    for (const piece of [
      '`mailLists: false`', '"Redesign, mail. Off until it is checked on a preview."', '`MAIL_LISTS_ON = false`', '"Set: "', '`test/unit/mail-switches.test.ts`',
      '`MAIL_SENDER: MailSender = \'resend\'`', 'never by a setting', 'Nothing reads `MAIL_LISTS_ON` yet',
    ]) expect(switches, piece).toContain(piece)
  })

  it('names the record it opened, checkpoint L\'s merge in a sentence or two, and what the merge does', () => {
    expect(bullet(block, '- **The record opened.**')).toContain('the map, 40 items')
    const merge = bullet(block, '- **Checkpoint L\'s merge recorded.**')
    for (const piece of ['WS08\'s section', 'draft pull request 125', '`719abad`', 'Tuesday, November 10, 2026', 'the Checkpoint L section opens with the merge']) expect(merge, piece).toContain(piece)
    expect(merge.split('\n')).toHaveLength(1)
    expect(proseOf(merge).split(/[.;](?:\s|$)/).filter((s) => s.trim() !== '').length).toBeLessThanOrEqual(3)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration.', '`deploy-worker.yml`', 'daily-emails worker', 'byte for byte']) expect(does, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, names the two pins it moves, and its judgement calls', () => {
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/redesign-status-ws02-step2.test.ts`', '42 to 43', '`test/unit/preview-database.test.ts`', '15 to 16', '"WS01 to WS16"',
      'The first is WS02 step 2\'s record test, a closed step\'s,', 'no other record test changes, and no pin on words a record wrote moves.',
    ]) {
      expect(pins, piece).toContain(piece)
    }
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
  })

  it('gives the lint as unchanged, the build and the worker against the base, and each figure of the checks once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`719abad`', 'the main script', 'the stylesheet', 'the switches chunk', 'bytes', 'a local production build']) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })

  it('gives the worker\'s dry run on the base and after, measured on their days, growing by no more than 2 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`719abad`', 'Tuesday, November 10, 2026']) expect(worker, piece).toContain(piece)
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    const [base, after] = sizes
    expect(base).toEqual([31.99, 9.17])
    expect(after[0] - base[0]).toBeGreaterThan(0)
    expect(after[0] - base[0]).toBeLessThanOrEqual(2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 1: the lists', () => {
  it('tags every entry of the four lists in the form the record keeps', () => {
    for (const list of [decisions, deviations, verify, followUps]) {
      expect(entries(list).length).toBeGreaterThan(0)
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS16 step (?:[1-9]|1[0-2])\)\.\*\* \S/)
    }
  })

  it('records the decisions this step takes, D31 and D32 with K\'s date', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Amazon SES sends the site\'s mail through one seam (WS16 step 1).',
      'WS16 right after checkpoint L, ahead of WS09 (WS16 step 1).',
      'Twelve steps in three checkpoints (WS16 step 1).',
    ])
    expect(tagged(decisions)[0]).toContain('D31, settled by K on Tuesday, November 10, 2026')
    expect(tagged(decisions)[1]).toContain('D32, settled by K on Tuesday, November 10, 2026')
  })

  it('records the deviation of this step', () => {
    expect(tagged(deviations).map(head)).toEqual(['WS16 is new since brief 1.4 (WS16 step 1).'])
    for (const piece of ['`docs/redesign/ws16-brief-section.md`', '`redesign/docs-phase2`', '42 to 43', 'ahead of WS09']) expect(tagged(deviations)[0], piece).toContain(piece)
  })

  it('resolves the verify items, each confirmed in the code', () => {
    expect(tagged(verify).map(head)).toEqual([
      'Only two places call Resend (WS16 step 1).',
      'The two bodies differ (WS16 step 1).',
      'The callers (WS16 step 1).',
      'The outbox readers (WS16 step 1).',
      'Pins on Resend\'s address (WS16 step 1).',
      'The closure tests (WS16 step 1).',
      'The switch count pins (WS16 step 1).',
      'The record\'s workstream list (WS16 step 1).',
      'The words of the section comment (WS16 step 1).',
      'Checkpoint L\'s merged form (WS16 step 1).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
  })

  it('records its own follow-ups, then the one it hands to WS16 step 12, each once', () => {
    const own = [
      'K\'s address map, settled but for where replies go (WS16 step 1).',
      'The second list\'s name, settled before migration 0060 (WS16 step 1).',
      'K\'s open questions for WS16, with their defaults (WS16 step 1).',
    ]
    const handed = ['The two launch scripts (WS16 step 12).']
    expect(tagged(followUps).map(head)).toEqual(own)
    const heads = entries(followUps).map(head)
    expect(heads.slice(0, own.length + handed.length)).toEqual([...own, ...handed])
    for (const name of [...own, ...handed]) expect(heads.filter((h) => h === name), name).toHaveLength(1)
  })

  it('gives K\'s answers of Wednesday, November 11, 2026 in its follow-ups, each form with the step that writes it, and writes no address there', () => {
    /** An entry in this step's words: a later step that closes it adds a sentence of its own after them, "Done in WS16 step N: ...". */
    const asWritten = (entry: string) => entry.split(/ Done in WS16 step (?:[2-9]|1[0-2]):/)[0]
    const [addressMap, listName, openQuestions] = tagged(followUps).map(asWritten)
    for (const piece of [
      'Open on Tuesday, November 10, 2026', 'Wednesday, November 11, 2026', 'choices 1 to 5 and 7 as recommended', 'Choice 6, where replies go, stays open',
      '`domain/mail/addresses.ts` by the step that adds it', 'WS16 step 4 the newsletter\'s sender', 'WS16 step 11 LCA tournament email\'s',
    ]) expect(addressMap, piece).toContain(piece)
    for (const piece of ['Wednesday, November 11, 2026', '"LCA tournament email"', 'migration 0060 writes it']) expect(listName, piece).toContain(piece)
    expect(openQuestions).toContain('Q44\'s one open part (where replies go')
    expect(openQuestions).toContain('silence keeps each default.')
    // The words that called K's answers open before K gave them: none of them stays in what this step wrote.
    for (const entry of tagged(followUps)) {
      expect(asWritten(entry), head(entry)).not.toContain('@')
      expect(asWritten(entry), head(entry)).not.toMatch(/\bnot decided\b|Q44 aside|the address map, which K decides|switches the newsletter on writes/i)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 1: plain language', () => {
  /** Everything this step wrote in this section, and the date line's date. */
  const written = [ws16, date?.[0] ?? '']
  /** The same, with what sits in backticks taken out, since code is not prose. */
  const prose = written.map(proseOf)

  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
    for (const text of [map, block, decisions, deviations, verify, followUps, openingParagraph]) expect(text).not.toBe('')
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
    expect(ws16).not.toMatch(/\.github\//)
  })

  it('calls K, the owner, K or they, never he', () => {
    expect(proseOf(ws16)).not.toMatch(HE)
  })

  it('names steps as "WS16 step N", never with the bare "(step N)" WS01\'s tests look for', () => {
    expect(ws16).not.toMatch(/\(step \d+[;),]/)
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

describe('REDESIGN_STATUS.md, WS16 step 1: the date', () => {
  it('dates the record on a real day, on or after Tuesday, November 10, 2026, the day K decided WS16', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-10').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 1: its claims against the files', () => {
  it('lists as new only files that exist, but the two that go with Resend, each free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of NEW_FILES) {
      // WS16 step 12 deletes the two files that go with Resend; they are read only while they exist.
      if (GO_WITH_RESEND.includes(file) && !existsSync(join(ROOT, file))) continue
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of [...CHANGED, ...CHANGED_TESTS, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed files\' gains and the grown files\' growth', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7986, 303])
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

  it('gives integration counts that add up: the base\'s, and no new integration file', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1321, 85])
    expect([num(after), Number(afterFiles)]).toEqual([num(before), Number(beforeFiles)])
  })

  it('gives the browser run as one run whose counts add up', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
  })

  it('gives the lint figures as the base\'s with the new files added', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(858)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })
})
