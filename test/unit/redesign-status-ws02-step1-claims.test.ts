// test/unit/redesign-status-ws02-step1-claims.test.ts
//
// What the WS02 step 1 record says about the files it describes, checked
// against those files. test/unit/redesign-status-ws02-step1.test.ts and its
// edges file pin the record's own words; this file reads the brief, the
// switch file and the switch test the record speaks of and checks that the
// record's figures and claims are theirs.
//
// - The spec is the brief 1.4 copy the record measured: its lines, bytes and
//   sha256 as the "Brief 1.4." bullet and the verify item "The 1.4 copy"
//   give them, and the "- WS01:" line's bytes, characters and halves as the
//   verify item "Brief 1.4 and the WS01 record tests" gives them.
// - Brief 1.4 says what the two "Done in brief 1.4:" sentences say it says:
//   rule 0.1.8 and the 0.2 migrations line, with "K applies remote
//   migrations" gone from the whole brief.
// - The "The switches." bullet names the eighteen in the order the switch
//   file declares them after the step's section comment, and the two it
//   calls Phase 0 are the only Phase 0 rows among them in the brief's table.
// - PHASE_0 in test/unit/features.test.ts holds only switches the brief
//   calls Phase 0, besides the fifteen it held at the close of WS01, so it
//   gained none of the sixteen later ones. K turning a switch on takes a
//   name out of PHASE_0, which fails nothing here.
// - The date line's date is a real day, not before WS02 step 1, and "step 18"
//   ends where the record says it does.
// - In WS01's part of the record, the only sentences that say a merge is
//   pending are the two the step 32 verify item quotes as what it found,
//   which that item now closes.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
const spec = read('docs/redesign/REDESIGN_SPEC.md')
const specLines = spec.split('\n')
const statusLines = status.split('\n')

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
const line = (start: string) => statusLines.find((l) => l.startsWith(start)) ?? ''
/** A number as the record writes it, with commas between its thousands. */
const figure = (written: string) => Number(written.replace(/,/g, ''))

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const block = between(ws02, '### WS02 step 1: the record, brief 1.4 and the stale-tab reload', '\n### ')
const bullet = (start: string) => block.split('\n').find((l) => l.startsWith(start)) ?? ''

/** The rows of the brief's flag table, from its header row to its end, each as its name and its last cell. */
function flagRows(): Array<{ name: string; last: string }> {
  const header = specLines.findIndex((l) => l.startsWith('| Flag | Turns on | Can go on in |'))
  const rows: Array<{ name: string; last: string }> = []
  for (let i = header + 2; header >= 0 && specLines[i]?.startsWith('|'); i++) {
    const name = /^\| `([a-zA-Z][a-zA-Z0-9]*)` \|/.exec(specLines[i])?.[1]
    if (name) rows.push({ name, last: specLines[i].slice(specLines[i].lastIndexOf(' | ') + 3).replace(/ \|$/, '') })
  }
  return rows
}
const rows = flagRows()
const lastCell = (name: string) => rows.find((r) => r.name === name)?.last ?? ''

/** The fifteen switches PHASE_0 held at the close of WS01, homeWeek among them. */
const PHASE_0_AT_THE_CLOSE_OF_WS01 = [
  'newLook', 'themeHeritage', 'themeScholastic', 'newNav', 'siteSearch', 'homeSearch', 'eventStrip', 'eventStripLive',
  'liveMarker', 'newHome', 'homeResults', 'homeChampions', 'homeLive', 'homeWeek', 'homeRecap',
]

