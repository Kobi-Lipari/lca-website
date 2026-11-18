// The rules of a message sent to a club from its page (domain/clubs/contactMessage.ts
// and the request contract that reads them, domain/contracts/clubContact.ts), at their
// edges: the caps to the character, a name or an address with a line break or another
// control character, one plain address and what is not one, the three lines that say
// where a message goes (never a volunteer's name, never an address), and the two words
// a visitor is told. Every name and address is made up.
import { describe, expect, it } from 'vitest'
import {
  CONTACT_FIELD_WORDS, CONTACT_GOES_TO, CONTACT_LIMITS, CONTACT_NOT_SENT, CONTACT_SENT,
  contactFieldError, contactGoesLine, hasLineBreak, hasText, isPlainAddress,
} from '../../domain/clubs/contactMessage'
import { clubContactRequestSchema, clubContactResponseSchema } from '../../domain/contracts/clubContact'

const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const at = (total: number) => `${'p'.repeat(total - '@example.org'.length)}@example.org`

describe('the caps', () => {
  it('are 100, 254 and 5,000, and each field takes exactly its cap and refuses one more', () => {
    expect(CONTACT_LIMITS).toEqual({ name: 100, email: 254, message: 5000 })
    expect(contactFieldError('name', 'P'.repeat(100))).toBeNull()
    expect(contactFieldError('name', 'P'.repeat(101))).toBe(CONTACT_FIELD_WORDS.nameLong)
    expect(contactFieldError('email', at(254))).toBeNull()
    expect(contactFieldError('email', at(255))).toBe(CONTACT_FIELD_WORDS.emailLong)
    expect(contactFieldError('message', 'M'.repeat(5000))).toBeNull()
    expect(contactFieldError('message', 'M'.repeat(5001))).toBe(CONTACT_FIELD_WORDS.messageLong)
    expect(CONTACT_FIELD_WORDS.messageLong).toBe('Your message can be at most 5,000 characters.')
  })
})

describe('a name', () => {
  it('may be any person\'s, in any script, and nothing but spaces is no name', () => {
    for (const name of ['Player One', 'José Núñez', '李雷', 'Mary-Jane O\'Neil', 'P.', '  Player One  ']) expect(contactFieldError('name', name), name).toBeNull()
    for (const name of ['', ' ', '   ', ' ']) expect(contactFieldError('name', name), JSON.stringify(name)).toBe(CONTACT_FIELD_WORDS.nameMissing)
  })

  it('is refused with a line break or another control character, whichever kind', () => {
    const breaks = ['\n', '\r', '\r\n', '\t', '\u0000', '\u0085', ' ', ' ', '\u001b']
    for (const b of breaks) {
      expect(contactFieldError('name', `Player${b}One`), JSON.stringify(b)).toBe(CONTACT_FIELD_WORDS.nameBreak)
      expect(hasLineBreak(`Player${b}One`)).toBe(true)
    }
    expect(hasLineBreak('Player One')).toBe(false)
  })
})

describe('an address', () => {
  it('is one plain address: the forms mail servers take', () => {
    for (const address of ['p@example.org', 'first.last@example.org', 'first.last+club@example.org', 'player_one-1@example.org', `o'brien@example.org`, '  player@example.org  ']) {
      expect(isPlainAddress(address.trim()), address).toBe(true)
      expect(contactFieldError('email', address), address).toBeNull()
    }
  })

  it('is refused when it is two addresses, a name with an address, quoted, in brackets or broken by a line break', () => {
    const bad = [
      'player@example', 'player.example.org', '@example.org', 'player@', 'player@@example.org', 'pla yer@example.org',
      'a@example.org, b@example.org', 'a@example.org; b@example.org', 'a@example.org b@example.org',
      'Player One <player@example.org>', '<player@example.org>', '"player"@example.org', '(Player)player@example.org',
      'player@[192.0.2.1]', 'player@example.org\nBcc: hidden@example.org', 'player\n@example.org', 'player@exa\\mple.org',
    ]
    for (const address of bad) {
      expect(isPlainAddress(address), JSON.stringify(address)).toBe(false)
      expect(contactFieldError('email', address), JSON.stringify(address)).toBe(address.trim() === '' ? CONTACT_FIELD_WORDS.emailMissing : CONTACT_FIELD_WORDS.emailForm)
    }
    for (const address of ['', '   ']) expect(contactFieldError('email', address)).toBe(CONTACT_FIELD_WORDS.emailMissing)
  })
})

describe('a message', () => {
  it('may run over many lines and hold any markup as text; nothing but spaces is no message', () => {
    for (const message of ['Hello', 'Line one\nLine two\r\nLine three', '<b>Hello</b> & <script>x</script>', 'A\tB', 'Bcc: hidden@example.org']) {
      expect(contactFieldError('message', message), message).toBeNull()
    }
    for (const message of ['', ' ', '\n\n', '\t']) expect(contactFieldError('message', message), JSON.stringify(message)).toBe(CONTACT_FIELD_WORDS.messageMissing)
    expect(hasText('  x ')).toBe(true)
    expect(hasText(' \n ')).toBe(false)
  })
})

