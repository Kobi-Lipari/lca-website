// test/unit/redesign-status-ws09-help-marks.test.ts
//
// REDESIGN_STATUS.md records K's decision 16 in the block "WS09 aside: Help
// as small question marks": My region's Help and the one club editor's Help
// as small question marks beside each part, and the editor's box as tall as
// the preview strip from lg up, within the window. This file holds the
// block to the tree: what goes, the table of marks against the files that
// draw them, how a mark behaves, the words and the one division, the box's
// classes and its bound, the look and its sheets, what ships
// with no switch and K's rule it replaces, the pins moved, the one entry
// under the deviations, the Status line's tail and the checks. Like the
// other record tests of WS09, it reads only the WS09 section, from its
// heading to the WS10 heading. No case reads or pins a switch's shipped
// value.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
  while (end < all.length && (/^\s+\S/.test(all[end]) || (all[end] === '' && /^\s+\S/.test(all[end + 1] ?? '')))) end++
  return all.slice(at, end).join('\n')
}

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const BEFORE = '### WS09 switch-on: regionEvents with main taken in'
const BLOCK = '### WS09 aside: Help as small question marks'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const TAG = '(WS09 aside: Help as small question marks).'
const deviation = part('### WS09 deviations from the brief').split('\n').find((l) => l.startsWith('- **') && l.includes(`${TAG}**`)) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

const EDITOR = read('src/areas/clubs/components/ClubEditor.tsx')
const MARK = read('src/areas/clubs/components/HelpMark.tsx')

