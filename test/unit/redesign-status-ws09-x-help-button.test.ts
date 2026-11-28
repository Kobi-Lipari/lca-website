// test/unit/redesign-status-ws09-x-help-button.test.ts
//
// REDESIGN_STATUS.md records K's answer to checkpoint X's choice 5, one Help
// button and one panel again on the club page's Contact form and on the reply
// page, in the block "WS09 aside: one Help button again on the Contact form
// and the reply page". This file holds the block to the tree: its place, its
// parts in order, K's words quoted once, the words of the two panels as the
// domain files give them, what did not change, the Status line's clause, the
// two follow-ups and the checks. Like the other record tests of WS09, it
// reads only the WS09 section, from its heading to the WS10 heading. No case
// reads or pins a switch's shipped value.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACT_LINE_HELP, contactEmailHelp } from '@domain/clubs/contactMessage'
import { replyHelp } from '@domain/clubs/replyMessage'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow', 'rul' + 'ing'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I', 'assis' + 'tant', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
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
const BEFORE = '### WS09 checkpoint X: the review of the whole and its fixes'
const BLOCK = '### WS09 aside: one Help button again on the Contact form and the reply page'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const TAG = '(WS09 aside: one Help button again).'
const followUpEntries = part('### WS09 follow-ups').split('\n').filter((l) => l.startsWith('- **'))
const followUps = followUpEntries.filter((l) => l.includes(`${TAG}**`))
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const sha256 = (file: string) => createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex')

const FORM = 'src/areas/clubs/components/ContactRelayForm.tsx'
const PAGE = 'src/pages/ClubReplyPage.tsx'
const K_WORDS = '"i dont think there will need to be the many question marks buecause it isnt build for functionality use like the newsletter is and doesnt need as many; the reason i did it for the newsletter page because the help thing was so giant so it looked better broken up in the sections that the notes were relevant to"'
const PARTS = [
  '- **What a person meets.**', '- **As before.**', '- **The words.**', '- **What did not change.**', '- **What ships with every switch off.**',
  '- **Pins moved.**', '- **Follow-ups.**', '- **Judgement calls.**', '- Checks:', '- **Files.**', '- **Branch.**',
]
/** The three public forms that keep their small question marks, with how many each draws. */
const FORMS_WITH_MARKS: Array<[string, number]> = [
  ['src/areas/clubs/components/SuggestUpdateSheet.tsx', 2],
  ['src/areas/clubs/components/SuggestClubForm.tsx', 1],
  ['src/areas/clubs/components/RepRequestSheet.tsx', 1],
]
/** The question marks' two files, as they stood at checkpoint X's review and stand here. */
const MARK_FILES: Array<[string, string]> = [
  ['src/areas/clubs/components/HelpMark.tsx', '4233435e43579faef10ba8128462f14b27462b62951da35f57461f3e7b68e6ac'],
  ['src/areas/clubs/helpMarks.ts', '9dbb3aaae370f427cfd0840f7583bb202e53c137cd6e904ef6a0ed4695abbcc3'],
]

