// test/unit/newsletter-issues-rules.test.ts
//
// The rules of the newsletter's letters (WS16 part two, page step 3) that need
// no database: the pure helpers of functions/utils/mail/issues.ts, the limits
// of the four methods' contracts at their edges, and the plain-language rules
// over every word a person could read from them. The methods themselves are
// held in test/integration/newsletter-issues.test.ts and
// test/integration/newsletter-issues-edges.test.ts.
//
// Every name, heading and word here is made up.
import { describe, expect, it } from 'vitest'
import {
  lastNewsletterSchema,
  MONTH_LABEL_MAX,
  newsletterIssueRefusedSchema,
  newsletterIssueResponseSchema,
  newsletterIssueSavedResponseSchema,
  newsletterIssueSaveRequestSchema,
  newsletterIssuesResponseSchema,
  newsletterIssueStartRequestSchema,
  PREHEADER_MAX,
  REQUEST_ID_MAX,
  SUBJECT_MAX,
} from '../../domain/contracts/newsletter'
import { defaultSubject, LETTER_MAX_BYTES, STARTER_IDS, STARTERS } from '../../domain/mail/letter'
import * as issues from '../../functions/utils/mail/issues'
import { cleanedLetter, holdsWords, refusalWords, startRefusalWords, startsWithSmallHeading, starterLetter } from '../../functions/utils/mail/issues'

/** The name US Chess no longer goes by, written in two pieces so this file never holds it whole. */
const OLD_NAME = new RegExp(`${'US'}${'CF'}`, 'i')
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'
const SAVE = { id: null, version: 0, monthLabel: 'December 2026', subject: 'Sample subject one', preheader: 'Sample preview line', bodyHtml: LETTER }
const fieldsRefused = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } }, value: unknown) => {
  const result = schema.safeParse(value)
  return result.success ? null : result.error!.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}
const open = (over: Partial<Parameters<typeof holdsWords>[0]> = {}) => ({ monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml: '', ...over })

describe('startsWithSmallHeading', () => {
  it('is true only when an h3 comes before any h2', () => {
    expect(startsWithSmallHeading('<h3>Sample</h3><h2>Sample</h2>')).toBe(true)
    expect(startsWithSmallHeading('<p>Words</p><h3>Sample</h3>')).toBe(true)
    expect(startsWithSmallHeading('<h3>Sample</h3>')).toBe(true)
  })
  it('is false for a letter whose first heading is a main one, one with no heading and an empty letter', () => {
    expect(startsWithSmallHeading('<h2>Sample</h2><h3>Sample</h3>')).toBe(false)
    expect(startsWithSmallHeading('<p>Words only</p>')).toBe(false)
    expect(startsWithSmallHeading('')).toBe(false)
    expect(startsWithSmallHeading('<h2>Sample</h2>')).toBe(false)
  })
  it('does not read the words of a letter as a tag: an escaped "<h3>" in a paragraph is words', () => {
    // The editor writes a typed "<" as &lt;, which the cleaner keeps as written, so the text below holds no h3 tag. A "<"
    // that starts no tag, as in "1 < 2", the cleaner keeps exactly as typed.
    expect(startsWithSmallHeading('<p>Write &lt;h3&gt; for a smaller heading</p><h2>Sample</h2>')).toBe(false)
  })
})

