// test/unit/club-check-email-buttons.test.ts
//
// The monthly check's email after checkpoint U's pictures (WS09 checkpoint
// V): in each club's box, Still accurate and Update are two buttons a thumb
// can press, in the same cell so each still reads with its club, with no dot
// between them. Their addresses, the box's other lines, the heading, the
// sentences and the whole text part stay exactly as they were: the text part
// is held here byte for byte against the base's own template, written out
// below as the base drew it. Every club, person and link here is made up.
import { describe, expect, it } from 'vitest'
import { NO_STATEMENT } from '../../domain/clubs/monthlyCheck'
import { LINK_LIFE, MONTHLY_CHECK_BY_HAND, MONTHLY_CHECK_TIMED, MONTHLY_CHECK_WHY, monthlyCheckEmail, oneLine, type CheckClub } from '../../functions/utils/clubs/emails'
import { formatDate } from '../../domain/format/date'

const at = (iso: string) => new Date(iso)
const LINKS_END = at('2027-01-06T14:00:00Z')

const ONE: CheckClub = {
  name: 'Example Chess Club', city: 'Example City', statement: 'Tuesdays at 7:00 PM.',
  confirmUrl: 'https://example.org/clubs/confirm/v1.s.a.b', updateUrl: 'https://example.org/workspace/region/clubs/example-chess-club',
}
const SEVERAL: CheckClub[] = [
  ONE,
  {
    name: 'Example <Knights> Club', city: 'Example Town', statement: null,
    confirmUrl: 'https://example.org/clubs/confirm/v1.s.c.d', updateUrl: 'https://example.org/workspace/region/clubs/example-knights-club',
  },
  {
    name: 'Example "Rooks" & Pawns', city: 'Example <b>Parish</b>', statement: 'Fridays <script>at</script> 6:00 PM & later.',
    confirmUrl: 'https://example.org/clubs/confirm/v1.s.e.f?x=1&y=2', updateUrl: 'https://example.org/workspace/region/clubs/example-rooks',
  },
]

/** The base's text part, as the base's monthlyCheckEmail wrote it, so the text part is held byte for byte. */
function baseText(data: { fullName: string; month: string; linksEnd: Date; clubs: readonly CheckClub[]; byHand?: boolean }): string {
  const first = oneLine(data.fullName).split(' ')[0] || 'there'
  const count = (n: number) => `${n} ${n === 1 ? 'club' : 'clubs'}`
  const ask = data.clubs.length === 1
    ? `Here is the club in your region, for ${data.month}. Press Still accurate if its listing is right, or Update to change it.`
    : `Here are the ${count(data.clubs.length)} in your region, for ${data.month}. For each one, press Still accurate if its listing is right, or Update to change it.`
  const life = `Still accurate works without logging in for 30 days, until ${formatDate(data.linksEnd, { year: true })}. Update opens the club in My region after you log in.`
  const why = `You get this because you are a regional representative. ${data.byHand ? 'An LCA admin sent this one by hand.' : 'It comes on the first Monday of each month at 8:00 AM.'}`
  return [
    `Hi ${first},`, '', ask, '',
    ...data.clubs.flatMap((club) => [
      oneLine(club.name), oneLine(club.city), club.statement ? oneLine(club.statement) : 'How the club meets is not listed yet.',
      `Still accurate: ${club.confirmUrl}`, `Update: ${club.updateUrl}`, '',
    ]),
    life, '', why,
  ].join('\n')
}

/** The two buttons of each club's box, in order, with their addresses (as the HTML writes them) and their styles. */
function buttonsOf(html: string): Array<{ label: string; href: string; style: string; holder: string }> {
  const found: Array<{ label: string; href: string; style: string; holder: string }> = []
  const re = /<div style="([^"]*)"><a href="([^"]*)" style="([^"]*)">([^<]*)<\/a><\/div>/g
  for (const m of html.matchAll(re)) found.push({ holder: m[1], href: m[2], style: m[3], label: m[4] })
  return found
}

const escaped = (url: string) => url.replace(/&/g, '&amp;')

/** The clubs' boxes alone, from the first box to the line on the links' life after the last; the shared layout around them is not this file's. */
const boxesOf = (html: string) => html.slice(html.indexOf('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;'), html.indexOf(LINK_LIFE))

/** A style's value for one property, or undefined. */
const prop = (style: string, name: string) => style.split(';').map((d) => d.split(':')).find(([k]) => k.trim() === name)?.slice(1).join(':').trim()

const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN')

