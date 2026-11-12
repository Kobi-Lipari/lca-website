// test/unit/redesign-status-ws16-before-switch-on.test.ts
//
// REDESIGN_STATUS.md, the change between checkpoint M's merge and the
// switch-on: what it wrote in the WS16 section, read from the record alone.
// It reads only the WS16 section and the date line, and no count from the
// code: the block "Before the switch-on: the newsletter tab's last rough
// spots" at the section's end, its bullets in their order, the five spots and
// what was not built, the files with each test file's count beside it and
// the sums against the base's in the Checks line, the pins it moved, the
// build's and the worker's figures, the pull request's text with its short
// headings; the paragraph that opens checkpoint M's section with the merge;
// the PR line and the Status line; and the plain-language rules on all of it.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

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
const UNFILLED = new RegExp(`${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}|${'to be ' + 'measured'}|PRTEXT`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** An assistant named in a pull request's text, or a line about how it was written. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')
/** The merge-pending phrase. */
const PENDING = new RegExp(`merge into \`main\` is ${'pen' + 'ding'}|is ${'pen' + 'ding'}`)

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
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const sectionLines = ws16.split('\n')
const BLOCK_HEADING = "### Before the switch-on: the newsletter tab's last rough spots"
const CHECKPOINT = '### Checkpoint M: WS16 steps 1 to 8'
const block = ws16.includes(`\n${BLOCK_HEADING}\n`) ? ws16.slice(ws16.indexOf(`\n${BLOCK_HEADING}\n`) + 1) : ''
const checkpoint = between(ws16, `\n${CHECKPOINT}\n`, '\n### ').slice(1)
const opening = checkpoint.split('\n')[2] ?? ''
const firstSentence = block.split('\n')[2] ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')

const BULLETS = [
  '- **The merge of checkpoint M recorded.**', '- **The five spots.**', '- **What ships with every switch off.**', '- **Files.**', '- **Pins moved.**',
  '- **Build.**', '- **Worker.**', "- **The pull request's text.**", '- Checks:',
]
const MERGE = bullet(block, BULLETS[0])
const SPOTS = bullet(block, BULLETS[1])
const SHIPS = bullet(block, BULLETS[2])
const FILES = bullet(block, BULLETS[3])
const PINS = bullet(block, BULLETS[4])
const BUILD = bullet(block, BULLETS[5])
const WORKER = bullet(block, BULLETS[6])
const PULL_REQUEST = bullet(block, BULLETS[7]).split('\n').filter((l) => l.startsWith('  >')).map((l) => l.replace(/^ {2}> ?/, ''))
const CHECKS = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const SPOT_NAMES = ['F1.', 'F2.', 'F3.', 'F4.', 'F5.', 'Not built:']
const spot = (name: string) => SPOTS.split('\n').find((l) => l.startsWith(`  - ${name} `)) ?? ''

/** Every file the change adds or changes, as its Files bullet names it. */
const CHANGED = [
  'src/pages/AdminEmailPage.tsx', 'src/areas/governance/components/RichTextEditor.tsx', 'src/pages/AdminPage.tsx',
  'REDESIGN_STATUS.md', 'test/unit/helpers/tailwindPx.ts', 'test/unit/fixtures/rich-text-editor-today.tsx',
]
const CHANGED_TESTS = [
  'test/unit/admin-email-newsletter.test.tsx', 'test/unit/admin-media-manager.test.tsx', 'test/unit/email-pages-review.test.tsx', 'test/unit/goldText.test.ts',
  'test/unit/redesign-status-ws16-step1.test.ts', 'test/unit/redesign-status-ws16-step8.test.ts', 'test/unit/redesign-status-ws16-checkpoint-m.test.ts',
]
const NEW_TESTS = ['test/unit/rich-text-editor-phone.test.tsx', 'test/unit/redesign-status-ws16-before-switch-on.test.ts']
/** The pins the change moved, by the test file each sits in. */
const MOVED = [
  'test/unit/redesign-status-ws16-step8.test.ts', 'test/unit/redesign-status-ws16-checkpoint-m.test.ts', 'test/unit/redesign-status-ws16-step1.test.ts',
  'test/unit/admin-email-newsletter.test.tsx', 'test/unit/admin-media-manager.test.tsx', 'test/unit/goldText.test.ts',
]