describe('the request contract', () => {
  const good = { name: 'Player One', email: 'player.one@example.org', message: 'Hello.', token: 'example-token' }

  it('takes the three fields and a token, drops any other key, and asks no token of the schema itself', () => {
    expect(clubContactRequestSchema.parse({ ...good, to: 'x@example.org', cc: 'y@example.org', subject: 'Hello', replyTo: 'z@example.org' })).toEqual(good)
    const { token, ...noToken } = good
    expect(token).toBeTruthy()
    expect(clubContactRequestSchema.parse(noToken)).toEqual(noToken)
    expect(clubContactRequestSchema.safeParse({ ...good, token: 7 }).success).toBe(false)
  })

  it('refuses a line break after an address too, which trimming alone would hide', () => {
    for (const email of ['player@example.org\r', 'player@example.org\n', 'player@example.org\r\nBcc: hidden@example.org']) {
      expect(clubContactRequestSchema.safeParse({ ...good, email }).success, JSON.stringify(email)).toBe(false)
    }
  })

  it('refuses each field with the words the form uses beside it', () => {
    const words = (over: Record<string, unknown>) => {
      const result = clubContactRequestSchema.safeParse({ ...good, ...over })
      return result.success ? null : result.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`)
    }
    expect(words({ name: '' })).toEqual([`name: ${CONTACT_FIELD_WORDS.nameMissing}`])
    expect(words({ name: 'A\nB' })).toEqual([`name: ${CONTACT_FIELD_WORDS.nameBreak}`])
    expect(words({ email: 'p@example.org\nBcc: other@example.org' })).toEqual([`email: ${CONTACT_FIELD_WORDS.emailForm}`])
    expect(words({ message: '' })).toEqual([`message: ${CONTACT_FIELD_WORDS.messageMissing}`])
    expect(words({ name: undefined })).toEqual([`name: ${CONTACT_FIELD_WORDS.nameMissing}`])
    expect(words({ email: null })).toEqual([`email: ${CONTACT_FIELD_WORDS.emailMissing}`])
  })

  it('answers the strict { sent: true } and nothing wider', () => {
    expect(clubContactResponseSchema.safeParse({ sent: true }).success).toBe(true)
    for (const wider of [{ sent: true, to: 'a@example.org' }, { sent: true, keeper: 'club' }, { sent: false }, {}, { sent: 'true' }]) {
      expect(clubContactResponseSchema.safeParse(wider).success, JSON.stringify(wider)).toBe(false)
    }
  })
})

describe('where the message goes, said before it is sent', () => {
  it('is a closed list of three words', () => {
    expect([...CONTACT_GOES_TO]).toEqual(['club', 'region', 'lca'])
  })

  it('says the club, the region\'s representative or LCA in one plain sentence each, with no address and no volunteer\'s name', () => {
    const lines = [
      contactGoesLine('club', 'Example Region'),
      contactGoesLine('club', null),
      contactGoesLine('region', 'Example Region'),
      contactGoesLine('region', '  Example Region  '),
      contactGoesLine('region', null),
      contactGoesLine('region', '   '),
      contactGoesLine('lca', 'Example Region'),
      contactGoesLine('lca', null),
    ]
    for (const line of lines) {
      expect(line).toMatch(/\.$/)
      expect(line).not.toMatch(/@|mailto/)
      expect(line).not.toMatch(LONG_DASHES)
      expect(line).not.toMatch(/Example Rep|Example Admin/)
      expect(line.split('.').filter(Boolean).length).toBeLessThanOrEqual(2)
    }
    expect(lines[0]).toBe(lines[1])
    expect(lines[2]).toBe('No club address on file, so your message goes to the Example Region representative by email.')
    expect(lines[3]).toBe(lines[2])
    expect(lines[4]).toBe(lines[5])
    expect(lines[4]).not.toContain('null')
    expect(lines[6]).toBe(lines[7])
    expect(lines[6]).not.toContain('Example Region')
    expect(new Set([lines[0], lines[2], lines[4], lines[6]]).size).toBe(4)
  })

  it('names the club\'s own contact nowhere: the line is the same whatever the club chose to show', () => {
    expect(contactGoesLine('club', 'Example Region')).not.toMatch(/\bP\.|Contact P/)
  })
})

describe('what the visitor is told', () => {
  it('is "Sent." and "We couldn\'t send this. Try again later." in plain words, with no keeper and no address', () => {
    expect(CONTACT_SENT).toBe('Sent.')
    expect(CONTACT_NOT_SENT).toBe('We couldn\'t send this. Try again later.')
    for (const words of [CONTACT_SENT, CONTACT_NOT_SENT, ...Object.values(CONTACT_FIELD_WORDS)]) {
      expect(words).not.toMatch(LONG_DASHES)
      expect(words).not.toMatch(/@(?!example)/)
      expect(words).not.toMatch(/representative|admin|keeper/i)
    }
  })
})
