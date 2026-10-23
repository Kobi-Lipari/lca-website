// src/lib/features.ts
//
// On/off switches for parts of the site that are built but not open yet.
// To turn one on, change its value to true and deploy. Nothing else needs
// to change: the code behind each switch stays in place.
//
// The values written below are the values the site runs with. The one
// exception is the accessibility test build (vite build --mode a11y, run by
// npm run test:a11y), which may turn switches on through VITE_FLAGS; see
// applyFlagOverrides at the end of this file.

const SWITCHES = {
  /**
   * The "By organizer" column on the Tournaments page, which lets visitors
   * filter by LCA club. Off until clubs are given permission to run their
   * own tournaments here.
   */
  clubTournaments: false,

  /**
   * The "USCF rated" and "Register on this site" quick filters on the
   * Tournaments page. Off until the listings carry reliable rating and
   * registration details for every event.
   */
  tournamentQuickFilters: false,

  /**
   * The "Ext" / "External" tags that mark events not run through this site.
   * Off while every listed event is external, since the tag says nothing.
   */
  externalTags: false,

  // Redesign, Phase 0. Each switch below turns on one part of the new site.
  // Each stays off until that part has been checked on a preview.
  // test/unit/features.test.ts checks that they start off, so turning one
  // on also means taking its name out of PHASE_0 in that file.

  /**
   * The new base look: the new colours and type, dark mode (following the
   * device setting unless the visitor picks Light or Dark), the stronger
   * focus ring, and the new date, time and score formats. It also shows the
   * home page hero as one still picture, with no slideshow and no timer.
   */
  newLook: false,

  /**
   * The Heritage Club look on About, Board, Bylaws, Minutes, Annual meeting
   * and Champions. It puts those six pages in the heritage layout, with the
   * look's type, paper ground, rules and seal, and keeps forms and editors on
   * them in the base look. The look itself shows only when newLook is on as
   * well.
   */
  themeHeritage: false,

  /**
   * The Bright Scholastic look on the Scholastic pages. Off until the
   * Scholastic fonts are added and the look has been checked on a preview.
   * It shows only when newLook is on as well.
   */
  themeScholastic: false,

  /**
   * The new header with its six sections, the My LCA menu and the new
   * footer, plus the tablet header and, on phones, the top bar, bottom tab
   * bar and menu sheet. One switch, so a phone is never left without a menu.
   */
  newNav: false,

  /**
   * The Search button in the header, its search panel (also opened with
   * Ctrl K or ⌘K) and the /search page.
   */
  siteSearch: false,

  /** The search box in the band under the homepage hero. */
  homeSearch: false,

  /**
   * The personal event strip for people taking part in an event: on desktop
   * and tablet from the week before until after the event, and on phones the
   * event bar and banner from check-in on the first day. Off until it has
   * been checked on a preview with a real registration.
   */
  eventStrip: false,

  /**
   * The event strip while rounds are being played (board, colour and
   * opponent), the "Playing today" line on pairings and standings, and the
   * admin reminder to mark a finished event completed.
   */
  eventStripLive: false,

  /** The "Live" tag on the Tournaments page while an event is being played. */
  liveMarker: false,

  /**
   * The new homepage: the hero that changes with what is coming up (event
   * day, last call to register, open registration, newly announced, this
   * week in Louisiana, quiet weeks and clubs), the three doors in the quiet
   * and clubs heroes, and the new order of the blocks below.
   */
  newHome: false,

  /** The final standings hero on the homepage for 7 days after an LCA event. */
  homeResults: false,

  /** The band of current champions on the homepage. */
  homeChampions: false,

  /** The homepage hero that follows a round while it is being played. */
  homeLive: false,

  /**
   * The homepage's week view hero and the this-week strip under the search
   * band. Off until clubs can list their weekly meetings.
   */
  homeWeek: false,

  /** The recap card on the homepage for the latest event. */
  homeRecap: false,

  // Redesign, Phase 1 (brief 1.3). Off until each part is checked on a preview.

  /**
   * The Featured rung in the homepage hero: a festival an admin has pinned.
   */
  homeFeatured: false,

  /**
   * The new Tournaments page: the List, Calendar, Map and Table views, the
   * filter-and-sort line, the preview pane, the bell reminders and the
   * partner pages.
   */
  newTournaments: false,

  /**
   * The new event page: the sub-navigation, the registration card with the
   * membership line, entry limits by section, schedules, side events and
   * the Venue & travel block.
   */
  newEventPage: false,

  /** The public festival page and the festivals admin. */
  festivals: false,

  /**
   * The household checkout: the "Who's playing?" picker, Register my family
   * and the family pages in My LCA.
   */
  householdCheckout: false,

  /**
   * The "LCA membership required" switch on a club-run event's Registration
   * tab, shown only to an LCA admin and the organizing club's rep. Club-run
   * events start with it off. Nothing checks the setting at registration
   * yet: that comes with the household checkout, which can add the
   * membership in the same payment, so turning it on today would only store
   * the choice, while the page's wording says players must hold a
   * membership. Leave it off until that checkout ships.
   */
  membershipRequirementSwitch: false,

  // Redesign, brief 1.4. Off until each part is checked on a preview.
  // clubEmailHidden and rosterShortNames are Phase 0 switches, so
  // test/unit/features.test.ts holds them off in PHASE_0 as well.

  /** Today's club page offers "Contact this club through LCA" in place of the club's email. */
  clubEmailHidden: false,

  /** Today's event page lists entrants under 18 by first name and last initial to anyone not running it. */
  rosterShortNames: false,

  /** The new live pages: pairings, standings, My board, Find your board, the hall TV and the print kit. */
  newLive: false,

  /** Players report their own results from the pinned card, with the director's queue of reported results. */
  resultReports: false,

  /** Round emails to registered players and their guardians, sent when a director publishes a round and asks. */
  roundAlerts: false,

  /** The same round emails for the people who follow a player or the event. */
  followerAlerts: false,

  /** The first phase of tournament creation: standing directors, one-event directors and the entry-fee rule. */
  standingDirectors: false,

  /** The new director's console, one stage at a time, with the setup checklist and the rating report step. */
  tdConsole: false,

  /** The new admin home: the dashboard, the merged Needs attention queue and the grouped sidebar. */
  adminHome: false,

  /** The new clubs directory and club pages; the new menus and footer read it for their club rows too. */
  newClubs: false,

  /** The new News page, results index and /about/champions; the new menus read it for State champions too. */
  newNews: false,

  /** The new Scholastic page, one page for parents. */
  newScholastic: false,

  /** The scholastic season block, Season at a glance on Tournaments and the admin season screen. */
  seasonSchedule: false,

  /** The new Membership and Give pages and the digital card; the new menus read it for Donate and the card too. */
  newMembership: false,

  /** The new one-page My LCA (Today, You, Family, Receipts and Settings), for everyone until the rail is on. */
  newDashboard: false,

  /** My LCA's left rail for volunteers; until it is on, the new My LCA menu keeps today's role rows. */
  myLcaRail: false,

  /** The new tabbed About page and its redirects; the new menus read it for their governance rows too. */
  newAbout: false,

  /** The new scoresheet scanner for active LCA members, with private drafts, My games and the printed kit. */
  scanner2: false,
} as const

