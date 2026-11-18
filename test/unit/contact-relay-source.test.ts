// What the files of the contact relay (WS09) are and are not, read from the tree:
// the handler takes nothing from the request but the three fields and the token; the
// relay and the handler write no row of their own, call no mail service and
// name none, the handler logs no line and the relay one line of fixed words; the form keeps nothing in the browser's storage and makes
// no call of its own; and the files and tests of the relay use no dash of the long
// kinds, no short name for US Chess and no word of the build's own tools.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
/** A file's lines with the whole-line comments left out, so a comment that says what is not done is not read as the thing itself. */
const codeOf = (rel: string) => read(rel).split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n')

const HANDLER = 'functions/api/clubs/[id]/contact.ts'
const RELAY = 'functions/utils/clubs/relay.ts'
const FORM = 'src/areas/clubs/components/ContactRelayForm.tsx'
const OWN_FILES = [
  HANDLER, RELAY, FORM, 'domain/clubs/contactMessage.ts', 'domain/contracts/clubContact.ts',
  'test/integration/club-contact-relay.test.ts', 'test/integration/club-contact-relay-edges.test.ts',
  'test/integration/contracts/club-contact.test.ts', 'test/integration/spam-check-no-signal.test.ts',
  'test/unit/contact-relay-form.test.tsx', 'test/unit/spam-check-widget-mends.test.tsx',
  'test/unit/contact-message-rules.test.ts', 'test/unit/contact-relay-source.test.ts',
]

describe('the handler', () => {
  const code = codeOf(HANDLER)

  it('reads from the request body the name, the address, the message and the token, and nothing else', () => {
    const keys = new Set([...code.matchAll(/\bbody\.(\w+)/g)].map((m) => m[1]).filter((key) => key !== 'headers'))
    expect([...keys].sort()).toEqual(['email', 'message', 'name', 'token'])
    // No header of the request is read but through the limiter: no address, copy or subject comes from one.
    expect(code).not.toMatch(/headers\.get|\.headers\[/)
    expect(code).not.toMatch(/searchParams|new URL\(/)
  })

  it('runs its guards in the order: constant, body, place, spam check, club, club count, relay', () => {
    // The constant's read in the handler's code, as text: this file never reads a switch, so its name is not written whole here.
    const readOfConstant = `${'CLUB_PAGES'}_ON)`
    const order = [readOfConstant, 'parseBody(', "limit(env, request, CONTACT_PLACE_ROUTE", 'checkSpam(', 'clubNamedBy(', "limit(env, request, CONTACT_CLUB_ROUTE", 'relayMessage(']
    const at = order.map((piece) => code.indexOf(piece))
    expect(at.every((i) => i > 0), JSON.stringify(at)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // The constant is read inside the handler, at each call.
    expect(code.indexOf(readOfConstant)).toBeGreaterThan(code.indexOf('onRequestPost'))
  })

  it('counts five an hour for a place and twenty an hour for a club', () => {
    expect(code).toMatch(/MESSAGES_AN_HOUR_FROM_ONE_PLACE = 5\b/)
    expect(code).toMatch(/MESSAGES_AN_HOUR_TO_ONE_CLUB = 20\b/)
  })
})

describe('the relay and the handler', () => {
  for (const file of [HANDLER, RELAY]) {
    const code = codeOf(file)
    it(`${file} writes no row, logs nothing it was given, calls no mail service and names none`, () => {
      expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|REPLACE)\b\s+(INTO|\w+)/i)
      // The handler logs no line; the relay logs one, its fixed words, and nothing a failure carries.
      expect([...code.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1])).toEqual(file === RELAY ? ['COPY_NOT_SENT_LOG'] : [])
      expect(code).not.toMatch(/\bdeliver\(|deliverEmail|trySendEmail\(|sendEmailOutcome\(/)
      expect(code).not.toMatch(/resend|amazonaws|\bSES\b|api\.mail|mailgun|sendgrid/i)
      expect(code).not.toMatch(/localStorage|sessionStorage|waitUntil/)
    })
  }

  it('the relay sends through sendEmail alone, in its own catch, one copy to one address, and names no recipient from the request', () => {
    const code = codeOf(RELAY)
    expect([...code.matchAll(/\bsendEmail\(/g)]).toHaveLength(1)
    // The failure is caught with no name, so nothing it says can be logged or passed on.
    expect(code).toMatch(/await sendEmail\([^\n]*\n\s*return true\n\s*\} catch \{\n/)
    expect(code).toMatch(/export const COPY_NOT_SENT_LOG = 'Contact relay: a copy was not sent\.'/)
    expect([...code.matchAll(/\bto:\s*([\w.]+)/g)].map((m) => m[1])).toEqual(['address'])
    expect(code).not.toMatch(/\b(cc|bcc)\b\s*:/i)
    // The visitor's address is a reply-to on the club's own copy alone.
    expect([...code.matchAll(/replyTo/g)]).toHaveLength(1)
    expect(code).toMatch(/kind === 'club' \? \{ replyTo: visitor\.email\.trim\(\) \}/)
  })
})

describe('the form', () => {
  const code = codeOf(FORM)

  it('keeps nothing in the browser\'s storage and makes no call of its own', () => {
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
    expect(code).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon/)
    expect(code).toMatch(/sendClubMessage/)
  })

  it('says the club\'s contact name nowhere and takes no keeper\'s name or address as a prop', () => {
    expect(code).not.toMatch(/contact_email|rep(resentative)?Name|adminName|keeperName/)
  })
})

describe('the words of the relay\'s own files', () => {
  const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  // Built from pieces so this file never holds the words it looks for.
  const OLD_NAME = new RegExp(['US', 'CF'].join(''))
  const TOOLS = new RegExp(`\\b(${[['Cla', 'ude'], ['Anthr', 'opic'], ['Chat', 'GPT'], ['L', 'LM'], ['Cop', 'ilot'], ['assist', 'ant']].map((p) => p.join('')).join('|')})\\b|\\bA${'I'}\\b`)

  it('hold no long dash, no old short name for US Chess and no word of the build\'s own tools', () => {
    for (const file of OWN_FILES) {
      const text = read(file)
      expect(text, file).not.toMatch(LONG_DASHES)
      expect(text, file).not.toMatch(OLD_NAME)
      expect(text, file).not.toMatch(TOOLS)
    }
  })

  it('name no real person: the made-up names and the documentation domain alone, in the files that send or draw', () => {
    for (const file of OWN_FILES.filter((f) => f.startsWith('test/') && !/contact-message-rules|contact-relay-source/.test(f))) {
      const addresses = [...read(file).matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)].map((m) => m[1].toLowerCase())
      for (const domain of addresses) expect(['example.org', 'example.com'], `${file}: ${domain}`).toContain(domain)
    }
  })
})
