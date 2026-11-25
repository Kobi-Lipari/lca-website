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
//
// And so are the three copies of a message a visitor sends from a club's
// page (relayCopyEmail, WS09 step 26), sent by functions/utils/clubs/relay.ts:
// to the club's own address, else to the region's representatives, else to
// the LCA admins.
//
// And so is the answer a representative or an LCA admin sends through Reply
// through LCA (clubReplyEmail, WS09 step 27), sent by
// functions/api/clubs/reply/[token].ts to the visitor's address the sealed
// link holds, from LCA's own address and with LCA's own reply-to.
//
// And so is the email a keeper gets when a visitor suggests an update to a
// club's listing (suggestionKeeperEmail, WS09 step 28), sent by
// functions/utils/clubs/suggestions.ts to the club's rep, else to the
// region's representatives, else to the LCA admins; a keeper's answer to it
// is clubReplyEmail again, signed by the role alone.
//
// And so is the email of the 14 days (overdueSuggestionEmail, WS09 step 29),
// sent by functions/utils/clubs/reportClock.ts when a suggestion has had no
// answer in 14 days: to the LCA admins and, when the club's rep had it
// first, to the region's representatives as well.

import { trySendEmail, type EmailEnv, type EmailMessage } from '../email'
import { emailDetails, emailQuote, escapeHtml, p, renderEmail } from '../emailLayout'
import { resolveSiteUrl } from '../site'
import { regionRepresentativesOf, representativesOfRegion } from './routing'
// The contact relay (./relay.ts) reads the region's representatives and the LCA admins through this file, the one reader
// of the routing among the club mail's files with the monthly check; Suggest an update (./suggestions.ts, WS09 step 28)
// reads who keeps the club first, and each keeper after, the same way.
export { clubRepsOf, keeperOf, lcaAdmins, regionRepresentativesOf, type ClubKeepers, type Keeper } from './routing'
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

// ── The contact relay (WS09 step 26) ─────────────────────────────

/** What a visitor typed into a club's Contact form, after the contract's check. */
export interface RelayedMessage {
  name: string
  email: string
  message: string
}

/** Who a copy goes to: the club's own address, a representative of its region, or an LCA admin. */
export type RelayCopyKind = 'club' | 'region' | 'lca'

/** Why a copy goes to a representative or an admin: the club has no address on file, or its address took nothing. */
export type RelayReason = 'no_address' | 'unreachable'

/** The heading of the club's own copy. */
export const RELAY_CLUB_HEADING = 'A message for your club'

/** The heading of a representative's and an admin's copy. */
export const RELAY_KEEPER_HEADING = 'A message for a club you look after'

/**
 * The line on a representative's and an admin's copy (WS09 step 27): the visitor's address is not in the copy, and
 * an answer goes through the site, so neither side sees the other's address.
 */
export const RELAY_OWN_MAIL_LINE = 'To answer, use Reply through LCA. Your answer goes to them from LCA\'s own address, so they never see yours and you never see theirs.'

/** The link's words on a representative's and an admin's copy, where the visitor's address stood. */
export const RELAY_REPLY_LABEL = 'Reply through LCA'

/**
 * The line in place of the link while the site has no signing key: no link is made, and the visitor's address is not
 * put in the copy instead, so the message cannot be answered from it.
 */
export const RELAY_NO_LINK_LINE = 'This message cannot be answered from this email: the site could not make its Reply through LCA link. Their address is kept private, so it is not shown here.'

/**
 * The opening of a representative's or an admin's copy: why the message came
 * to them and not to the club. {Club} has no connected email yet, or its
 * email could not be reached, so the message came to them as the region's
 * representative, or as an LCA admin while no one holds the region's seat.
 */