describe('the spec is the brief 1.4 copy the record measured', () => {
  const bytes = Buffer.byteLength(spec, 'utf8')
  const newlines = (spec.match(/\n/g) ?? []).length
  const sha = createHash('sha256').update(spec).digest('hex')

  it.each([
    ['the "Brief 1.4." bullet', bullet('- **Brief 1.4.**')],
    ['the verify item "The 1.4 copy"', line('- **The 1.4 copy (WS02 step 1).**')],
  ])('%s gives its lines, bytes and sha256', (_, text) => {
    const found = /(\d[\d,]*) lines and (\d[\d,]*) bytes, sha256 `([0-9a-f]{64})`/.exec(text)
    expect(found, 'the figures').not.toBeNull()
    const [, lines, size, hash] = found as RegExpExecArray
    expect(figure(lines)).toBe(newlines)
    expect(figure(size)).toBe(bytes)
    expect(hash).toBe(sha)
  })

  it('and its "- WS01:" line has the bytes, characters and halves the record gives it', () => {
    const item = line('- **Brief 1.4 and the WS01 record tests (WS02 step 1).**')
    const found = /(\d[\d,]*) bytes before its newline \((\d[\d,]*) characters, (two|one|three) of them ½\)/.exec(item)
    expect(found, 'the figures').not.toBeNull()
    const [, size, characters, halves] = found as RegExpExecArray
    const ws01 = specLines.filter((l) => l.startsWith('- WS01:'))
    expect(ws01).toHaveLength(1)
    expect(Buffer.byteLength(ws01[0], 'utf8')).toBe(figure(size))
    expect([...ws01[0]]).toHaveLength(figure(characters))
    expect(ws01[0].split('½').length - 1).toBe(['one', 'two', 'three'].indexOf(halves) + 1)
  })
})

describe('brief 1.4 says what the two "Done in brief 1.4:" sentences say it says', () => {
  const section01 = between(spec, '### 0.1 ', '### 0.2 ')
  const section02 = between(spec, '### 0.2 ', '\n## 1. ')
  const closings = [line('- **Brief 0.1, rule 8**'), line('- **Brief text.**')].map((l) => l.slice(l.indexOf('Done in brief 1.4:')))

  it('rule 0.1.8 is headed "Previews never touch the production database" and binds the preview to its own database', () => {
    const rule8 = section01.split('\n').find((l) => l.startsWith('8. ')) ?? ''
    expect(rule8.startsWith('8. **Previews never touch the production database.**')).toBe(true)
    expect(rule8).toContain('`wrangler.toml` binds `DB` to its own database, `lca-db-preview`, under `[env.preview]` for every branch except `main`')
    for (const text of closings) expect(text).toContain('rule 0.1.8 now reads "Previews never touch the production database"')
    // The rule the deviation quotes as it was is gone.
    expect(spec).not.toContain('Preview deployments share the production database')
  })

  it('the 0.2 migrations line has a merge to main migrate production through the job in migrate-db.yml, and K migrate the preview by hand', () => {
    const migrations = section02.split('\n').filter((l) => l.includes('Merging to `main` applies new migrations to the production database'))
    expect(migrations).toHaveLength(1)
    expect(migrations[0]).toContain('(the GitHub Actions job in `migrate-db.yml`)')
    expect(migrations[0]).toContain('K applies its migrations there with `npm run db:migrate:preview`')
    for (const text of closings) {
      expect(text).toContain('through the GitHub Actions job in `migrate-db.yml`')
      expect(text).toContain('`npm run db:migrate:preview`')
    }
  })

  it('"K applies remote migrations" is nowhere in brief 1.4', () => {
    expect(spec).not.toContain('K applies remote migrations')
    for (const text of closings) expect(text).toContain('no longer says "K applies remote migrations"')
  })
})