describe('holdsWords', () => {
  it('is false for a letter with no body, no preview line and the month\'s own subject', () => {
    expect(holdsWords(open())).toBe(false)
    expect(holdsWords(open({ subject: '' }))).toBe(false)
    expect(holdsWords(open({ monthLabel: '', subject: defaultSubject('') }))).toBe(false)
  })
  it('is false for a body of kept tags, spaces and non-breaking spaces alone', () => {
    for (const bodyHtml of ['<p></p>', '<p>&nbsp;</p><p>&#160; </p><p>&#xA0;</p>', '<h2></h2><p></p><hr><br>', '<ul><li></li></ul>', '<p><strong> </strong><em></em></p>', '\n\t  ']) {
      expect(holdsWords(open({ bodyHtml })), bodyHtml).toBe(false)
    }
  })
  it('is true for any word in the body, a heading among them, a link\'s words and a "<" kept as a word', () => {
    for (const bodyHtml of ['<p>Sample</p>', '<h2>Sample heading one</h2>', '<p><a href="https://example.org">here</a></p>', '<p>&lt; 2</p>', '<p>a</p>', '<ol start="4"><li>x</li></ol>']) {
      expect(holdsWords(open({ bodyHtml })), bodyHtml).toBe(true)
    }
  })
  it('is true for a preview line, and for a subject that is not the month\'s', () => {
    expect(holdsWords(open({ preheader: 'Sample preview line' }))).toBe(true)
    expect(holdsWords(open({ subject: 'Sample subject of its own' }))).toBe(true)
    // A subject that was the month's when the month was another one is the writer's own words.
    expect(holdsWords(open({ monthLabel: 'January 2027', subject: defaultSubject('December 2026') }))).toBe(true)
  })
  it('is false for a preview line of spaces alone', () => {
    expect(holdsWords(open({ preheader: '   ' }))).toBe(false)
  })
})

describe('holdsWords, a starter nobody wrote in', () => {
  const monthly = starterLetter('monthly')

  it('is false for each of LCA\'s starters as a start writes it, with its month\'s own subject and no preview line', () => {
    for (const id of STARTER_IDS) expect(holdsWords(open({ bodyHtml: starterLetter(id) })), id).toBe(false)
  })

  it('is false for an untouched starter in an editor\'s own form: empty parts as "<p><br></p>" or left out, spaces between two tags, a line break at a heading\'s end', () => {
    for (const bodyHtml of [
      monthly.replaceAll('<p></p>', '<p><br></p>'),
      monthly.replaceAll('</h2><p>', '</h2> <p>').replaceAll('</p><h2>', '</p>\n\n<h2>'),
      monthly.replaceAll('<p></p>', '<p> <br> </p>'),
      monthly.replaceAll('<p></p>', ''),
      `<p></p>${monthly}<p><br></p>`,
      '<h2>Results and thanks<br></h2><p></p>',
    ]) {
      expect(holdsWords(open({ bodyHtml })), bodyHtml).toBe(false)
    }
  })

  it('is true for anything else in a starter: a word under a heading, a heading reworded, removed, added or moved, a link, a list, a rule, a smaller heading, bold or italic inside a heading, a space that is no space between tags, or a "<" typed just before a line break, which stays a word', () => {
    for (const bodyHtml of [
      monthly.replace('<h2>Coming up</h2><p></p>', '<h2>Coming up</h2><p>Sample</p>'),
      monthly.replace('<h2>Coming up</h2>', '<h2>Sample heading one</h2>'),
      monthly.replace('<h2>Scholastic</h2><p></p>', ''),
      `${monthly}<h2>Sample heading one</h2><p></p>`,
      monthly.replace('<h2>Results</h2><p></p><h2>From the clubs</h2>', '<h2>From the clubs</h2><p></p><h2>Results</h2>'),
      monthly.replace('<h2>Results</h2><p></p>', '<h2>Results</h2><p><a href="https://example.org"></a></p>'),
      monthly.replace('<h2>Results</h2><p></p>', '<h2>Results</h2><ul><li></li></ul>'),
      monthly.replace('<h2>Results</h2><p></p>', '<h2>Results</h2><hr>'),
      monthly.replace('<h2>Board business</h2>', '<h3>Board business</h3>'),
      monthly.replace('<h2>Results</h2>', '<h2><strong>Results</strong></h2>'),
      monthly.replace('<h2>Results</h2>', '<h2><em>Results</em></h2>'),
      monthly.replace('<h2>Coming up</h2>', '<h2>Coming  up</h2>'),
      monthly.replace('<h2>Coming up</h2>', '<h2>Coming<br>up</h2>'),
      monthly.replace('<p></p>', '<p>&nbsp;</p>'),
      monthly.replace('<p></p>', `<p>${String.fromCharCode(0xa0)}</p>`),
      starterLetter('results-and-thanks').replace('<p></p>', '<p></p><h2>Results and thanks</h2><p></p>'),
      // A "<" that starts no tag is kept by the cleaner as typed. Typed just before a line break, it must stay a word,
      // never joined to the words after the break into a tag: between two parts, at a heading's end, with spaces between
      // the pieces, a first heading written as words, and alone.
      monthly.replace('<h2>Results</h2>', '<<br>p><<br>/p><h2>Results</h2>'),
      monthly.replace('<h2>Results</h2>', '<h2>Results<<br>p><<br>/p></h2>'),
      monthly.replace('<h2>Results</h2>', '<<br>p> <<br>/p> <h2>Results</h2>'),
      monthly.replace('<h2>A note from the president</h2>', '<<br>h2>A note from the president<<br>/h2>'),
      '<<br>p><<br>/p>',
    ]) {
      expect(holdsWords(open({ bodyHtml })), bodyHtml).toBe(true)
    }
  })

  it('is true for an untouched starter with a subject of its own, a preview line, or a month its subject no longer names', () => {
    expect(holdsWords(open({ bodyHtml: monthly, subject: 'Sample subject one' }))).toBe(true)
    expect(holdsWords(open({ bodyHtml: monthly, preheader: 'Sample preview line' }))).toBe(true)
    expect(holdsWords(open({ bodyHtml: monthly, monthLabel: 'January 2027' }))).toBe(true)
  })
})

