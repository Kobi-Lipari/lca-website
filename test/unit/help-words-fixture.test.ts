// test/unit/help-words-fixture.test.ts
//
// The question marks' words as K's note of Thursday, November 19, 2026 has
// them, held in the fixture itself (test/unit/fixtures/help-words.json,
// written from the list and not from the code) before any page draws them:
// every variant keeps the terms the old list had, in the old order; each
// sentence varies only with the reader or the switch the list names for it;
// and every sentence keeps to the plain-language rules the association
// writes by. Nothing here reads the product's code, so a page and its fixture
// cannot agree on a mistake through this file.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
type Lists = Record<string, Array<[string, string]>>
const read = (name: string) => JSON.parse(readFileSync(join(ROOT, 'test/unit/fixtures', name), 'utf8')) as { editor: Lists; region: Lists }
const NOW = read('help-words.json')
const OLD = read('help-words-before.json')

/** A variant's key, taken apart: its four choices. */
function choices(key: string) {
  const pick = (name: string) => new RegExp(`${name}=(true|false)`).exec(key)?.[1] === 'true'
  return { own: pick('own'), emailHidden: pick('emailHidden'), pagesOn: pick('pagesOn'), showAdmin: pick('showAdmin') }
}
const entries = (): Array<[string, string, string, string]> => [
  ...Object.entries(NOW.editor).flatMap(([key, list]) => list.map(([term, text]) => ['editor', key, term, text] as [string, string, string, string])),
  ...Object.entries(NOW.region).flatMap(([key, list]) => list.map(([term, text]) => ['region', key, term, text] as [string, string, string, string])),
]

