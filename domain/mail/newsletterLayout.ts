// domain/mail/newsletterLayout.ts
//
// The LCA newsletter's email in the navy look the LCA president picked,
// board Newsletter-Email-6, "The navy band, with In this issue" (K's
// decision 53), written once for the server that sends it and the page that
// previews it (WS16 part two, page step 2). Pure: the same email for the
// same input on every call, with no clock, no random value and nothing read
// from outside its arguments, and no import from outside domain/. Nothing
// imports it yet: the send (page step 6) and the page's side preview (page
// step 4) are its first callers. Today's layout, functions/utils/emailLayout.ts,
// is not changed, so no other email moves.
//
// What it trusts, and does not clean again:
// - bodyHtml is a letter in the cleaner's own form (cleanLetterHtml in
//   functions/utils/mail/letterClean.ts). The letter's saving (page step 3)
//   cleans it before it is stored, and the send (page step 6) hands on a
//   stored letter only.
// - footerHtml is the footer builder's own (listMailParts in
//   functions/utils/mail/footer.ts), set in as given, not one byte changed.
// month, subject and preheader are plain text, escaped here for text and for
// an attribute, and siteUrl is escaped where the rook's address holds it.
//
// The email, in its reading order:
// - the inbox preview line, when one is given, hidden;
// - the band, navy, with the rook, "LCA Newsletter" and the month under it,
//   the email's one h1, over a thin gold rule;
// - the "In this issue" strip on cream: a link to each part's named anchor,
//   down the first column and then the second, left out when the letter has
//   fewer than two parts;
// - the letter, serif words on white, each part's heading in sans under a
//   short rule;
// - the footer on cream: the builder's footer, then the newsletter's follow
//   line from domain/mail/footer.ts, and nothing after it. No postal address
//   and no slot for one (K's decision 23). The line today's layout writes
//   under every email, the association's name with the site's, is not drawn:
//   the band names LCA.
//
// How it is built: tables, each with role="presentation", 600 pixels wide at
// most. Outlook on Windows draws with Word and reads no largest width, so
// for that program alone the email sits in one more table, 600 pixels wide,
// written inside two comments only it reads; every other mail app draws
// nothing for them. Every colour, size and space a part needs is written
// inline on it, so the email reads right in light where a mail app drops
// the head's one style block, which holds only the dark colours and the
// narrow-screen rules. The letter's running words take their type and ink
// from the cell around them, and only the tags that need a style of their
// own get one, by an exact rewrite of the cleaner's tag forms that changes
// no word: each heading, a part's with its rule above it, each link and
// each line. Paragraphs and lists keep their bare tags and the mail app's
// own spacing, so what the layout adds to a letter grows with its headings
// and links alone.

import { NEWSLETTER_FOLLOW_LINE } from './footer'
import { letterParts, withAnchors, type LetterPart } from './letter'

/**
 * The most an email's HTML may hold, in UTF-8 bytes. Gmail cuts an email past about 102,000 bytes, and what follows
 * the cut, the footer's links among it, is then out of reach. Page step 6 holds a rendered email to it and refuses one
 * over it in words.
 */
export const EMAIL_MAX_BYTES = 102000

/** What the navy email is made of. */
export interface NewsletterEmail {
  /** The site's address with no trailing slash, as resolveSiteUrl gives it: the rook is loaded from it. */
  siteUrl: string
  /** The month as the band writes it, "December 2026". Plain text. */
  month: string
  /** The email's subject, its title. Plain text. */
  subject: string
  /** The inbox preview line, hidden in the email itself; nothing is written for an empty or missing one. Plain text. */
  preheader?: string
  /** The letter, in the cleaner's own form. */
  bodyHtml: string
  /** The footer listMailParts builds for the person the email goes to. */
  footerHtml: string
}

// The board's colours. In light the bright gold is text on the navy alone;
// on a light ground the gold is a rule, never words, and the strip's label
// is the dark bronze K and the president approved. In dark the strip's
// label takes the gold on the strip's dark ground, as the site's own dark
// setting draws its gold words.
const NAVY = '#1a2744'
const GOLD = '#c8a94a'
const GOLD_ON_NAVY = '#efd98a'
const BRONZE = '#866a1e'
const CREAM = '#f8f4e8'
const CREAM_EDGE = '#ebe3c9'
const PAPER = '#ffffff'
const WHITE = '#ffffff'
const PAGE = '#f1efe8'
const PAGE_EDGE = '#e8e5da'
const INK = '#1f2a40'
/** The footer's ink, as the footer builder writes it on its own lines. */
const FOOTER_INK = '#3a3f4b'
// The dark setting's, from the board's phone in the dark.
const DARK_PAGE = '#151719'
const DARK_PANEL = '#202328'
const DARK_EDGE = '#2b2e33'
const DARK_INK = '#e4e5e8'
const DARK_FOOTER_INK = '#c4c7ce'
const DARK_LINK = '#c9d7f5'

const SANS = 'Arial,Helvetica,sans-serif'
const SERIF = 'Georgia,serif'

