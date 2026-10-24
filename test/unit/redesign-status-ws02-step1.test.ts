// test/unit/redesign-status-ws02-step1.test.ts
//
// REDESIGN_STATUS.md records WS02 step 1: checkpoint D's merge, brief 1.4
// landing as docs/redesign/REDESIGN_SPEC.md, the eighteen switches its flag
// table names, the stale-tab reload, and WS02's own section opened. This file
// reads only the WS02 section and the lines the step wrote elsewhere (the
// WS01 header, the Checkpoint D section's first paragraph, the date line and
// the three sentences it closed older entries with), never every table row
// or heading of the file, which WS01's record tests read. Pinned here: the
// merged wording of the WS01 header and the Checkpoint D paragraph, and no
// sentence of the present that calls the merge pending; the date line's two
// parts; the WS02 section's parts; its map of 23 criteria and 12 decisions,
// each with exactly one planned step; each part of the brief's two WS02
// deviation bullets with its step; the follow-ups WS01 handed on, with their
// steps; the stale-tab reload waiting for K's yes, which brief 1.4's section
// 0.2 and Q34 ask of anything but what a screen reader hears that ships with
// every switch off; the two "Done in brief 1.4" sentences; the spec's version
// line, its WS01 line by its hash and its flag table; every switch that table
// names declared in src/lib/features.ts; and the plain-language rules over
// what the step wrote.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
const spec = read('docs/redesign/REDESIGN_SPEC.md')
const lines = status.split('\n')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own, which test/unit/test-setup.test.ts keeps out of the record. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, built the same way. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** The names the records were drafted with before their figures were filled in. */
const UNFILLED = /@@|\b(RELOADTESTS|RECORDTESTS|SETUPTESTS|FEATURESTESTS|STEP32TESTS|LINT|BUILD|BROWSER|CHECKS|CSSGROWTH|GREP)\b/

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
/** A bullet and the indented lines under it. */
function bullet(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
/** What the step added at the end of an older line: from `from` to the end of the line. */
function closing(start: string, from: string): string {
  const l = line(start)
  const at = l.indexOf(from)
  return at < 0 ? '' : l.slice(at)
}

const WS02 = '## WS02: Information architecture and navigation'
const ws02 = between(status, WS02, '\n## WS03:')
const part = (heading: string) => between(ws02, heading, '\n### ')
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))

const MAP = '### WS02 map: what proves each acceptance criterion and decision'
const STEP = '### WS02 step 1: the record, brief 1.4 and the stale-tab reload'
const map = part(MAP)
const block = part(STEP)
const decisions = part('### WS02 decisions')
const deviations = part('### WS02 deviations from the brief')
const verify = part('### WS02 verify items resolved')
const followUps = between(ws02, '### WS02 follow-ups', '\n## ')

const header = between(status, '## WS01:', '### What each acceptance criterion')
const headerLines = header.split('\n').filter((l) => /^\*\*(Status|Branch|PR):\*\*/.test(l))
const checkpoint = between(status, '### Checkpoint D: steps 20 to 32', '### Decisions')
const merged = checkpoint.split('\n').find((l) => l.startsWith('**Merged into `main` as')) ?? ''
/** The part of the paragraph this step wrote; the rest, from "Checkpoint D is the design system", is WS01's. */
const mergedOwn = merged.slice(0, merged.indexOf(' Checkpoint D is the design system'))
const dateLine = line('Last updated:')
const rule8 = closing('- **Brief 0.1, rule 8**', 'Done in brief 1.4:')
const briefText = closing('- **Brief text.**', 'Done in brief 1.4:')
const verifyClosing = closing('- **The header and checkpoint D (step 32).**', 'Since then the merge has happened')

