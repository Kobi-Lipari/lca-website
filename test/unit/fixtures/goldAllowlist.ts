// test/unit/fixtures/goldAllowlist.ts
//
// The allowlist of the gold text guard, test/unit/goldText.test.ts (WS01 step
// 25), which scripts/codemods/gold-ink.ts reads as well, so the script and
// the guard never disagree.
//
// Brand gold #c8a94a is 2.28:1 on white, so it is text only on navy (6.51:1)
// or another ground that stays dark in every look. The guard and the script
// read the ground of each gold text class from the JSX: the element the
// class sits on and its ancestors, and the places its component is drawn. An
// entry here is a person's decision about a use that reading cannot settle,
// such as a class in an object of strings that the page looks up by a value
// known only when it runs. Each entry gives the file, the class as written,
// how many uses it allows and why the ground is navy. A use the reading can
// place needs no entry, and an entry for one fails, so the list holds only
// what a person had to decide.
//
// GOLD_BADGE_ALLOWLIST does the same for the gold tokens of one kind of
// ground, which the guard places with the same reading: the dark gold words
// of badges (text-gold-ink-badge and text-gold-ink-badge-club, #705718 in
// the light looks, about 2.2:1 on navy) never on navy, and the light gold of
// a pill (text-gold-on-dark-badge, #f0d07a, about 1.5:1 on white) never on a
// light ground. Most of these are tags in an object of strings that a row
// looks up by a status, so an entry names the code in the className that
// reads the string (meta.className, say), and the guard places every element
// whose className holds that code on the entry's ground; when one moves, the
// entry fails. An entry with no such code is a person's decision about the
// ground itself, with the ratio the use reads there.
//
// WS02_GOLD holds the brief's three gold colours for the new header, its
// phone sheet and the phone tab bar (section 1 and WS01's scope-aware guard):
// #705718 as the About menu's "You are here" label, #866a1e as text at 13px
// or more on the sheet's #fbfaf6 row, and #866a1e as the current tab's top
// bar. The About menu (WS02 step 5) and the sheet (WS02 step 6) are built,
// and each entry matches its one use, in its context; the tab bar is not
// built yet (WS02 step 7), so its entry matches nothing. The guard says so,
// and fails when a use does not keep to its context.

export interface GoldAllowEntry {
  /** The TSX file, relative to the repository root. */
  file: string
  /** The class as written, its variants and modifier included: 'text-lca-gold'. */
  class: string
  /** How many uses in the file the entry allows. */
  count: number
  /** The ground under the gold: always navy, since brand gold is never text on a light ground. */
  ground: 'navy'
  reason: string
}

export const GOLD_ALLOWLIST: GoldAllowEntry[] = [
  {
    file: 'src/components/StatusBadge.tsx',
    class: 'text-lca-gold',
    count: 1,
    ground: 'navy',
    reason:
      'The words of StatusBadge\'s gold tone on its navy surface (TONE_CLASSES.navy, the surface the on prop gives by default), on a 20 per cent gold tint. No caller draws the navy surface today (each passes on="light"); one that does puts it on navy, which stays #1a2744 in every look, and the guard checks that each place StatusBadge is drawn passes the on its ground needs. The class sits in an object of strings looked up by two props, which no reading of the JSX can follow to a ground.',
  },
  {
    file: 'src/pages/TournamentDetailPage.tsx',
    class: 'text-lca-gold',
    count: 1,
    ground: 'navy',
    reason:
      'The words of the Upcoming tag in statusConfig, drawn among the title\'s badges in the tournament page\'s navy hero (bg-brand-navy), on a 20 per cent gold tint. The page looks the tag up by the event\'s status into a constant of its own, which no reading of the JSX can follow to a ground.',
  },
]

/** A badge's or a pill's gold that the reading cannot place, and the ground a person found under it. */
export interface GoldBadgeEntry {
  /** The TSX file, relative to the repository root. */
  file: string
  /** The class as written: 'text-gold-ink-badge'. */
  class: string
  /** How many uses in the file the entry allows. */
  count: number
  /** light for a badge's dark gold words, dark for a pill's light gold. */
  ground: 'light' | 'dark'
  /** The code in a className of the file that reads the string, such as meta.className: every element whose className holds it must sit on the entry's ground. */
  readBy?: string
  reason: string
}

