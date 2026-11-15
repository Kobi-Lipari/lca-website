// functions/utils/clubs/emails.ts
//
// The save notice: when someone who is not a representative of the club's
// region saves its listing or its places, each representative for that
// region gets one email naming the fields that changed. It names the fields
// alone, never a value, so no private address and no text the club has not
// yet published leaves the site in it. It is sent only by the new save,
// while CLUB_KEEPERS_ON is set; today's save sends nothing.
//
// Its words are drawn here with the shared layout, as
// functions/utils/events/publishedReview.ts draws its own, and it goes
// through trySendEmail, one email to each person, so no representative sees
// another's address.
//
// By K's decision 7 of Sunday, November 15, 2026, the notice goes at most
// once an hour for one club and one person saving. The save decides that in
// its own batch (functions/utils/clubs/save.ts), with noticeMayGo below as
// the half of the rule that needs the region's representatives, and the
// handlers send only when the save's activity row says the notice goes.

import { trySendEmail, type EmailEnv, type EmailMessage } from '../email'
import { emailDetails, escapeHtml, p, renderEmail } from '../emailLayout'
import { resolveSiteUrl } from '../site'
import { regionRepresentativesOf, representativesOfRegion } from './routing'

/**
 * Each field a save can change, by its column, as the notice names it: in
 * the words the editor shows for that field, so a keeper and the region's
 * representative read the same name. A column of today's that a save copies
 * from the listing (description from About, meeting_schedule from how the
 * club meets, and location and the pin from the places) takes the name of
 * the field it is copied from, so one change is named once.
 */
export const CLUB_FIELD_LABELS: Record<string, string> = {
  about_text: 'One sentence about the club',
  description: 'One sentence about the club',
  how_we_meet_text: 'How the club meets, in words',
  meeting_schedule: 'How the club meets, in words',
  places: 'Where',
  location: 'Where',
  latitude: 'Where',
  longitude: 'Where',
  contact_name_public: 'Contact name',
  contact_email: 'Email for messages',
  name: 'Club name',
  city: 'City',
  region: 'Region',
  slug: 'Page address',
  cost_text: 'Cost',
  welcome_text: 'Who is welcome',
  weekend_play: 'The club plays on weekends',
  scholastic_friendly: 'Scholastic friendly',
  facebook_url: 'Facebook page',
  website_url: 'Website',
  other_url: 'Another link',
  image_url: 'Logo',
  color: 'Club color',
}

/** The fields' names in the editor's order. */
const LABEL_ORDER = [...new Set(Object.values(CLUB_FIELD_LABELS))]

/** The fields' names, each once, in the editor's order; a column with no label is left out. */
export function fieldNames(columns: readonly string[]): string[] {
  const names = new Set<string>()
  for (const column of columns) {
    const label = CLUB_FIELD_LABELS[column]
    if (label) names.add(label)
  }
  return LABEL_ORDER.filter((label) => names.has(label))
}

/**
 * A stored name as one line: every run of white space or control characters
 * made one space, so no name a member typed can break the notice's lines or
 * stand in it as a line of its own.
 */
