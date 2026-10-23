// test/unit/redesign-status-ws02-step2.test.ts
//
// REDESIGN_STATUS.md records WS02 step 2: the navigation model, the chrome's
// one condition, the guard on the five early switches, the seven switches of
// the a11y-on test build and the signed-in visitor of the browser tests. This
// file reads only the WS02 section and the two lines the step wrote outside
// the block (the Status line and the date line), never every table row or
// heading of the file, which WS01's record tests read. Pinned here: the
// Status line; the date line's two parts; the step's block with every part
// and every file; its decisions, deviations, verify items and follow-ups,
// each with its tag; the map left as WS02 step 1 wrote it; the plain-language
// rules over what the step wrote; and, checked against the files they
// describe, the record's claims: the model's entries and labels, the
// addresses the five early switches open, the 42 switches and the eighteen
// comments WS02 step 1 wrote, the a11y-on build's seven switches in
// test/a11y/global-setup.ts and test/a11y/builds.spec.ts, the twelve people
// of the persona list, the two signed-in specs' tests and the helper's wait,
// which covers one page. Every file the step adds is held to the dashes and
// names rules by name. It never reads whether
// a switch is on: that is test/unit/features.test.ts's to hold, so K turning
// a switch on fails nothing here. A later step that rewrites one of the
// eighteen comments as its part ships takes that name out of the list below.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES, type Features } from '@/lib/features'
import { NAV_IDS, navLabel, openedAddresses } from '@/lib/nav'
import { A11Y_VARIANTS } from '../a11y/global-setup'
import { PERSONA_KEYS, navPersonas } from './fixtures/navPersonas'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
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
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH'].join('|')})\\b`)

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
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith('(WS02 step 2).'))

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const part = (heading: string) => between(ws02, heading, '\n### ')
const STEP1 = '### WS02 step 1: the record, brief 1.4 and the stale-tab reload'
const STEP = '### WS02 step 2: the navigation model, the signed-in visitor and the browser build\'s switches'
const block = part(STEP)
const map = part('### WS02 map: what proves each acceptance criterion and decision')
const decisions = part('### WS02 decisions')
const deviations = part('### WS02 deviations from the brief')
const verify = part('### WS02 verify items resolved')
const followUps = between(ws02, '### WS02 follow-ups', '\n## ')
const statusLine = ws02.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const dateLine = line('Last updated:')
/** WS02's part of the date line, which the steps of WS02 write. */
const datePart = dateLine.slice(dateLine.indexOf('; WS02, ') + 2)

/** Everything this step wrote, each piece on its own. */
const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, datePart]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

const ALL_OFF = Object.fromEntries(Object.keys(FEATURES).map((n) => [n, false])) as Features

/** The files this step adds, the model, the person list, the helper and every new test among them. */
const NEW_FILES = [
  'src/lib/nav.ts',
  'test/unit/nav.test.ts',
  'test/unit/nav-model-edges.test.ts',
  'test/unit/fixtures/navPersonas.ts',
  'test/unit/nav-personas-edges.test.ts',
  'test/unit/signed-in-session.test.ts',
  'test/unit/signed-in-header.test.tsx',
  'test/integration/nav-personas.test.ts',
  'test/a11y/signedIn.ts',
  'test/a11y/signed-in.spec.ts',
  'test/a11y/signed-in-edges.spec.ts',
  'test/unit/redesign-status-ws02-step2.test.ts',
]

