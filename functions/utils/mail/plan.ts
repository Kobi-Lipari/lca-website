// functions/utils/mail/plan.ts
//
// What one invocation may spend on mail, by the hosting plan WORKERS_PLAN
// names in ./switches, read at each call. Cloudflare's limits, read on
// Tuesday, November 10, 2026: an invocation on Workers Free may make 50
// outside calls and 50 database queries, a db.batch() counting as one
// query; on Workers Paid, 10,000 and 1,000. Each email is one outside call,
// to the service that sends it, and so is each US Chess rating lookup.
//
// This file holds the daily run's budget, and the sizes of the campaign
// sender's batches under the engine's rules (functions/utils/admin/campaigns.ts):
// Group email's and the LCA newsletter's, for the request that starts a
// campaign and for each run of the five-minute sweep.

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

/** How much the campaign sender may send in one invocation under the engine's rules. */
export interface CampaignSizes {
  /** The most rows the request that starts a campaign claims at once. */
  requestBatch: number
  /** How long that request keeps sending, checked before each send; null for one batch and no more. */
  requestDeadlineMs: number | null
  /** The most rows one run of the five-minute sweep sends, across the campaigns it reads. */
  sweepBatch: number
  /** The most campaigns one sweep run reads. */
  sweepCampaigns: number
}

/**
 * The campaign sender's sizes on the plan the account is on now. Each send is one outside call. A batch of n rows
 * makes at most n + 8 database queries: the campaign's read, the write-off of rows marked by a run that died, the
 * claim, the gate (one query for each 90 addresses, GATE_QUERY_SIZE in ./gate), for a list campaign the one batch that
 * takes out the rows the gate refused, the first row's mark, one batch for each of the n outcomes, which carries the
 * next row's mark, the count of what is left and the close. A Group email campaign has no list, so its batch makes
 * n + 7. A sweep run makes one query more, the read of the campaigns that are sending.
 *
 * On the free plan, inside 50 outside calls and 50 queries an invocation:
 * - The request sends one batch of 10 and leaves the rest to the sweep. Group email's request for Specific people
 *   (today's POST /api/admin/campaigns, whose requireMailer verifies an LCA admin's session twice) makes 2 outside
 *   calls to the sign-in service and 6 queries of its own for up to 80 recipients (the two member reads, the read of
 *   the members picked by hand, the campaign's insert, one recipient batch for each 80 and the audit row), so with its
 *   batch at most 12 outside calls and 6 + 17 = 23 queries, inside 25 for up to 240 recipients. The newsletter's own
 *   request runs only on Workers Paid, since Amazon SES sends only there.
 * - A sweep run sends 20 from one campaign: 20 outside calls and at most 1 + 20 + 8 = 29 queries. 10 and 20 addresses
 *   are one gate query each.
 *
 * On Workers Paid, inside 10,000 outside calls and 1,000 queries:
 * - The request sends batches of 40 until 20 seconds have passed, checking the time before each send and claiming no
 *   more rows than fit in the time left at the sender's 400 ms between sends: at most 50 sends, so it ends well inside
 *   the 30 seconds waitUntil lasts after the answer. 40 addresses are one gate query.
 * - A sweep run sends up to 300 across up to 20 campaigns: 300 outside calls, and under 500 queries even when every
 *   campaign is read (300 rows, 20 campaigns' fixed queries and the gate's extra queries: 300 addresses in one campaign
 *   are four, 90, 90, 90 and 30). At 400 ms between sends, 300 take two minutes, inside the five between runs.
 */
export function sizes(): CampaignSizes {
  if (WORKERS_PLAN === 'paid') return { requestBatch: 40, requestDeadlineMs: 20_000, sweepBatch: 300, sweepCampaigns: 20 }
  return { requestBatch: 10, requestDeadlineMs: null, sweepBatch: 20, sweepCampaigns: 1 }
}