/** The name of one switch. */
export type FeatureName = keyof typeof SWITCHES

/** Every switch, on or off. */
export type Features = { readonly [K in FeatureName]: boolean }

/** The mode of the accessibility test build, the only mode that reads VITE_FLAGS. */
export const FLAG_OVERRIDE_MODE = 'a11y'

/**
 * The switches as written above, with the names listed in `flags` turned on
 * when `mode` is the accessibility test build's mode. `flags` is a
 * comma-separated list of switch names, such as "newLook,themeHeritage". In
 * any other mode, or with no names, the answer is `base` itself, unchanged.
 * An unknown name is an error, so a typo in a test run fails loudly instead
 * of testing the wrong page.
 */
export function applyFlagOverrides(base: Features, mode: string | undefined, flags: string | undefined): Features {
  if (mode !== FLAG_OVERRIDE_MODE) return base
  const names = (flags ?? '').split(',').map((n) => n.trim()).filter(Boolean)
  if (names.length === 0) return base
  const out: Record<string, boolean> = { ...base }
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(base, name)) throw new Error(`VITE_FLAGS names "${name}", which is not a switch in src/lib/features.ts.`)
    out[name] = true
  }
  return out as Features
}

// The mode check is written out here as a literal, not only inside
// applyFlagOverrides: the build replaces import.meta.env.MODE with the mode's
// name, so in every build except the accessibility test build this line
// becomes plain `FEATURES = SWITCHES` and VITE_FLAGS never reaches the site.
export const FEATURES: Features =
  import.meta.env.MODE === 'a11y'
    ? applyFlagOverrides(SWITCHES, import.meta.env.MODE, import.meta.env.VITE_FLAGS)
    : SWITCHES