describe('starterLetter', () => {
  it('writes each starter\'s headings as h2 parts over an empty paragraph, and nothing for a starter with none', () => {
    for (const id of STARTER_IDS) {
      const expected = STARTERS[id].headings.map((h) => `<h2>${h}</h2><p></p>`).join('')
      expect(starterLetter(id), id).toBe(expected)
    }
    expect(starterLetter('blank')).toBe('')
    expect(starterLetter('short-notice')).toBe('')
  })
  it('never starts with a smaller heading, so a starter is never refused as one', () => {
    for (const id of STARTER_IDS) expect(startsWithSmallHeading(starterLetter(id)), id).toBe(false)
  })
  it('holds no word of any of its own that is not a heading: an empty starter letter is a letter of parts, not of words, until a person writes', () => {
    // A starter's own headings, untouched, are not a person's words (holdsWords, above); the paragraphs hold none.
    for (const id of STARTER_IDS) {
      const body = starterLetter(id)
      expect(body.replace(/<h2>[^<]*<\/h2>/g, '').replace(/<\/?p>/g, '')).toBe('')
    }
  })
})

describe('refusalWords', () => {
  it('gives each reason its own words, and no two alike', () => {
    const words = (['changed', 'sent', 'set_aside'] as const).map(refusalWords)
    expect(new Set(words).size).toBe(3)
    expect(words).toEqual([issues.CHANGED_SINCE_READ, issues.SENT_SINCE_READ, issues.SET_ASIDE_SINCE_READ])
  })
  it('gives a start whose letter was sent as it started its own words, and a start that met any other change the words for a write', () => {
    expect(startRefusalWords('sent')).toBe(issues.SENT_WHILE_STARTING)
    expect(startRefusalWords('changed')).toBe(issues.CHANGED_WHILE_STARTING)
    expect(startRefusalWords('set_aside')).toBe(issues.CHANGED_WHILE_STARTING)
    // A start's words are its own: none of them speaks of words not saved.
    for (const reason of ['changed', 'sent', 'set_aside'] as const) expect(startRefusalWords(reason)).not.toBe(refusalWords(reason))
  })
})

describe('cleanedLetter, the bound before cleaning', () => {
  it('counts the bound in UTF-8 bytes and refuses before it reaches the cleaner, with the save\'s words or the start\'s', async () => {
    expect(issues.LETTER_INPUT_MAX_BYTES).toBe(3 * LETTER_MAX_BYTES)
    // 120,001 two-byte characters are 240,002 bytes: under the bound by length, over it by bytes.
    const wide = 'é'.repeat(120_001)
    expect(wide.length).toBeLessThan(issues.LETTER_INPUT_MAX_BYTES)
    expect(await cleanedLetter(wide)).toEqual({ refused: { status: 413, error: issues.LETTER_TOO_LONG } })
    expect(await cleanedLetter(wide, 'start')).toEqual({ refused: { status: 413, error: issues.SOURCE_TOO_LONG } })
    // One byte over, in characters of one byte.
    expect(await cleanedLetter('a'.repeat(issues.LETTER_INPUT_MAX_BYTES + 1))).toMatchObject({ refused: { status: 413 } })
  })
})