describe('REDESIGN_STATUS.md, before the switch-on: the block', () => {
  it('sits at the end of the WS16 section, after checkpoint M\'s section and its lists, once, with its bullets in order, each once, and the Checks line last', () => {
    expect(ws16.split(`\n${BLOCK_HEADING}\n`)).toHaveLength(2)
    expect(ws16.indexOf(`\n${BLOCK_HEADING}\n`)).toBeGreaterThan(ws16.indexOf(`\n${CHECKPOINT}\n`))
    expect(ws16.indexOf(`\n${BLOCK_HEADING}\n`)).toBeGreaterThan(ws16.indexOf('\n### WS16 follow-ups\n'))
    expect(block.split('\n').filter((l) => l.startsWith('### '))).toEqual([BLOCK_HEADING])
    const at = BULLETS.map((name) => block.indexOf(`\n${name}`))
    for (const [i, name] of BULLETS.entries()) {
      expect(at[i], name).toBeGreaterThan(-1)
      expect(block.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    }
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.trimEnd().split('\n').at(-1)!.startsWith('- Checks:')).toBe(true)
  })

  it('opens with what the change is, after checkpoint M\'s merge and before the switch-on change, built from the merge, and the switch every spot waits for', () => {
    for (const piece of [
      "follows checkpoint M's merge and comes before the switch-on change", 'Thursday, November 12, 2026 from `d2c5ec0`', 'plainly made-up answers',
      'Each spot put right is drawn only with `mailLists` on', 'keeping the ring round "Saved." as it is', '`MAIL_LISTS_ON` unset', 'no file under `functions/`, `domain/` or `workers/` changes',
    ]) expect(firstSentence, piece).toContain(piece)
  })

  it('records the merge in two sentences: the PR line, the Status line and checkpoint M\'s opening, nothing else of the section changed', () => {
    const words = MERGE.slice(BULLETS[0].length).trim()
    expect(words.split(/(?<=\.)\s+(?=[A-Z])/).filter((s) => !/^"|^\w+\.$/.test(s))).toHaveLength(2)
    for (const piece of [
      'was draft pull request 126, merged into `main` as `d2c5ec0` on Thursday, November 12, 2026', '"steps 1 to 8 are built and merged, switched off."',
      'in the form of the Checkpoint L section', 'nothing else in it changes',
    ]) expect(MERGE, piece).toContain(piece)
  })

  it('gives each spot a sub-bullet of its own, in order, with what changed in the words a person reads, and the stored copies that hold the switch off', () => {
    const at = SPOT_NAMES.map((name) => SPOTS.indexOf(`\n  - ${name} `))
    for (const [i, name] of SPOT_NAMES.entries()) expect(at[i], name).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const copy of ['admin-email-today.tsx', 'admin-page-today.tsx', 'email-pages-today.tsx', 'rich-text-editor-today.tsx']) expect(SPOTS.split('\n')[0], copy).toContain(`\`test/unit/fixtures/${copy}\``)
    expect(SPOTS.split('\n')[0]).toContain("fails on `d2c5ec0`'s code and passes after")
    const pieces: ReadonlyArray<readonly [string, string[]]> = [
      ['F1.', ['never starts or ends a line on its separator', '`RowPieces`', '`-ml-2.5 flex flex-wrap`', '`ml-2.5 whitespace-nowrap`', '`absolute right-full w-2.5 text-center`', '`overflow-hidden`', '"112 recipients"', '"2 failed"', '`aria-hidden`', 'keep their markup byte for byte', '`test/unit/helpers/tailwindPx.ts`', 'the look at 320px and wider is left to the pictures after the gate']],
      ['F2.', ['44px', '`max-sm:min-h-11`', '`RichTextEditor`', '`tallOnPhone`', 'which only the newsletter tab passes', 'the shared `Input`, gained no choice of its own', 'byte for byte as on `d2c5ec0`']],
      ['F3.', [
        'Not built:', 'stays `focus:ring-ring`, with `mailLists` on and off, the class string as on `d2c5ec0`', '`src/pages/EmailPreferencesPage.tsx` unchanged', "K's decision 52 asked for in B1", '`focus:ring-focus`',
        'about 2.6 to 1 on white', 'about 1.5 to 1', 'turns on `mailLists` alone and `newLook` stays off', 'undone B1', 'Under the new look `--ring` is `--focus`', "in the new look's dark themes the same gold", '`ring-ink` would be right in today\'s look and wrong',
        "A darker ring in today's look is K's to ask for.",
        '`src/areas/membership/components/EmailChoiceParts.tsx`', 'nothing else wears `focus:ring-ring`', '"Done." box', 'the heading of a link that does not work takes none',
      ]],
      ['F4.', ['no longer look like an empty text box', '`mt-0.5 text-sm text-ink`', 'no border and no fill', '14px', 'the 6px above them that the test note under the test box has', 'carries 4px under it', 'adds 2px', 'The words are unchanged.']],
      ['F5.', ['"View only, except the newsletter"', '"View only"', "the seat's answer true", 'an officer while the answer is on its way', "K's choice of these words is open", 'the recommended words are built']],
      ['Not built:', ['"40 sent"', '"Not sent yet"', "the pictures' own mix of answers", "the server's words are unchanged"]],
    ]
    for (const [name, words] of pieces) for (const piece of words) expect(spot(name), `${name} ${piece}`).toContain(piece)
  })

  it('says what ships with every switch off: nothing a person meets, no answer, write or send changed, no migration and the browser baseline unmoved', () => {
    for (const piece of ['Nothing a visitor or a member meets.', 'byte for byte', 'no answer, write or send changes', 'there is no migration', '`test/a11y/baseline.json` does not move']) {
      expect(SHIPS, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, before the switch-on: files, pins, build, worker and checks', () => {
  it('names every file the change adds and changes, each in backticks, each test file with its count, and the counts add up to the Checks line', () => {
    for (const file of [...CHANGED, ...CHANGED_TESTS, ...NEW_TESTS]) expect(FILES, file).toContain(`\`${file}\``)
    // F3 was not built, so the page and the choices page's test are as on the base.
    for (const file of ['src/pages/EmailPreferencesPage.tsx', 'test/unit/email-choice-pages.test.tsx']) expect(FILES, file).not.toContain(file)
    let delta = 0
    for (const file of [...CHANGED_TESTS, ...NEW_TESTS]) {
      const m = new RegExp(`\`${escaped(file)}\` \\((\\d+), (?:(\\d+) before|(as before)|(new))[:)]`).exec(FILES)
      expect(m, file).not.toBeNull()
      expect(Boolean(m![4]), `${file} is new`).toBe(NEW_TESTS.includes(file))
      const now = Number(m![1])
      delta += m![4] ? now : m![2] ? now - Number(m![2]) : 0
    }
    const unit = /unit ([\d,]+) tests in ([\d,]+) files \(([\d,]+) in ([\d,]+) on the base\)/.exec(CHECKS)!
    const integration = /integration ([\d,]+) in ([\d,]+) files \(([\d,]+) in ([\d,]+) on the base\)/.exec(CHECKS)!
    expect([num(unit[3]), num(unit[4]), num(integration[3]), num(integration[4])]).toEqual([8812, 336, 1817, 108])
    expect(num(unit[1]) - num(unit[3])).toBe(delta)
    expect(num(unit[2]) - num(unit[4])).toBe(NEW_TESTS.length)
    expect([num(integration[1]), num(integration[2])]).toEqual([1817, 108])
  })

  it('lists each pin moved under its file, once, with its old and its new words', () => {
    for (const file of MOVED) expect(PINS.split('\n').filter((l) => l.startsWith(`  - \`${file}\`:`)), file).toHaveLength(1)
    for (const words of [
      '"steps 1 to 8 are built."', '"steps 1 to 8 are built and merged, switched off."', 'once WS16 step 8 was built', 'merged into `main` as `d2c5ec0`',
      '"**Not merged yet: checkpoint M waits for its merge into `main`** (draft pull request 126)."', BLOCK_HEADING, '"View only, except the newsletter"',
      'lines 717, 718 and 724', 'lines 752, 753 and 759',
      '"The merge waits for K\'s word and for nothing else."', '"The merge waited for K\'s word and for nothing else."',
    ]) expect(PINS, words).toContain(words)
  })

  it('gives the build against the base\'s figures, each difference the record\'s own subtraction, and says they are a local build\'s', () => {
    expect(BUILD).toMatch(/the main script `index-[\w-]+\.js` at 554,147 bytes, as the base's `index-rLaj86fe\.js`/)
    const css = /the stylesheet `index-[\w-]+\.css` at ([\d,]+) bytes, ([\d,]+) on the base, ([\d,]+) more/.exec(BUILD)!
    expect(num(css[2])).toBe(130974)
    expect(num(css[1]) - num(css[2])).toBe(num(css[3]))
    expect(BUILD).toContain('the switches chunk `features-DxqQlIon.js` at 698 bytes, as on the base')
    for (const [name, before, after] of [...BUILD.matchAll(/`(\w+)` grows from ([\d,]+) to ([\d,]+)|`(\w+)` from ([\d,]+) to ([\d,]+)/g)].map((m) => [m[1] ?? m[4], m[2] ?? m[5], m[3] ?? m[6]])) {
      expect(num(after), name).toBeGreaterThan(num(before))
    }
    for (const piece of ['`AdminPage` grows from 102,832', '`EmailPreferencesPage` at 3,719', '`EmailChoiceParts` stays at 1,122', '`EmailUnsubscribePage` at 2,187', '`footer` at 507', '`dist` holds 232 files and `dist/assets` 194', "a local build's figures", 'Thursday, November 12, 2026']) {
      expect(BUILD, piece).toContain(piece)
    }
  })

  it('gives the worker as the base\'s, no file of it changed, and the pull request\'s text its title and its four short headings in order', () => {
    for (const piece of ['76.61 KiB, gzip 20.53 KiB', '`deploy-worker.yml`', 'does not run on the merge', 'no dry run is needed']) expect(WORKER, piece).toContain(piece)
    expect(PULL_REQUEST[0]).toMatch(/^WS16: /)
    const headings = ['**What this is**', '**What the merge does to production**', '**Checks**', '**What comes after**']
    const at = headings.map((h) => PULL_REQUEST.indexOf(h))
    for (const [i, h] of headings.entries()) expect(at[i], h).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const text = PULL_REQUEST.join('\n')
    expect(text).not.toMatch(/^#/m)
    for (const piece of ['There is no migration', 'no file under `functions/`, `domain/` or `workers/` changes', "on K's own day", 'in a local production build the main script', 'It puts right four', 'stays as it is', "A darker ring in today's look is K's to ask for."]) {
      expect(text, piece).toContain(piece)
    }
    // A size is a local build's, since Pages' own build of the same tree differs by some bytes.
    expect(text).not.toMatch(/Pages rebuilds the site: the main script/)
    expect(text).not.toMatch(ASSISTANT)
  })

  it('gives the checks in the form of a step\'s Checks line, with the base\'s lint, browser run and baseline, the run the gate\'s', () => {
    for (const piece of [
      '`npm run lint` 13 errors and 13 warnings over', '(956 on the base)', "the base's findings", '`npm run build` (194 files in `dist/assets`)', '`npm run typecheck:functions`', '`npm run check:bundle`',
      '`npm run test:a11y` 995 tests, 659 that run and 336 that skip', "the base's figures", "the one browser run being the gate's before the commit",
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'Thursday, November 12, 2026',
    ]) expect(CHECKS, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, before the switch-on: the merge in checkpoint M\'s section, the PR line and the Status line', () => {
  it('opens checkpoint M\'s section with the merge, in the form of checkpoint L\'s, and keeps the section\'s own words after it', () => {
    expect(opening.startsWith('**Merged into `main` as `d2c5ec0` on Thursday, November 12, 2026 at 3:26 PM UTC** (pull request 126, a merge commit on head `1cf41c2`), which was 9:26 AM Central')).toBe(true)
    for (const piece of [
      "on K's word of that day", "the Preview environment's secrets were read, and it holds none", 'What the merge did, as seen afterwards:',
      '`22c205e`, `764f32f`, `e98263b`, `4b9d780`, `5e7a23c`, `aa731a1`, `d4818fd`, `24bcf50`, `3daa463` and `1cf41c2`',
      '`migrate-db.yml` ("Apply database migrations") started with the push at 3:26 PM UTC and succeeded at 3:27 PM UTC, applying migration 0060',
      "`mail_lists` holding LCA's two lists, `lca-newsletter` and `lca-tournaments`", '`deploy-worker.yml` ("Deploy scheduled-jobs worker")',
      '`index-BzGK14PF.js` at 554,057 bytes', '`index-rLaj86fe.js` at 554,147, 90 bytes more, the same difference as at checkpoint L, 550,257 against 550,347',
      '`index-BTmE8w6L.css` at 130,974 bytes', '`features-DxqQlIon.js` at 698 bytes, which holds `mailLists` off', '"This link isn\'t working."', 'POST `/api/mail/ses-events` answered 404',
      "Checkpoint M is the first of WS16's three checkpoints", "The merge waited for K's word and for nothing else.",
    ]) expect(opening, piece).toContain(piece)
    expect(opening).not.toContain('The merge waits')
    expect(554147 - 554057).toBe(550347 - 550257)
  })

  it('gives the PR line checkpoint M\'s merge and the Status line its tail, the rest of each as it was', () => {
    expect(prLine).toBe('**PR:** checkpoint M (steps 1 to 8) was draft pull request 126, merged into `main` as `d2c5ec0` on Thursday, November 12, 2026; checkpoint N (steps 9 to 11) and checkpoint O (WS16 step 12) come after it, each merged on its own.')
    expect(statusLine).toBe('**Status:** in progress: part one, the mail engine and the first LCA newsletter, twelve steps in three checkpoints (checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12); steps 1 to 8 are built and merged, switched off.')
  })
})

describe('REDESIGN_STATUS.md, before the switch-on: plain language', () => {
  const written = [block, opening, prLine, statusLine]

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks, the merge-pending phrase and a he out of it, gives every date its weekday and every time the twelve-hour clock, and dates the record on a real day', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    for (const text of written) {
      expect(text.length).toBeGreaterThan(20)
      for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED, PENDING]) expect(text).not.toMatch(rule)
      expect(proseOf(text)).not.toMatch(HE)
      expect(text).not.toMatch(/\.github\//)
      const prose = proseOf(text)
      for (const found of prose.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}) \\d{1,2}\\b`, 'g'))) {
        expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of prose.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    }
    expect(ws16.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
    expect(date).not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
  })
})
