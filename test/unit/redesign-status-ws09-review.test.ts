// test/unit/redesign-status-ws09-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint S's merge-safety review in WS09 step
// 5's block, the checkpoint's last step, and marks each sentence the review
// added to the section's earlier bullets and lists with "Changed in
// checkpoint S's review:". Like the step record tests, this file reads only
// the WS09 section, from its heading to the WS10 heading. Pinned here: the
// review's bullet and its ten findings in order, after the step's Checks line
// and before the decisions; the sentences it added, each where it belongs and
// saying what it must; the files and lines they name; the two guards of the
// seed, the sheet's two lines and the journal case found by its tag against
// the files; the case counts of the new tests; and the plain-language rules.
// What a later step moves (the mail stream's files, the line numbers of
// today's pages) is read by line only while WS09 step 5 is the latest.
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
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b`)
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
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_3 = part('### WS09 step 3: the regions fill')
const STEP_4 = part('### WS09 step 4: the club tables and the slug rule')
const STEP_5 = part('### WS09 step 5: the seed on today\'s clubs')
const DECISIONS = part('### WS09 decisions')
const VERIFY = part('### WS09 verify items resolved')
const FOLLOW_UPS = ws09.slice(ws09.indexOf('\n### WS09 follow-ups\n') + 1)
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const REVIEW = bullet(STEP_5, '- **Checkpoint S\'s merge-safety review.**')
const FILES = bullet(STEP_5, '- **Files of the review\'s fixes.**')
const PINS = bullet(STEP_5, '- **Pins moved in the review\'s fixes.**')
const MARK = 'Changed in checkpoint S\'s review: '
/** The sentence the review added to a line: from the mark to the line's end. */
const added = (line: string) => (line.includes(MARK) ? line.slice(line.indexOf(MARK)) : '')
/** The line of a list or a block that starts with `start`, and the sentence the review added to it. */
const addedTo = (text: string, start: string) => added(text.split('\n').find((l) => l.startsWith(start)) ?? '')
/** Every sentence the review added, outside its own bullets. */
const marked = ws09.split('\n').filter((l) => l.includes(MARK)).map(added)

const NEW_TESTS = ['test/unit/club-seed-review.test.ts', 'test/unit/redesign-status-ws09-review.test.ts']
const SEED = 'migrations/0067_club_pages_seed.sql'
const SHEET = 'scripts/db/club-seed-sheet.ts'
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

describe('REDESIGN_STATUS.md, checkpoint S\'s merge-safety review', () => {
  it('sits in WS09 step 5\'s block after its Checks line, with its ten findings in order and its two bullets of files and pins', () => {
    expect(REVIEW).not.toBe('')
    const at = ['- Checks:', '- **Checkpoint S\'s merge-safety review.**', '- **Files of the review\'s fixes.**', '- **Pins moved in the review\'s fixes.**']
      .map((p) => STEP_5.indexOf(`\n${p}`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws09.split('- **Checkpoint S\'s merge-safety review.**')).toHaveLength(2)
    const findings = REVIEW.split('\n').filter((l) => /^ {2}- R\d+\. /.test(l))
    expect(findings.map((l) => /^ {2}- (R\d+)\. /.exec(l)?.[1])).toEqual(Array.from({ length: 10 }, (_, i) => `R${i + 1}`))
    for (const piece of [
      'Friday, November 13, 2026', '`be9ef6d`', 'Ten findings stood', 'one lens called the first blocking', 'the choice is K\'s, with the option recommended first',
    ]) expect(REVIEW.split('\n')[0], piece).toContain(piece)
    for (const finding of findings) expect(finding, finding.slice(0, 12)).toContain('Changed:')
    const r1 = findings[0]
    for (const piece of [
      '`migrate-db.yml`', 'lines 17 to 20', 'takes seconds and the build minutes', '`f914d8f`', 'US Chess ID', 'the officers\' emails', '`GET /api/board/my-seats`',
      'For K', 'recommended first, the build first', 'turns "Apply database migrations" off in the Actions tab', 'sees the Pages deployment of the merge commit live',
      'starts it by hand from the Actions tab', 'sees it green', 'two pushes', 'K\'s written yes to the window', 'K deletes no club until the run is green',
    ]) expect(r1, piece).toContain(piece)
    const r2 = findings[1]
    for (const piece of [
      '`git revert -m 1`', 'never undoes a file', 'If it has to come back out', 'a change forward', '`functions/utils/clubs/memberView.ts`',
      'deletes the rows of `club_places` and `club_slug_history`', 'puts back to blank the regions 0065 filled', 'whose region was blank',
    ]) expect(r2, piece).toContain(piece)
    for (const [i, piece] of [[2, 'at the latest in WS09 step 37'], [3, '`AND is_visible = 1`'], [3, 'line 381'], [5, 'For K'], [8, 'its 15 cases standing']] as const) {
      expect(findings[i], piece).toContain(piece)
    }
  })

  it('marks each sentence it added to the section\'s earlier bullets and lists, each where it belongs and saying what it must', () => {
    const where: ReadonlyArray<readonly [string, string, string, readonly string[]]> = [
      ['step 3', STEP_3, '- **What the merge does.**', ['the other order is the usual one', 'K\'s choice 1 (a)', 'Checkpoint S\'s merge-safety review']],
      ['step 3', STEP_3, '- **What ships with every switch off.**', ['`src/pages/DashboardPage.tsx` line 340', 'My region’s clubs', '`functions/api/admin/board-seats.ts` lines 82 to 85', '`src/pages/AdminPage.tsx` line 605', 'hidden drafts']],
      ['step 3', STEP_3, '  - The staging snapshot and journal entry the generator wrote are kept', ['all three of this branch\'s staging entries']],
      ['step 4', STEP_4, '- **What the merge does.**', ['five statements one at a time', 'A plain revert']],
      ['step 4', STEP_4, '  - The snapshot and journal entry the generator wrote are kept, `0011`', ['"may share" understates it']],
      ['step 5', STEP_5, '- **Safe on rows nobody read.**', ['the name 0013 stored', 'at most 48 characters', '`test/unit/club-seed-review.test.ts`']],
      ['step 5', STEP_5, '- **The four data points.**', ['16 lines more', 'part (g) can now be judged from the sheet']],
      ['step 5', STEP_5, '- **The sheet.**', ['"Description today"', '"Location today"']],
      ['step 5', STEP_5, '- **Owed before the pull request.**', ['one list of questions', '0065, 0066 and 0067']],
      ['step 5', STEP_5, '- **The branch.**', ['`be9ef6d`', '`f914d8f`', '`c37ba11`', 'no conflict and no clubs file touched']],
      ['step 5', STEP_5, '- **What the merge does.**', ['`0065_club_regions.sql`, `0066_club_pages.sql` and then `0067_club_pages_seed.sql`', 'ahead of the Pages build']],
      ['decisions', DECISIONS, '- **Each stream makes its migrations with its own numbers (WS09 step 2).**', ['`0011_club_regions`, `0012_club_pages` and `0013_club_pages_seed`', 'headers', 'finds its entry by its tag']],
      ['verify', VERIFY, '- **What a filled region opens (WS09 step 3).**', ['hidden drafts', '`src/components/layout/Navbar.tsx` lines 110 and 111']],
      ['verify', VERIFY, '- **Production\'s rows (WS09 step 5).**', ['before the pull request opens']],
      ['follow-ups', FOLLOW_UPS, '- **The pending count beside the mail stream\'s (WS09 step 1).**', ['109 pending and 28 contracted', 'even when git reports no conflict']],
      ['follow-ups', FOLLOW_UPS, '- **The one read of production, owed before checkpoint S merges (WS09 step 3).**', ['one list']],
      ['follow-ups', FOLLOW_UPS, '- **The admin club page\'s words for a roster kept back (WS09 step 3).**', ['`src/pages/DashboardPage.tsx` line 340', '`src/areas/admin/components/BoardSeatsPanel.tsx` lines 323 and 324', 'WS09 step 37']],
      ['follow-ups', FOLLOW_UPS, '- **The migration run at checkpoint S\'s merge (WS09 step 4).**', ['`0065_club_regions.sql`, `0066_club_pages.sql` and `0067_club_pages_seed.sql`', 'started by hand']],
      ['follow-ups', FOLLOW_UPS, '- **The rehearsal on the preview database, owed before checkpoint S\'s pull request (WS09 step 5).**', ['0065, 0066 and 0067 together', 'for 0065', 'for 0066', 'for 0067']],
      ['follow-ups', FOLLOW_UPS, '- **The four counts of production, owed before checkpoint S\'s pull request (WS09 step 5).**', ['(1)', '(7)', '`seat_regions`', 'a location other than 0013\'s', 'a name other than 0013\'s', 'a reserved word or not in the form of a slug', 'whose region is blank kept']],
    ]
    for (const [name, text, start, pieces] of where) {
      const sentence = addedTo(text, start)
      expect(sentence, `${name}: ${start}`).not.toBe('')
      for (const piece of pieces) expect(sentence, `${name}: ${piece}`).toContain(piece)
    }
    // Every marked line is one of those above; the review's own first line names the mark in quotation marks, which the count leaves out.
    expect(REVIEW.split('\n')[0]).toContain(`"${MARK.trim()}"`)
    expect(marked.length).toBe(where.length)
  })

  it('names files that exist, and the lines it cites hold what it says of them', () => {
    const written = [REVIEW, FILES, PINS, ...marked].join('\n')
    const paths = [...written.matchAll(/`([a-z][\w./[\]-]*\/[\w.[\]-]+\.(?:ts|tsx|sql|md|json))`/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(10)
    for (const path of new Set(paths)) expect(existsSync(join(ROOT, path)), path).toBe(true)
    const workflow = read('.github/workflows/migrate-db.yml')
    expect(workflow.split('\n').slice(16, 20).join('\n')).toContain('The\n# migration takes seconds and the site build takes minutes')
    expect(workflow).toMatch(/^ {2}workflow_dispatch:$/m)
    expect(workflow).toContain('It can also be started by\n# hand from the Actions tab')
    expect(read('src/pages/DashboardPage.tsx')).toContain('As regional representative you can update these clubs\' pages and news.')
    expect(read('src/areas/admin/components/BoardSeatsPanel.tsx')).toMatch(/Whoever holds the seat can\s+manage every club in those regions: the club page, news and logo\./)
    expect(read('functions/api/admin/board-seats.ts')).toContain('COUNT(*) AS clubs')
    expect(read('functions/api/admin/clubs/[id].ts')).toContain('FROM tournaments WHERE club_id = ? ORDER BY date DESC')
    if (latestStep !== 5) return
    const line = (file: string, n: number) => read(file).split('\n')[n - 1] ?? ''
    expect(line('src/pages/DashboardPage.tsx', 340)).toContain('As regional representative you can update')
    expect(line('src/areas/admin/components/BoardSeatsPanel.tsx', 70)).toContain('clubsByRegion.get(r)')
    expect(line('src/areas/admin/components/BoardSeatsPanel.tsx', 326)).toContain('clubsWithoutRegion > 0')
    expect(line('src/areas/admin/components/BoardSeatsPanel.tsx', 323)).toContain('Whoever holds the seat can')
    expect(line('src/components/layout/Navbar.tsx', 111)).toContain('My region\\u2019s clubs')
    expect(line('src/pages/AdminPage.tsx', 605)).toContain('club.region')
    expect(read('functions/api/admin/board-seats.ts').split('\n').slice(83, 87).join('\n')).toContain('GROUP BY COALESCE(region, \'\')')
    expect(read('src/pages/AdminClubPage.tsx').split('\n').slice(44, 47).join('\n')).toContain('Club tournaments stay with')
    expect(line('test/integration/club-permissions.test.ts', 381)).toContain('body.tournaments')
  })

  it('holds the seed\'s two guards, the sheet\'s two lines and the journal case found by its tag, as the review says', () => {
    const sql = read(SEED)
    for (const [id, name] of [
      ['baton-rouge', 'Baton Rouge Chess Club'], ['metairie', 'Metairie Chess Academy'], ['monroe', 'Monroe Chess Club'],
      ['ruston', 'Ruston Knights Chess Club'], ['shreveport', 'Shreveport-Bossier Chess Club'], ['slidell', 'Slidell Chess Club'],
    ]) {
      expect(sql, id).toMatch(new RegExp(` WHERE id = '${escape(id)}' AND slug IS NULL\\n {3}AND name = '${escape(name)}'\\n`))
      expect(read('migrations/0013_real_clubs.sql'), id).toContain(`UPDATE clubs SET name = '${name}',`)
    }
    expect(sql).toContain('UPDATE clubs SET slug = id\n WHERE slug IS NULL\n')
    for (const guard of ['AND length(id) BETWEEN 1 AND 48', 'AND id NOT GLOB \'*[^a-z0-9-]*\'', 'AND id NOT GLOB \'-*\' AND id NOT GLOB \'*-\' AND id NOT GLOB \'*--*\'']) {
      expect(sql, guard).toContain(guard)
    }
    const sheet = read(SHEET)
    expect(sheet).toContain('lines.push(`   Description today: ${club.description ?? \'None\'}`)')
    expect(sheet).toContain('lines.push(`   Location today: ${club.location ?? \'None\'}`)')
    const journalCase = read('test/unit/migration-0066-club-pages.test.ts')
    expect(journalCase).toContain('journal.entries.find((e) => e.tag.endsWith(\'_club_pages\'))')
    expect(journalCase).not.toMatch(/idx: 11\b|snapshot\(1[01]\)|entries\[11\]/)
  })

  it('counts as many cases for each new test as the file holds', () => {
    for (const file of NEW_TESTS) {
      const text = read(file)
      expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
      const written = Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(FILES)?.[1])
      expect(written, file).toBe((text.match(/^\s*it\(/gm) ?? []).length)
    }
    expect(FILES).toContain('`test/unit/migration-0066-club-pages.test.ts` (15, as before: ')
    expect((read('test/unit/migration-0066-club-pages.test.ts').match(/^\s*it\(/gm) ?? []).length).toBe(15)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote, and dates and times in their plain form', () => {
    const written = [REVIEW, FILES, PINS, ...marked].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of [...NEW_TESTS, SHEET, SEED]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE]) expect(text, file).not.toMatch(rule)
    }
  })
})