describe('the save\'s contract, at its edges', () => {
  it('takes the six fields as a page sends them, a seventh passing through and being kept apart from the six', () => {
    expect(newsletterIssueSaveRequestSchema.safeParse(SAVE).success).toBe(true)
    const parsed = newsletterIssueSaveRequestSchema.safeParse({ ...SAVE, testedAt: '2026-11-13 12:00:00' })
    expect(parsed.success).toBe(true)
  })
  it('holds each plain field to its limit after it is trimmed, in characters', () => {
    const at = (field: 'monthLabel' | 'subject' | 'preheader', max: number) => {
      expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, [field]: 'x'.repeat(max) }), `${field} at ${max}`).toBeNull()
      expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, [field]: `  ${'x'.repeat(max)}  ` }), `${field} padded`).toBeNull()
      expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, [field]: 'x'.repeat(max + 1) }), `${field} over`).toEqual([expect.stringContaining(`${field}: Keep the`)])
    }
    expect([MONTH_LABEL_MAX, SUBJECT_MAX, PREHEADER_MAX]).toEqual([40, 200, 150])
    at('monthLabel', MONTH_LABEL_MAX)
    at('subject', SUBJECT_MAX)
    at('preheader', PREHEADER_MAX)
  })
  it('refuses every character below a space, delete, the C1 controls and the line and paragraph separators, in the middle of a field', () => {
    const codes = [...Array.from({ length: 0x20 }, (_, i) => i), 0x7f, ...Array.from({ length: 0x20 }, (_, i) => 0x80 + i), 0x2028, 0x2029]
    for (const code of codes) {
      for (const field of ['monthLabel', 'subject', 'preheader'] as const) {
        const value = `Sample${String.fromCharCode(code)}words`
        const refused = fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, [field]: value })
        expect(refused, `${field} U+${code.toString(16)}`).toEqual([expect.stringContaining(`${field}: Write the`)])
      }
    }
  })
  it('refuses each of the nine characters that force the direction or the order of what follows, in each of the three fields, in the contract\'s words', () => {
    const forcing = [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]
    const names = { monthLabel: 'month', subject: 'subject', preheader: 'inbox preview line' } as const
    for (const code of forcing) {
      for (const [field, name] of Object.entries(names)) {
        const refused = fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, [field]: `Sample${String.fromCharCode(code)}words` })
        expect(refused, `${field} U+${code.toString(16)}`).toEqual([`${field}: Write the ${name} on one line, with no line break, tab or other hidden character.`])
      }
    }
  })
  it('keeps as written the joiners, the variation selector, the marks right-to-left text needs, the zero width space, the soft hyphen and an emoji made with a joiner', () => {
    // U+200D, U+200C, U+FE0F, U+200E, U+200F, U+061C, U+200B and U+00AD; then a heart on fire: a heart, U+FE0F, U+200D and a fire.
    const kept = [0x200d, 0x200c, 0xfe0f, 0x200e, 0x200f, 0x061c, 0x200b, 0x00ad].map((code) => `Sample${String.fromCharCode(code)}words`)
    for (const text of [...kept, `Sample ${String.fromCodePoint(0x2764, 0xfe0f, 0x200d, 0x1f525)} words`]) {
      for (const field of ['monthLabel', 'subject', 'preheader'] as const) {
        const parsed = newsletterIssueSaveRequestSchema.safeParse({ ...SAVE, [field]: text })
        expect(parsed.success, `${field} ${JSON.stringify(text)}`).toBe(true)
        expect(parsed.data?.[field], `${field} ${JSON.stringify(text)}`).toBe(text)
      }
    }
  })
  it('lets through ordinary text that is not a control: a non-breaking space, an accent, a middle dot, an emoji and a zero-width joiner', () => {
    for (const text of ['Sample words', 'Café sample', 'LCA Newsletter · December 2026', 'Sample \u{1F600}', 'a‍b']) {
      expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, subject: text }), text).toBeNull()
    }
  })
  it('trims an edge line break away as it trims a space, and refuses one inside', () => {
    const parsed = newsletterIssueSaveRequestSchema.parse({ ...SAVE, subject: '\n Sample subject\r\n' })
    expect(parsed.subject).toBe('Sample subject')
    expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, subject: 'Sample\n subject' })).not.toBeNull()
  })
  it('lets each plain field be empty and the letter be empty', () => {
    expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, monthLabel: '', subject: '', preheader: '', bodyHtml: '' })).toBeNull()
  })
  it('takes a version from 0 up as a whole number and refuses a fraction, a negative, a string, null and a missing one, each at the version field', () => {
    for (const version of [0, 1, 2, 9_000_000]) expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, version }), String(version)).toBeNull()
    for (const version of [-1, 1.5, '1', null, Number.NaN, undefined]) {
      expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, version }), String(version)).toEqual([expect.stringMatching(/^version: /)])
    }
  })
  it('takes the letter\'s id as text or null, and refuses an empty id, a number and a missing one', () => {
    expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, id: 'issue-sample-one' })).toBeNull()
    for (const id of ['', 7, undefined, {}]) expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, id }), String(id)).toEqual([expect.stringMatching(/^id: /)])
  })
  it('holds the letter\'s id to REQUEST_ID_MAX characters, and refuses one a character over in the field\'s own words', () => {
    expect(REQUEST_ID_MAX).toBe(64)
    expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, id: 'i'.repeat(REQUEST_ID_MAX) })).toBeNull()
    expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, id: 'i'.repeat(REQUEST_ID_MAX + 1) })).toEqual(['id: Name the letter you read, or none for a new one.'])
  })
  it('refuses a body that is not text, at bodyHtml, and one missing', () => {
    for (const bodyHtml of [3, null, undefined, ['<p>x</p>']]) expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, bodyHtml }), String(bodyHtml)).toEqual([expect.stringMatching(/^bodyHtml: /)])
  })
})

