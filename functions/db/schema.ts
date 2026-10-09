// functions/db/schema.ts
//
// The typed description of the D1 database for Drizzle's query builder
// (getDb in ./client.ts) and for drizzle-kit, which diffs it against
// drizzle/meta to write new migrations (npm run db:generate; see
// migrations/README.md). It was introspected with drizzle-kit pull from a
// local SQLite file built by applying migrations/*.sql in order
// (npm run db:local-sqlite), then reviewed by hand.
//
// The migrations are the source of truth. test/unit/schema-drift.test.ts
// compares every table and column here (name, type affinity, NOT NULL,
// default, primary key), every index and every foreign key with that local
// database, in both directions, so a migration that adds a column this file
// lacks fails the tests.
//
// What this file does not model, on purpose:
// - CHECK constraints (status lists and the like on tournaments,
//   registrations, payments, support tickets and messages, email campaigns
//   and recipients, announcements, posts, the feed cache and the old site
//   announcement). They stay in the migrations. Changing one means
//   rebuilding a table, which db:generate refuses (see migrations/README.md).
// - UNIQUE constraints written inside CREATE TABLE (lca_posts.slug,
//   tournament_reminders (member_id, tournament_id),
//   tournament_attendee_reminders (tournament_id, member_id,
//   reminder_number), tournament_games (tournament_id, round, board,
//   section)). SQLite backs them with unnamed indexes that Drizzle cannot
//   name, so declaring them here would make drizzle-kit believe in indexes
//   that do not exist. Named unique indexes (uniqueIndex below) are modelled.
// - The members role triggers (members_role_insert, members_role_update,
//   from 0046 and 0050) and the four triggers of 0053 that keep
//   tournament_sections, tournament_schedules and their rounds in step with
//   the tournaments.sections and round_schedule JSON columns, and fill
//   registrations.section_id and schedule_id, while code still writes only
//   the JSON. Triggers stay in hand-written migrations.
// - NULL in a TEXT primary key. SQLite allows it unless the column says NOT
//   NULL; Drizzle marks every primary key NOT NULL. No row has a NULL id.
//
// By hand after the pull: SQL defaults such as (datetime('now')) and
// (lower(hex(randomblob(8)))) were written out by drizzle-kit as quoted
// strings and are restored as sql`...`; the DEFAULT 0 on the four money
// columns of tournaments was missing; DESC columns and the WHERE of the
// partial index idx_seat_member_current were missing; the CHECK
// constraints it produced were wrong (every table got all of them) and are
// left out. 0/1 flags stay plain integers and dates stay text, because every
// existing query reads them that way.
//
// No runtime code imports this yet. Queries move to Drizzle only when a
// later change rewrites them.
import { sql } from 'drizzle-orm'
import { foreignKey, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const clubs = sqliteTable('clubs', {
  id: text().primaryKey(),
  name: text().notNull(),
  city: text().notNull(),
  location: text(),
  description: text(),
  meetingSchedule: text('meeting_schedule'),
  contactEmail: text('contact_email'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  color: text().default('#c8a94a'),
  imageUrl: text('image_url').default(sql`(NULL)`),
  region: text().default(sql`(NULL)`),
  latitude: real(),
  longitude: real(),
})

export const tournaments = sqliteTable('tournaments', {
  id: text().primaryKey(),
  name: text().notNull(),
  location: text().notNull(),
  venue: text(),
  date: text().notNull(),
  endDate: text('end_date'),
  entryFee: real('entry_fee').default(0).notNull(),
  sections: text().default('[]').notNull(),
  rounds: integer().default(4).notNull(),
  maxPlayers: integer('max_players'),
  status: text().default('upcoming').notNull(),
  description: text(),
  registrationDeadline: text('registration_deadline'),
  clubId: text('club_id').references(() => clubs.id),
  createdBy: text('created_by').references(() => members.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  registrationStatus: text('registration_status').default('draft').notNull(),
  registrationOpensAt: text('registration_opens_at'),
  reminder1DaysBefore: integer('reminder_1_days_before').default(7),
  reminder1Enabled: integer('reminder_1_enabled').default(1),
  reminder2DaysBefore: integer('reminder_2_days_before').default(1),
  reminder2Enabled: integer('reminder_2_enabled').default(1),
  isRated: integer('is_rated').default(1).notNull(),
  isVisible: integer('is_visible').default(1).notNull(),
  roundSchedule: text('round_schedule'),
  registrationClosesAt: text('registration_closes_at'),
  customDetails: text('custom_details'),
  timeControl: text('time_control'),
  registrationUrl: text('registration_url').default(sql`(NULL)`),
  eligibility: text().default(sql`(NULL)`),
  organizer: text().default(sql`(NULL)`),
  pairingSystem: text('pairing_system').default('uscf').notNull(),
  earlyDeadline: text('early_deadline'),
  earlyDiscount: real('early_discount').default(0).notNull(),
  lateAfter: text('late_after'),
  lateFee: real('late_fee').default(0).notNull(),
  // Retired (there is no member price): neither read nor written since 0054,
  // kept so no data is dropped.
  memberDiscount: real('member_discount').default(0).notNull(),
  accelerated: integer().default(0).notNull(),
  keepApart: text('keep_apart').default('family').notNull(),
  reportSettings: text('report_settings'),
  isStateChampionship: integer('is_state_championship').default(0).notNull(),
  // Entering needs a current LCA membership (domain/membership/requirement.ts).
  // On by default; club-run events start with it off (0054).
  requiresLcaMembership: integer('requires_lca_membership').default(1).notNull(),
},
(table) => [
  index('idx_tournaments_club_id').on(table.clubId),
  index('idx_tournaments_status').on(table.status),
])

// One row per section of a tournament (0052). tournaments.sections, the JSON
// column, stays and stays authoritative until the code reads this table;
// the 0053 triggers copy it here on every write. Rows are archived, never
// deleted, so an entry or a game always finds its section. A null
// fee_regular means the tournament's entry_fee. A null fee_early or
// fee_late means that tier is worked out when read, from the tournament's
// own early_deadline, early_discount, late_after and late_fee; neither is
// ever a stored copy of those columns.
export const tournamentSections = sqliteTable('tournament_sections', {
  id: text().default(sql`(lower(hex(randomblob(8))))`).primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  position: integer().default(0).notNull(),
  name: text().notNull(),
  feeRegular: real('fee_regular'),
  feeEarly: real('fee_early'),
  feeLate: real('fee_late'),
  cap: integer(),
  prizeFund: text('prize_fund'),
  ratingMin: integer('rating_min'),
  ratingMax: integer('rating_max'),
  unratedOk: integer('unrated_ok'),
  gradeMin: integer('grade_min'),
  gradeMax: integer('grade_max'),
  rulesSet: integer('rules_set').default(0).notNull(),
  prizesJson: text('prizes_json'),
  extraJson: text('extra_json'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_tournament_sections_tournament_id').on(table.tournamentId),
  uniqueIndex('idx_tournament_sections_live_name').on(table.tournamentId, table.name).where(sql`archived_at IS NULL`),
])

// The round times of a tournament (0052). Every tournament has one live
// primary schedule, filled from tournaments.round_schedule by the 0053
// triggers. A null time_control means the tournament's own.
export const tournamentSchedules = sqliteTable('tournament_schedules', {
  id: text().default(sql`(lower(hex(randomblob(8))))`).primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  position: integer().default(0).notNull(),
  label: text().default('Main schedule').notNull(),
  timeControl: text('time_control'),
  isPrimary: integer('is_primary').default(0).notNull(),
  mergeRound: integer('merge_round'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_tournament_schedules_tournament_id').on(table.tournamentId),
  uniqueIndex('idx_tournament_schedules_primary').on(table.tournamentId).where(sql`is_primary = 1 AND archived_at IS NULL`),
])

export const tournamentScheduleRounds = sqliteTable('tournament_schedule_rounds', {
  scheduleId: text('schedule_id').notNull().references(() => tournamentSchedules.id, { onDelete: 'cascade' }),
  round: integer().notNull(),
  date: text(),
  time: text(),
},
(table) => [
  primaryKey({ columns: [table.scheduleId, table.round], name: 'tournament_schedule_rounds_schedule_id_round_pk' }),
])

export const registrations = sqliteTable('registrations', {
  id: text().primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id),
  memberId: text('member_id').notNull().references(() => members.id),
  section: text().notNull(),
  paymentStatus: text('payment_status').default('pending').notNull(),
  registeredAt: text('registered_at').default(sql`(datetime('now'))`).notNull(),
  byeRounds: text('bye_rounds'),
  withdrawnAt: text('withdrawn_at'),
  checkedInAt: text('checked_in_at'),
  ratingAtEntry: integer('rating_at_entry'),
  grade: text(),
  waitlistedAt: text('waitlisted_at'),
  // Filled by the 0053 triggers from section (the name) and the primary
  // schedule. No ON DELETE: section and schedule rows are archived, never
  // deleted, while an entry points at them.
  sectionId: text('section_id').references(() => tournamentSections.id),
  scheduleId: text('schedule_id').references(() => tournamentSchedules.id),
},
(table) => [
  index('idx_registrations_member_id').on(table.memberId),
  index('idx_registrations_tournament_id').on(table.tournamentId),
  index('idx_registrations_section_id').on(table.sectionId),
  index('idx_registrations_schedule_id').on(table.scheduleId),
])

export const clubOfficers = sqliteTable('club_officers', {
  id: text().primaryKey(),
  clubId: text('club_id').notNull().references(() => clubs.id),
  memberId: text('member_id').notNull().references(() => members.id),
  role: text().notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_club_officers_club_id').on(table.clubId),
])

export const clubNews = sqliteTable('club_news', {
  id: text().primaryKey(),
  clubId: text('club_id').notNull().references(() => clubs.id),
  title: text().notNull(),
  newsDate: text('news_date').notNull(),
  excerpt: text().notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_club_news_club_id').on(table.clubId),
])

export const tournamentDirectors = sqliteTable('tournament_directors', {
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  assignedAt: text('assigned_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_tournament_directors_member_id').on(table.memberId),
  primaryKey({ columns: [table.tournamentId, table.memberId], name: 'tournament_directors_tournament_id_member_id_pk' }),
])

export const tournamentReminders = sqliteTable('tournament_reminders', {
  id: text().primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  email: text().notNull(),
  sentRegistrationOpen: integer('sent_registration_open').default(0).notNull(),
  sentWeekBefore: integer('sent_week_before').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  registrationOpenedNotifiedAt: text('registration_opened_notified_at'),
},
(table) => [
  index('idx_tournament_reminders_member_id').on(table.memberId),
  index('idx_tournament_reminders_tournament_id').on(table.tournamentId),
])

export const tournamentAttendeeReminders = sqliteTable('tournament_attendee_reminders', {
  id: text().primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  reminderNumber: integer('reminder_number').notNull(),
  sentAt: text('sent_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_attendee_reminders_tournament_id').on(table.tournamentId),
])

export const contactMessages = sqliteTable('contact_messages', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  subject: text().notNull(),
  body: text().notNull(),
  status: text().default('unread').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
})

export const supportTickets = sqliteTable('support_tickets', {
  id: text().primaryKey(),
  memberId: text('member_id').references(() => members.id, { onDelete: 'set null' }),
  name: text().notNull(),
  email: text().notNull(),
  subject: text().notNull(),
  status: text().default('open').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  seatId: text('seat_id').references(() => boardMembers.id),
  number: integer(),
},
(table) => [
  uniqueIndex('idx_support_tickets_number').on(table.number),
  index('idx_support_tickets_seat_id').on(table.seatId),
  index('idx_support_tickets_status').on(table.status),
  index('idx_support_tickets_member_id').on(table.memberId),
])

export const supportMessages = sqliteTable('support_messages', {
  id: text().primaryKey(),
  ticketId: text('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  senderId: text('sender_id'),
  senderType: text('sender_type').notNull(),
  body: text().notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  isNote: integer('is_note').default(0).notNull(),
  loggedBy: text('logged_by').references(() => members.id),
  occurredAt: text('occurred_at'),
},
(table) => [
  index('idx_support_messages_notes').on(table.ticketId, table.isNote),
  index('idx_support_messages_ticket_id').on(table.ticketId),
])

export const boardMembers = sqliteTable('board_members', {
  id: text().default(sql`(lower(hex(randomblob(8))))`).primaryKey(),
  role: text().notNull(),
  name: text().notNull(),
  email: text(),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  slug: text(),
  category: text().default('officer').notNull(),
  isActive: integer('is_active').default(1).notNull(),
  isShared: integer('is_shared').default(0).notNull(),
  photoUrl: text('photo_url'),
},
(table) => [
  uniqueIndex('idx_board_members_slug').on(table.slug),
])

export const governanceDocuments = sqliteTable('governance_documents', {
  id: text().default(sql`(lower(hex(randomblob(8))))`).primaryKey(),
  category: text().notNull(),
  title: text().notNull(),
  filename: text(),
  fileUrl: text('file_url'),
  docDate: text('doc_date'),
  year: integer(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  content: text(),
})

export const clearinghouse = sqliteTable('clearinghouse', {
  id: text().primaryKey(),
  name: text().notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  organizer: text(),
  city: text(),
  state: text(),
  venue: text(),
  ratingSystem: text('rating_system'),
  eligibility: text(),
  contact: text(),
  link: text(),
  isLca: integer('is_lca').default(0),
  syncedAt: text('synced_at').default(sql`(datetime('now'))`),
},
(table) => [
  index('idx_clearinghouse_state').on(table.state),
  index('idx_clearinghouse_start_date').on(table.startDate),
])

export const payments = sqliteTable('payments', {
  id: text().primaryKey(),
  memberId: text('member_id').references(() => members.id),
  amount: real().notNull(),
  type: text().notNull(),
  referenceId: text('reference_id').notNull(),
  status: text().default('pending').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  stripeSessionId: text('stripe_session_id'),
  stripePaymentIntent: text('stripe_payment_intent'),
},
(table) => [
  index('idx_payments_member_id').on(table.memberId),
])

export const tournamentGames = sqliteTable('tournament_games', {
  id: text().primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  round: integer().notNull(),
  board: integer().notNull(),
  section: text().notNull(),
  whiteMemberId: text('white_member_id').references(() => members.id),
  blackMemberId: text('black_member_id').references(() => members.id),
  result: text().default('pending').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_tournament_games_tournament_id').on(table.tournamentId),
])

export const emailCampaigns = sqliteTable('email_campaigns', {
  id: text().primaryKey(),
  subject: text().notNull(),
  bodyHtml: text('body_html').notNull(),
  filterJson: text('filter_json').notNull(),
  totalRecipients: integer('total_recipients').default(0).notNull(),
  sentCount: integer('sent_count').default(0).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  status: text().default('sending').notNull(),
  createdBy: text('created_by').references(() => members.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  completedAt: text('completed_at'),
},
(table) => [
  index('idx_campaigns_status').on(table.status),
])

export const siteAnnouncement = sqliteTable('site_announcement', {
  id: integer().primaryKey(),
  enabled: integer().default(0).notNull(),
  message: text().default('').notNull(),
  linkUrl: text('link_url'),
  linkLabel: text('link_label'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  updatedBy: text('updated_by'),
})

export const facebookFeedCache = sqliteTable('facebook_feed_cache', {
  id: integer().primaryKey(),
  postsJson: text('posts_json').default('[]').notNull(),
  cachedAt: text('cached_at'),
})

export const boardSeatAssignments = sqliteTable('board_seat_assignments', {
  id: text().default(sql`(lower(hex(randomblob(8))))`).primaryKey(),
  seatId: text('seat_id').notNull().references(() => boardMembers.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').default(sql`(datetime('now'))`).notNull(),
  endedAt: text('ended_at'),
  appointedBy: text('appointed_by').references(() => members.id),
  note: text(),
},
(table) => [
  uniqueIndex('idx_seat_member_current').on(table.seatId, table.memberId).where(sql`ended_at IS NULL`),
  index('idx_seat_assignments_member').on(table.memberId, table.endedAt),
])

export const adminAuditLog = sqliteTable('admin_audit_log', {
  id: text().primaryKey(),
  actorId: text('actor_id').notNull().references(() => members.id),
  actorEmail: text('actor_email').notNull(),
  action: text().notNull(),
  targetMemberId: text('target_member_id').references(() => members.id),
  targetLabel: text('target_label'),
  detail: text(),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_admin_audit_action').on(table.action, sql`created_at DESC`),
  index('idx_admin_audit_actor').on(table.actorId, sql`created_at DESC`),
  index('idx_admin_audit_created').on(sql`created_at DESC`),
])

export const siteAnnouncements = sqliteTable('site_announcements', {
  id: text().primaryKey(),
  enabled: integer().default(1).notNull(),
  message: text().default('').notNull(),
  linkUrl: text('link_url'),
  linkLabel: text('link_label'),
  tone: text().default('gold').notNull(),
  size: text().default('default').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  startsAt: text('starts_at'),
  endsAt: text('ends_at'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  updatedBy: text('updated_by'),
},
(table) => [
  index('idx_announcements_active').on(table.enabled, table.sortOrder),
])

export const uscfRatingHistory = sqliteTable('uscf_rating_history', {
  id: text().primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id),
  ratingSystem: text('rating_system').notNull(),
  rating: integer().notNull(),
  isProvisional: integer('is_provisional').default(0).notNull(),
  gamesPlayed: integer('games_played'),
  ratingFloor: integer('rating_floor'),
  effectiveDate: text('effective_date'),
  recordedAt: text('recorded_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_rating_history_latest').on(table.memberId, table.ratingSystem, sql`recorded_at DESC`),
  index('idx_rating_history_member').on(table.memberId, table.ratingSystem, table.recordedAt),
])

export const scanUsage = sqliteTable('scan_usage', {
  memberId: text('member_id').notNull().references(() => members.id),
  day: text().notNull(),
  count: integer().default(0).notNull(),
},
(table) => [
  primaryKey({ columns: [table.memberId, table.day], name: 'scan_usage_member_id_day_pk' }),
])

export const lcaPosts = sqliteTable('lca_posts', {
  id: text().primaryKey(),
  slug: text().notNull(),
  title: text().notNull(),
  summary: text().default('').notNull(),
  bodyHtml: text('body_html').default('').notNull(),
  imageUrl: text('image_url'),
  linkUrl: text('link_url'),
  linkLabel: text('link_label'),
  status: text().default('draft').notNull(),
  pinned: integer().default(0).notNull(),
  publishedAt: text('published_at'),
  createdBy: text('created_by').references(() => members.id),
  updatedBy: text('updated_by').references(() => members.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_lca_posts_status_date').on(table.status, table.publishedAt),
])

export const emailCampaignRecipients = sqliteTable('email_campaign_recipients', {
  id: text().primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => emailCampaigns.id),
  memberId: text('member_id').references(() => members.id),
  email: text().notNull(),
  status: text().default('pending').notNull(),
  error: text(),
  sentAt: text('sent_at'),
  claimedAt: text('claimed_at'),
  attempts: integer().default(0).notNull(),
},
(table) => [
  index('idx_campaign_recipients_pending').on(table.campaignId, table.status),
  index('idx_campaign_recipients_campaign').on(table.campaignId),
])

export const members = sqliteTable('members', {
  id: text().primaryKey(),
  email: text().notNull(),
  fullName: text('full_name').notNull(),
  uscfId: text('uscf_id'),
  membershipStatus: text('membership_status').default('pending').notNull(),
  membershipExpiry: text('membership_expiry'),
  role: text().default('member').notNull(),
  clubId: text('club_id').references(() => clubs.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  uscfRating: integer('uscf_rating'),
  uscfRatingUpdatedAt: text('uscf_rating_updated_at'),
  membershipType: text('membership_type').default(sql`(NULL)`),
  guardianId: text('guardian_id').default(sql`(NULL)`),
  uscfExpiration: text('uscf_expiration'),
  photoUrl: text('photo_url'),
},
(table) => [
  index('idx_members_guardian_id').on(table.guardianId),
  index('idx_members_club_id').on(table.clubId),
  index('idx_members_role').on(table.role),
  index('idx_members_email').on(table.email),
  foreignKey({
    columns: [table.guardianId],
    foreignColumns: [table.id],
    name: 'members_guardian_id_members_id_fk',
  }),
])

export const stateChampions = sqliteTable('state_champions', {
  id: text().default(sql`(lower(hex(randomblob(8))))`).primaryKey(),
  year: integer().notNull(),
  title: text().notNull(),
  champion: text().notNull(),
  notes: text(),
  tournamentId: text('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
},
(table) => [
  index('idx_state_champions_year').on(sql`year DESC`, table.title),
])

export const seatRegions = sqliteTable('seat_regions', {
  seatId: text('seat_id').notNull().references(() => boardMembers.id, { onDelete: 'cascade' }),
  region: text().notNull(),
},
(table) => [
  index('idx_seat_regions_region').on(table.region),
  primaryKey({ columns: [table.seatId, table.region], name: 'seat_regions_seat_id_region_pk' }),
])