describe('the new list\'s fixture, as a list', () => {
  it('holds the old list\'s sixteen editor variants and two My region variants, by the same keys in the same order, each with the same terms in the same order', () => {
    for (const group of ['editor', 'region'] as const) {
      expect(Object.keys(NOW[group])).toEqual(Object.keys(OLD[group]))
      for (const key of Object.keys(OLD[group])) {
        expect(NOW[group][key].map(([term]) => term), `${group} ${key}`).toEqual(OLD[group][key].map(([term]) => term))
      }
    }
    expect(Object.keys(NOW.editor)).toHaveLength(16)
    expect(Object.keys(NOW.region)).toHaveLength(2)
  })

  it('keeps every term once in a variant, and the editor\'s entries to thirteen with the admin\'s fields and twelve without', () => {
    for (const [group, key, list] of [...Object.entries(NOW.editor).map(([k, l]) => ['editor', k, l] as const), ...Object.entries(NOW.region).map(([k, l]) => ['region', k, l] as const)]) {
      const terms = list.map(([term]) => term)
      expect(new Set(terms).size, `${group} ${key}`).toBe(terms.length)
      if (group === 'editor') expect(terms.length, key).toBe(choices(key).showAdmin ? 13 : 12)
      else expect(terms, key).toEqual(['What this page is', 'Still accurate', 'The 90 days', 'Confirm all still accurate', 'The monthly check', 'Open', 'Who sees the stamps'])
    }
  })

  it('draws "Club name, region and page address" only with the admin\'s fields, and the pointer to an LCA admin only without them, once, in Name and address', () => {
    const ASK = 'To change the name, the region or the web address, ask an LCA admin.'
    for (const [key, list] of Object.entries(NOW.editor)) {
      const { showAdmin } = choices(key)
      const terms = list.map(([term]) => term)
      expect(terms.includes('Club name, region and page address'), key).toBe(showAdmin)
      const holding = list.filter(([, text]) => text.includes('ask an LCA admin'))
      expect(holding.map(([term]) => term), key).toEqual(showAdmin ? [] : ['Name and address'])
      if (!showAdmin) expect(holding[0][1].endsWith(` ${ASK}`), key).toBe(true)
    }
  })

  it('makes each sentence vary only with the choice the list names for it, and in as many forms as it names', () => {
    // For each term: which choices its sentence follows, and how many sentences it has across the sixteen variants.
    const FOLLOWS: Record<string, { by: Array<'own' | 'emailHidden' | 'pagesOn' | 'showAdmin'>; forms: number }> = {
      'One sentence about the club': { by: ['own'], forms: 2 },
      'How the club meets, in words': { by: [], forms: 1 },
      'Where': { by: [], forms: 1 },
      'Contact name shown on the page': { by: [], forms: 1 },
      'Contact name': { by: [], forms: 1 },
      'Email for messages': { by: ['emailHidden', 'own'], forms: 3 },
      'Name and address': { by: ['own', 'showAdmin'], forms: 4 },
      'Club name, region and page address': { by: [], forms: 1 },
      'Cost and who is welcome': { by: [], forms: 1 },
      'Links': { by: ['own'], forms: 2 },
      'Logo and club color': { by: ['pagesOn'], forms: 2 },
      'Today\'s page shows different words here': { by: ['own'], forms: 2 },
      'Save and publish': { by: ['own'], forms: 2 },
      'Preview': { by: [], forms: 1 },
    }
    const seen = new Map<string, Map<string, Set<string>>>()
    for (const [key, list] of Object.entries(NOW.editor)) {
      const c = choices(key)
      for (const [term, text] of list) {
        const rule = FOLLOWS[term]
        expect(rule, `${key} ${term}`).toBeDefined()
        const group = rule.by.map((name) => `${name}=${c[name]}`).join(' ')
        const byGroup = seen.get(term) ?? new Map<string, Set<string>>()
        byGroup.set(group, (byGroup.get(group) ?? new Set()).add(text))
        seen.set(term, byGroup)
      }
    }
    for (const [term, byGroup] of seen) {
      // Within one setting of the choices a term follows, the sentence is one.
      for (const [group, texts] of byGroup) expect(texts.size, `${term} ${group}`).toBe(1)
      const all = new Set([...byGroup.values()].flatMap((texts) => [...texts]))
      expect(all.size, term).toBe(FOLLOWS[term].forms)
    }
    // The contact name's two terms are the new club pages' choice, and the sentence under each is the one.
    const contactNow = [...seen.keys()].filter((term) => term.startsWith('Contact name'))
    expect(contactNow.sort()).toEqual(['Contact name', 'Contact name shown on the page'])
    expect([...seen.get('Contact name')!.values()][0]).toEqual(new Set(['The person a visitor should ask for.']))
    expect([...seen.get('Contact name shown on the page')!.values()][0]).toEqual(new Set(['The person a visitor should ask for.']))
    // Which variants draw which term: the new club pages decide the contact name's term and nothing else's.
    for (const key of Object.keys(NOW.editor)) {
      const terms = NOW.editor[key].map(([term]) => term)
      expect(terms.includes('Contact name shown on the page'), key).toBe(choices(key).pagesOn)
      expect(terms.includes('Contact name'), key).toBe(!choices(key).pagesOn)
    }
  })

  it('says "your club\'s" only to the club\'s own rep and "the club\'s" to everyone else, in the sentences and in no term', () => {
    for (const [key, list] of Object.entries(NOW.editor)) {
      const { own } = choices(key)
      for (const [term, text] of list) {
        expect(term, `${key} ${term}`).not.toMatch(/\b(?:your|the) club's\b/i)
        if (!own) expect(text, `${key} ${term}`).not.toMatch(/\byour club\b/i)
      }
    }
    // The wording by reader, one line each, as the list gives them.
    const one = (key: string, term: string) => NOW.editor[key].find(([t]) => t === term)![1]
    const OWN = 'own=true emailHidden=true pagesOn=false showAdmin=true'
    const OTHER = 'own=false emailHidden=true pagesOn=false showAdmin=true'
    expect(one(OWN, 'Save and publish')).toMatch(/^Your changes show on your club's page right away\./)
    expect(one(OTHER, 'Save and publish')).toMatch(/^Your changes show on the club's page right away\./)
    expect(one(OWN, 'Today\'s page shows different words here')).toMatch(/^Your club's page shows different words/)
    expect(one(OTHER, 'Today\'s page shows different words here')).toMatch(/^The club's page shows different words/)
    expect(one(OWN, 'Links')).toContain('such as your club\'s Facebook page.')
    expect(one(OTHER, 'Links')).toContain('such as the club\'s Facebook page.')
  })

  it('has the email\'s two forms, the color\'s two forms, and no mention of what visitors do not see of the six fields', () => {
    const one = (key: string, term: string) => NOW.editor[key].find(([t]) => t === term)![1]
    expect(one('own=false emailHidden=true pagesOn=true showAdmin=true', 'Email for messages')).toBe('LCA can reach the club at this address. Visitors never see it.')
    expect(one('own=false emailHidden=false pagesOn=true showAdmin=true', 'Email for messages')).toBe('Messages for the club are sent to this address. Visitors can see it on the club\'s page.')
    expect(one('own=true emailHidden=false pagesOn=true showAdmin=true', 'Email for messages')).toBe('Messages for the club are sent to this address. Visitors can see it on your club\'s page.')
    expect(one('own=false emailHidden=true pagesOn=true showAdmin=true', 'Logo and club color').endsWith('The club\'s own color. A club with none shows navy.')).toBe(true)
    expect(one('own=false emailHidden=true pagesOn=false showAdmin=true', 'Logo and club color').endsWith('The club\'s own color. A club with none shows LCA\'s gold.')).toBe(true)
    // Until K answers, no sentence says the six fields are not yet seen by visitors.
    for (const [, key, term, text] of entries()) expect(text, `${key} ${term}`).not.toMatch(/visitors do not see|not shown yet|do not see this yet/i)
  })
})

describe('the new list\'s sentences, in plain language', () => {
  it('has no em dash, no en dash, no "USCF", no ".5" for a half, no time but "7:00 PM", no date without its weekday, and no stray spacing', () => {
    const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
    const all = entries()
    expect(all.length).toBeGreaterThan(16 * 12)
    for (const [group, key, term, text] of all) {
      const where = `${group} ${key} ${term}`
      expect(text, where).not.toMatch(DASH)
      expect(text, where).not.toMatch(OLD_INITIALS)
      expect(text, where).not.toMatch(/\d\.5\b/)
      expect(text, where).not.toMatch(/(?<![:\d])\d{1,2}\s?(?:am|pm)\b/i)
      expect(text, where).not.toMatch(/\b\d{1,2}:\d{2}\s?(?:am|pm)\b/)
      for (const time of text.match(/\b\d{1,2}:\d{2}\b.{0,3}/g) ?? []) expect(time, where).toMatch(/^\d{1,2}:\d{2} (?:AM|PM)/)
      expect(text, where).not.toMatch(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/)
      expect(text, where).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(text, where).toBe(text.trim())
      expect(text, where).not.toMatch(/ {2}|\n/)
      expect(text.endsWith('.'), where).toBe(true)
    }
    // The list's one clock time is written the way the page shows one.
    expect(entries().some(([, , , text]) => text.includes('at 7:00 PM"'))).toBe(true)
  })

  it('keeps K\'s rule in the fixture too: nothing of how the pages are made or may change, and none over 300 characters', () => {
    const REFUSED = ['today\'s', 'once the', 'new club pages', 'older form', 'will show', 'will be', 'not yet', 'switch', 'is drawn', 'is used once']
    for (const [group, key, term, text] of entries()) {
      expect(text.length, `${group} ${key} ${term}`).toBeLessThanOrEqual(300)
      for (const words of REFUSED) expect(text.toLowerCase(), `${group} ${key} ${term}: ${words}`).not.toContain(words)
    }
  })

  it('keeps My region\'s two lists the same but for the first entry, and the admin never reads "your region"', () => {
    const rep = NOW.region['isAdmin=false']
    const admin = NOW.region['isAdmin=true']
    expect(rep.slice(1)).toEqual(admin.slice(1))
    expect(rep[0][1]).toBe('A card for each club in your region, with when its listing was last checked.')
    expect(admin[0][1]).toBe('A card for each club, in every region, with when its listing was last checked.')
    for (const [, text] of admin) expect(text).not.toMatch(/\byour region\b/i)
    expect(rep[6][1]).toBe('Only My region shows when a club was checked. No public page does.')
  })
})
