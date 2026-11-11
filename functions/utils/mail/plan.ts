// functions/utils/mail/plan.ts
//
// What one invocation may spend on mail, by the hosting plan WORKERS_PLAN
// names in ./switches, read at each call. Cloudflare's limits, read on
// Tuesday, November 10, 2026: an invocation on Workers Free may make 50
// outside calls and 50 database queries, a db.batch() counting as one
// query; on Workers Paid, 10,000 and 1,000. Each email is one outside call,
// to the service that sends it, and so is each US Chess rating lookup.
//
// This file holds the daily run's budget. WS16 step 4 adds the sizes of
// Group email's batches and the sweep's runs here.

import { WORKERS_PLAN } from './switches'

/** What the daily run of workers/daily-emails may spend on its reminders and its rating lookups. */
export interface DailyBudget {
  /** The most reminder rows one run claims, across its three reminder phases; null for no cap. */
  reminders: number | null
  /** The outside calls the reminders and the rating lookups share; null for no cap. */
  outsideCalls: number | null
}

/**
 * The daily run's budget on the plan the account is on now.
 *
 * On the free plan: 45 of the invocation's 50 outside calls, the other 5 kept in hand. The reminders go first, at
 * most 25 rows claimed in one run, so at most 25 sends, and the rating lookups take what the reminders leave: 20
 * after a day of 25 reminders, all 45 on a day with none. A row past the cap waits for a later run only if its query
 * reads it again, which the registration-open query does and the week-before and attendee queries, each naming one
 * day, do not; so the run takes the attendee and week-before reminders first (workers/daily-emails/src/index.ts).
 * A run makes no more than 25 + 20 = 45 outside calls. Its queries stay under 50 too while fewer than seven events
 * close on one day: the three bookkeeping phases make 3, and one more for each event whose registration closes that
 * day; each of the four reminder loops makes one to find its rows, one for its gate for each 90 of them and at most
 * one to give a claim back, 12 in all while no loop has more than 90 rows; the rows make at most 25 claims; and the
 * rating lookups make 3, for their members, the last readings and one batch of writes: 43 at most on a day no event
 * closes, and one more for each event that does.
 * test/integration/mail-gate.test.ts counts a day of 60 reminders and 60 lookups due at 45 calls and 36 queries.
 *
 * On Workers Paid: no cap. Today's 500 rating lookups and every reminder due fit in 10,000 outside calls and 1,000
 * queries.
 */
export function dailyBudget(): DailyBudget {
  if (WORKERS_PLAN === 'paid') return { reminders: null, outsideCalls: null }
  return { reminders: 25, outsideCalls: 45 }
}