export function relayOpening(club: string, kind: Exclude<RelayCopyKind, 'club'>, reason: RelayReason, region: string | null): string {
  const why = reason === 'no_address' ? `${club} has no connected email yet` : `${club}'s email could not be reached`
  if (kind === 'lca') return `${why}, so this message came to you as an LCA admin.`
  const area = region ? oneLine(region) : ''
  return area ? `${why}, so this message came to you as the ${area} representative.` : `${why}, so this message came to you as the region's representative.`
}

/**
 * One copy of a message a visitor sent from a club's page. The subject is
 * fixed words with the club's name, never anything the visitor typed. Every
 * word the visitor typed is escaped in the HTML and written as text in the
 * plain part; their name stands as one line. The club's own copy carries the
 * visitor's address and is answered straight back to the visitor (the relay
 * sets the reply-to). A representative's or an admin's copy (WS09 step 27)
 * carries no address of the visitor anywhere: Reply through LCA stands in its
 * place, a link to the reply page (replyUrl), or, while the site has no
 * signing key and no link can be made, the line that says so. It says why
 * the message came to them, and its footer says a reply to the email itself
 * does not reach the visitor. Its `to` is empty, as every template's is, and
 * is filled for each person by the relay.
 */
export function relayCopyEmail(data: {
  siteUrl: string
  clubName: string
  region: string | null
  kind: RelayCopyKind
  reason: RelayReason
  visitor: RelayedMessage
  /** The Reply through LCA link, on a representative's and an admin's copy; null when none could be made. */
  replyUrl?: string | null
}): EmailMessage {
  const clubName = oneLine(data.clubName)
  const name = oneLine(data.visitor.name)
  const email = data.visitor.email.trim()
  const message = data.visitor.message.trim()
  const club = data.kind === 'club'
  const link = club ? null : data.replyUrl ?? null
  const heading = club ? RELAY_CLUB_HEADING : RELAY_KEEPER_HEADING
  const intro = `Someone wrote to ${clubName} from the club's page on the Louisiana Chess Association website.`
  const lead = data.kind === 'club' ? [intro] : [relayOpening(clubName, data.kind, data.reason, data.region), intro]
  const after = club ? 'Reply to this email to answer them. Your own address stays private until you do.' : link ? RELAY_OWN_MAIL_LINE : RELAY_NO_LINK_LINE
  const footer = club
    ? 'A reply to this email goes to the person who wrote.'
    : 'A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.'
  const details: Array<[string, string]> = club ? [['From', name], ['Their email', email]] : [['From', name]]
  return {
    to: '',
    subject: `A message for ${clubName} from the LCA website`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading,
      preheader: `A message for ${clubName}`,
      body: lead.map((line) => p(escapeHtml(line))).join('') + emailDetails(details) + emailQuote(message, 'Message') + p(escapeHtml(after)),
      ...(link ? { cta: { label: RELAY_REPLY_LABEL, url: link } } : {}),
      footerNote: escapeHtml(footer),
    }),
    text: [
      `${heading}.`,
      '',
      ...lead.flatMap((line) => [line, '']),
      ...details.map(([label, value]) => `${label}: ${value}`),
      '',
      'Message:',
      message,
      '',
      after,
      ...(link ? ['', `${RELAY_REPLY_LABEL}: ${link}`] : []),
      '',
      footer,
    ].join('\n'),
  }
}

// ── Reply through LCA (WS09 step 27) ─────────────────────────────

/** How an answer is signed: by the role alone, never by a name (K's decision 12). */
export function replySignOff(by: { kind: 'region'; region: string } | { kind: 'lca' }): string {
  return by.kind === 'region' ? `LCA ${oneLine(by.region)} representative` : 'Louisiana Chess Association'
}

/** The heading of the answer the visitor gets. */
export const REPLY_HEADING = 'An answer to your message'