describe('the eighteen switches, as the record names them', () => {
  const switches = bullet('- **The switches.**')
  const listed = [...between(switches, 'row of the table: ', '. The file now declares').matchAll(/`([a-zA-Z][a-zA-Z0-9]*)`/g)].map((m) => m[1])

  it('are named by the "The switches." bullet in the order the switch file declares them after the step\'s section comment', () => {
    expect(listed).toHaveLength(18)
    const file = read('src/lib/features.ts').split('\n')
    const section = file.indexOf('  // Redesign, brief 1.4. Off until each part is checked on a preview.')
    expect(section).toBeGreaterThan(-1)
    const declared = file.slice(section).flatMap((l) => /^ {2}([a-zA-Z][a-zA-Z0-9]*): (?:true|false),$/.exec(l)?.[1] ?? [])
    expect(declared.slice(0, 18)).toEqual(listed)
    // In the order of brief 1.4's flag table as well.
    const order = rows.map((r) => r.name)
    expect(listed.map((name) => order.indexOf(name))).toEqual([...listed.map((name) => order.indexOf(name))].sort((a, b) => a - b))
  })

  it('include exactly the two the bullet calls Phase 0 among the rows the brief says can go on in Phase 0', () => {
    expect(switches).toContain('Two are Phase 0 switches, `clubEmailHidden` and `rosterShortNames`')
    expect(listed.filter((name) => lastCell(name).startsWith('Phase 0'))).toEqual(['clubEmailHidden', 'rosterShortNames'])
    for (const name of listed) expect(lastCell(name), name).not.toBe('')
  })

  it('leave PHASE_0 in test/unit/features.test.ts holding only switches the brief calls Phase 0, besides the fifteen it held at the close of WS01', () => {
    const source = read('test/unit/features.test.ts')
    const phase0 = [...(/const PHASE_0 = \[([\s\S]*?)\] as const/.exec(source)?.[1] ?? '').matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'/g)].map((m) => m[1])
    expect(phase0.length).toBeGreaterThan(0)
    for (const name of phase0) {
      expect(PHASE_0_AT_THE_CLOSE_OF_WS01.includes(name) || lastCell(name).startsWith('Phase 0'), name).toBe(true)
    }
    // None of the sixteen later ones, whose rows name a workstream or a later phase.
    for (const name of listed.filter((n) => !lastCell(n).startsWith('Phase 0'))) expect(phase0, name).not.toContain(name)
  })
})

describe('the date line and the lines WS02 step 1 closed', () => {
  it('dates the record on a real day, not before WS02 step 1', () => {
    const found = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(line('Last updated:'))
    expect(found).not.toBeNull()
    const [, year, month, day] = (found as RegExpExecArray).map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    expect([date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]).toEqual([year, month, day])
    expect(date.getTime()).toBeGreaterThanOrEqual(Date.UTC(2026, 9, 23))
  })

  it('ends "step 18" at the character the record gives, inside the first 400 characters the step 21 and step 32 tests read', () => {
    const item = line('- **The date line\'s pins (WS02 step 1).**')
    const found = /"step 18" ends at character (\d+) of the file/.exec(item)
    expect(found).not.toBeNull()
    const end = status.indexOf('step 18') + 'step 18'.length
    expect(Number((found as RegExpExecArray)[1])).toBe(end)
    expect(end).toBeLessThanOrEqual(400)
  })

  it('leaves, in WS01\'s part, no sentence saying a merge is pending but the two the step 32 verify item quotes as what it found', () => {
    const ws01 = between(status, '## WS01:', '\n## WS02:')
    const saying = ws01
      .split('\n')
      .flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z(*"`])/).map((sentence) => ({ l, sentence })))
      .filter(({ sentence }) => /\bpending\b/i.test(sentence) && /\bmerg/i.test(sentence))
    expect(saying).toHaveLength(2)
    for (const { l } of saying) {
      expect(l.startsWith('- **The header and checkpoint D (step 32).** Found:')).toBe(true)
      expect(l.endsWith('as the WS01 header and the first paragraph of the Checkpoint D section now record (WS02 step 1).')).toBe(true)
    }
    expect(saying[0].sentence).toContain('it now says all 32 steps are built and checkpoint D\'s merge is pending')
    expect(saying[1].sentence).toContain('with the merge pending')
  })
})

describe('this file', () => {
  it('holds no en dash, no em dash, no old initials for US Chess and no name of a tool that helped write it', () => {
    const text = read('test/unit/redesign-status-ws02-step1-claims.test.ts')
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(text).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    expect(text).not.toMatch(new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini'].join('|')})\\b`, 'i'))
  })
})