describe('the start\'s contract, at its edges', () => {
  const start = (from: unknown, monthLabel: unknown = 'January 2027') => ({ from, monthLabel })
  it('takes each starter by its id, a past letter by its id and a send by its id', () => {
    for (const id of STARTER_IDS) expect(fieldsRefused(newsletterIssueStartRequestSchema, start(id)), id).toBeNull()
    expect(fieldsRefused(newsletterIssueStartRequestSchema, start({ issueId: 'issue-sample-one' }))).toBeNull()
    expect(fieldsRefused(newsletterIssueStartRequestSchema, start({ campaignId: 'campaign-sample-one' }))).toBeNull()
  })
  it('refuses a source of two kinds, an empty id, an id that is not text, an unknown starter and none', () => {
    for (const from of [{ issueId: 'a', campaignId: 'b' }, { issueId: '' }, { campaignId: '' }, { issueId: 4 }, { campaignId: null }, 'Monthly', 'BLANK', 'a-starter-nobody-wrote', '', 7, null, undefined, {}, []]) {
      expect(fieldsRefused(newsletterIssueStartRequestSchema, start(from)), JSON.stringify(from) ?? 'undefined').not.toBeNull()
    }
  })
  it('holds a past letter\'s id and a send\'s to REQUEST_ID_MAX characters, and refuses one a character over in the source\'s own words', () => {
    for (const key of ['issueId', 'campaignId']) {
      expect(fieldsRefused(newsletterIssueStartRequestSchema, start({ [key]: 'i'.repeat(REQUEST_ID_MAX) })), key).toBeNull()
      expect(fieldsRefused(newsletterIssueStartRequestSchema, start({ [key]: 'i'.repeat(REQUEST_ID_MAX + 1) })), key).toEqual([
        'from: Choose a blank letter, a starter, a past letter or a past newsletter.',
      ])
    }
  })
  it('answers an empty id in the field\'s own words too, the save\'s and a source\'s, as it answers one over the bound', () => {
    expect(fieldsRefused(newsletterIssueSaveRequestSchema, { ...SAVE, id: '' })).toEqual(['id: Name the letter you read, or none for a new one.'])
    for (const key of ['issueId', 'campaignId']) {
      expect(fieldsRefused(newsletterIssueStartRequestSchema, start({ [key]: '' })), key).toEqual([
        'from: Choose a blank letter, a starter, a past letter or a past newsletter.',
      ])
    }
  })
  it('holds the month to the same limit and the same one line as a save does, and lets it be empty', () => {
    expect(fieldsRefused(newsletterIssueStartRequestSchema, start('blank', 'm'.repeat(MONTH_LABEL_MAX)))).toBeNull()
    expect(fieldsRefused(newsletterIssueStartRequestSchema, start('blank', 'm'.repeat(MONTH_LABEL_MAX + 1)))).not.toBeNull()
    expect(fieldsRefused(newsletterIssueStartRequestSchema, start('blank', 'January\n2027'))).not.toBeNull()
    expect(fieldsRefused(newsletterIssueStartRequestSchema, start('blank', ''))).toBeNull()
    expect(fieldsRefused(newsletterIssueStartRequestSchema, { from: 'blank' })).not.toBeNull()
  })
  it('gives a start from the open month with no month the bare subject, so an empty month is not written as a dangling separator', () => {
    expect(defaultSubject('')).toBe('LCA Newsletter')
    expect(defaultSubject('   ')).toBe('LCA Newsletter')
  })
})