describe('the monthly check\'s two buttons in each club\'s box', () => {
  const copies = [
    ['the timed copy, one club', monthlyCheckEmail({ siteUrl: 'https://example.org', fullName: 'Player One', month: 'December 2026', linksEnd: LINKS_END, clubs: [ONE] }), [ONE]],
    ['the timed copy, several clubs', monthlyCheckEmail({ siteUrl: 'https://example.org', fullName: 'Player One', month: 'December 2026', linksEnd: LINKS_END, clubs: SEVERAL }), SEVERAL],
    ['the by-hand copy, several clubs', monthlyCheckEmail({ siteUrl: 'https://example.org', fullName: 'Player Two', month: 'December 2026', linksEnd: LINKS_END, clubs: SEVERAL, byHand: true }), SEVERAL],
  ] as const

  it('each club\'s two buttons carry exactly the base\'s two addresses, Still accurate first, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail, clubs] of copies) {
      const buttons = buttonsOf(mail.html)
      expect(buttons.map((b) => [b.label, b.href])).toEqual(clubs.flatMap((club) => [['Still accurate', escaped(club.confirmUrl)], ['Update', escaped(club.updateUrl)]]))
    }
  })

  it('no dot between the two, and no small text link left, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail] of copies) {
      const boxes = boxesOf(mail.html)
      expect(boxes.length).toBeGreaterThan(0)
      expect(boxes).not.toContain('&middot;')
      expect(boxes).not.toContain(String.fromCharCode(0xb7))
      expect(boxes).not.toContain('text-decoration:underline;')
    }
  })

  it('each button is at least 44px tall by its padding, line height and edge, and the two stand 8px apart, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail] of copies) {
      for (const button of buttonsOf(mail.html)) {
        expect(prop(button.style, 'display')).toBe('inline-block')
        const [vertical] = (prop(button.style, 'padding') ?? '').split(' ')
        const edge = px(prop(button.style, 'border')?.split(' ')[0])
        const height = px(vertical) * 2 + px(prop(button.style, 'line-height')) + edge * 2
        expect(height, button.label).toBeGreaterThanOrEqual(44)
        // The holder's margin: 8px above, so a wrapped second button stands 8px under the first, and 8px to the right.
        expect(prop(button.holder, 'display')).toBe('inline-block')
        const [top, right] = (prop(button.holder, 'margin') ?? '').split(' ').map(px)
        expect(top, button.label).toBeGreaterThanOrEqual(8)
        expect(right, button.label).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('Still accurate wears the site\'s email button look, and Update is quiet with navy words and a navy line, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail] of copies) {
      for (const button of buttonsOf(mail.html)) {
        expect(prop(button.style, 'color')).toBe('#1a2744')
        expect(prop(button.style, 'font-weight')).toBe('bold')
        expect(prop(button.style, 'font-size')).toBe('15px')
        expect(prop(button.style, 'font-family')).toBe('Arial,Helvetica,sans-serif')
        expect(prop(button.style, 'border-radius')).toBe('8px')
        expect(prop(button.style, 'text-decoration')).toBe('none')
        if (button.label === 'Still accurate') {
          expect(prop(button.style, 'background')).toBe('#c8a94a')
        } else {
          expect(prop(button.style, 'background')).toBe('#ffffff')
          expect(prop(button.style, 'border')).toBe('2px solid #1a2744')
        }
      }
      // Never gold words on a light ground.
      expect(boxesOf(mail.html)).not.toMatch(/(^|[;"\s])color:#c8a94a/i)
    }
  })

  it('inline styles only, no script, no web font, and no media query the buttons depend on, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail] of copies) {
      expect(mail.html).not.toMatch(/<script/i)
      expect(mail.html).not.toMatch(/@font-face|fonts\.googleapis/i)
      expect(boxesOf(mail.html)).not.toMatch(/\bclass="|@media/)
    }
  })

  it('with the styles dropped, the two are two plain links in blocks of their own, never run together, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail] of copies) {
      const bare = mail.html.replace(/ style="[^"]*"/g, '')
      expect(bare).toMatch(/<div><a href="[^"]*">Still accurate<\/a><\/div>\s+<div><a href="[^"]*">Update<\/a><\/div>/)
      expect(bare).not.toMatch(/<\/a>\s*<a /)
    }
  })

  it('the text part is byte for byte the base\'s, in the timed copy for one club and for several and in the by-hand copy', () => {
    for (const [, mail, clubs] of copies) {
      const byHand = mail.text!.includes(MONTHLY_CHECK_BY_HAND)
      expect(mail.text).toBe(baseText({ fullName: byHand ? 'Player Two' : 'Player One', month: 'December 2026', linksEnd: LINKS_END, clubs, byHand }))
    }
  })

  it('a name, a town or a statement that carries markup is still escaped, and the box\'s other lines are the base\'s', () => {
    const mail = copies[1][1]
    expect(mail.html).toContain('Example &lt;Knights&gt; Club')
    expect(mail.html).toContain('Example &quot;Rooks&quot; &amp; Pawns')
    expect(mail.html).toContain('Example &lt;b&gt;Parish&lt;/b&gt;')
    expect(mail.html).toContain('Fridays &lt;script&gt;at&lt;/script&gt; 6:00 PM &amp; later.')
    expect(mail.html).not.toMatch(/<Knights>|<b>Parish|<script>at/)
    expect(mail.html).toContain(`<div style="margin-top:8px;font-size:14px;line-height:1.5;">${NO_STATEMENT}</div>`)
    expect(mail.html).toContain('<div style="font-size:16px;font-weight:bold;color:#1a2744;">Example Chess Club</div>')
    expect(mail.html).toContain('<div style="font-size:14px;">Example City</div>')
    expect(mail.html).toContain('<div style="margin-top:8px;font-size:14px;line-height:1.5;">Tuesdays at 7:00 PM.</div>')
    for (const words of [`${LINK_LIFE}, until Wed, Jan 6, 2027.`, `${MONTHLY_CHECK_WHY} ${MONTHLY_CHECK_TIMED}`]) expect(mail.html).toContain(words)
  })

  it('the sentence for no meeting words is the one the base wrote', () => {
    expect(NO_STATEMENT).toBe('How the club meets is not listed yet.')
  })
})