describe('REDESIGN_STATUS.md, WS09 aside: one Help button again on the Contact form and the reply page', () => {
  it('sits once, right after the block of checkpoint X\'s review, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(BLOCK) - 1]).toBe(BEFORE)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('opens with the choice and K\'s answer in K\'s own words, quoted once, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['choice 5', 'draft pull request 158', 'Friday, November 27, 2026', K_WORDS]) expect(opening, piece).toContain(piece)
    expect(status.split(K_WORDS)).toHaveLength(2)
    const at = PARTS.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of PARTS.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of PARTS) expect(block.split(`\n${p}`), p).toHaveLength(2)
  })

  it('gives the Status line one clause for this aside, straight after checkpoint X\'s', () => {
    const clause = '; one Help button again on the Contact form and the reply page, K\'s answer to checkpoint X\'s choice 5, is built on `redesign/ws09-clubs-x`'
    expect(statusLine.split(clause)).toHaveLength(2)
    const x = statusLine.indexOf('; checkpoint X, steps 25 to 31, is built and reviewed on `redesign/ws09-clubs-x`')
    const mine = statusLine.indexOf(clause)
    expect(x).toBeGreaterThan(-1)
    expect(mine).toBeGreaterThan(x)
    expect(statusLine.indexOf('; ', x + 2)).toBe(mine)
    expect(statusLine.indexOf('; steps 1 to 14 and 16 to ', mine)).toBeGreaterThan(mine)
  })

  it('adds K\'s two questions to the end of the follow-ups, tagged for this aside', () => {
    expect(followUps.map((l) => /^- \*\*([^*]+)\*\*/.exec(l)?.[1])).toEqual([
      `The reply page's Help opening by itself ${TAG}`,
      `The other three forms' question marks ${TAG}`,
    ])
    expect(followUpEntries.slice(-2)).toEqual(followUps)
    expect(followUps[0]).toContain('`lca-club-reply-help`')
    expect(followUps[0]).toContain('(a) it opens by itself once, as before, built; (b) it never opens by itself and nothing is kept in the browser')
    for (const piece of ['Suggest an update (two)', 'Suggest a club (one)', 'Ask to be its named rep (one)', 'A question for K']) expect(followUps[1], piece).toContain(piece)
    const said = bullet(block, '- **Follow-ups.**')
    for (const entry of followUps) expect(said).toContain(`"${/^- \*\*([^*]+)\*\*/.exec(entry)?.[1]}"`)
  })

  it('says each page has one button named Help and no question mark, and the tree holds it', () => {
    for (const file of [FORM, PAGE]) {
      const code = read(file)
      expect(code, file).not.toMatch(/HelpMark/)
      expect(code.split('<CircleHelp aria-hidden="true" className="size-4" /> Help'), file).toHaveLength(2)
      expect(code.split('Close help'), file).toHaveLength(2)
      expect(code, file).toMatch(/aria-expanded=\{helpOpen\}/)
      expect(code, file).toMatch(/role="region"/)
    }
    expect(read(FORM)).toContain('aria-label="Help with Contact"')
    expect(read(PAGE)).toContain('aria-label="Help with Reply through LCA"')
    expect(read(PAGE)).toContain('export const REPLY_HELP_SHOWN_KEY = \'lca-club-reply-help\'')
    const meets = bullet(block, '- **What a person meets.**')
    for (const piece of ['one button named Help', 'no small question mark', '"Help: Where your message goes"', '"Help: Your email"', '"Help: Reply through LCA"', '"Help: Your reply"']) {
      expect(meets, piece).toContain(piece)
    }
    const before = bullet(block, '- **As before.**')
    for (const piece of ['`git diff 8d21b19`', '`aria-expanded`', '`aria-controls`', '`club-contact-help`', '`club-reply-help`', 'Escape', 'Close help', '`lca-club-reply-help`', 'with the focus left where it is', 'E4']) {
      expect(before, piece).toContain(piece)
    }
  })

  it('gives every sentence of both panels as the domain files hold them, today\'s words, and names the earlier panels\' differences', () => {
    const words = bullet(block, '- **The words.**')
    expect(words).toContain(`"${CONTACT_LINE_HELP}"`)
    expect(contactEmailHelp('club', null).replace('The club\'s contact', '{who}')).toBe('{who} answers by email, to the address you give here.')
    expect(words).toContain('"{who} answers by email, to the address you give here."')
    for (const who of ['The club\'s contact', 'The {region} representative', 'The region\'s representative', 'Someone at LCA']) expect(words, who).toContain(`"${who}"`)
    expect(contactEmailHelp('region', 'Bayou Region')).toBe('The Bayou Region representative answers by email, to the address you give here.')
    expect(contactEmailHelp('region', null)).toBe('The region\'s representative answers by email, to the address you give here.')
    expect(contactEmailHelp('lca', 'Bayou Region')).toBe('Someone at LCA answers by email, to the address you give here.')
    const reply = replyHelp('{first name}')
    expect(reply).toHaveLength(4)
    for (const sentence of reply) expect(words, sentence).toContain(`"${sentence}"`)
    for (const cut of ['", so it gets no spam"', '" and the site keeps no copy of it, your name or your address"', '", and someone there passes it on"']) expect(words, cut).toContain(cut)
    for (const sentence of [CONTACT_LINE_HELP, contactEmailHelp('club', null), ...reply]) {
      expect(sentence).not.toMatch(/today's|once the|new club pages|will show|will be|not yet|switch|is drawn/i)
      expect(sentence).not.toMatch(/spam|keeps no copy|passes it on/)
    }
  })

  it('says what did not change, and the tree holds it: the other three forms\' marks, and the marks\' own files as they were', () => {
    const kept = bullet(block, '- **What did not change.**')
    for (const [file, marks] of FORMS_WITH_MARKS) {
      expect(read(file).split('<HelpMark ').length - 1, file).toBe(marks)
      expect(kept).toContain(`\`${file.split('/').pop()}\``)
    }
    for (const piece of ['Suggest an update two', 'Suggest a club one', 'Ask to be its named rep one', '`HelpMark.tsx` and `helpMarks.ts` are as they were', 'No server file, migration, endpoint, contract or switch changes']) {
      expect(kept, piece).toContain(piece)
    }
    for (const [file, hash] of MARK_FILES) expect(sha256(file), file).toBe(hash)
  })

  it('says with proof that nothing a person meets changes with every switch as shipped', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Nothing a person meets changes.', '`clubPagesOn()`', '`src/App.tsx`', '`src/areas/clubs/switches.ts`', '`src/lib/features.ts`', '`CLUB_PAGES_ON`', '`functions/utils/clubs/pages.ts`', 'with clubPagesOn off the address draws what it draws today: no reply page and no call']) {
      expect(ships, piece).toContain(piece)
    }
    const app = read('src/App.tsx')
    expect(app).toContain('{clubPagesOn() && <Route path="/clubs/reply/:token" element={<ClubReplyPage />} />}')
    expect(app).toMatch(/\{clubPagesOn\(\)\n\s+\? <Route path="\/clubs\/:id" element=\{<ClubListingPage \/>\} \/>/)
    expect(read('test/unit/club-reply-page.test.tsx')).toContain('with clubPagesOn off the address draws what it draws today: no reply page and no call')
  })

  it('names every turned case and the one pin moved in a closed record test, and deletes none', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain('no case is deleted, skipped or emptied')
    for (const file of ['test/unit/contact-relay-form.test.tsx', 'test/unit/contact-relay-form-edges.test.tsx', 'test/unit/club-page-bare.test.tsx', 'test/unit/club-page-rest.test.tsx', 'test/unit/club-page-edges.test.tsx', 'test/unit/club-reply-page.test.tsx', 'test/unit/club-reply-page-edges.test.tsx', 'test/unit/redesign-status-ws09-step1.test.ts']) {
      expect(pins, file).toContain(`\`${file}\``)
    }
    expect(read('test/unit/contact-relay-form.test.tsx')).toContain('keeps the rest behind Help\'')
    expect(read('test/unit/contact-relay-form-edges.test.tsx')).toContain('it(\'moves from Help to the name')
    expect(read('test/unit/club-reply-page.test.tsx')).toContain('it(\'Help opens by itself the first time, once, with the focus left where it is, and Escape closes it\'')
    expect(read('test/unit/club-reply-page.test.tsx')).toContain('it(\'keeps nothing typed in the browser\\\'s storage, only that Help has opened\'')
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('!e.includes(\'(WS09 aside: one Help button again).** \')')
  })

  it('names every file it changes, the new tests with their counts, and the branch', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [FORM, PAGE, 'domain/clubs/contactMessage.ts', 'domain/clubs/replyMessage.ts', 'test/unit/club-help-panel.test.tsx', 'test/unit/club-help-panel-edges.test.tsx', 'test/a11y/clubs-help.spec.ts', 'test/unit/redesign-status-ws09-x-help-button.test.ts']) {
      expect(files, file).toContain(`\`${file}\``)
    }
    expect(files).toContain(`\`test/unit/club-help-panel.test.tsx\` (new, ${casesIn('test/unit/club-help-panel.test.tsx')}:`)
    expect(files).toContain(`\`test/unit/club-help-panel-edges.test.tsx\` (new, ${casesIn('test/unit/club-help-panel-edges.test.tsx')}:`)
    expect(read('test/a11y/clubs-help.spec.ts')).toMatch(/for \(const size of SIZES\)/)
    expect(read('test/a11y/clubs-help.spec.ts').match(/^\s+test\(/gm)).toHaveLength(2)
    expect(files).toContain('`test/a11y/clubs-help.spec.ts` (new, 4 in the third project')
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-x`, at `aa31351`')
  })

  it('gives each gate figure once, with the lint, the build, the suites, the browser run left to the gate, and the worker', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'the daily-emails worker\'s dry run', 'ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('a local production build')
    expect(checksLine).toMatch(/no browser run of its own/)
  })

  it('writes in plain words: no dashes, no working words, no tools, no old initials, and K is K or they', () => {
    const own = [block, ...followUps, statusLine.slice(statusLine.indexOf('; one Help button again'), statusLine.indexOf('; steps 1 to 14 and 16 to '))]
    for (const text of own) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(HE)
    }
    for (const file of [FORM, PAGE, 'domain/clubs/contactMessage.ts', 'domain/clubs/replyMessage.ts', 'test/unit/club-help-panel.test.tsx', 'test/unit/club-help-panel-edges.test.tsx', 'test/a11y/clubs-help.spec.ts']) {
      expect(read(file), file).not.toMatch(DASHES)
      expect(read(file), file).not.toMatch(TOOLS)
    }
  })
})