export function oneLine(text: string): string {
  return text.replace(/[\s\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim()
}

/** The pause between one representative's email and the next, the pace functions/utils/events/publishedReview.ts keeps. */
const SEND_INTERVAL_MS = 400

/** The notice's heading, true whoever saved: the club's own rep, another keeper or an LCA admin. */
const HEADING = 'A club\'s listing in your region was updated'

/** The notice for one club. Its `to` is empty, as every template's is, and is filled for each representative. */
export function clubSaveNoticeEmail(data: {
  siteUrl: string
  clubId: string
  clubName: string
  saverName: string
  fields: readonly string[]
}): EmailMessage {
  const url = `${data.siteUrl}/admin/clubs/${encodeURIComponent(data.clubId)}`
  // A name may hold a comma, so the names are kept apart by semicolons.
  const changed = data.fields.join('; ')
  const clubName = oneLine(data.clubName)
  const saverName = oneLine(data.saverName)
  const why = 'You are told because your board seat covers this club\'s region. Nothing needs doing unless something looks wrong.'
  // The email is no longer the whole story of the hour, so it says so.
  const later = `If ${saverName} saves again within the hour, no second email follows; the link shows the listing as it stands.`
  return {
    to: '',
    subject: `${clubName}: its listing was updated`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: HEADING,
      preheader: `${clubName}: ${changed}`,
      body: emailDetails([
        ['Club', clubName],
        ['Saved by', saverName],
        ['What changed', changed],
      ]) + p(escapeHtml(why)) + p(escapeHtml(later)),
      cta: { label: 'See the club', url },
    }),
    text: [
      `${HEADING}.`,
      '',
      `Club: ${clubName}`,
      `Saved by: ${saverName}`,
      `What changed: ${changed}`,
      '',
      why,
      '',
      later,
      '',
      `See the club: ${url}`,
    ].join('\n'),
  }
}

/**
 * Whether a save that changed these columns may send the notice at all,
 * before the hour is counted: a field with a name changed, the club's region
 * has a representative, and the saver is not one of them. The region is the
 * one the save leaves the club in: `region` is passed when the save writes
 * the region (an LCA admin's save can move a club), and the club's stored
 * region is read otherwise, so the decision and sendClubSaveNotice, which
 * reads the region after the batch, ask about the same people. The save
 * reads it just before its batch, and the batch counts the hour. Never
 * throws: a failed read is logged with no address and no name and answers
 * false, so the save still lands and its row says no notice went.
 */
export async function noticeMayGo(
  db: D1Database,
  clubId: string,
  saverId: string,
  columns: readonly string[],
  region?: string | null,
): Promise<boolean> {
  if (fieldNames(columns).length === 0) return false
  try {
    const representatives = region === undefined ? await regionRepresentativesOf(db, clubId) : await representativesOfRegion(db, region)
    return representatives.length > 0 && !representatives.some((person) => person.id === saverId)
  } catch (err) {
    console.warn(`club save notice not decided for ${clubId}:`, err instanceof Error ? err.message : String(err))
    return false
  }
}

/**
 * Sends the notice for one save. The handlers call it only when the save's
 * activity row says the notice goes, at most once an hour for one club and
 * one saver. Nothing goes when no field changed, when the club's region has
 * no representative (no region, no seat covering it, or a vacant seat), or
 * when the saver is one of its representatives; otherwise each
 * representative gets one email, however many seats they hold. The saver is
 * never sent one. Never throws: a failed read or send is logged with no
 * address and no name, and the save it follows has already landed; it is
 * not tried again, and the hour counts from it all the same. Answers how
 * many emails went.
 */
export async function sendClubSaveNotice(
  env: EmailEnv & { DB: D1Database; SITE_URL?: string },
  request: Request | undefined,
  save: { clubId: string; clubName: string; saver: { id: string; full_name: string }; columns: readonly string[] },
): Promise<number> {
  let sent = 0
  try {
    const fields = fieldNames(save.columns)
    if (fields.length === 0) return 0
    const representatives = await regionRepresentativesOf(env.DB, save.clubId)
    if (representatives.some((person) => person.id === save.saver.id)) return 0
    const message = clubSaveNoticeEmail({
      siteUrl: resolveSiteUrl(env, request),
      clubId: save.clubId,
      clubName: save.clubName,
      saverName: save.saver.full_name,
      fields,
    })
    let index = 0
    for (const person of representatives) {
      if (index++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
      if (await trySendEmail(env, { ...message, to: person.email })) sent++
    }
  } catch (err) {
    console.warn(`club save notice failed for ${save.clubId} (${sent} sent):`, err instanceof Error ? err.message : String(err))
  }
  return sent
}