/** Every link: navy and underlined, so none is told by its colour alone. */
const LINK = `color:${NAVY};text-decoration:underline;`

/** The short rule above a part's heading: decoration, drawn as an empty block, never words. */
const RULE_SHAPE = `width:32px;height:3px;background-color:${BRONZE};`
const RULE = `<div style="${RULE_SHAPE}margin:34px 0 12px;"></div>`
/** The rule of a part that opens the letter: the letter's cell already holds the space above it. */
const FIRST_RULE = `<div class="nl-first" style="${RULE_SHAPE}margin:16px 0 12px;"></div>`
const H2 = `<h2 style="margin:0 0 10px;font-family:${SANS};font-size:20px;line-height:1.25;font-weight:700;color:${NAVY};">`
const H3 = `<h3 style="margin:24px 0 8px;font-family:${SANS};font-size:17px;line-height:1.3;font-weight:700;color:${NAVY};">`
const HR = `<hr style="margin:24px 0;border:0;border-top:1px solid ${CREAM_EDGE};">`

/**
 * For Outlook on Windows alone: a table 600 pixels wide round the email, since that program reads no largest width and
 * would draw the email across its whole reading pane. Every other mail app reads these two as comments.
 */
const OUTLOOK_OPEN = '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->'
const OUTLOOK_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->'

/** Hidden in the usual way for mail: no size, no height, and hidden from Outlook too. */
const PREHEADER = 'display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;'

/**
 * The one style block: only what inline styles cannot say. First the dark colours, each over an inline one, so each
 * is important; the footer builder's own ink is among them, since its navy and grey would not read on the dark
 * footer. Then the narrow-screen rules: the board's phone sizes, each link of the strip 44 pixels tall, and one
 * column under 340 pixels.
 */
const STYLE = [
  '@media (prefers-color-scheme: dark) {',
  `.nl-page{background-color:${DARK_PAGE} !important}`,
  `.nl-card{background-color:${DARK_PAGE} !important;border-color:${DARK_EDGE} !important}`,
  `.nl-toc{background-color:${DARK_PANEL} !important;border-bottom-color:${DARK_EDGE} !important}`,
  `.nl-toc p{color:${GOLD} !important}`,
  `.nl-toc a,.nl-letter a,.nl-foot a{color:${DARK_LINK} !important}`,
  `.nl-letter{background-color:${DARK_PAGE} !important;color:${DARK_INK} !important}`,
  `.nl-letter h2,.nl-letter h3,.nl-letter strong{color:${WHITE} !important}`,
  `.nl-letter div{background-color:${GOLD} !important}`,
  `.nl-letter hr{border-top-color:${DARK_EDGE} !important}`,
  `.nl-foot{background-color:${DARK_PANEL} !important;border-top:3px solid ${GOLD} !important;color:${DARK_FOOTER_INK} !important}`,
  `.nl-foot p{color:${DARK_FOOTER_INK} !important}`,
  '}',
  '@media (max-width: 480px) {',
  '.nl-outer{padding:0 !important}',
  '.nl-card{border:0 !important}',
  '.nl-band{padding:18px 20px !important}',
  '.nl-rook{padding-right:13px !important}',
  '.nl-rook img{width:38px !important;height:38px !important}',
  '.nl-band h1{font-size:27px !important;letter-spacing:-.01em !important}',
  '.nl-band span{margin-bottom:7px !important;font-size:15px !important}',
  '.nl-toc{padding:16px 20px 6px !important}',
  '.nl-toc p{margin-bottom:2px !important}',
  '.nl-col{width:auto !important}',
  '.nl-toc ul{font-size:15px !important;line-height:22px !important}',
  '.nl-toc li{margin:0 !important}',
  '.nl-toc a{display:inline-block !important;padding:11px 0 !important}',
  '.nl-letter{padding:8px 20px 0 !important}',
  '.nl-letter div{width:28px !important;margin:26px 0 10px !important}',
  '.nl-letter .nl-first{margin-top:16px !important}',
  '.nl-letter h2{margin-bottom:8px !important;font-size:19px !important}',
  '.nl-foot{padding:20px !important}',
  '}',
  '@media (max-width: 339px) {',
  '.nl-col{display:block !important;padding:0 !important}',
  '}',
].join('\n')

/** Plain text made safe for HTML words and for a quoted attribute: the ampersand, both angle brackets and both quote marks. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** The band: the rook, then the one h1, "LCA Newsletter" in ordinary letters set in capitals by a style, the month under it. */
function band(site: string, month: string): string {
  return [
    `<tr><td class="nl-band" style="padding:24px 36px 23px;background-color:${NAVY};border-bottom:3px solid ${GOLD};">`,
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>',
    `<td class="nl-rook" valign="middle" style="padding-right:18px;"><img src="${site}/email-rook.png" width="52" height="52" alt="" style="display:block;border:0;"></td>`,
    // The line break ends the name's line where a mail app does not set the name as a block; where it does, it adds nothing.
    `<td valign="middle"><h1 style="margin:0;font-family:${SANS};font-size:36px;line-height:1;font-weight:700;letter-spacing:-.015em;color:${WHITE};">` +
      `<span style="display:block;margin-bottom:9px;font-size:17px;letter-spacing:.08em;text-transform:uppercase;color:${GOLD_ON_NAVY};">LCA Newsletter<br></span> ${escape(month)}</h1></td>`,
    '</tr></table>',
    '</td></tr>',
  ].join('\n')
}

