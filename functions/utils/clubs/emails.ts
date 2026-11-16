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

//
// The monthly check's email (monthlyCheckEmail below) is drawn here too, and
// sent by functions/utils/clubs/monthlyCheck.ts.
//
// So are the three emails of a representative's club event in the LCA
// admins' wait (WS09 step 18), sent by
// functions/api/admin/tournaments/[id]/approval.ts: Submit for LCA review
// writes to the LCA admins, and Approve and publish and Ask for changes to
// the person who drafted the event.

import { trySendEmail, type EmailEnv, type EmailMessage } from '../email'
import { emailDetails, emailQuote, escapeHtml, p, renderEmail } from '../emailLayout'
import { resolveSiteUrl } from '../site'
import { regionRepresentativesOf, representativesOfRegion } from './routing'
import { formatDate } from '../../../domain/format/date'
import { NO_STATEMENT } from '../../../domain/clubs/monthlyCheck'

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

// ── The monthly check ────────────────────────────────────────────

/** The monthly check's subject and heading. */
export const MONTHLY_CHECK_HEADING = 'Your region\'s clubs: still accurate?'

/** The line on the links' life, before the day they stop: it names the link by its label, so it reads true of one club or several. */
export const LINK_LIFE = 'Still accurate works without logging in for 30 days'

/** Why the person gets the email: it is about their own seat, so it carries no unsubscribe line. True of one seat or two. */
export const MONTHLY_CHECK_WHY = 'You get this because you are a regional representative.'

/** When the email comes, said after the why: the timed send's line. */
export const MONTHLY_CHECK_TIMED = 'It comes on the first Monday of each month at 8:00 AM.'

/** The line a copy sent with the LCA admin's button carries in its place, since it can go on any day. */
export const MONTHLY_CHECK_BY_HAND = 'An LCA admin sent this one by hand.'

/** One club in the monthly check's email: its listing's name, town and statement, and its two links. */
export interface CheckClub {
  name: string
  city: string
  /** How the club meets, in its own words; null when it has none. */
  statement: string | null
  /** Still accurate: the signed link, good for 30 days with no login. */
  confirmUrl: string
  /** Update: the club's page in My region, after sign-in. */
  updateUrl: string
}

/** "1 club" or "3 clubs". */
const clubCount = (n: number) => `${n} ${n === 1 ? 'club' : 'clubs'}`

/** The first word of a stored name, as one line, or "there" for a name with none. */
function firstNameOf(fullName: string): string {
  return oneLine(fullName).split(' ')[0] || 'there'
}

const NAVY = '#1a2744'
const INK = '#3a3f4b'
const SANS = 'Arial,Helvetica,sans-serif'

const GOLD = '#c8a94a'

/**
 * One of a club's two buttons: padding 12px above and below, a 20px line
 * and a 2px edge make it 48px tall. Still accurate wears the look of the
 * site's own email button (functions/utils/emailLayout.ts emailButton): the
 * gold ground with navy bold words. Update is the quiet one, navy words and
 * a navy line round it on a white ground, so no gold word sits on a light
 * ground. Each sits in its own block with an 8px margin to its right and
 * above, so the two stand 8px apart side by side and 8px apart when a narrow
 * screen puts the second under the first; with the styles dropped, the two
 * blocks fall onto two lines as two plain links.
 */
function buttonHtml(label: string, url: string, look: 'main' | 'quiet'): string {
  const ground = look === 'main' ? `background:${GOLD};border:2px solid ${GOLD};` : `background:#ffffff;border:2px solid ${NAVY};`
  return `<div style="display:inline-block;margin:8px 8px 0 0;vertical-align:top;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;${ground}font-family:${SANS};font-size:15px;line-height:20px;font-weight:bold;color:${NAVY};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></div>`
}

