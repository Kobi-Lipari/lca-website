// test/unit/redesign-status-ws09-regions.test.ts
//
// REDESIGN_STATUS.md records the club regions made the five regional seats'
// titles, by K's decision 14, in the block "WS09 aside: the regions by the
// five seats": what asked for it, the list, where the clubs went (a best
// guess for K to correct), the migration, the seats, the short names and the
// seed, what does not move, what ships with no switch, the look, the way
// back, the pins moved and the checks. Like the other record tests of WS09,
// this file reads only the WS09 section, from its heading to the WS10
// heading. No case reads or pins a switch's shipped value.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { REGION_ALIASES } from '../../src/lib/nav'
import { nextMigrationNumber } from '../../scripts/db/generate'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
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

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const BEFORE = '### WS09 switch-on: regionEvents with main taken in'
const BLOCK = '### WS09 aside: the regions by the five seats'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const MIGRATION = 'migrations/0072_regions_by_seat.sql'
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

const GONE = ['Central Louisiana', 'North of Lake Pontchartrain', 'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region']

describe('REDESIGN_STATUS.md, WS09 aside: the regions by the five seats', () => {
  it('sits once, right after the block with main taken in, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(BEFORE) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Asked by.**', '- **Branch.**', '- **The list.**', '- **The clubs.**', '- **The migration.**', '- **The seats.**',
      '- **The aliases and the seed.**', '- **What does not move.**', '- **What ships with no switch.**', '- **The look.**',
      '- **How it comes back out.**', '- **Pins moved.**', '- **Follow-ups.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('quotes K\'s words and names the decision with its date', () => {
    const asked = bullet(block, '- **Asked by.**')
    for (const piece of ['K\'s decision 14 of Wednesday, November 18, 2026', 'change all of our regions to align with the titelse of the regional representatives', '"2 b a, make your best guess and I\'ll correct later."']) {
      expect(asked, piece).toContain(piece)
    }
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/regions-by-seat`, cut from `915a9ba`')
  })

  it('gives the list as the code holds it, old and new', () => {
    const list = bullet(block, '- **The list.**')
    expect(list).toContain(`in this order, ${REGIONS.slice(0, -1).join(', ')} and ${REGIONS.at(-1)}`)
    expect(list).toContain('North Louisiana, Central Louisiana, North of Lake Pontchartrain, New Orleans Metro, Southwest Louisiana, South Central Louisiana and Bayou Region')
    const domain = read('domain/clubs/regions.ts')
    expect(domain).toContain('The five names are the titles of the five regional representatives\' seats.')
    for (const gone of GONE) expect(domain, gone).not.toContain(gone)
  })

  it('says each club\'s move as a best guess for K to correct, the way K corrects one, and the table the migration writes', () => {
    const clubs = bullet(block, '- **The clubs.**')
    for (const piece of ['a best guess', 'for K to correct', 'not a rule of the association', 'changes its Region field in the club\'s editor', '12 in New Orleans Metro, 3 in Baton Rouge / East Central, 5 in Lafayette / South Central, 2 in Lake Charles / Southwestern and 3 in North Louisiana']) {
      expect(clubs, piece).toContain(piece)
    }
    // Every town the block names is one the migration names, with the region it gives it.
    const sql = read(MIGRATION)
    const rules: Array<[string, string, string]> = [
      ['South Central Louisiana', "city IN ('Baton Rouge', 'Gonzales')", 'Baton Rouge / East Central'],
      ['Bayou Region', "city = 'Houma'", 'New Orleans Metro'],
    ]
    for (const [from, town, to] of rules) {
      expect(sql, from).toContain(`UPDATE clubs SET region = '${to}'\n WHERE region = '${from}' AND ${town};`)
    }
    for (const [from, to] of [['South Central Louisiana', 'Lafayette / South Central'], ['Bayou Region', 'Lafayette / South Central'], ['Southwest Louisiana', 'Lake Charles / Southwestern'], ['North of Lake Pontchartrain', 'New Orleans Metro'], ['Central Louisiana', 'Lafayette / South Central']]) {
      expect(sql, from).toContain(`UPDATE clubs SET region = '${to}'\n WHERE region = '${from}';`)
      // Each town's rule comes before its old region's last rule.
      const last = sql.indexOf(`WHERE region = '${from}';`)
      const town = sql.indexOf(`WHERE region = '${from}' AND`)
      if (town >= 0) expect(town, from).toBeLessThan(last)
    }
    for (const town of ['Sulphur', 'DeRidder', 'Lafayette and Opelousas', 'Mandeville, Slidell and Picayune', 'Morgan City', 'Pineville and Bunkie']) expect(clubs, town).toContain(town)
  })

  it('says what the migration rewrites, that it changes no schema and runs twice safely, against the file', () => {
    const migration = bullet(block, '- **The migration.**')
    for (const piece of ['`migrations/0072_regions_by_seat.sql`', 'changes no table, column, index or trigger', '`clubs.region`', '`clubs.city`', '`club_reports.region`', 'empty on the live site', 'a second run changes no row', '`0071`', 'by its name', 'On the live database it rewrites every stored club region', 'a revert of the code does not undo it']) {
      expect(migration, piece).toContain(piece)
    }
    const sql = read(MIGRATION)
    const body = sql.replace(/^--.*$/gm, '')
    expect(body).not.toMatch(/\b(CREATE|ALTER|DROP|PRAGMA)\b/i)
    expect(sql).toContain('a best guess')
    expect(sql).toContain('decision 14 of Wednesday, November 18, 2026')
    expect(readdirSync(join(ROOT, 'migrations')).filter((f) => f.startsWith('0072_'))).toEqual(['0072_regions_by_seat.sql'])
    // The README names the file and the number the generator gives next.
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    expect(readme).toContain('the regions by seat `0072`')
    expect(readme).toContain(`\`${nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))}\` is next`)
  })

  it('gives the seats\' rule as the file writes it', () => {
    const seats = bullet(block, '- **The seats.**')
    for (const piece of ['`regional_rep`', '`role LIKE \'New Orleans Metro%\'`', 'with or without the word Representative', 'an officer\'s seat covers none', 'Board seats page', 'set by hand on the Board seats page before the merge are replaced', 'changes who keeps which clubs on the live site', 'gains Baton Rouge Chess Club, Bluebonnet Chess Club and Gonzales Chess Club', 'the Lafayette / South Central seat loses those three']) expect(seats, piece).toContain(piece)
    const sql = read(MIGRATION)
    for (const region of REGIONS) {
      expect(sql, region).toContain(`SELECT id, '${region}' FROM board_members\n WHERE category = 'regional_rep' AND role LIKE '${region}%';`)
    }
  })

  it('gives the short names and the seed as the files hold them, with the other stream\'s condition', () => {
    const aliases = bullet(block, '- **The aliases and the seed.**')
    expect(REGION_ALIASES).toEqual({ nola: 'New Orleans Metro', northshore: 'New Orleans Metro', acadiana: 'Lafayette / South Central' })
    for (const piece of ['`nola` and `northshore` now point at New Orleans Metro and `acadiana` at Lafayette / South Central', 'each short name follows the region that holds those towns\' clubs', '`northshore` moves with them in the same change', '11:47 PM UTC']) {
      expect(aliases, piece).toContain(piece)
    }
    const seed = read('scripts/seed/fixtures.sql')
    expect(seed).toContain("'#1f4e79', 'Baton Rouge / East Central', 30.4515, -91.1871),")
    expect(seed.match(/'North Louisiana'/g)).toHaveLength(2)
    for (const gone of GONE) expect(seed, gone).not.toContain(gone)
  })

  it('says what does not move, and what ships with no switch', () => {
    const still = bullet(block, '- **What does not move.**')
    for (const piece of ['`functions/db/schema.ts`', '`drizzle/`', 'every migration but `0072`', 'No switch is added, changed or read', 'Nothing under `test/a11y/` moves', 'does not import the list', 'free text in a row']) {
      expect(still, piece).toContain(piece)
    }
    const shipped = bullet(block, '- **What ships with no switch.**')
    for (const piece of ['All of it, on K\'s word', 'rewrites the live database\'s stored regions', 'waits for K\'s own word', 'runs the old code on the new rows', 'A failed Pages build, or a revert of the code', 'both the migration job\'s run and the Pages deploy are checked']) expect(shipped, piece).toContain(piece)
    expect(read('.github/workflows/migrate-db.yml')).toContain('Migrations should still only')
    const worker = read('workers/daily-emails/src/index.ts')
    expect(worker).not.toMatch(/regions/)
  })

  it('names the two faults the look found, and they are mended as the list says', () => {
    const look = bullet(block, '- **The look.**')
    for (const piece of ['made-up', 'no request left the machine', 'Eight sheets', '"7 regions"', '`src/pages/ClubsPage.tsx`', '`src/pages/AboutPage.tsx`', '320, 390 or 1280', 'mended after the look']) expect(look, piece).toContain(piece)
    const list = bullet(block, '- **The list.**')
    for (const piece of ['say 5 where they said 7', '`HERO_STATS`', '`src/pages/ClubsPage.tsx`', '`src/pages/AboutPage.tsx`', '`test/unit/fixtures/brand-today.ts`']) expect(list, piece).toContain(piece)
    expect(read('src/pages/ClubsPage.tsx')).toContain("{ n: '5', l: 'regions' }")
    expect(read('src/pages/AboutPage.tsx')).toContain('Support affiliated chess clubs in 5 regions statewide')
    expect(read('test/unit/fixtures/brand-today.ts')).toContain('Support affiliated chess clubs in 5 regions statewide')
    expect(bullet(block, '- **Follow-ups.**')).not.toContain('"7 regions"')
  })

  it('gives the way back in full, by new region and town', () => {
    const back = bullet(block, '- **How it comes back out.**')
    for (const piece of [
      'Lake Charles / Southwestern to Southwest Louisiana', 'Baton Rouge / East Central to South Central Louisiana',
      'Lafayette and Opelousas to South Central Louisiana, Morgan City to Bayou Region, Pineville and Bunkie to Central Louisiana',
      'Mandeville, Slidell and Picayune to North of Lake Pontchartrain, Houma to Bayou Region, and the rest stay',
      'North Louisiana stays', 'as migration 0050 first set them', 'Baton Rouge / East Central seat\'s left empty', 'K\'s own choice',
      'puts back only the clubs of the towns it names', 'cannot be put back from its row', 'D1\'s Time Travel', 'Recovering data',
      'a list of every club\'s id and region taken, on K\'s word, by whoever merges, just before the merge',
    ]) expect(back, piece).toContain(piece)
    expect(read('migrations/README.md')).toContain('## Recovering data')
    expect(read('migrations/0072_regions_by_seat.sql')).toContain('puts back only the towns it names')
  })

  it('lists every pin moved with its file\'s count of cases and its owner', () => {
    const pins = bullet(block, '- **Pins moved.**')
    const moved = [
      'test/unit/club-editor-off.test.tsx', 'test/unit/club-editor-shut-while-saving.test.tsx', 'test/unit/club-editor.test.tsx',
      'test/unit/clubs-page-narrow-css.test.tsx', 'test/unit/nav.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/db-generate-real-kit.test.ts',
      'test/unit/drizzle-baseline.test.ts', 'test/unit/seed-fixtures.test.ts', 'test/unit/migration-0070-club-event-approval.test.ts',
      'test/unit/migration-0065-club-regions.test.ts', 'test/unit/redesign-status-ws09-step3.test.ts', 'test/unit/redesign-status-ws09-step16.test.ts',
      'test/unit/redesign-status-ws09-step1.test.ts', 'test/integration/club-regions-fill.test.ts', 'test/integration/domain-shared-rules.test.ts', 'test/integration/officer-regions.test.ts',
      'test/integration/workspace-region.test.ts',
    ]
    for (const file of moved) expect(pins, file).toMatch(new RegExp(`\`${file.replace(/[.]/g, '\\.')}\` \\(${casesIn(file)}\\), (WS\\d\\d|the officer roles work)`))
    expect(pins).toContain('`test/unit/fixtures/navPersonas.ts`, WS02\'s people list')
    expect(pins).toContain(`\`test/unit/nav-personas-edges.test.ts\` (${casesIn('test/unit/nav-personas-edges.test.ts')})`)
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain("expect(sql.at(-1)).toBe('0072_regions_by_seat.sql')")
  })

  it('gives each figure of the checks once, the integration figure with the one todo beside it', () => {
    const checks = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
    for (const piece of ['`npm run lint` 13 errors and 12 warnings over ', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', ' tests that run in ', 'with the one todo beside them', 'no browser run of its own', 'the worker\'s dry run ']) {
      expect(checks.split(piece), piece).toHaveLength(2)
    }
    expect(checks).not.toContain('`npm run test:a11y`')
    for (const file of ['test/unit/regions-by-seat.test.ts', 'test/unit/regions-gone.test.ts', 'test/unit/regions-pages.test.tsx', 'test/unit/redesign-status-ws09-regions.test.ts', 'test/integration/regions-by-seat.test.ts', 'test/integration/regions-by-seat-edges.test.ts']) {
      expect(checks, file).toContain(`\`${file}\` (${casesIn(file)})`)
    }
  })

  it('moves the Status line\'s tail by one clause and keeps it ending in built', () => {
    expect(statusLine).toContain('the regions by the five seats, by K\'s decision 14, are built on `redesign/regions-by-seat` with their data migration and wait for K\'s own word on their pull request;')
    expect(statusLine).toMatch(/\bbuilt\.$/)
  })

  it('keeps one tagged entry under the deviations from the brief', () => {
    const deviations = part('### WS09 deviations from the brief')
    const tagged = deviations.split('\n').filter((l) => l.startsWith('- **') && /\(WS09 regions by seat\)\.\*\*/.test(l))
    expect(tagged).toHaveLength(1)
    for (const piece of ['`docs/redesign/REDESIGN_SPEC.md`', 'is not rewritten', '`migrations/README.md`']) expect(tagged[0], piece).toContain(piece)
  })

  it('keeps the record\'s plain language in what it wrote', () => {
    const tagged = part('### WS09 deviations from the brief').split('\n').filter((l) => /\(WS09 regions by seat\)/.test(l))
    for (const text of [block, ...tagged, read(MIGRATION)]) {
      for (const rule of [DASHES, BANNED, TOOLS, OLD_INITIALS, HE]) expect(text).not.toMatch(rule)
      for (const date of text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g) ?? []) {
        expect(text, date).toMatch(new RegExp(`(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ${date}`))
      }
    }
  })
})