describe('REDESIGN_STATUS.md, WS02 step 1: checkpoint D merged', () => {
  it('says in the WS01 header that all four checkpoints are merged and live, and names the head that merged', () => {
    expect(headerLines).toHaveLength(3)
    for (const piece of [
      '**Status:** built. All 32 steps are on the branch',
      'All four checkpoints are merged into `main` and live, with every switch off',
      'checkpoint D merged on Thursday, October 22, 2026',
      'the head that merged is `ffee346`',
      'draft pull request 108',
      'merged into `main` as `34b721c` on Thursday, October 22, 2026',
    ]) expect(header, piece).toContain(piece)
    expect(header).not.toMatch(/in progress|pending|once it has merged|not pushed yet/)
  })

  it('opens the Checkpoint D section with the merge, its source and what it was seen to do, and keeps the rest of the paragraph', () => {
    expect(checkpoint.split('\n')[2]).toBe(merged)
    expect(merged.startsWith('**Merged into `main` as `34b721c` on Thursday, October 22, 2026 at 6:52 PM UTC** (pull request 108, a merge commit on head `ffee346`), after a merge-safety review by someone who has not followed the work, working from this file, and a green CI run on `ffee346`.')).toBe(true)
    for (const piece of [
      'The time is the pull request\'s own merge time on GitHub; the notes written that evening give 6:53 PM UTC.',
      'the checks on `ffee346` had passed',
      'the CI run for the push to `main` passed (6:53 PM to 6:58 PM UTC)',
      '"pages build and deployment"',
      '`.github/workflows/migrate-db.yml` and `.github/workflows/deploy-worker.yml` did not run, since nothing under `migrations/`, `workers/`, `functions/utils/` or `domain/` changed',
      'production stays at `0054_requires_lca_membership.sql`',
      'at 7:10 PM UTC, by the notes written that evening, the live site served the merged build',
      'its stylesheet, switches chunk and utilities chunk carrying the content hashes of a local production build of `ffee346`\'s tree',
      'the main script\'s hash differs',
      'all 24 switches are off in production and nothing a visitor sees changed',
    ]) expect(mergedOwn, piece).toContain(piece)
    expect(merged).toContain(' Checkpoint D is the design system: the browser tests, the design tokens with dark mode,')
    expect(checkpoint).not.toContain('Not merged yet')
    expect(checkpoint).not.toContain('merge into `main` is pending')
  })

  it('leaves no sentence of the present calling the merge pending, and closes the one verify item that records it', () => {
    const saying = lines.filter((l) => /checkpoint D's merge is pending|merge into `main` is pending/.test(l))
    expect(saying).toHaveLength(1)
    expect(saying[0].startsWith('- **The header and checkpoint D (step 32).** Found:')).toBe(true)
    expect(saying[0].endsWith(verifyClosing)).toBe(true)
    expect(verifyClosing).toBe('Since then the merge has happened: checkpoint D merged into `main` as `34b721c` on Thursday, October 22, 2026, as the WS01 header and the first paragraph of the Checkpoint D section now record (WS02 step 1).')
  })

  it('keeps WS01\'s part of the date line first and word for word, ends it with checkpoint D\'s merge, and puts WS02\'s part after it', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    // Later WS02 steps go in front of this one, latest first, as WS01's did.
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 1: the WS02 section', () => {
  it('keeps its heading and its event-mode bullet, and holds Status, Branch and PR', () => {
    expect(status.split(WS02)).toHaveLength(2)
    expect(ws02).not.toBe('')
    const eventMode = ws02.split('\n').find((l) => l.startsWith('- Read the brief with this path:')) ?? ''
    for (const name of ['`domain/events/eventMode.ts`', '`functions/utils/eventMode.ts`', '"Event-mode phase gaps (step 5)"']) expect(eventMode, name).toContain(name)
    expect(ws02).toContain('**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19)')
    expect(ws02).toContain('**Branch:** `redesign/ws02-navigation`, cut from `main` at `34b721c`.')
    expect(ws02).toMatch(/\n\*\*PR:\*\* /)
    // WS01's Follow-ups still end where this section begins.
    expect(between(status, '### Follow-ups', '\n## WS02')).not.toContain('\n## ')
  })

  it('holds its parts in order under headings no WS01 test reads, and no table row', () => {
    const order = [MAP, STEP, '### WS02 decisions', '### WS02 deviations from the brief', '### WS02 verify items resolved', '### WS02 follow-ups'].map((h) => ws02.indexOf(h))
    for (const at of order) expect(at).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    const headings = ws02.split('\n').filter((l) => l.startsWith('### '))
    // The six parts this step opened, once each; every other heading is a later step's block.
    const FIXED = [MAP, STEP, '### WS02 decisions', '### WS02 deviations from the brief', '### WS02 verify items resolved', '### WS02 follow-ups']
    for (const fixed of FIXED) expect(headings.filter((h) => h === fixed), fixed).toHaveLength(1)
    for (const h of headings.filter((l) => !FIXED.includes(l))) expect(h).toMatch(/^### WS02 step \d+: \S/)
    for (const h of headings) expect(h.startsWith('### WS02 '), h).toBe(true)
    expect(ws02.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('maps the 23 criteria and the 12 decisions, each one list item with exactly one planned WS02 step', () => {
    // Each later step fills in its own items, and moves this pin for those items, keeping their step.
    const PLANNED: Array<[string, number]> = [
      ['AC1', 18], ['AC2', 5], ['AC3', 7], ['AC4', 15], ['AC5', 11], ['AC6', 7], ['AC7', 8], ['AC8', 8], ['AC9', 16], ['AC10', 16],
      ['AC11', 8], ['AC12', 16], ['AC13', 8], ['AC14', 18], ['AC15', 5], ['AC16', 7], ['AC17', 17], ['AC18', 8], ['AC19', 18],
      ['AC20', 3], ['AC21', 7], ['AC22', 13], ['AC23', 3],
      ['D1', 5], ['Header rulings 1.2', 5], ['Q34', 5], ['Phone rulings 1.2', 7], ['D16', 7], ['Q32', 8], ['D9', 9], ['D26', 9],
      ['Event copy', 12], ['Q18', 13], ['Phone event bar', 16], ['Page 14 menu', 17],
    ]
    const items = entries(map)
    expect(items.map((l) => head(l).replace(/\.$/, ''))).toEqual(PLANNED.map(([id]) => id))
    expect(items.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(items.length - 23).toBe(12)
    for (const [i, [id, step]] of PLANNED.entries()) {
      const item = items[i]
      expect(item.match(/WS02 step \d+/g), id).toEqual([`WS02 step ${step}`])
      expect(item, id).toContain(`Planned: WS02 step ${step}.`)
      expect(step).toBeGreaterThanOrEqual(1)
      expect(step).toBeLessThanOrEqual(19)
    }
    // The criteria with halves in other steps name them without the words "WS02 step".
    expect(items[3]).toContain('Role safety is built in step 13 and the strip in step 14.')
    expect(items[4]).toContain('The panel and the inline combobox are built in step 10.')
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item')
    for (const name of ['Header rulings 1.2', 'Phone rulings 1.2', 'Phone event bar', 'Event copy', 'Page 14 menu', 'D1, D9, D16, D26, Q18, Q32 and Q34']) expect(map, name).toContain(name)
  })

  it('has the step block with every part, every file and nothing left to fill in', () => {
    for (const piece of [
      '**Files.**', '**Brief 1.4.**', '**The switches.**', '**The stale-tab reload.**', '**Pins moved.**', '**Judgement calls.**',
      '**Lint.**', '**Build.**', '**The browser runs.**', '\n- Checks:', 'Files beyond the step\'s list:',
    ]) expect(block, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const name of [
      'src/lib/reloadOnStaleChunk.ts', 'test/unit/reload-on-stale-chunk.test.ts', 'test/unit/redesign-status-ws02-step1.test.ts',
      'test/unit/reload-on-stale-chunk-edges.test.ts', 'test/unit/reload-on-stale-chunk-loader.test.ts',
      'test/unit/reload-on-stale-chunk-pages.test.tsx', 'test/unit/redesign-status-ws02-step1-edges.test.ts',
      'test/unit/redesign-status-ws02-step1-claims.test.ts',
      'docs/redesign/REDESIGN_SPEC.md', 'src/lib/features.ts', 'src/main.tsx', 'REDESIGN_STATUS.md',
      'test/unit/test-setup.test.ts', 'test/unit/features.test.ts', 'test/unit/redesign-status-step32.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
    expect(files).toMatch(/`test\/unit\/redesign-status-ws02-step1\.test\.ts` \(\d+: these records/)
    expect(files).toMatch(/`test\/unit\/reload-on-stale-chunk\.test\.ts` \(\d+: /)
    expect(block).toContain('"Version 1.4, Thursday, October 22, 2026"')
    expect(block).toContain('71f182150c8fa684cec110c6ba515a3f823b7543b0c68fc28d99374129dc7a09')
    expect(block).toContain('`vite:preloadError`')
    expect(block).toContain('the build loader')
    expect(block).toContain('No switch governs the guard')
    // The guard changes what a visitor sees when a file fails to load, so the block no longer says it changes nothing.
    expect(block).not.toContain('it changes nothing a visitor sees')
    expect(block).toContain('for an instant')
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(5)
    for (const text of [ws02, verify]) {
      expect(text).not.toContain('__')
      expect(text).not.toMatch(/\{[A-Z_0-9]+\}/)
      expect(text).not.toMatch(UNFILLED)
    }
  })

  it('records the step\'s decisions, each tagged with it, with the defaults of K\'s eight questions', () => {
    const own = entries(decisions)
    expect(own.length).toBeGreaterThanOrEqual(6)
    // Each decision carries the tag of the step that took it, and this step's six are there with theirs.
    for (const d of own) expect(head(d), d.slice(0, 60)).toMatch(/\(WS02 step \d+\)\.$/)
    for (const name of ['Brief 1.4 lands in this step', 'The eighteen switches now, all off', 'The flag table tests read 1.4\'s table, and WS01\'s step 2 record a frozen list', 'A stale tab reloads once', 'WS02\'s record is a list', 'K\'s eight questions keep their defaults']) {
      expect(own.map(head), name).toContain(`${name} (WS02 step 1).`)
    }
    const defaults = entries(decisions).find((l) => l.startsWith('- **K\'s eight questions keep their defaults')) ?? ''
    for (const piece of ['today\'s donation dialog', '`/give` once `newMembership` is on', 'pull request 106', 'five checkpoints, E to I', 'throwaway preview', 'no count until WS08\'s merged queue exists', '`index.html` keeps its dash', 'Q18, Q32 and Q34', 'only with `newLook` on as well']) {
      expect(defaults, piece).toContain(piece)
    }
  })

  it('records every planned deviation with its step, and the brief\'s two WS02 bullets part by part', () => {
    const own = entries(deviations)
    expect(own.length).toBeGreaterThanOrEqual(44)
    for (const d of own) expect(head(d), d.slice(0, 60)).toMatch(/\(WS02 steps? [\d, ]+(?:(?: and | to )\d+)?\)\.$/)
    const tagOf = (phrase: string) => {
      const found = own.filter((l) => l.includes(phrase))
      expect(found, phrase).toHaveLength(1)
      return head(found[0]).match(/\((WS02 steps? [^)]+)\)\.$/)?.[1]
    }
    const PARTS: Array<[string, string]> = [
      ['`EventBar.tsx` becomes `EventStrip.tsx`', 'WS02 step 14'],
      ['The "/" shortcut for search is dropped', 'WS02 step 10'],
      ['The mobile layout is M2 under 768 pixels', 'WS02 steps 6 and 7'],
      ['the rook mark at every width and no longer condenses', 'WS02 step 5'],
      ['Renew shows only once a membership has expired', 'WS02 step 5'],
      ['Donate moves into the About menu, then the brand name hides', 'WS02 step 5'],
      ['WS02 AC6 and WS12 AC6 follow', 'WS02 step 7'],
      ['The footer\'s column list changes', 'WS02 step 8'],
      ['Bylaws & rules, Minutes and State champions rows point at the `/about` tabs', 'WS02 steps 2, 5 and 8'],
      ['keeps today\'s role rows until `myLcaRail`', 'WS02 steps 2 and 17'],
      ['WS02 creates `listedWhere`', 'WS02 step 9'],
      ['written into `index.html` at build time', 'WS02 step 7'],
    ]
    for (const [phrase, tag] of PARTS) expect(tagOf(phrase), phrase).toBe(tag)
    expect(own.filter((l) => /^- \*\*From v1\.1: /.test(l))).toHaveLength(8)
    expect(own.filter((l) => /^- \*\*From v1\.3: /.test(l))).toHaveLength(4)
    // The redirects belong to the workstreams that own those pages.
    expect(own.find((l) => l.includes('the `/about` tabs'))).toContain('belong to WS14 and WS10')
    // The plan's five early switches come in step 1 with the rest, and the navigation model's step adds none.
    const early = own.find((l) => l.startsWith('- **The switches before their workstreams (WS02 step 1).**')) ?? ''
    for (const piece of ['`newAbout` (WS14)', '`newNews` (WS10)', '`newMembership` (WS12)', '`newClubs` (WS09)', '`myLcaRail` (WS13)', 'that step now adds none']) expect(early, piece).toContain(piece)
    for (const name of ['Brief 1.4 lands in this step (WS02 step 1)', 'The public-answer trim has not merged (WS02 step 1)', 'The stale-tab reload is not in the brief (WS02 step 1)']) {
      expect(own.map(head), name).toContain(`${name}.`)
    }
  })

  it('has the stale-tab reload wait for K\'s yes, since brief 1.4 lets only what a screen reader hears ship with every switch off', () => {
    // Brief 1.4's section 0.2, which Q34 settles: anything else that ships with every switch off waits for K's yes before its pull request merges.
    expect(between(spec, '### 0.2 ', '\n## 1. ')).toContain('Anything else that would ship with every switch off needs K\'s yes before its PR merges (Q34).')
    const own = (text: string, start: string) => entries(text).find((l) => l.startsWith(start)) ?? ''
    const exception = 'It ships with every switch off, an exception brief 1.4 allows only with K\'s yes (section 0.2 and Q34), so it waits for that yes before checkpoint E merges'
    expect(own(decisions, '- **A stale tab reloads once (WS02 step 1).**')).toContain(exception)
    expect(own(deviations, '- **The stale-tab reload is not in the brief (WS02 step 1).**')).toContain(exception)
    // The map's Q34 item names the exception without the words "WS02 step", so it keeps exactly one planned step.
    expect(own(map, '- **Q34.**')).toContain('The stale-tab reload ships with every switch off as well, an exception Q34 allows only with K\'s yes, so it waits for that yes before checkpoint E merges.')
    expect(bullet(block, '- **The stale-tab reload.**')).toContain('the guard waits for K\'s yes before checkpoint E merges, or for a switch if K asks for one')
    expect(bullet(block, '- **Judgement calls.**')).toContain('The guard has no switch of its own and waits for K\'s yes instead')
    const defaults: Array<[string, string]> = [
      [decisions, '- **K\'s eight questions keep their defaults'],
      [followUps, '- **K\'s questions for WS02, with their defaults'],
    ]
    for (const [text, start] of defaults) expect(own(text, start), start).toContain('Q34 with the stale-tab reload waiting for K\'s yes')
    const asked = own(followUps, '- **K\'s yes for the stale-tab reload (WS02 step 1).**')
    for (const piece of ['Before checkpoint E merges, K says yes to the reload shipping without a switch, or asks for one', 'Checkpoint E\'s pull request asks K for this.']) {
      expect(asked, piece).toContain(piece)
    }
  })

  it('resolves its verify items, each found in the code or measured', () => {
    for (const name of [
      'The merge commit and its time', 'What ran after the merge', 'The pins that move', 'The date line\'s pins',
      'The tests that read every table row', 'The tests a WS02 heading could catch', 'Brief 1.4 and the WS01 record tests',
      'Brief 1.4 and the flag table tests', 'The digit trap', 'The public-answer trim', 'The 1.4 copy', 'The loader\'s event',
      'The stylesheet\'s growth', 'Lint and counts', 'The baseline', 'The grep check',
    ]) {
      const item = line(`- **${name} (WS02 step 1).**`)
      expect(item, name).not.toBe('')
      expect(item.slice(item.indexOf('.**') + 4), name).toMatch(/^(Confirmed|Measured|Not merged)/)
    }
    expect(line('- **The merge commit and its time (WS02 step 1).**')).toContain('6:52:31 PM UTC')
    expect(line('- **The grep check (WS02 step 1).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('takes on each follow-up WS01 handed to WS02, with the step that takes it, and adds its own', () => {
    const own = entries(followUps)
    const HANDED: Array<[string, number]> = [
      ['"Event-mode phases in WS02 (step 5)"', 13],
      ['"Contracts as endpoints change (step 7)"', 13],
      ['"The browser bar colour when the choice differs from the device (step 21)"', 3],
      ['"A light card inside a navy band (step 21)"', 3],
      ['"Classes only docs and tests name reach the CSS (step 23)"', 3],
      ['"Selected navy controls in dark mode (step 23)", its header part', 5],
      ['"Gold grounds in dark mode (step 23)"', 3],
      ['"WS02\'s gold (step 25)"', 7],
      ['"The header\'s brand link in WS02 (step 28)"', 5],
      ['"The layout shift as measured (step 31)"', 3],
      ['"The pages AC1 does not name (step 32)", its `/contact` and `/support` part', 18],
      ['"Brief text", with the deviation "Brief 0.1, rule 8"', 1],
    ]
    for (const [quote, step] of HANDED) {
      const found = own.filter((l) => l.includes(quote))
      expect(found, quote).toHaveLength(1)
      expect(found[0].startsWith('- **From WS01: '), quote).toBe(true)
      expect(head(found[0]), quote).toMatch(new RegExp(`\\(WS02 step ${step}\\)\\.$`))
    }
    expect(own.filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(HANDED.length)
    // Each quoted heading is one of WS01's Follow-ups, word for word.
    const ws01FollowUps = between(status, '### Follow-ups', '\n## WS02')
    for (const [quote] of HANDED) expect(ws01FollowUps, quote).toContain(`- **${quote.slice(1, quote.indexOf('"', 1))}.**`)
    expect(own.map(head)).toEqual(expect.arrayContaining(['K\'s questions for WS02, with their defaults (WS02 step 1).', 'The public-answer trim still to merge (WS02 step 1).']))
    const trim = own.find((l) => l.startsWith('- **The public-answer trim still to merge')) ?? ''
    for (const name of ['`clubEmailHidden`', '`rosterShortNames`', 'as WS02 step 1 declared them']) expect(trim, name).toContain(name)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 1: the entries brief 1.4 answers', () => {
  it('ends the deviation "Brief 0.1, rule 8" and the follow-up "Brief text" with what brief 1.4 now says, and renames neither', () => {
    for (const text of [rule8, briefText]) {
      expect(text.startsWith('Done in brief 1.4: rule 0.1.8 now reads "Previews never touch the production database"')).toBe(true)
      for (const piece of ['`wrangler.toml` binds `DB` to `lca-db-preview` under `[env.preview]` for every branch except `main`', 'the GitHub Actions job in `migrate-db.yml`', '`npm run db:migrate:preview`', 'no longer says "K applies remote migrations"', '(WS02 step 1).']) {
        expect(text, piece).toContain(piece)
      }
      expect(text).not.toMatch(/step 32/i)
    }
    expect(line('- **Brief 0.1, rule 8** ("Preview deployments share the production database") is no longer true once this step merges.')).not.toBe('')
    expect(line('- **Brief text.** Update brief 0.1 rule 8 and the 0.2 line "K applies remote migrations" in the next brief revision.')).not.toBe('')
    // Step 32 closed four of WS01's follow-ups; this step closes none in those words.
    expect(entries(between(status, '### Follow-ups', '\n## WS02')).filter((l) => l.includes('Done in step 32'))).toHaveLength(4)
  })
})

describe('REDESIGN_SPEC.md is brief 1.4', () => {
  it('has the version line of 1.4', () => {
    expect(spec.split('\n')[4].startsWith('**Version:** 1.4, Thursday, October 22, 2026')).toBe(true)
  })

  it('keeps the WS01 deviation line of 1.3 byte for byte, as the only line that starts so', () => {
    const ws01 = spec.split('\n').filter((l) => l.startsWith('- WS01:'))
    expect(ws01).toHaveLength(1)
    expect(createHash('sha256').update(`${ws01[0]}\n`).digest('hex')).toBe('71f182150c8fa684cec110c6ba515a3f823b7543b0c68fc28d99374129dc7a09')
  })

  it('names 42 switches in its flag table and one row that is not a switch, each switch declared in src/lib/features.ts', () => {
    const all = spec.split('\n')
    const start = all.findIndex((l) => l.startsWith('| Flag | Turns on | Can go on in |'))
    expect(start).toBeGreaterThan(-1)
    const rows: string[] = []
    for (let i = start + 2; all[i]?.startsWith('|'); i++) rows.push(all[i])
    const names = rows.map((l) => /^\| `([a-zA-Z][a-zA-Z0-9]*)` \|/.exec(l)?.[1]).filter((n): n is string => n !== undefined)
    expect(names).toHaveLength(42)
    const others = rows.filter((l) => !/^\| `[a-zA-Z][a-zA-Z0-9]*` \|/.test(l))
    expect(others).toHaveLength(1)
    expect(others[0].startsWith('| `member_events_enabled` | **not a build switch:**')).toBe(true)
    // Only that each is declared: whether a switch is on is test/unit/features.test.ts's to hold, so K turning one on fails nothing here.
    const declared = read('src/lib/features.ts').split('\n').flatMap((l) => /^ {2}([a-zA-Z][a-zA-Z0-9]*): (?:true|false),$/.exec(l)?.[1] ?? [])
    for (const name of [...names, 'clubTournaments', 'tournamentQuickFilters', 'externalTags']) expect(declared, name).toContain(name)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 1: plain language', () => {
  it('keeps the dashes, the working words, any tool\'s name and the old initials out of what the step wrote', () => {
    const written = [ws02, ...headerLines, mergedOwn, dateLine, rule8, briefText, verifyClosing]
    for (const text of written) expect(text).not.toBe('')
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
    }
  })

  it.each([
    'test/unit/redesign-status-ws02-step1.test.ts',
    'test/unit/redesign-status-ws02-step1-edges.test.ts',
    'test/unit/reload-on-stale-chunk.test.ts',
    'test/unit/reload-on-stale-chunk-edges.test.ts',
    'test/unit/reload-on-stale-chunk-loader.test.ts',
    'test/unit/reload-on-stale-chunk-pages.test.tsx',
    'test/unit/redesign-status-ws02-step1-claims.test.ts',
    'src/lib/reloadOnStaleChunk.ts',
  ])('%s has no em dash, no en dash and no tool\'s name', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(BARE)
  })
})