export const GOLD_BADGE_ALLOWLIST: GoldBadgeEntry[] = [
  {
    file: 'src/areas/admin/components/AuditLogPanel.tsx',
    class: 'text-gold-ink-badge',
    count: 6,
    ground: 'light',
    readBy: 'meta.className',
    reason:
      'The words of six actions\' tags in ACTION_META (a membership override, a changed pairing, a withdrawn and a reinstated player, a changed payment status and a members export), each on a 20 per cent gold tint, drawn in the audit log\'s rows on its card. Each row looks its tag up by the entry\'s action, which no reading of the JSX can follow to a ground.',
  },
  {
    file: 'src/areas/admin/components/TournamentList.tsx',
    class: 'text-gold-ink-badge',
    count: 1,
    ground: 'light',
    readBy: 'sc.className',
    reason:
      'The words of the Upcoming tag in STATUS, on a 15 per cent gold tint, drawn in the admin list of tournaments on each row\'s card. The row looks the tag up by the tournament\'s status, which no reading of the JSX can follow to a ground.',
  },
  {
    file: 'src/components/StatusBadge.tsx',
    class: 'text-gold-ink-badge',
    count: 1,
    ground: 'light',
    readBy: 'TONE_CLASSES[on][tone]',
    reason:
      'The words of StatusBadge\'s gold tone on its light surface (TONE_CLASSES.light), on a 20 per cent gold tint. Every caller passes on="light" from a light ground, which the guard checks at each place StatusBadge is drawn; the class sits in an object of strings looked up by two props, which no reading of the JSX can follow to a ground.',
  },
  {
    file: 'src/pages/AdminEmailPage.tsx',
    class: 'text-gold-ink-badge',
    count: 1,
    ground: 'light',
    readBy: 'meta.className',
    reason:
      'The words of the Sending tag in STATUS_META, on a 15 per cent gold tint, drawn in a campaign\'s row on its card. The row looks the tag up by the campaign\'s status, which no reading of the JSX can follow to a ground.',
  },
  {
    file: 'src/pages/ClubDetailPage.tsx',
    class: 'text-gold-ink-badge-club',
    count: 1,
    ground: 'light',
    readBy: 'badge.className',
    reason:
      'The words of the Upcoming badge in statusBadge, on a 15 per cent gold tint, drawn by TournamentRow on its card under a 4 per cent tint of the club\'s colour. The row looks the badge up by the tournament\'s status, which no reading of the JSX can follow to a ground.',
  },
  {
    file: 'src/pages/HomePage.tsx',
    class: 'text-gold-on-dark-badge',
    count: 1,
    ground: 'dark',
    reason:
      'The pill above the home page hero\'s title, on a 20 per cent gold tint over the hero\'s darkened photo, which carries data-ground="dark" with no navy of its own, so the reading cannot tell what it is. Its light gold reads 4.76:1 there at the lightest the photo gets, as contrast.test.ts works it out, where brand gold would read 3.14:1.',
  },
]

/** A gold colour WS02 uses, and the one context the brief allows it in. */
export interface Ws02GoldEntry {
  /** The hex colour, lower case. */
  colour: '#705718' | '#866a1e'
  /** The file WS02 builds the part in (src/components/layout, as the brief's WS02 Frontend list names it). */
  file: string
  /** Words in the colour, or a bar drawn in it (a border or fill, never text). */
  use: 'text' | 'bar'
  /** For words: the label the colour must sit beside, its smallest size in pixels and the ground under it. */
  label?: string
  minPx?: number
  ground?: string
  reason: string
}

export const WS02_GOLD: Ws02GoldEntry[] = [
  {
    colour: '#705718',
    file: 'src/components/layout/AboutMenu.tsx',
    use: 'text',
    label: 'You are here',
    minPx: 13,
    ground: '#f3eedc',
    reason:
      'The About menu marks the current row with "You are here" at 13px, weight 600, in #705718 on the row\'s #f3eedc tint (5.6:1), as the Nav-Header-Final board draws it; #866a1e reads 4.41:1 there. Outside heritage this is the one place #705718 is allowed.',
  },
  {
    colour: '#866a1e',
    file: 'src/components/layout/MobileMenu.tsx',
    use: 'text',
    label: 'You are here',
    minPx: 13,
    ground: '#fbfaf6',
    reason:
      'The phone sheet marks the current section with "You are here" at 13px, weight 600, in #866a1e on the sheet\'s #fbfaf6 row (4.91:1). Smaller than 13px it is not allowed.',
  },
  {
    colour: '#866a1e',
    file: 'src/components/layout/BottomTabs.tsx',
    use: 'bar',
    reason:
      'The phone tab bar marks the current tab with a 3px top bar in #866a1e, a line and not words. The tab\'s label stays navy, and brand gold #c8a94a is never its text.',
  },
]
