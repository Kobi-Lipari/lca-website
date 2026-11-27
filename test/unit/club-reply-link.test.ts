// test/unit/club-reply-link.test.ts
//
// The Reply through LCA link and its two emails (WS09, the twenty-seventh step), as plain
// code: the first lines the link carries and their cap, the longest link the
// step can make, measured, the link sealed under its own purpose for 30 days
// and refused with no key, the representative's and the admins' copies with
// the link and with none, and the answer the visitor gets, signed by the role
// alone. Every name, address and key here is made up.
import { describe, expect, it } from 'vitest'
import { CONTACT_LIMITS } from '../../domain/clubs/contactMessage'
import {
  RELAY_NO_LINK_LINE, RELAY_OWN_MAIL_LINE, RELAY_REPLY_LABEL, clubReplyEmail, relayCopyEmail, replySignOff,
} from '../../functions/utils/clubs/emails'
import { REPLY_EXCERPT_LENGTH, REPLY_PURPOSE, REPLY_TTL_SECONDS, firstLines, firstNameOf, openReplyLink, replyLink } from '../../functions/utils/clubs/reply'
import { MAX_TOKEN_LENGTH, openToken } from '../../functions/utils/tokens'

const KEY = 'example-made-up-signing-key-for-the-reply-unit-0027'
const SITE = 'https://www.louisianachess.org'
const VISITOR = { name: 'Player One', email: 'player.one@example.org', message: 'Hello. When do you meet on Saturdays?' }

describe('the first lines', () => {
  it('are the whole message when it is short, on one line', () => {
    expect(firstLines('  Hello.\n\nWhen do you meet?\t ')).toBe('Hello. When do you meet?')
  })

  it('are cut at a space before the cap, with an ellipsis, and never longer than the cap', () => {
    const long = `${'word '.repeat(60)}end`
    const cut = firstLines(long)
    expect(cut.length).toBeLessThanOrEqual(REPLY_EXCERPT_LENGTH)
    expect(cut.endsWith('word…')).toBe(true)
    // With no space to cut at, at the cap itself; a character of two code units is never cut in half.
    expect(firstLines('M'.repeat(400))).toBe(`${'M'.repeat(REPLY_EXCERPT_LENGTH - 1)}…`)
    const emoji = firstLines('♞'.repeat(10) + '\u{1F600}'.repeat(200))
    expect(emoji.length).toBeLessThanOrEqual(REPLY_EXCERPT_LENGTH)
    expect(emoji).not.toMatch(/[\uD800-\uDBFF]…$/)
  })

  it('a first name is the first word of the name given', () => {
    expect(firstNameOf('  Player   One ')).toBe('Player')
    expect(firstNameOf('Player')).toBe('Player')
  })
})