describe('the responses\' contracts, strict', () => {
  const letter = { id: 'issue-sample-one', version: 1, monthLabel: 'December 2026', subject: 'Sample subject', preheader: '', bodyHtml: LETTER, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 15:00:00' }
  it('takes the open letter\'s read, with and without a letter, and refuses a state beside the two, a key beside the four and a time that is not as the database writes it', () => {
    const read = { issue: letter, state: 'draft', lastSavedBy: 'Member One', lastSavedAt: '2026-11-13 15:00:00' }
    expect(newsletterIssueResponseSchema.safeParse(read).success).toBe(true)
    expect(newsletterIssueResponseSchema.safeParse({ issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }).success).toBe(true)
    for (const bad of [{ ...read, state: 'sent' }, { ...read, extra: 1 }, { ...read, lastSavedAt: '2026-11-13T15:00:00Z' }, { ...read, issue: { ...letter, version: 0 } }, { ...read, issue: { ...letter, testedAt: null } }]) {
      expect(newsletterIssueResponseSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })
  it('takes a save\'s answer with the stored letter or null, and nothing beside', () => {
    const saved = { id: 'issue-sample-one', version: 2, savedAt: '2026-11-13 15:00:00', bodyHtml: null }
    expect(newsletterIssueSavedResponseSchema.safeParse(saved).success).toBe(true)
    expect(newsletterIssueSavedResponseSchema.safeParse({ ...saved, bodyHtml: LETTER }).success).toBe(true)
    expect(newsletterIssueSavedResponseSchema.safeParse({ ...saved, bodyHtml: undefined }).success).toBe(false)
    expect(newsletterIssueSavedResponseSchema.safeParse({ ...saved, subject: 'x' }).success).toBe(false)
  })
  it('takes the 409 with who and when and carries no words of the refused save', () => {
    const refused = { error: issues.CHANGED_SINCE_READ, reason: 'changed', changedBy: null, changedAt: '2026-11-13 15:00:00' }
    expect(newsletterIssueRefusedSchema.safeParse(refused).success).toBe(true)
    expect(newsletterIssueRefusedSchema.safeParse({ ...refused, bodyHtml: LETTER }).success).toBe(false)
    expect(newsletterIssueRefusedSchema.safeParse({ ...refused, reason: 'stale' }).success).toBe(false)
  })
  it('takes at most 20 of the last newsletters, each in one of four states, and no reader\'s address among its keys', () => {
    const one = { issueId: null, campaignId: 'campaign-sample-one', monthLabel: '', subject: 'Sample', state: 'sending', at: '2026-11-13 15:00:00', by: null, totalRecipients: 0 }
    for (const state of ['sending', 'completed', 'failed', 'set_aside']) expect(lastNewsletterSchema.safeParse({ ...one, state }).success, state).toBe(true)
    expect(lastNewsletterSchema.safeParse({ ...one, state: 'scheduled' }).success).toBe(false)
    expect(lastNewsletterSchema.safeParse({ ...one, email: 'reader.one@example.org' }).success).toBe(false)
    expect(lastNewsletterSchema.safeParse({ ...one, totalRecipients: -1 }).success).toBe(false)
    expect(newsletterIssuesResponseSchema.safeParse({ issues: Array.from({ length: 20 }, () => one) }).success).toBe(true)
    expect(newsletterIssuesResponseSchema.safeParse({ issues: Array.from({ length: 21 }, () => one) }).success).toBe(false)
  })
})

describe('plain language over every word a person could read from the page\'s methods', () => {
  const stringConstants = Object.entries(issues).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[0] === entry[0].toUpperCase() && /[a-z]/i.test(entry[1]) && /\s/.test(entry[1]))
  const contractWords = (() => {
    const words: string[] = []
    const bads: Array<[{ safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, unknown]> = [
      [newsletterIssueSaveRequestSchema, { id: 5, version: 'x', monthLabel: 3, subject: 3, preheader: 3, bodyHtml: 3 }],
      [newsletterIssueSaveRequestSchema, { ...SAVE, monthLabel: 'm'.repeat(41), subject: 's'.repeat(201), preheader: 'p'.repeat(151) }],
      [newsletterIssueSaveRequestSchema, { ...SAVE, monthLabel: 'a\nb', subject: 'a\nb', preheader: 'a\nb', version: -1 }],
      [newsletterIssueStartRequestSchema, { from: 'nobody-wrote-this', monthLabel: 'a\nb' }],
      [newsletterIssueStartRequestSchema, { from: { issueId: 'a', campaignId: 'b' }, monthLabel: 3 }],
    ]
    for (const [schema, value] of bads) {
      const result = schema.safeParse(value)
      if (!result.success) words.push(...result.error!.issues.map((i) => i.message))
    }
    return words
  })()

  it('finds the refusals\' words to read: the constants and the contracts\' messages', () => {
    expect(stringConstants.map(([name]) => name).sort()).toEqual([
      'CHANGED_SINCE_READ', 'CHANGED_WHILE_STARTING', 'LETTER_NOT_CLEAN', 'LETTER_STARTS_SMALL', 'LETTER_TOO_LONG', 'SENT_SINCE_READ',
      'SENT_WHILE_STARTING', 'SET_ASIDE_SINCE_READ', 'SOURCE_NOT_CLEAN', 'SOURCE_STARTS_SMALL', 'SOURCE_TOO_LONG',
    ])
    expect(contractWords.length).toBeGreaterThan(8)
  })

  const everyWord = () => [...stringConstants.map(([, text]) => text), ...contractWords]
  it('holds no em or en dash, no hyphen used as a dash, no old name for US Chess, no 24-hour time and no "he" or "his" for the owner', () => {
    for (const text of everyWord()) {
      expect(text, text).not.toMatch(/[‒-―−]/)
      expect(text, text).not.toMatch(/ - | -- /)
      expect(text, text).not.toMatch(OLD_NAME)
      expect(text, text).not.toMatch(/\b\d{1,2}:\d{2}\b/)
      expect(text, text).not.toMatch(/\b(?:he|his|him)\b/i)
    }
  })
  it('says what happened and what to do in one or two plain sentences, each ending in a full stop, with no markup and no postal address', () => {
    for (const text of everyWord()) {
      expect(text, text).toMatch(/\.$/)
      expect(text.split(/(?<=\.)\s+/).length, text).toBeLessThanOrEqual(2)
      expect(text, text).not.toMatch(/[<>{}]/)
      expect(text, text).not.toMatch(/\b(?:street|avenue|p\.?o\.? box|suite)\b/i)
      expect(text.length, text).toBeLessThanOrEqual(160)
    }
  })
  it('names the 409\'s three reasons without naming a person, the name and time being the answer\'s own fields', () => {
    for (const reason of ['changed', 'sent', 'set_aside'] as const) {
      expect(refusalWords(reason)).not.toMatch(/Player|Member|\d{4}-\d{2}/)
      expect(startRefusalWords(reason)).not.toMatch(/Player|Member|\d{4}-\d{2}/)
    }
  })
})