describe('REDESIGN_STATUS.md, WS02 step 2: the two lines outside the block', () => {
  it('says in the Status line that steps 1 and 2 are built', () => {
    expect(statusLine).toBe('**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); steps 1 and 2 are built.')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 2 before step 1 in WS02\'s part', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 2: navigation model and signed-in visitor; step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-10-23').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 2: the step block', () => {
  it('sits after the step 1 block and before the decisions, and leaves the map as WS02 step 1 wrote it', () => {
    const at = [STEP1, STEP, '### WS02 decisions'].map((h) => ws02.indexOf(h))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(STEP)).toHaveLength(2)
    // Still the 23 criteria and the 12 decisions, each planned for exactly one step; later steps fill their items in.
    const items = entries(map)
    expect(items.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(items).toHaveLength(35)
    for (const item of items) expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item')
  })

  it('has every part, every file and nothing left to fill in', () => {
    for (const piece of [
      '**Files.**', '**The navigation model.**', '**The chrome\'s one condition.**', '**The switches.**', '**The browser build.**',
      '**The signed-in visitor.**', '**Pins moved.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**',
      '\n- Checks:', 'Files beyond the step\'s list:',
    ]) expect(block, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, 'src/lib/features.ts', 'test/a11y/global-setup.ts', 'REDESIGN_STATUS.md',
      'test/a11y/builds.spec.ts', 'test/unit/scopes-edges.test.ts', 'test/unit/redesign-status-ws02-step1.test.ts', 'playwright.config.ts',
      '.dev.vars.a11y', 'test/unit/features.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
    // Each new test file of the unit and integration suites with the number of its tests.
    for (const name of NEW_FILES.filter((f) => /^test\/(unit|integration)\/.*\.test\.tsx?$/.test(f))) {
      expect(files, name).toMatch(new RegExp(`\`${name.replace(/[./]/g, '\\$&')}\` \\(\\d+: `))
    }
    expect(files).toContain('`test/a11y/signed-in.spec.ts` (14 in each project, 28 in all')
    expect(files).toContain('`test/a11y/signed-in-edges.spec.ts` (4 in each project, 8 in all')
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const text of [block, decisions, deviations, verify, followUps]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what the model holds, what it leaves to later steps, and that no page reads it yet', () => {
    const model = bullet(block, '- **The navigation model.**')
    for (const piece of [
      'no React, no router, no request, no contract and no colour', '`canAccessAdmin`, `isViewOnlyAdmin` and `WORKSPACE_ROLES`',
      'Donate as the last row above it', 'today\'s donation dialog', '`/give` once `newMembership` is on', '"Admin (view only)"',
      'the word Workspace is in no row', '`/tournaments/:id/print`, `/membership/success` and `/donate/success`',
      'nola for New Orleans Metro', 'the to-do group and the event line of the My LCA menu (WS02 step 17)',
    ]) expect(model, piece).toContain(piece)
    expect(block).toContain('no page reads the model yet')
    expect(block).toContain('With the switches off nothing a visitor sees changes')
  })

  it('names the chrome\'s condition, its four gates and the sentence each switch\'s comment gains', () => {
    const chrome = bullet(block, '- **The chrome\'s one condition.**')
    for (const piece of ['`chromeOn`', '`searchOn`', '`eventStripOn`', '`eventStripLiveOn`', '`liveMarkerOn`', '`switchOn`', 'with `newNav` on and `newLook` off the site keeps today\'s header and footer']) {
      expect(chrome, piece).toContain(piece)
    }
    expect(chrome).toContain('"It shows only when newNav and newLook are on as well."')
    expect(chrome).toContain('"It shows only when eventStrip, newNav and newLook are on as well."')
  })

  it('says the guard holds the five early switches, with no list holding them off, and that it holds a pull request and not a preview', () => {
    const switches = bullet(block, '- **The switches.**')
    for (const piece of ['None is added', 'No list holds the five off', 'the notes for this workstream', '`/workspace/lookup`', 'its message says the five stay off until their part ships', 'not a throwaway preview branch, which runs none']) {
      expect(switches, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS02 step 2: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    const own = tagged(decisions).map(head)
    expect(own).toEqual([
      'The chrome\'s one condition, built (WS02 step 2).',
      'The model takes the switches as an argument (WS02 step 2).',
      'The guard alone holds the five early switches (WS02 step 2).',
      'Donate before the Give page (WS02 step 2).',
      'The sheet and the tabs live in the model (WS02 step 2).',
      'The signed-in visitor answers in the browser (WS02 step 2).',
    ])
  })

  it('records what it found or chose that differs from the plan or the brief, after the deviations planned for the step', () => {
    const own = tagged(deviations).map(head)
    for (const name of [
      'The browser test build\'s switches', 'Signed-in states in the browser tests', 'The chrome needs the new look',
      'The five switches were already declared', 'No list holds the five off', 'The five comments stay as WS02 step 1 wrote them',
      '`POST /api/me` needs an answer too', 'A fourth pin and four comments', 'Children as a yes or no', 'Addresses the brief does not give',
      'Parents\' first-tournament words point at Scholastic', 'Website help where brief 1.4 places support', 'The round states need the strip',
      'The browser counts rise', 'Two pins of the step 1 record test move',
    ]) expect(own, name).toContain(`${name} (WS02 step 2).`)
    for (const entry of tagged(deviations)) expect(entry).not.toMatch(/^- \*\*From v1\.[13]: /)
    // The step's own entries follow the three the plan wrote for it, and come before WS02 step 3's.
    const heads = entries(deviations).map(head)
    expect(heads.indexOf('The five switches were already declared (WS02 step 2).')).toBe(heads.indexOf('The chrome needs the new look (WS02 step 2).') + 1)
    expect(heads.indexOf('Two pins of the step 1 record test move (WS02 step 2).')).toBeLessThan(heads.indexOf('The skip link first at every width (WS02 step 3).'))
  })

  it('resolves each verify item, found in the code or measured', () => {
    const names = [
      'The tree', 'The switches', 'The switch test', 'Nothing reads the chrome\'s switches', 'The pins of the browser build\'s list', 'Routes',
      'Today\'s account links', 'The sign-in context', 'The sign-in library', 'The servers refuse a made-up token', 'The support file', 'The seed',
      'The labels', 'Search\'s words', 'The icons', 'The step 1 record tests', 'Lint and counts', 'The baseline', 'The stylesheet\'s growth',
      'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 2).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    expect(line('- **The sign-in library (WS02 step 2).**')).toContain('`sb-127-auth-token`')
    expect(line('- **The grep check (WS02 step 2).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('adds its follow-ups, none of them one WS01 handed on', () => {
    const own = tagged(followUps)
    expect(own.map(head)).toEqual([
      'Signed-in pages and states in the browser tests (WS02 step 2).',
      'K reads search\'s words once (WS02 step 2).',
      'No help page for US Chess IDs yet (WS02 step 2).',
      'Two addresses to confirm (WS02 step 2).',
      'Children and entries in the sign-in context (WS02 step 2).',
      'Leaving the five early switches off (WS02 step 2).',
      'Turning a switch on for everyone (WS02 step 2).',
      'A new version of the sign-in library (WS02 step 2).',
      'Support in today\'s More menu (WS02 step 2).',
      'A date in today\'s header file (WS02 step 2).',
      'The round states\' comment (WS02 step 2).',
      'The home page\'s lab check (WS02 step 2).',
    ])
    for (const entry of own) expect(entry.startsWith('- **From WS01: ')).toBe(false)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 2: plain language', () => {
  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
    expect(tagged(decisions).length + tagged(deviations).length + tagged(verify).length + tagged(followUps).length).toBeGreaterThan(40)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and table rows out of what the step wrote', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
    }
  })

  it('names steps as "WS02 step N", never with the bare "(step N)" WS01\'s tests look for', () => {
    for (const text of written) expect(text).not.toMatch(/\(step \d+[;)]/)
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of prose) {
      for (const date of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (date.index ?? 0) - 11), date.index), date[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS02 step 2: its claims against the files', () => {
  it('gives the number of the model\'s entries and the labels the board sets, each the label of an entry', () => {
    const model = bullet(block, '- **The navigation model.**')
    expect(model).toContain(`One entry for each destination, ${NAV_IDS.length} in all`)
    const labels = NAV_IDS.map(navLabel)
    const named = between(model, 'The labels are the board\'s section F: ', '; the sheet\'s')
    const quoted = [...named.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(quoted).toHaveLength(9)
    for (const label of quoted) expect(labels, label).toContain(label)
  })

  it('names the paths each early switch opens as the model opens them', () => {
    const switches = bullet(block, '- **The switches.**')
    const pathsOf = (name: string) => {
      const before = new Set(openedAddresses(ALL_OFF))
      return [...new Set(openedAddresses({ ...ALL_OFF, [name]: true }).filter((a) => !before.has(a) && a.startsWith('/')).map((a) => a.split(/[?#]/)[0]))].sort()
    }
    for (const name of ['newAbout', 'newNews', 'newMembership', 'newClubs']) {
      const said = new RegExp(`\`${name}\` opens (.+?), (?:and )?\`(?:new|my)[A-Za-z]+\` `).exec(switches)?.[1] ?? ''
      const paths = [...said.matchAll(/`(\/[^`]+)`/g)].map((m) => m[1]).sort()
      expect(paths, name).toEqual(pathsOf(name))
    }
    expect(switches).toContain('`myLcaRail` needs `/workspace/lookup`')
  })

  it('holds 42 switches, and the eighteen comments WS02 step 1 wrote as it wrote them', () => {
    const file = read('src/lib/features.ts').split('\n')
    const declared = file.filter((l) => /^ {2}[a-zA-Z][a-zA-Z0-9]*: (?:true|false),$/.test(l))
    expect(declared).toHaveLength(42)
    expect(Object.keys(FEATURES)).toHaveLength(42)
    const COMMENTS: Record<string, string> = {
      clubEmailHidden: 'Today\'s club page offers "Contact this club through LCA" in place of the club\'s email.',
      rosterShortNames: 'Today\'s event page lists entrants under 18 by first name and last initial to anyone not running it.',
      newLive: 'The new live pages: pairings, standings, My board, Find your board, the hall TV and the print kit.',
      resultReports: 'Players report their own results from the pinned card, with the director\'s queue of reported results.',
      roundAlerts: 'Round emails to registered players and their guardians, sent when a director publishes a round and asks.',
      followerAlerts: 'The same round emails for the people who follow a player or the event.',
      standingDirectors: 'The first phase of tournament creation: standing directors, one-event directors and the entry-fee rule.',
      tdConsole: 'The new director\'s console, one stage at a time, with the setup checklist and the rating report step.',
      adminHome: 'The new admin home: the dashboard, the merged Needs attention queue and the grouped sidebar.',
      newClubs: 'The new clubs directory and club pages; the new menus and footer read it for their club rows too.',
      newNews: 'The new News page, results index and /about/champions; the new menus read it for State champions too.',
      newScholastic: 'The new Scholastic page, one page for parents.',
      seasonSchedule: 'The scholastic season block, Season at a glance on Tournaments and the admin season screen.',
      newMembership: 'The new Membership and Give pages and the digital card; the new menus read it for Donate and the card too.',
      newDashboard: 'The new one-page My LCA (Today, You, Family, Receipts and Settings), for everyone until the rail is on.',
      myLcaRail: 'My LCA\'s left rail for volunteers; until it is on, the new My LCA menu keeps today\'s role rows.',
      newAbout: 'The new tabbed About page and its redirects; the new menus read it for their governance rows too.',
      scanner2: 'The new scoresheet scanner for active LCA members, with private drafts, My games and the printed kit.',
    }
    for (const [name, comment] of Object.entries(COMMENTS)) {
      const at = file.findIndex((l) => new RegExp(`^ {2}${name}: (?:true|false),$`).test(l))
      expect(file[at - 1], name).toBe(`  /** ${comment} */`)
    }
  })

  it('holds none of the five early switches off by name in the switch test or the builds spec, as the record says', () => {
    expect(bullet(block, '- **The switches.**')).toContain('No list holds the five off')
    for (const file of ['test/unit/features.test.ts', 'test/a11y/builds.spec.ts']) {
      const text = read(file)
      for (const name of ['newAbout', 'newNews', 'newMembership', 'newClubs', 'myLcaRail']) expect(text.includes(name), `${file} names ${name}`).toBe(false)
    }
  })

  it('names the seven switches the a11y-on build turns on, as test/a11y/global-setup.ts and test/a11y/builds.spec.ts give them', () => {
    const build = bullet(block, '- **The browser build.**')
    const said = [...between(build, 'builds `a11y-on` with ', ', in that order').matchAll(/`([a-zA-Z]+)`/g)].map((m) => m[1])
    expect(said).toHaveLength(7)
    expect(A11Y_VARIANTS.find((v) => v.name === 'a11y-on')?.flags.split(',')).toEqual(said)
    expect(A11Y_VARIANTS.find((v) => v.name === 'a11y-off')?.flags).toBe('')
    const spec = read('test/a11y/builds.spec.ts')
    const listed = [...(/^const SWITCHES_ON = \[([^\]]*)\]$/m.exec(spec)?.[1] ?? '').matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
    expect(listed).toEqual(said)
  })

  it('counts the twelve people of the persona list and the two signed-in specs\' tests in each project', () => {
    expect(PERSONA_KEYS).toHaveLength(12)
    const people = navPersonas()
    expect(people).toHaveLength(12)
    const signedIn = people.filter((p) => p.user !== null).length
    expect(signedIn).toBe(11)
    const spec = read('test/a11y/signed-in.spec.ts')
    // One test for each person signed in, from one loop, and three more.
    const tests = (spec.match(/^\s*test\(/gm) ?? []).length
    expect(tests - 1 + signedIn).toBe(14)
    // The edges, one test each.
    expect(read('test/a11y/signed-in-edges.spec.ts').match(/^test\(/gm) ?? []).toHaveLength(4)
    expect(bullet(block, '- **The signed-in visitor.**')).toContain('`sb-127-auth-token`')
  })

  it('says one wait for the member\'s answers covers one page, as the helper waits', () => {
    const visitor = bullet(block, '- **The signed-in visitor.**')
    expect(visitor).toContain('one call covers one page')
    const helper = read('test/a11y/signedIn.ts')
    expect(helper).toContain('One call covers one page.')
    expect(helper).toMatch(/\.poll\(\(\) => needed\.filter\(\(call\) => !visit\.answeredOnThisPage\.includes\(call\)\)/)
  })
})

describe('the files of this step', () => {
  it.each(NEW_FILES)('%s has no em dash, no en dash, no tool\'s name and no old initials for US Chess', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(BARE)
    expect(text).not.toMatch(OLD_INITIALS)
  })
})