describe('REDESIGN_STATUS.md, WS09 aside: Help as small question marks', () => {
  it('sits once, right after the block before it, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    // Written straight after the club events switch-on's last block; on main it stands after the blocks the week's other changes wrote, the public event page's last.
    expect([BEFORE, '### WS09 aside: the public event page on a phone']).toContain(headings[headings.indexOf(BLOCK) - 1])
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Asked by.**', '- **Branch.**', '- **What goes.**', '- **The marks.**', '- **How a mark behaves.**', '- **The words.**', '- **The box.**',
      '- **What does not move.**', '- **What ships with no switch.**', '- **The look.**', '- **How it comes back out.**', '- **Pins moved.**', '- **Follow-ups.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('quotes K\'s decision 16 and K\'s three notes, and names the branch and its base', () => {
    const asked = bullet(block, '- **Asked by.**')
    for (const piece of [
      'K\'s decision 16, of Thursday, November 19, 2026',
      '"on the manage clubs page, the stuff in the help section at the top would be better put as little question marks after each section',
      '"also, the edit box on the left of the page ends a big sooner than the strip on the right',
      '"yep its in the club edit thing too (admin/clubs/), where the help bubble is at the top right',
    ]) expect(asked, piece).toContain(piece)
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/help-marks`', '`915a9ba`', 'pull request 140', 'this step\'s one commit alone']) expect(branch, piece).toContain(piece)
  })

  it('names what goes, and the tree holds none of it', () => {
    const goes = bullet(block, '- **What goes.**')
    const gone = ['RegionHelpButton', 'EditorHelpButton', 'focusWithoutJump', 'focusInView', 'HELP_SHOWN_KEY', 'helpShownBefore', 'rememberHelpShown', 'REGION_HELP_SHOWN_KEY', 'regionHelpShownBefore', 'rememberRegionHelpShown', 'REGION_HELP_ID']
    for (const name of gone) expect(goes, name).toContain(`\`${name}\``)
    for (const name of ['`lca-club-editor-help`', '`lca-my-region-help`', 'is not cleaned up', 'Close help', 'The basics, alone']) expect(goes, name).toContain(name)
    const files = ['src/areas/clubs/components/ClubEditor.tsx', 'src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/components/RegionHelp.tsx', 'src/areas/clubs/editor.ts', 'src/areas/clubs/region.ts', 'src/pages/MyRegionPage.tsx']
    for (const file of files) {
      const text = read(file)
      for (const name of gone) expect(text, `${file} ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`))
      expect(text, file).not.toMatch(/localStorage|Close help|club-editor-help|my-region-help/)
    }
    // The old deviations it names stand as written.
    for (const title of ['The board\'s side notes go behind Help (WS09 step 7).', 'The board\'s side notes go behind Help, again (WS09 step 8).', 'No Help hook (WS09 step 19).']) {
      expect(goes, title).toContain(`"${title}"`)
      expect(part('### WS09 deviations from the brief'), title).toContain(`- **${title}**`)
    }
  })

  it('gives the table of marks, each name as the files draw it', () => {
    const marks = bullet(block, '- **The marks.**')
    const rows = marks.split('\n').filter((l) => /^ {2}\| Help: /.test(l)).map((l) => l.split('|')[1].trim())
    expect(rows).toEqual([
      'Help: One sentence about the club', 'Help: How the club meets, in words', 'Help: Where', 'Help: Contact name shown on the page, or Help: Contact name',
      'Help: Email for messages', 'Help: Name and address', 'Help: Club name, region and page address', 'Help: Cost and who is welcome', 'Help: Links',
      'Help: Logo', 'Help: Club color', 'Help: Today\'s page shows different words here', 'Help: Save and publish', 'Help: Preview',
      'Help: This month', 'Help: Confirm all still accurate', 'Help: Clubs',
    ])
    // The names come from the entries' terms, and the three shared ones from the code.
    const help = read('src/areas/clubs/components/EditorHelp.tsx')
    expect(help).toContain('if (part === \'logo\') return \'Logo\'')
    expect(help).toContain('if (part === \'color\') return \'Club color\'')
    const region = read('src/areas/clubs/components/RegionHelp.tsx')
    for (const line of [
      'month: { name: \'This month\', terms: [\'The monthly check\', \'The 90 days\'] },',
      'confirmAll: { name: \'Confirm all still accurate\', terms: [\'Confirm all still accurate\'] },',
      'clubs: { name: \'Clubs\', terms: [\'What this page is\', \'Still accurate\', \'Open\', \'Who sees the stamps\'] },',
    ]) expect(region).toContain(line)
    expect(MARK).toContain('const label = `Help: ${name}`')
    for (const piece of ['No club\'s card carries a mark', '`aria-labelledby`', '`editor-aboutText-differs`', 'a span that answers as a button']) expect(marks, piece).toContain(piece)
    expect(read('src/areas/clubs/components/RegionClubCard.tsx')).not.toContain('HelpMark')
  })

  it('says how a mark behaves, as HelpMark.tsx does it', () => {
    const behaves = bullet(block, '- **How a mark behaves.**')
    for (const piece of [
      '`aria-expanded`', '`aria-controls`', '`useId`', '`type="button"`', '`CircleHelp`', '150 milliseconds', '300 milliseconds', 'A touch never opens it by resting',
      'reaches nothing else', 'passes on untouched', 'The focus alone never opens one', 'only one bubble on the page is open at a time', '`hidden`',
      'no dialog, no tooltip and no live region', 'never wider than 24rem', 'no fixed place, no portal and no new library', 'by its nearest edge', '24 by 24 pixels',
      '44 pixels wide and 44 tall, or 34 tall on a label\'s line', 'nothing is read from or written to the browser\'s store', 'every timer is cleared',
    ]) expect(behaves, piece).toContain(piece)
    for (const code of [
      'const OPEN_AFTER = 150', 'const CLOSE_AFTER = 300', 'if (e.pointerType !== \'mouse\') return', 'window.addEventListener(\'keydown\', onKey, true)',
      'document.addEventListener(\'pointerdown\', onPress, true)', 'document.addEventListener(\'focusin\', onFocus, true)', 'if (openMark && openMark !== self) openMark.close()',
      'bubble.current?.scrollIntoView?.({ block: \'nearest\', inline: \'nearest\' })', 'w-[min(24rem,100%)]', 'hidden={open === null}', 'type="button"', 'aria-hidden="true"',
    ]) expect(MARK, code).toContain(code)
    expect(MARK).not.toMatch(/localStorage|createPortal|role="tooltip"|role="dialog"|aria-live|\bfixed\b/)
  })

  it('says no sentence is rewritten, and names the one division and why Cost and who is welcome stays whole', () => {
    const words = bullet(block, '- **The words.**')
    for (const piece of ['None is rewritten, shortened or added', '`test/unit/fixtures/help-words-before.json`', 'sixteen variants', 'Logo and club color, at the end of its second sentence', 'Cost and who is welcome is not divided']) {
      expect(words, piece).toContain(piece)
    }
    const fixture = JSON.parse(read('test/unit/fixtures/help-words-before.json')) as { editor: Record<string, unknown[]>; region: Record<string, unknown[]> }
    expect(Object.keys(fixture.editor)).toHaveLength(16)
    expect(Object.keys(fixture.region)).toHaveLength(2)
    // The sentences stay in the two Help files, which closed record tests read.
    expect(read('src/areas/clubs/components/EditorHelp.tsx')).toContain('[\'Logo and club color\', `${LOGO_WORDS} ${colorWords(pagesOn)}`]')
  })

  it('gives the box\'s classes as ClubEditor.tsx holds them, with ScrollPanel.tsx as it was', () => {
    const box = bullet(block, '- **The box.**')
    const line = EDITOR.split('\n').find((l) => l.startsWith('const BOX = ')) ?? ''
    expect(line).not.toBe('')
    expect(box).toContain(`\`${line}\``)
    for (const piece of ['`lg:items-stretch`', '`lg:flex lg:flex-col`', '`lg:self-start`', '`src/components/ScrollPanel.tsx` is not changed', 'Below `lg` nothing moves']) expect(box, piece).toContain(piece)
    expect(EDITOR).toContain('lg:flex-row lg:items-stretch')
    expect(EDITOR).toContain('lg:sticky lg:top-4 lg:w-80 lg:shrink-0 lg:self-start')
    expect(read('src/components/ScrollPanel.tsx')).not.toMatch(/lg:grow|min-h-\[70vh\]/)
    // From lg up the box is never taller than the window less 2rem, nor under 70% of it, and the wheel passes on to the page at its ends, as the line holds.
    for (const name of ['lg:max-h-[calc(100vh-2rem)]', 'lg:min-h-[70vh]', 'lg:grow', 'lg:basis-0', 'lg:overscroll-auto']) expect(line, name).toContain(` ${name}`)
    expect(line).not.toContain(' lg:max-h-none')
    expect(line.startsWith('const BOX = \'scroll-mt-[100vh] max-lg:max-h-none max-lg:overflow-visible max-lg:[&>[data-slot=scroll-panel-header]]:static ')).toBe(true)
    for (const piece of [
      'never taller than the window less 2rem', 'never under 70% of the window\'s height', 'Save and publish sits straight under it', '`lg:overscroll-auto`', '`overscroll-contain`', '`cn` keeps both names',
      'at 1280 by 800 the box is 768 pixels tall', 'at 1440 by 900 it is 868 pixels', 'at 1920 by 1080 it is 947 pixels, under its bound of 1,048', 'end on the same pixel, 1,336',
      'The bound and the wheel\'s passing on were added after the second review', '947 pixels tall in an 800 pixel window', 'never in view together',
    ]) expect(box, piece).toContain(piece)
    expect(read('src/lib/brand.ts')).toMatch(/ADMIN_SCROLL = '[^']*overscroll-contain/)
    // The bound is built, not left open: the follow-ups say when and why it was added, and leave nothing on the box for K to choose.
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of ['`11-club-editor-box-1280-by-800.png`', '`15-club-editor-box-1920-by-1080.png`', '`lg:max-h-[calc(100vh-2rem)]`', '`lg:overscroll-auto`', 'added after the second review', 'nothing on the box is left for K to choose']) expect(follow, piece).toContain(piece)
    expect(follow).not.toMatch(/K's call|If K would rather/)
    expect(block).not.toMatch(/has no upper bound|with no upper bound and a floor/)
    // A press on a bubble's words keeps it open where the box takes the focus, as the mark's file does it.
    expect(bullet(block, '- **How a mark behaves.**')).toContain('A press on the bubble\'s own words keeps it open')
    expect(MARK).toContain('if (pressedInside && around(e.target))')
    expect(bullet(block, '- **How a mark behaves.**')).toContain('`test/unit/help-marks-edges.test.tsx`')
  })

  it('says a resting mouse never takes the place of a pressed bubble, a swipe keeps a bubble open, and a mark on a label\'s line takes less room on a phone, as HelpMark.tsx does it', () => {
    const behaves = bullet(block, '- **How a mark behaves.**')
    for (const piece of [
      'stays when the mouse comes to rest on another mark, which then opens nothing', 'a touch outside closes it once the touch ends in a tap',
      'narrows the launch note\'s "opening one closes any other" for a resting mouse alone', '`max-sm:ml-1 max-sm:-mr-3`', '`max-sm:before:-left-1 max-sm:before:-right-4`',
    ]) expect(behaves, piece).toContain(piece)
    for (const code of [
      'if (how === \'pointer\' && self.pressedElsewhere()) return', 'if (!open && !me.pressedElsewhere())', '.pointerType === \'touch\') touchedOutside = true',
      'document.addEventListener(\'pointercancel\', onCancel, true)', 'max-sm:ml-1 max-sm:-mr-3 max-sm:before:-left-1 max-sm:before:-right-4',
    ]) expect(MARK, code).toContain(code)
    expect(bullet(block, '- **The look.**')).toContain('a second look at 320, 340, 360 and 390 pixels finds every label\'s distance to its box the same')
  })

  it('says what ships with no switch, and that K\'s words replace K\'s rule for these two pages', () => {
    const ships = bullet(block, '- **What ships with no switch.**')
    for (const piece of ['All of it, on K\'s word', 'behind no switch', '`clubKeepers`', 'waits for K\'s own word', 'K\'s standing rule 14', 'replaced for these two pages by K\'s own words in decision 16']) {
      expect(ships, piece).toContain(piece)
    }
    // No line this step wrote reads a switch the two Help files did not read before.
    for (const file of ['src/areas/clubs/components/HelpMark.tsx', 'src/areas/clubs/helpMarks.ts', 'src/areas/clubs/components/RegionHelp.tsx']) expect(read(file), file).not.toMatch(/FEATURES|features'/)
    expect(bullet(block, '- **How it comes back out.**')).toContain('Revert the one commit')
    expect(bullet(block, '- **Follow-ups.**')).toContain('`ApprovalWait.tsx`')
  })

  it('records the look with its sheets\' findings', () => {
    const look = bullet(block, '- **The look.**')
    for (const piece of ['Fifteen labelled sheets', 'made-up', 'does not scroll sideways', 'end on the same pixel', 'At 320 the marks after', 'covers the top of About\'s own box', 'axe', 'The keyboard walk']) {
      expect(look, piece).toContain(piece)
    }
    // The sheets by name, numbered one to fifteen, and what the box and the wheel did at the three computer sizes.
    const sheets = [...look.matchAll(/`(\d+)-[a-z0-9-]+\.png`/g)].map((m) => Number(m[1]))
    expect(sheets).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    for (const piece of [
      '1280 by 800, 1440 by 900 and 1920 by 1080', 'the box is 768, 868 and 947 pixels tall', 'never taller than the window less 32 pixels', '27 turns of the wheel', 'Save and publish was in the window',
      'five turns up took the page back to its top', 'each of the editor\'s 108 drawn parts stands where it stood',
    ]) expect(look, piece).toContain(piece)
  })

  it('lists every pin moved, each file that exists, with its case named where a record test\'s moved', () => {
    const pins = bullet(block, '- **Pins moved.**')
    const files = [...pins.matchAll(/`(test\/unit\/[^`]+)`/g)].map((m) => m[1])
    expect(files.length).toBeGreaterThanOrEqual(25)
    for (const file of files) expect(() => read(file), file).not.toThrow()
    for (const [file, title] of [
      ['test/unit/redesign-status-ws09-step1.test.ts', 'sits after the map and before the four lists, once, and every heading of the section is WS09\'s'],
      ['test/unit/redesign-status-ws09-step7.test.ts', 'says Help holds the explaining words, opens by itself once, and gives the focus back, as the files do'],
      ['test/unit/redesign-status-ws09-step8.test.ts', 'names the fields in the site\'s order, as the components draw them, each saved through the one call'],
      ['test/unit/redesign-status-ws09-step11.test.ts', 'names no weekly claims, and the words and the look, with the tint\'s two colours'],
    ]) {
      expect(pins, file).toContain(`"${title}"`)
      expect(read(file), file).toContain(`it('${title.replace(/'/g, '\\\'')}'`)
    }
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 aside: \\S|')
    expect(casesIn('test/unit/redesign-status-ws09-step1.test.ts')).toBeGreaterThan(0)
  })

  it('adds one entry under the deviations, tagged as this step', () => {
    expect(deviation).not.toBe('')
    for (const piece of ['button of type button', '`ViewOnlyFieldset`', '`HelpMarksShut`', 'a span with the role of a button', 'Save and publish\'s mark']) expect(deviation, piece).toContain(piece)
    expect(read('src/lib/viewOnly.tsx')).toContain('<fieldset disabled className="m-0 min-w-0 border-0 p-0">')
    expect(MARK).toContain('role="button" tabIndex={0}')
  })

  it('gives the Status line\'s tail one more clause, and keeps it ending as before', () => {
    expect(statusLine).toContain('; Help as small question marks on My region and in the one club editor, with the editor\'s box as tall as the preview strip where the window has room, is built by K\'s decision 16 on `redesign/help-marks` and waits for K\'s word on its own pull request; steps 1 to 14 and 16 to ')
    expect(statusLine).toMatch(/\bbuilt\.$/)
  })

  it('gives each figure of the checks once, the integration figure with the one todo beside it', () => {
    for (const piece of ['`npm run lint` 13 errors and 12 warnings over ', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', ' tests in ', 'with the one todo beside them', 'the browser run ', 'the stored baseline unchanged', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toMatch(/PENDING/)
  })

  it('keeps the record\'s plain language in what it wrote', () => {
    for (const text of [block, deviation]) {
      for (const rule of [DASHES, BANNED, TOOLS, OLD_INITIALS, HE]) expect(text).not.toMatch(rule)
      for (const date of text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g) ?? []) {
        expect(text, date).toMatch(new RegExp(`(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ${date}`))
      }
    }
    for (const file of ['src/areas/clubs/components/HelpMark.tsx', 'src/areas/clubs/helpMarks.ts', 'src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/components/RegionHelp.tsx', 'test/unit/help-mark.test.tsx', 'test/unit/help-marks-editor.test.tsx', 'test/unit/help-marks-region.test.tsx', 'test/unit/help-marks-edges.test.tsx']) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