/**
 * The answer a representative or an LCA admin sends through Reply through
 * LCA, to the visitor. The subject is fixed words with the club's name. The
 * answer's words are the volunteer's, escaped in the HTML and written as text
 * in the plain part; the first lines the visitor wrote stand above them, so
 * they know which message is answered. It is signed by the role alone and
 * carries no name and no address of the volunteer. Its last line says the
 * email comes from LCA's own address and that the club's page is the way to
 * write to the club again. Its `to` is empty, as every template's is, and is
 * filled by the endpoint from the sealed link alone.
 */
export function clubReplyEmail(data: {
  siteUrl: string
  clubName: string
  clubUrl: string
  firstName: string
  excerpt: string
  answer: string
  signOff: string
}): EmailMessage {
  const clubName = oneLine(data.clubName)
  const first = oneLine(data.firstName)
  const answer = data.answer.trim()
  const intro = `You wrote to ${clubName} from the club's page on the Louisiana Chess Association website. Here is the answer.`
  const last = `This email comes from the Louisiana Chess Association's own address. To write to ${clubName} again, use the club's page: ${data.clubUrl}`
  return {
    to: '',
    subject: `An answer to your message to ${clubName}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: REPLY_HEADING,
      preheader: `An answer to your message to ${clubName}`,
      body: p(`Hi ${escapeHtml(first)},`) + p(escapeHtml(intro)) + emailQuote(data.excerpt, 'You wrote') + emailQuote(answer, 'Answer') + p(escapeHtml(data.signOff)),
      // The footer is outside the body's styled part, so its link carries the navy the layout's own footer links use.
      footerNote: `${escapeHtml(`This email comes from the Louisiana Chess Association's own address. To write to ${clubName} again, use `)}<a href="${escapeHtml(data.clubUrl)}" style="color:#1a2744;text-decoration:underline;">the club's page</a>.`,
    }),
    text: [
      `Hi ${first},`,
      '',
      intro,
      '',
      'You wrote:',
      data.excerpt,
      '',
      'Answer:',
      answer,
      '',
      data.signOff,
      '',
      last,
    ].join('\n'),
  }
}

// ── Suggest an update (WS09 step 28) ─────────────────────────────

/** Who a suggestion's email goes to: the club's rep, a representative of its region, or an LCA admin. */
export type SuggestionKeeperKind = 'club_rep' | 'region' | 'lca'

/** The heading of a keeper's email. */
export const SUGGESTION_HEADING = 'A suggestion for a club listing'

/** The link's words on a keeper's email. */
export const SUGGESTION_LINK_LABEL = 'Open the suggestion'

/** The line on a keeper's email when the visitor left an address: the keeper may reply from the site, and the address is not shown. */
export const SUGGESTION_ADDRESS_LEFT = 'They left an email address, so you can reply to them from the site. Their address is kept private, so it is not shown here.'

/** The line on a keeper's email when the visitor left no address. */
export const SUGGESTION_NO_ADDRESS = 'They left no email address, so there is no one to reply to.'

/** Where a keeper answers: on the site, where the club's Still accurate waits until they do. */
export const SUGGESTION_ANSWER_LINE = 'Answer it on the site: fix the listing, reply, or mark it not an issue. The club cannot be marked still accurate until you do.'

/** The last line of a keeper's email, as the relay's copies say it. */
export const SUGGESTION_FOOTER = 'A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.'

/**
 * Why a suggestion came to an LCA admin: the club has no rep and no one holds
 * its region's seat, or its keepers' addresses took nothing (or were the
 * address the visitor typed, which is never written to).
 */
export type SuggestionReason = 'no_keeper' | 'unreachable'

/** Why the suggestion came to this keeper. */
export function suggestionOpening(club: string, kind: SuggestionKeeperKind, region: string | null, reason: SuggestionReason): string {
  if (kind === 'club_rep') return `A visitor suggested an update to ${club}'s listing. It came to you as the club's representative.`
  if (kind === 'region') {
    const area = region ? oneLine(region) : ''
    return `A visitor suggested an update to ${club}'s listing. It came to you as the ${area || 'region\'s'} representative.`
  }
  return reason === 'no_keeper'
    ? `A visitor suggested an update to ${club}'s listing. It came to you as an LCA admin, since the club has no representative and no one holds its region's seat.`
    : `A visitor suggested an update to ${club}'s listing. It came to you as an LCA admin, since it could not reach the club's keepers.`
}

