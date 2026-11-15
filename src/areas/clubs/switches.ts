// src/areas/clubs/switches.ts
//
// What the clubs switches turn on together, and the order they may be turned
// on in. Three switches in src/lib/features.ts govern the clubs work:
// clubKeepers (the pages for the people who keep club listings),
// regionEvents (the regional representatives' club events) and newClubs
// (the public directory and club pages). Each has a server half in
// functions/utils/clubs/pages.ts, which the site cannot import, so
// switchOrderProblems takes those constants as a plain argument and
// test/unit/club-pages-switch.test.ts hands it the real ones.
import { FEATURES, type Features } from '@/lib/features'

/** The new public clubs pages: newClubs and newLook together, as chromeOn in src/lib/nav.ts reads newNav. */
export function clubPagesOn(features: Features = FEATURES): boolean {
  return features.newClubs && features.newLook
}

/** The pages for the people who keep club listings: clubKeepers alone. */
export function keepersOn(features: Features = FEATURES): boolean {
  return features.clubKeepers
}

/** The regional representatives' club events: regionEvents, with clubKeepers on as well. */
export function regionEventsOn(features: Features = FEATURES): boolean {
  return features.regionEvents && features.clubKeepers
}

/** The server constants the order reads, as functions/utils/clubs/pages.ts and functions/utils/clubs/publicAnswer.ts write them. */
export interface ClubServerSwitches {
  readonly CLUB_EMAIL_HIDDEN: boolean
  readonly CLUB_PAGES_ON: boolean
  readonly CLUB_KEEPERS_ON: boolean
  readonly REGION_EVENTS_ON: boolean
}

/** The part of the switches the order reads. */
type OrderSwitches = Pick<Features, 'clubEmailHidden' | 'clubKeepers' | 'regionEvents' | 'newClubs' | 'newLook'>

/**
 * Every way the switches and their server constants break the order they may
 * be turned on in, one sentence each, and an empty list when they keep it:
 * clubEmailHidden first, then clubKeepers, then regionEvents, and newClubs
 * only with clubEmailHidden and newLook on. A change that turns a switch on
 * out of order fails test/unit/club-pages-switch.test.ts, so it cannot merge.
 */
export function switchOrderProblems(features: OrderSwitches, constants: ClubServerSwitches): string[] {
  const problems: string[] = []
  if (features.clubKeepers && !features.clubEmailHidden) {
    problems.push('clubKeepers is on while clubEmailHidden is off: the club editor tells keepers the email for messages is never shown, and today\'s club page prints it until clubEmailHidden is on.')
  }
  if (constants.CLUB_KEEPERS_ON && !constants.CLUB_EMAIL_HIDDEN) {
    problems.push('CLUB_KEEPERS_ON is set while CLUB_EMAIL_HIDDEN is not: the club editor tells keepers the email for messages is never shown, and today\'s club answer carries it until CLUB_EMAIL_HIDDEN is set.')
  }
  if (features.newClubs && !features.clubEmailHidden) {
    problems.push('newClubs is on while clubEmailHidden is off: today\'s club page and its answer stay live, and must not carry the club\'s email once the new pages are public.')
  }
  if (constants.CLUB_PAGES_ON && !constants.CLUB_EMAIL_HIDDEN) {
    problems.push('CLUB_PAGES_ON is set while CLUB_EMAIL_HIDDEN is not: today\'s club answer stays live, and must not carry the club\'s email once the new pages are public.')
  }
  if (features.newClubs && !features.newLook) {
    problems.push('newClubs is on while newLook is off: the new clubs pages are drawn only in the new look, so the site would draw today\'s pages while the server answered for the new ones.')
  }
  if (constants.CLUB_PAGES_ON && !features.newLook) {
    problems.push('CLUB_PAGES_ON is set while newLook is off: the server would answer the moves from today\'s addresses, write the new page into today\'s HTML, serve the sitemap and open the forms while the site drew today\'s pages.')
  }
  if (features.regionEvents && !features.clubKeepers) {
    problems.push('regionEvents is on while clubKeepers is off: the representatives\' club events live on My region, which comes with clubKeepers.')
  }
  if (constants.REGION_EVENTS_ON && !constants.CLUB_KEEPERS_ON) {
    problems.push('REGION_EVENTS_ON is set while CLUB_KEEPERS_ON is not: the representatives\' club events live on My region, which comes with CLUB_KEEPERS_ON.')
  }
  return problems
}
