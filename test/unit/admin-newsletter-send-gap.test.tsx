// @vitest-environment jsdom
//
// What a letter needs before the newsletter page's own Send asks its question
// (WS16 part two, page step 6, send half): a subject, and words a person
// wrote. A starter's headings left untouched are not words a person wrote, so
// such a letter is refused with the "no words yet" sentence and nothing is
// posted. The page's sendGap in src/areas/admin/newsletter/useIssue.ts is the
// page's copy of the server's sendGap in functions/utils/mail/issues.ts, and
// the last case holds the two equal.

import { describe, expect, it } from 'vitest'
import { STARTER_IDS, defaultSubject } from '@domain/mail/letter'
import { sendGap as serverSendGap, starterLetter } from '../../functions/utils/mail/issues'

const { sendGap } = await import('@/areas/admin/newsletter/useIssue')

const MONTH = 'December 2026'
const letter = (subject: string, bodyHtml: string) => ({ monthLabel: MONTH, subject, preheader: '', bodyHtml })

describe("what a letter needs before the page's Send", () => {
  it('reads a letter with a subject and words of its own as ready', () => {
    expect(sendGap(letter('Sample subject', '<p>Sample words</p>'))).toBeNull()
    expect(sendGap(letter(defaultSubject(MONTH), '<h2>Sample heading one</h2><p></p>'))).toBeNull()
    expect(sendGap(letter('Sample subject', '<p>&lt; 2</p>'))).toBeNull()
  })

  it('reads an empty subject, or one of spaces only, as no subject', () => {
    expect(sendGap(letter('', '<p>Sample words</p>'))).toBe('subject')
    expect(sendGap(letter('   ', '<p>Sample words</p>'))).toBe('subject')
  })

  it('reads an empty body, an empty paragraph and a space alone as no words', () => {
    expect(sendGap(letter('Sample subject', ''))).toBe('words')
    expect(sendGap(letter('Sample subject', '<p></p>'))).toBe('words')
    expect(sendGap(letter('Sample subject', '<p>&nbsp;</p>'))).toBe('words')
  })

  it("reads every one of LCA's starters left untouched as no words", () => {
    for (const id of STARTER_IDS) expect(sendGap(letter('Sample subject', starterLetter(id))), id).toBe('words')
    expect(sendGap(letter('Sample subject', starterLetter('monthly').replace('<h2>Coming up</h2><p></p>', '<h2>Coming up</h2><p>Sample</p>')))).toBeNull()
  })

  it('reads no subject and no words as both', () => {
    expect(sendGap(letter(' ', '<p></p>'))).toBe('both')
    expect(sendGap(letter('', starterLetter(STARTER_IDS[0])))).toBe('both')
  })

  it("is the server's own: the page and the server read every one of these letters alike", () => {
    const letters = [
      letter('Sample subject', '<p>Sample words</p>'),
      letter(defaultSubject(MONTH), '<h2>Sample heading one</h2><p></p>'),
      letter('Sample subject', '<p>&lt; 2</p>'),
      letter('', '<p>Sample words</p>'),
      letter('   ', '<p>Sample words</p>'),
      letter('Sample subject', ''),
      letter('Sample subject', '<p></p>'),
      letter('Sample subject', '<p>&nbsp;</p>'),
      ...STARTER_IDS.map((id) => letter('Sample subject', starterLetter(id))),
      letter('Sample subject', starterLetter('monthly').replaceAll('<p></p>', '<p><br></p>')),
      letter('Sample subject', starterLetter('monthly').replace('<h2>Results</h2>', '<h2>Sample heading one</h2>')),
      letter(' ', '<p></p>'),
      letter('', starterLetter(STARTER_IDS[0])),
    ]
    for (const each of letters) expect(sendGap(each), JSON.stringify(each)).toBe(serverSendGap({ subject: each.subject.trim(), bodyHtml: each.bodyHtml }))
  })
})