/**
 * The email a keeper gets for one suggestion. The subject is fixed words
 * with the club's name, never anything the visitor typed. It names which of
 * the six parts changed in the choice's own words, quotes the visitor's
 * words (escaped in the HTML and written as text in the plain part), says
 * whether an address was left but never the address, and links to the
 * suggestion's place on the site, where it is answered. Its `to` is empty, as
 * every template's is, and is filled for each person by the sender; the
 * reply-to is the site's own, never the visitor's.
 */
export function suggestionKeeperEmail(data: {
  siteUrl: string
  clubName: string
  region: string | null
  kind: SuggestionKeeperKind
  /** Why an LCA admin's email came to them; read only when `kind` is 'lca'. */
  reason: SuggestionReason
  choice: string
  message: string
  hasAddress: boolean
  link: string
}): EmailMessage {
  const clubName = oneLine(data.clubName)
  const choice = oneLine(data.choice)
  const message = data.message.trim()
  const opening = suggestionOpening(clubName, data.kind, data.region, data.reason)
  const address = data.hasAddress ? SUGGESTION_ADDRESS_LEFT : SUGGESTION_NO_ADDRESS
  return {
    to: '',
    subject: `A suggestion for ${clubName}'s listing on the LCA website`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: SUGGESTION_HEADING,
      preheader: `A suggestion for ${clubName}'s listing`,
      body: p(escapeHtml(opening)) + emailDetails([['What changed', choice]]) + emailQuote(message, 'Their words') + p(escapeHtml(address)) + p(escapeHtml(SUGGESTION_ANSWER_LINE)),
      cta: { label: SUGGESTION_LINK_LABEL, url: data.link },
      footerNote: escapeHtml(SUGGESTION_FOOTER),
    }),
    text: [
      `${SUGGESTION_HEADING}.`,
      '',
      opening,
      '',
      `What changed: ${choice}`,
      '',
      'Their words:',
      message,
      '',
      address,
      '',
      SUGGESTION_ANSWER_LINE,
      '',
      `${SUGGESTION_LINK_LABEL}: ${data.link}`,
      '',
      SUGGESTION_FOOTER,
    ].join('\n'),
  }
}

/**
 * Where a keeper of each kind answers on the site: Your club's page, the club's page in My region, the admin club
 * page, each at the suggestion's own row. Written here, where both of the suggestion's emails are drawn, so the
 * keeper's email (./suggestions.ts) and the email of the 14 days (./reportClock.ts) link the same way; `siteUrl` is the
 * site's own address (functions/utils/site.ts).
 */
export function suggestionLink(siteUrl: string, club: { id: string; slug: string | null }, kind: SuggestionKeeperKind, rowId: number): string {
  const place = kind === 'club_rep'
    ? `/my/club/${encodeURIComponent(club.slug ?? club.id)}`
    : kind === 'region'
      ? `/workspace/region/clubs/${encodeURIComponent(club.id)}`
      : `/admin/clubs/${encodeURIComponent(club.id)}`
  return `${siteUrl}${place}#suggestion-${rowId}`
}

// ── The 14 days (WS09 step 29) ───────────────────────────────────

/** The heading of the email a suggestion with no answer in 14 days sends on. */
export const OVERDUE_HEADING = 'A suggestion is still waiting for an answer'

/** Who had a suggestion first, by role alone: the club's rep, the region's representatives, or the LCA admins. */
export type OverdueFirst = 'club_rep' | 'region' | 'lca'