/** One club's box: its name, town and statement, with its two buttons in the same cell, so each reads with its club. */
function clubBox(club: CheckClub): string {
  const statement = club.statement ? oneLine(club.statement) : NO_STATEMENT
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;background:#f7f6f2;border-radius:10px;">
  <tr><td style="padding:16px 18px;font-family:${SANS};color:${INK};">
    <div style="font-size:16px;font-weight:bold;color:${NAVY};">${escapeHtml(oneLine(club.name))}</div>
    <div style="font-size:14px;">${escapeHtml(oneLine(club.city))}</div>
    <div style="margin-top:8px;font-size:14px;line-height:1.5;">${escapeHtml(statement)}</div>
    <div style="margin-top:4px;">${buttonHtml('Still accurate', club.confirmUrl, 'main')}
      ${buttonHtml('Update', club.updateUrl, 'quiet')}</div>
  </td></tr>
</table>`
}

/**
 * The monthly check for one person: every club their seats keep, each with its statement, Still accurate (a signed
 * link that needs no login) and Update (the club's page in My region). `linksEnd` is the moment the links stop, shown
 * as its day with its weekday. `byHand` is true for a copy sent with the LCA admin's button. Its `to` is empty, as
 * every template's is, and is filled by the sender.
 */
export function monthlyCheckEmail(data: {
  siteUrl: string
  fullName: string
  month: string
  linksEnd: Date
  clubs: readonly CheckClub[]
  byHand?: boolean
}): EmailMessage {
  const first = firstNameOf(data.fullName)
  const until = formatDate(data.linksEnd, { year: true })
  const ask = data.clubs.length === 1
    ? `Here is the club in your region, for ${data.month}. Press Still accurate if its listing is right, or Update to change it.`
    : `Here are the ${clubCount(data.clubs.length)} in your region, for ${data.month}. For each one, press Still accurate if its listing is right, or Update to change it.`
  const life = `${LINK_LIFE}, until ${until}. Update opens the club in My region after you log in.`
  const why = `${MONTHLY_CHECK_WHY} ${data.byHand ? MONTHLY_CHECK_BY_HAND : MONTHLY_CHECK_TIMED}`
  return {
    to: '',
    subject: MONTHLY_CHECK_HEADING,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: MONTHLY_CHECK_HEADING,
      preheader: `${clubCount(data.clubs.length)} to look over for ${data.month}`,
      body: p(`Hi ${escapeHtml(first)},`) + p(escapeHtml(ask)) + data.clubs.map(clubBox).join('') + p(escapeHtml(life)) + p(escapeHtml(why)),
    }),
    text: [
      `Hi ${first},`,
      '',
      ask,
      '',
      ...data.clubs.flatMap((club) => [
        oneLine(club.name),
        oneLine(club.city),
        club.statement ? oneLine(club.statement) : NO_STATEMENT,
        `Still accurate: ${club.confirmUrl}`,
        `Update: ${club.updateUrl}`,
        '',
      ]),
      life,
      '',
      why,
    ].join('\n'),
  }
}

// ── The approval wait (WS09 step 18) ─────────────────────────────

/** A representative's club event as the three emails of the wait name it. */
export interface WaitingEvent {
  siteUrl: string
  id: string
  name: string
  /** The club's name, or null for an event whose club is gone. */
  clubName: string | null
  /** The event's days, a weekday on each, as eventDays in functions/utils/events/publishedReview.ts writes them. */
  when: string
}

/** The club line of an event whose club has been deleted since it was drafted. */
export const NO_CLUB = 'No club on file'

/** Submit's subject line and heading. */
export const REVIEW_ASKED_HEADING = 'A club event is waiting for LCA review'

/** Approve's heading. */
export const APPROVED_HEADING = 'Your event is approved and listed'

/** Ask for changes' heading. */
export const CHANGES_ASKED_HEADING = 'An LCA admin asked for changes to your event'

/** The event's name, club and days as one line each, and its two addresses. */
function waitingWords(event: WaitingEvent) {
  return {
    name: oneLine(event.name),
    club: event.clubName && oneLine(event.clubName) ? oneLine(event.clubName) : NO_CLUB,
    when: event.when,
    manageUrl: `${event.siteUrl}/admin/tournaments/${encodeURIComponent(event.id)}`,
    publicUrl: `${event.siteUrl}/tournaments/${encodeURIComponent(event.id)}`,
  }
}

/**
 * Submit for LCA review, to each LCA admin: the event's name, its club and
 * its days, with a link to its manage page, where an LCA admin approves it.
 * It names no person. Its `to` is empty, as every template's is, and is
 * filled for each admin.
 */
export function reviewAskedEmail(event: WaitingEvent): EmailMessage {
  const words = waitingWords(event)
  const wait = 'It stays off the site until an LCA admin approves it.'
  return {
    to: '',
    subject: `For LCA review: ${words.name} (${words.when})`,
    html: renderEmail({
      siteUrl: event.siteUrl,
      heading: REVIEW_ASKED_HEADING,
      preheader: `${words.name}, ${words.club}`,
      body: emailDetails([
        ['Event', words.name],
        ['Club', words.club],
        ['When', words.when],
      ]) + p(escapeHtml(wait)),
      cta: { label: 'Review the event', url: words.manageUrl },
    }),
    text: [
      `${REVIEW_ASKED_HEADING}.`,
      '',
      `Event: ${words.name}`,
      `Club: ${words.club}`,
      `When: ${words.when}`,
      '',
      wait,
      '',
      `Review the event: ${words.manageUrl}`,
    ].join('\n'),
  }
}

/**
 * Approve and publish, to the person who drafted the event: it is approved
 * and listed, with its name, club and days and a link to its public page.
 */
export function approvedEmail(event: WaitingEvent & { fullName: string }): EmailMessage {
  const words = waitingWords(event)
  const first = firstNameOf(event.fullName)
  const listed = 'An LCA admin approved it, and it is now listed on Tournaments.'
  return {
    to: '',
    subject: `Approved and listed: ${words.name}`,
    html: renderEmail({
      siteUrl: event.siteUrl,
      heading: APPROVED_HEADING,
      preheader: `${words.name} is now listed`,
      body: p(`Hi ${escapeHtml(first)},`) + p(escapeHtml(listed)) + emailDetails([
        ['Event', words.name],
        ['Club', words.club],
        ['When', words.when],
      ]),
      cta: { label: 'See the event', url: words.publicUrl },
    }),
    text: [
      `Hi ${first},`,
      '',
      listed,
      '',
      `Event: ${words.name}`,
      `Club: ${words.club}`,
      `When: ${words.when}`,
      '',
      `See the event: ${words.publicUrl}`,
    ].join('\n'),
  }
}

/**
 * Ask for changes, to the person who drafted the event: the LCA admin's
 * note, as plain text, escaped in the HTML, with a link to the event's
 * manage page.
 */
export function changesAskedEmail(event: WaitingEvent & { fullName: string; note: string }): EmailMessage {
  const words = waitingWords(event)
  const first = firstNameOf(event.fullName)
  const ask = 'An LCA admin looked over your event and asked for a few changes before it is listed.'
  const again = 'Once it is changed, send it for LCA review again.'
  return {
    to: '',
    subject: `Changes asked: ${words.name}`,
    html: renderEmail({
      siteUrl: event.siteUrl,
      heading: CHANGES_ASKED_HEADING,
      preheader: `Changes asked for ${words.name}`,
      body: p(`Hi ${escapeHtml(first)},`) + p(escapeHtml(ask)) + emailDetails([
        ['Event', words.name],
        ['Club', words.club],
        ['When', words.when],
      ]) + emailQuote(event.note, 'What to change') + p(escapeHtml(again)),
      cta: { label: 'Open the event', url: words.manageUrl },
    }),
    text: [
      `Hi ${first},`,
      '',
      ask,
      '',
      `Event: ${words.name}`,
      `Club: ${words.club}`,
      `When: ${words.when}`,
      '',
      'What to change:',
      event.note,
      '',
      again,
      '',
      `Open the event: ${words.manageUrl}`,
    ].join('\n'),
  }
}
