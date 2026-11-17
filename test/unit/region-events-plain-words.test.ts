// test/unit/region-events-plain-words.test.ts
//
// The plain-language rules on the files WS09 step 19 wrote, read as source:
// no long dash anywhere (code comments and test names included), no US Chess
// written as the old initialism in a word a page draws, no decimal half, no
// time of day written in 24 hour form, and no mention of how the work was
// made. The pages' rendered words are held in region-events-pages.test.tsx
// and approval-wait-panel.test.tsx; this holds what a case can miss, a
// sentence only a rare state draws. Files this step only grew are not read
// whole, since they hold words from before it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')

/** The files this step wrote whole. */
const NEW_FILES = [
  'domain/events/approvalWords.ts',
  'functions/utils/clubs/eventRights.ts',
  'src/areas/clubs/approval.ts',
  'src/areas/clubs/components/ApprovalWait.tsx',
  'src/areas/clubs/components/ClubWaitingEvents.tsx',
  'src/areas/clubs/useManagesEvent.ts',
  'test/unit/region-events-pages.test.tsx',
  'test/unit/approval-wait-panel.test.tsx',
  'test/unit/approval-words.test.ts',
  'test/unit/region-events-steps.test.tsx',
  'test/unit/region-events-plain-words.test.ts',
  'test/unit/redesign-status-ws09-step19.test.ts',
  'test/integration/region-events-answers.test.ts',
  'test/integration/region-events-agreement.test.ts',
]

const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
// The build's own job words and tools, written as pieces so this file does not name them.
const MADE_WITH = new RegExp(`\\b(${['Cl' + 'aude', 'assis' + 'tant', 'chat' + 'bot', 'A' + 'I', 'G' + 'PT', 'L' + 'LM', 'Co' + 'pilot'].join('|')})\\b`, 'i')

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

describe('the files this step wrote', () => {
  for (const file of NEW_FILES) {
    it(`${file} has no long dash and no mention of how it was made`, () => {
      const text = read(file)
      const dash = text.split('\n').findIndex((line) => LONG_DASH.test(line))
      expect(dash === -1 ? 'none' : `line ${dash + 1}`).toBe('none')
      // The record's own test holds the list of words the record may not use, so it is read for dashes alone.
      const made = file === 'test/unit/redesign-status-ws09-step19.test.ts' ? -1 : text.split('\n').findIndex((line) => MADE_WITH.test(line))
      expect(made === -1 ? 'none' : `line ${made + 1}`).toBe('none')
    })
  }

  it('write US Chess in every sentence a page draws and never the old initialism', () => {
    for (const file of NEW_FILES.filter((f) => f.startsWith('src/') || f.startsWith('domain/'))) {
      const strings = [...read(file).matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2])
      for (const s of strings) expect(s, file).not.toMatch(new RegExp('US' + 'CF'))
    }
  })

  it('write no decimal half and no 24 hour time in a sentence a page draws', () => {
    for (const file of NEW_FILES.filter((f) => f.startsWith('src/') || f.startsWith('domain/'))) {
      const strings = [...read(file).matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).filter((s) => /\s/.test(s))
      for (const s of strings) {
        expect(s, file).not.toMatch(/(?<![-\w.])\d\.5\b/)
        expect(s, file).not.toMatch(/\b(?:[01]\d|2[0-3]):[0-5]\d\b(?!\s?[AP]M)/)
      }
    }
  })

  it('call no mail service and no deliver() from a page, a hook or a helper of this step', () => {
    for (const file of NEW_FILES.filter((f) => f.startsWith('src/') || f.startsWith('domain/') || f.startsWith('functions/'))) {
      const text = read(file)
      expect(text, file).not.toMatch(/\bdeliver\(/)
      expect(text, file).not.toMatch(/api\.resend\.com|amazonaws/)
    }
  })
})