/** One line of the strip: a link to the part's named anchor, in the part's own words. */
function stripLine(part: LetterPart): string {
  return `<li style="margin:0 0 6px;"><a href="#${escape(part.name)}" style="${LINK}">${escape(part.title)}</a></li>`
}

/** One column of the strip. */
function stripColumn(parts: readonly LetterPart[], gap: string): string {
  const list = `<ul style="margin:0;padding:0;list-style-type:none;font-size:16px;line-height:1.5;">${parts.map(stripLine).join('')}</ul>`
  return `<td class="nl-col" width="50%" valign="top" style="${gap}">${list}</td>`
}

/**
 * The "In this issue" strip, or nothing for a letter of fewer than two parts. The board's two columns run down the
 * first and then the second, so the first holds the first half of the parts, rounded up, and the source order is the
 * reading order.
 */
function strip(parts: readonly LetterPart[]): string {
  if (parts.length < 2) return ''
  const half = Math.ceil(parts.length / 2)
  return [
    `<tr><td class="nl-toc" style="padding:20px 36px 16px;background-color:${CREAM};border-bottom:1px solid ${CREAM_EDGE};font-family:${SANS};">`,
    `<p style="margin:0 0 10px;font-size:13px;line-height:1.2;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRONZE};">In this issue</p>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>',
    stripColumn(parts.slice(0, half), 'padding-right:16px;'),
    stripColumn(parts.slice(half), 'padding-left:16px;'),
    '</tr></table>',
    '</td></tr>',
  ].join('\n') + '\n'
}

/**
 * The letter, its anchors in place, with an inline style on each tag that needs one of its own, by an exact rewrite of
 * the cleaner's tag forms: a part's <h2>, the one withAnchors wrote an anchor before, gains its rule between the anchor
 * and the heading, and every <h2>, <h3>, <hr> and <a href="..."> gains its style. A heading with no words is no part:
 * the strip leaves it out and withAnchors gives it no anchor, so it gets no rule. Every other byte stays: the words, the
 * other tags, and each anchor, written back as withAnchors wrote it, still just before its part, now before its rule.
 */
function styledLetter(anchored: string): string {
  const tags = /(<a name="[a-z0-9-]+"><\/a>)?<h2>|<h3>|<hr>|<a href="([^"]*)">/g
  return anchored.replace(tags, (tag: string, anchor: string | undefined, href: string | undefined, at: number) => {
    if (tag.endsWith('<h2>')) return anchor === undefined ? H2 : `${anchor}${at === 0 ? FIRST_RULE : RULE}${H2}`
    if (tag === '<h3>') return H3
    if (tag === '<hr>') return HR
    return `<a href="${href}" style="${LINK}">`
  })
}

/** The whole email in the navy look, as its HTML. */
export function renderNewsletter(email: NewsletterEmail): string {
  const site = escape(email.siteUrl.replace(/\/+$/, ''))
  const parts = letterParts(email.bodyHtml)
  const letter = styledLetter(withAnchors(email.bodyHtml, parts))
  const follow = NEWSLETTER_FOLLOW_LINE
  const preheader = email.preheader ? `<div style="${PREHEADER}">${escape(email.preheader)}</div>\n` : ''
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="supported-color-schemes" content="light dark">',
    `<title>${escape(email.subject)}</title>`,
    `<style>\n${STYLE}\n</style>`,
    '</head>',
    `<body class="nl-page" style="margin:0;padding:0;background-color:${PAGE};">`,
    `${preheader}<table role="presentation" class="nl-page" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE};">`,
    '<tr><td class="nl-outer" align="center" style="padding:32px 12px 36px;">',
    OUTLOOK_OPEN,
    `<table role="presentation" class="nl-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${PAPER};border:1px solid ${PAGE_EDGE};">`,
    band(site, email.month),
    `${strip(parts)}<tr><td class="nl-letter" style="padding:18px 36px 14px;background-color:${PAPER};font-family:${SERIF};font-size:16px;line-height:1.7;color:${INK};">${letter}</td></tr>`,
    `<tr><td class="nl-foot" style="padding:24px 36px 26px;background-color:${CREAM};border-top:1px solid ${CREAM_EDGE};font-family:${SANS};line-height:1.55;color:${FOOTER_INK};">${email.footerHtml}`,
    `<p style="margin:0;font-size:12px;"><a href="${escape(follow.url)}" style="${LINK}">${escape(follow.label)}</a></p></td></tr>`,
    '</table>',
    OUTLOOK_CLOSE,
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n')
}