/** "16 days", the wait in whole days. */
function daysWord(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

/** Why the email came: no answer in the 14 days, and for whom it first went, by role alone; for the admins' own, a reminder. */
export function overdueWhy(first: OverdueFirst, dueDays: number): string {
  const none = `No one has answered it in ${daysWord(dueDays)}.`
  if (first === 'club_rep') return `${none} It went first to the club's representative.`
  if (first === 'region') return `${none} It went first to the region's representatives.`
  return `${none} It went first to the LCA admins, so this is a reminder.`
}

/** Why this copy came to this person, by the role they get it in. */
export function overdueCopyFor(kind: 'region' | 'lca', region: string | null): string {
  if (kind === 'region') {
    const area = region ? oneLine(region) : ''
    return `It comes to you as the ${area || 'region\'s'} representative.`
  }
  return 'It comes to you as an LCA admin.'
}

/**
 * The email for one suggestion with no answer in 14 days, to one LCA admin or
 * one of the region's representatives. The subject is fixed words with the
 * club's name, never anything the visitor typed. It names which of the six
 * parts changed in the choice's own words, quotes the visitor's words
 * (escaped in the HTML and written as text in the plain part), says how long
 * it has waited in whole days, why it came and for whom it first went by role
 * alone, whether an address was left but never the address, and links to the
 * suggestion's place on the site for this person's role. It names no one: no
 * keeper, no volunteer and not the visitor. Its `to` is empty, as every
 * template's is, and is filled for each person by the sender; the reply-to is
 * the site's own, never the visitor's.
 */
export function overdueSuggestionEmail(data: {
  siteUrl: string
  clubName: string
  region: string | null
  /** Who had it first, read from the club as it is at the run. */
  first: OverdueFirst
  /** The role this person gets it in. */
  kind: 'region' | 'lca'
  choice: string
  message: string
  hasAddress: boolean
  /** Whole days since the visitor sent it. */
  waitedDays: number
  /** The figure of the rule, SUGGESTION_DUE_DAYS in domain/clubs/regionCards.ts, handed in by the run. */
  dueDays: number
  link: string
}): EmailMessage {
  const clubName = oneLine(data.clubName)
  const choice = oneLine(data.choice)
  const message = data.message.trim()
  const opening = `A visitor suggested an update to ${clubName}'s listing ${daysWord(data.waitedDays)} ago, and it has not been answered.`
  const why = `${overdueWhy(data.first, data.dueDays)} ${overdueCopyFor(data.kind, data.region)}`
  const address = data.hasAddress ? SUGGESTION_ADDRESS_LEFT : SUGGESTION_NO_ADDRESS
  const waited = daysWord(data.waitedDays)
  return {
    to: '',
    subject: `A suggestion for ${clubName}'s listing is still waiting`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: OVERDUE_HEADING,
      preheader: `A suggestion for ${clubName}'s listing has waited ${waited}`,
      body: p(escapeHtml(opening)) + p(escapeHtml(why)) + emailDetails([['What changed', choice], ['Waiting', waited]]) + emailQuote(message, 'Their words') + p(escapeHtml(address)) + p(escapeHtml(SUGGESTION_ANSWER_LINE)),
      cta: { label: SUGGESTION_LINK_LABEL, url: data.link },
      footerNote: escapeHtml(SUGGESTION_FOOTER),
    }),
    text: [
      `${OVERDUE_HEADING}.`,
      '',
      opening,
      '',
      why,
      '',
      `What changed: ${choice}`,
      `Waiting: ${waited}`,
      '',
      'Their words:',
      message,
      '',
      address,
      '',
      SUGGESTION_ANSWER_LINE,
      '',
      `${SUGGESTION_LINK_LABEL}: ${data.link}`,
      '',
      SUGGESTION_FOOTER,
    ].join('\n'),
  }
}

/** How the club's own rep signs an answer to a suggestion: by the role and the club alone, never by a name. */
export function clubRepSignOff(clubName: string): string {
  return `${oneLine(clubName)} representative`
}
