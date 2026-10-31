// test/unit/redesign-status-ws02-step1-edges.test.ts
//
// What WS02 step 1 wrote, at the edges test/unit/redesign-status-ws02-step1.test.ts
// leaves out. Like that file, this one reads only the lines the step wrote:
// the WS02 section, the WS01 header's three lines, the first paragraph of the
// Checkpoint D section and the three sentences it closed older entries with.
//
// - Brief 1.4 as it landed: no en dash and no em dash anywhere in it, and its
//   one "- WS01:" line opens the list under "Deviations from v1.1", where
//   the WS01 record tests read it.
// - The eighteen switches the step declared in src/lib/features.ts: each
//   with a one-line comment of its own directly above it, in the file's
//   /** ... */ form, of five words or more, with no dash, no workstream
//   label, no working word and no old initials for US Chess; each under the
//   step's one section comment, after the switches that were there; none of
//   them one of WS01's 24. Only how each is declared and explained is read
//   here, never whether it is on, so K turning one on fails nothing here; a
//   later step that rewrites one of these comments, or retires the switch,
//   as its part ships takes that name out of the list below.
// - The dates and times the step wrote: every date carries its weekday, and
//   the weekday is right for it; every time reads on the twelve-hour clock,
//   as "6:52 PM"; the commit's time given in Central is the UTC time five
//   hours earlier, as Central Daylight Time was that Thursday, and the merge
//   time the Checkpoint D section gives is the pull request's own, to the
//   minute.
// - The stale-tab reload's record says why it came: K's admin tab of
//   /governance/minutes on Thursday, October 22, the "Add document" that
//   failed, a deploy for every checkpoint from now on, and a mark that lasts
//   as long as the tab.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
const spec = read('docs/redesign/REDESIGN_SPEC.md')
const features = read('src/lib/features.ts')
const lines = status.split('\n')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** The working words, put together so that this file does not hold them either. */
const WORKING = ['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow']
/** The working words, in the plural as well, and the two words that name a person's role in the work, as words of their own. */
const WORKING_WORDS = new RegExp(`\\b(${WORKING.join('|')})s?\\b|\\b${'the ' + 'lead'}\\b`, 'i')

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
/** What the step added at the end of an older line: from `from` to the end of the line. */
const closing = (start: string, from: string) => {
  const l = line(start)
  return l.includes(from) ? l.slice(l.indexOf(from)) : ''
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

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const header = between(status, '## WS01:', '### What each acceptance criterion')
const headerLines = header.split('\n').filter((l) => /^\*\*(Status|Branch|PR):\*\*/.test(l))
const checkpoint = between(status, '### Checkpoint D: steps 20 to 32', '### Decisions')
const merged = checkpoint.split('\n').find((l) => l.startsWith('**Merged into `main` as')) ?? ''
const mergedOwn = merged.slice(0, merged.indexOf(' Checkpoint D is the design system'))
const closings = [
  closing('- **Brief 0.1, rule 8**', 'Done in brief 1.4:'),
  closing('- **Brief text.**', 'Done in brief 1.4:'),
  closing('- **The header and checkpoint D (step 32).**', 'Since then the merge has happened'),
]
/** Every line the step wrote, with what sits in backticks taken out, since code is not prose. */
const written = [ws02, ...headerLines, mergedOwn, ...closings]
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** The year of the date line, for a date written without its year. */
const YEAR = Number(/^Last updated: (\d{4})-\d{2}-\d{2} /.exec(line('Last updated:'))?.[1])

describe('brief 1.4 as it landed', () => {
  it('holds no en dash and no em dash anywhere', () => {
    const found = spec.split('\n').flatMap((l, i) => (DASHES.test(l) ? [`line ${i + 1}`] : []))
    expect(found).toEqual([])
  })

  it('opens the list under "Deviations from v1.1" with its one "- WS01:" line', () => {
    const all = spec.split('\n')
    const at = all.findIndex((l) => l.startsWith('- WS01:'))
    expect(at).toBeGreaterThan(0)
    expect(all.filter((l) => l.startsWith('- WS01:'))).toHaveLength(1)
    expect(all[at - 1].startsWith('**Deviations from v1.1 to record in `REDESIGN_STATUS.md`**')).toBe(true)
  })
})

describe('the working words this file keeps out of the switches\' comments', () => {
  it('are the words it always kept out, in the plural as well, and the two words of a person\'s role as words of their own, built from pieces since WS02 step 7', () => {
    for (const word of WORKING) {
      for (const text of [word, `${word}s`, `Two ${word.toUpperCase()}S here.`]) expect(WORKING_WORDS.test(text), text).toBe(true)
      expect(WORKING_WORDS.test(`${word}ing`), `${word}ing`).toBe(false)
    }
    for (const text of ['the ' + 'lead', 'The ' + 'Lead said so']) expect(WORKING_WORDS.test(text), text).toBe(true)
    for (const text of ['the ' + 'leading line', 'the ' + 'leader', 'a lead', 'slight', 'build', 'flow', 'agent']) expect(WORKING_WORDS.test(text), text).toBe(false)
    expect(WORKING_WORDS.flags).toBe('i')
  })
})

describe('the eighteen switches WS02 step 1 declared in src/lib/features.ts', () => {
  /** In the order brief 1.4's flag table gives them. */
  const DECLARED_IN_WS02_STEP_1 = [
    'clubEmailHidden', 'rosterShortNames', 'newLive', 'resultReports', 'roundAlerts', 'followerAlerts', 'standingDirectors',
    'tdConsole', 'adminHome', 'newClubs', 'newNews', 'newScholastic', 'seasonSchedule', 'newMembership', 'newDashboard',
    'myLcaRail', 'newAbout', 'scanner2',
  ]
  /** The 24 the file held at the close of WS01, as test/unit/scopes-edges.test.ts keeps them. */
  const AT_THE_CLOSE_OF_WS01 = [
    'clubTournaments', 'tournamentQuickFilters', 'externalTags', 'newLook', 'themeHeritage', 'themeScholastic', 'newNav', 'siteSearch',
    'homeSearch', 'eventStrip', 'eventStripLive', 'liveMarker', 'newHome', 'homeResults', 'homeChampions', 'homeLive', 'homeWeek',
    'homeRecap', 'homeFeatured', 'newTournaments', 'newEventPage', 'festivals', 'householdCheckout', 'membershipRequirementSwitch',
  ]
  const all = features.split('\n')
  const declaredAt = (name: string) => all.findIndex((l) => new RegExp(`^ {2}${name}: (?:true|false),$`).test(l))
  const SECTION = '  // Redesign, brief 1.4. Off until each part is checked on a preview.'

  it.each(DECLARED_IN_WS02_STEP_1)('%s is declared once, with a one-line comment of its own directly above it', (name) => {
    expect(all.filter((l) => new RegExp(`^ {2}${name}: (?:true|false),$`).test(l)), name).toHaveLength(1)
    const above = all[declaredAt(name) - 1]
    const comment = /^ {2}\/\*\* (.+) \*\/$/.exec(above)?.[1] ?? ''
    expect(comment, `the line above ${name}`).not.toBe('')
    expect(comment.split(/\s+/).length, name).toBeGreaterThanOrEqual(5)
    expect(comment).not.toMatch(DASHES)
    expect(comment).not.toMatch(/\bWS\d\d\b/)
    expect(comment).not.toMatch(WORKING_WORDS)
    expect(comment).not.toMatch(OLD_INITIALS)
    // One comment for one switch: the comment does not run on from, or into, another.
    expect(all[declaredAt(name) - 2].trim(), `the line two above ${name}`).toBe('')
  })

  it('sit under the step\'s one section comment, after every switch that was there', () => {
    const section = all.indexOf(SECTION)
    expect(section).toBeGreaterThan(-1)
    expect(all.filter((l) => l === SECTION)).toHaveLength(1)
    for (const name of AT_THE_CLOSE_OF_WS01) expect(declaredAt(name), name).toBeLessThan(section)
    for (const name of DECLARED_IN_WS02_STEP_1) expect(declaredAt(name), name).toBeGreaterThan(section)
    const places = DECLARED_IN_WS02_STEP_1.map(declaredAt)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
  })
})

describe('the dates and times WS02 step 1 wrote', () => {
  it('reads every line it means to', () => {
    for (const text of written) expect(text).not.toBe('')
    expect(YEAR).toBe(2026)
  })

  it('gives every date its weekday', () => {
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of prose) {
      const dates = [...text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))]
      for (const date of dates) {
        const before = text.slice(Math.max(0, (date.index ?? 0) - 11), date.index)
        expect(before, `${date[0]} in "${text.slice((date.index ?? 0) - 40, (date.index ?? 0) + 30)}"`).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
    }
  })

  it('gives each date the weekday it falls on', () => {
    const pattern = new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g')
    const checked: string[] = []
    for (const text of prose) {
      for (const [whole, weekday, month, day, year] of text.matchAll(pattern)) {
        const date = new Date(Date.UTC(Number(year ?? YEAR), MONTHS.indexOf(month), Number(day)))
        expect(WEEKDAYS[date.getUTCDay()], whole).toBe(weekday)
        checked.push(whole)
      }
    }
    // The merge's day, the day brief 1.4 was settled to land here, and the day of the stale tab.
    expect(checked).toEqual(expect.arrayContaining(['Thursday, October 22, 2026', 'Friday, October 23, 2026', 'Thursday, October 22']))
  })

  it('writes every time on the twelve-hour clock, as "6:52 PM"', () => {
    const times = prose.flatMap((text) => [...text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)].map((m) => m[0]))
    expect(times.length).toBeGreaterThan(0)
    for (const time of times) expect(time).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
  })

  it('gives the commit\'s time in Central as the UTC time five hours earlier, as Central Daylight Time was that day', () => {
    const item = line('- **The merge commit and its time (WS02 step 1).**')
    const found = /(\d{1,2}:\d{2}:\d{2} [AP]M) Central, which is (\d{1,2}):(\d{2}):(\d{2}) ([AP]M) UTC/.exec(item)
    expect(found, 'the commit\'s time in Central and in UTC').not.toBeNull()
    const [, central, hour, minute, second, half] = found as RegExpExecArray
    const day = /on (Thursday), (October) (22), (2026)/.exec(item)
    expect(day, 'the merge\'s day').not.toBeNull()
    const hour24 = (Number(hour) % 12) + (half === 'PM' ? 12 : 0)
    const instant = new Date(Date.UTC(2026, 9, 22, hour24, Number(minute), Number(second)))
    const inChicago = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(instant)
    expect(inChicago.replace(/\u202f/g, ' ')).toBe(central)
    // Daylight time: five hours behind UTC that Thursday, six once it ends on Sunday, November 1, 2026.
    const offset = (at: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' }).formatToParts(at)
      return parts.find((p) => p.type === 'timeZoneName')?.value
    }
    expect(offset(instant)).toBe('GMT-5')
    expect(offset(new Date(Date.UTC(2026, 10, 2, 18)))).toBe('GMT-6')
  })

  it('gives the pull request\'s own merge time, to the minute, as the time of the merge', () => {
    const item = line('- **The merge commit and its time (WS02 step 1).**')
    const pullRequest = /pull request's merge time as (\d{1,2}:\d{2}):\d{2} (PM|AM) UTC on Thursday, October 22, 2026/.exec(item)
    expect(pullRequest, 'the pull request\'s merge time').not.toBeNull()
    const [, minute, half] = pullRequest as RegExpExecArray
    expect(mergedOwn).toContain(`on Thursday, October 22, 2026 at ${minute} ${half} UTC**`)
    expect(item).toContain(`The record gives the pull request's merge time, ${minute} ${half} UTC, and says so.`)
  })
})

describe('the stale-tab reload\'s record', () => {
  const block = between(ws02, '### WS02 step 1: the record, brief 1.4 and the stale-tab reload', '\n### ')
  const reload = bullet(block, '- **The stale-tab reload.**')

  it('says why it came: K\'s admin tab of /governance/minutes on Thursday, October 22, and a deploy for every checkpoint', () => {
    expect(reload).not.toBe('')
    for (const piece of [
      'On Thursday, October 22, K\'s admin tab of `/governance/minutes`, open since before checkpoint D\'s deploy',
      '"Something went wrong" screen on "Add document"',
      'the new deployment no longer serves that file',
      'with a deploy for every checkpoint from now on',
    ]) expect(reload, piece).toContain(piece)
  })

  it('says the reload comes once in a tab\'s life, and what the next stale file meets', () => {
    expect(reload).toContain('the guard never clears the mark, which lasts as long as the tab')
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls).toContain('a tab reloads by itself at most once in its life')
    expect(calls).toContain('shows the error screen, whose Refresh button mends it')
  })
})