describe('the link', () => {
  it('is sealed under club_reply for 30 days, on the site\'s host, and opens to its claim', async () => {
    const now = new Date('2026-11-18T15:00:00Z')
    const link = await replyLink({ SIGNING_SECRET: KEY }, SITE, VISITOR, 'club-example', now)
    expect(link).toMatch(/^https:\/\/www\.louisianachess\.org\/clubs\/reply\/v1\.x\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    const token = decodeURIComponent(link!.split('/clubs/reply/')[1])
    expect(await openReplyLink({ SIGNING_SECRET: KEY }, token, now)).toEqual({
      ok: true, claim: { name: 'Player One', email: 'player.one@example.org', clubId: 'club-example', excerpt: VISITOR.message },
    })
    const header = JSON.parse(atob(token.split('.')[2].replace(/-/g, '+').replace(/_/g, '/')))
    expect(header).toEqual({ p: REPLY_PURPOSE, e: Math.floor(now.getTime() / 1000) + REPLY_TTL_SECONDS })
    expect(REPLY_TTL_SECONDS).toBe(30 * 24 * 60 * 60)
    // A second before the 30 days end it opens; at the end it is refused as any other link is.
    expect((await openReplyLink({ SIGNING_SECRET: KEY }, token, new Date(now.getTime() + (REPLY_TTL_SECONDS - 1) * 1000))).ok).toBe(true)
    expect(await openReplyLink({ SIGNING_SECRET: KEY }, token, new Date(now.getTime() + REPLY_TTL_SECONDS * 1000))).toEqual({ ok: false, reason: 'refused' })
    // A signing key being changed: a link made under the earlier one still opens.
    expect((await openReplyLink({ SIGNING_SECRET: 'example-the-next-made-up-signing-key-0027', SIGNING_SECRET_PREVIOUS: KEY }, token, now)).ok).toBe(true)
  })

  it('is not made with no key, an empty one or one too short, and none is opened', async () => {
    for (const secret of [undefined, '', 'too-short-a-key']) {
      expect(await replyLink({ SIGNING_SECRET: secret }, SITE, VISITOR, 'club-example')).toBeNull()
      expect(await openReplyLink({ SIGNING_SECRET: secret }, 'v1.x.a.b.c', new Date())).toEqual({ ok: false, reason: 'key_missing' })
    }
  })

  it('the longest link the step can make, measured, is well under the token\'s cap', async () => {
    // The longest of every field the contact form takes, in the characters that take the most room once sealed.
    const wide = '中'
    const widest = {
      name: wide.repeat(CONTACT_LIMITS.name),
      email: `${wide.repeat(CONTACT_LIMITS.email - 'x@example.org'.length)}x@example.org`,
      message: wide.repeat(CONTACT_LIMITS.message),
    }
    const clubId = 'c'.repeat(36)
    const longest = await replyLink({ SIGNING_SECRET: KEY }, SITE, widest, clubId)
    const plain = await replyLink({ SIGNING_SECRET: KEY }, SITE, {
      name: 'P'.repeat(CONTACT_LIMITS.name),
      email: `${'p'.repeat(CONTACT_LIMITS.email - '@example.org'.length)}@example.org`,
      message: 'M'.repeat(CONTACT_LIMITS.message),
    }, clubId)
    const usual = await replyLink({ SIGNING_SECRET: KEY }, SITE, VISITOR, clubId)
    expect(longest).not.toBeNull()
    expect(longest!.length).toBe(2240)
    expect(plain!.length).toBe(906)
    expect(usual!.length).toBe(310)
    expect(decodeURIComponent(longest!.split('/clubs/reply/')[1]).length).toBeLessThan(MAX_TOKEN_LENGTH)
  })

  it('opens nothing it was not made for: another purpose, another key, or a claim not its own', async () => {
    const link = await replyLink({ SIGNING_SECRET: KEY }, SITE, VISITOR, 'club-example')
    const token = decodeURIComponent(link!.split('/clubs/reply/')[1])
    expect(await openToken({ current: KEY }, 'club_confirm', token, new Date())).toEqual({ ok: false, reason: 'wrong_purpose' })
    expect(await openReplyLink({ SIGNING_SECRET: 'example-another-made-up-key-of-enough-length' }, token, new Date())).toEqual({ ok: false, reason: 'refused' })
  })
})

describe('the copies', () => {
  const base = { siteUrl: SITE, clubName: 'Example Chess Club', region: 'Example Region', reason: 'no_address' as const, visitor: VISITOR }

  it('a representative\'s and an admin\'s copy carry Reply through LCA in place of the address', () => {
    for (const kind of ['region', 'lca'] as const) {
      const mail = relayCopyEmail({ ...base, kind, replyUrl: `${SITE}/clubs/reply/v1.x.example` })
      expect(`${mail.subject}${mail.html}${mail.text}`).not.toContain(VISITOR.email)
      expect(mail.text).not.toContain('Their email')
      expect(mail.text).toContain(`${RELAY_REPLY_LABEL}: ${SITE}/clubs/reply/v1.x.example`)
      expect(mail.text).toContain(RELAY_OWN_MAIL_LINE)
      expect(mail.html).toContain(`href="${SITE}/clubs/reply/v1.x.example"`)
      expect(mail.text).toContain(`From: ${VISITOR.name}`)
    }
  })

  it('with no link, a copy says it cannot be answered from it, and carries the address nowhere', () => {
    for (const replyUrl of [null, undefined]) {
      const mail = relayCopyEmail({ ...base, kind: 'region', replyUrl })
      expect(mail.text).toContain(RELAY_NO_LINK_LINE)
      expect(`${mail.html}${mail.text}`).not.toMatch(/clubs\/reply|Reply through LCA</)
      expect(`${mail.subject}${mail.html}${mail.text}`).not.toContain(VISITOR.email)
    }
  })

  it('the club\'s own copy is as it was: the address in its body and no link, whatever it is handed', () => {
    const mail = relayCopyEmail({ ...base, kind: 'club', replyUrl: `${SITE}/clubs/reply/v1.x.example` })
    expect(mail.text).toContain(`Their email: ${VISITOR.email}`)
    expect(`${mail.html}${mail.text}`).not.toContain('/clubs/reply/')
    expect(mail.text).toContain('Reply to this email to answer them.')
  })
})

describe('the answer the visitor gets', () => {
  const data = {
    siteUrl: SITE, clubName: 'Example Chess Club', clubUrl: `${SITE}/clubs/example-chess-club`, firstName: 'Player',
    excerpt: VISITOR.message, answer: 'We meet on Saturdays at 10:00 AM.', signOff: 'LCA Example Region representative',
  }

  it('is signed by the role alone: the region\'s representative, or LCA for an admin', () => {
    expect(replySignOff({ kind: 'region', region: '  Example  Region ' })).toBe('LCA Example Region representative')
    expect(replySignOff({ kind: 'lca' })).toBe('Louisiana Chess Association')
  })

  it('has a fixed subject with the club\'s name, the first lines, the answer, the sign-off, and its last line names LCA\'s own address and the club\'s page', () => {
    const mail = clubReplyEmail(data)
    expect(mail.to).toBe('')
    expect(mail.subject).toBe('An answer to your message to Example Chess Club')
    expect(mail.text!.split('\n')).toEqual([
      'Hi Player,', '',
      'You wrote to Example Chess Club from the club\'s page on the Louisiana Chess Association website. Here is the answer.', '',
      'You wrote:', VISITOR.message, '',
      'Answer:', 'We meet on Saturdays at 10:00 AM.', '',
      'LCA Example Region representative', '',
      `This email comes from the Louisiana Chess Association's own address. To write to Example Chess Club again, use the club's page: ${SITE}/clubs/example-chess-club`,
    ])
    expect(mail.html).toContain(`<a href="${SITE}/clubs/example-chess-club" style="color:#1a2744;text-decoration:underline;">the club's page</a>`)
    // The layout's default line, which says a reply reaches us, is not used: the footer is the last line above.
    expect(mail.html).not.toContain('Just reply to this email')
  })

  it('escapes the answer and every stored word in the HTML, and writes them as text in the plain part', () => {
    const mail = clubReplyEmail({ ...data, clubName: '<b>Example</b> & Co', firstName: '<i>P</i>', answer: '<script>alert(1)</script> & </td>' })
    expect(mail.html).not.toMatch(/<script>|<b>Example|<i>P/)
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;/td&gt;')
    expect(mail.html).toContain('&lt;b&gt;Example&lt;/b&gt; &amp; Co')
    expect(mail.text).toContain('<script>alert(1)</script> & </td>')
  })
})
