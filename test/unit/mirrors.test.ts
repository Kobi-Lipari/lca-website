// The browser keeps copies of a few server helpers so the entry form can
// show the same rules and prices the server charges. The copies must not
// drift: past each file's header comment they have to match exactly.
import { describe, expect, it } from 'vitest'
import serverRules from '../../functions/utils/sectionRules.ts?raw'
import browserRules from '../../src/lib/sectionRules.ts?raw'
import serverTime from '../../functions/utils/time.ts?raw'
import browserTime from '../../src/lib/lcaTime.ts?raw'
import serverPricing from '../../functions/utils/pricing.ts?raw'
import browserPricing from '../../src/lib/pricing.ts?raw'
import { FAMILY_MEMBERSHIP_CHILDREN as serverFamily } from '../../functions/utils/family'
import { FAMILY_MEMBERSHIP_CHILDREN as browserFamily } from '../../src/lib/family'

/** Everything after the header: from the first line that is just "//". */
const body = (src: string) => {
  const lines = src.split('\n')
  return lines.slice(lines.findIndex((l) => l.trim() === '//')).join('\n')
}

describe('browser copies of server helpers', () => {
  it('section rules match', () => expect(body(browserRules)).toBe(body(serverRules)))
  it('Central time helpers match', () => expect(body(browserTime)).toBe(body(serverTime)))
  it('pricing matches', () => expect(body(browserPricing).replace("'./lcaTime'", "'./time'")).toBe(body(serverPricing)))
})


describe('family membership size', () => {
  it('is the same in the browser and on the server', () => expect(browserFamily).toBe(serverFamily))
})
