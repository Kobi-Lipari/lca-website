// functions/db/relations.ts
//
// Relations between the tables in schema.ts, for Drizzle's relational queries
// (db.query.members.findFirst({ with: { club: true } })). They describe the
// foreign keys already in the migrations and add nothing to the database.
// Introspected by drizzle-kit pull; a few relation names were made plain by
// hand: tournaments.creator, members.guardian and members.dependents (the
// guardian_id self-link), supportMessages.loggedByMember and
// emailCampaigns.creator. Where two foreign keys point at the same table the
// relationName pairs each side with its partner.
import { relations } from 'drizzle-orm/relations'
import {
  adminAuditLog,
  boardMembers,
  boardSeatAssignments,
  clubNews,
  clubOfficers,
  clubs,
  emailCampaignRecipients,
  emailCampaigns,
  lcaPosts,
  members,
  payments,
  registrations,
  scanUsage,
  seatRegions,
  stateChampions,
  supportMessages,
  supportTickets,
  tournamentAttendeeReminders,
  tournamentDirectors,
  tournamentGames,
  tournamentReminders,
  tournaments,
  uscfRatingHistory,
} from './schema'

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  creator: one(members, {
    fields: [tournaments.createdBy],
    references: [members.id],
  }),
  club: one(clubs, {
    fields: [tournaments.clubId],
    references: [clubs.id],
  }),
  registrations: many(registrations),
  tournamentDirectors: many(tournamentDirectors),
  tournamentReminders: many(tournamentReminders),
  tournamentAttendeeReminders: many(tournamentAttendeeReminders),
  tournamentGames: many(tournamentGames),
  stateChampions: many(stateChampions),
}))

export const membersRelations = relations(members, ({ one, many }) => ({
  tournaments: many(tournaments),
  registrations: many(registrations),
  clubOfficers: many(clubOfficers),
  tournamentDirectors: many(tournamentDirectors),
  tournamentReminders: many(tournamentReminders),
  tournamentAttendeeReminders: many(tournamentAttendeeReminders),
  supportTickets: many(supportTickets),
  supportMessages: many(supportMessages),
  payments: many(payments),
  tournamentGames_blackMemberId: many(tournamentGames, {
    relationName: 'tournamentGames_blackMemberId_members_id',
  }),
  tournamentGames_whiteMemberId: many(tournamentGames, {
    relationName: 'tournamentGames_whiteMemberId_members_id',
  }),
  emailCampaigns: many(emailCampaigns),
  boardSeatAssignments_appointedBy: many(boardSeatAssignments, {
    relationName: 'boardSeatAssignments_appointedBy_members_id',
  }),
  boardSeatAssignments_memberId: many(boardSeatAssignments, {
    relationName: 'boardSeatAssignments_memberId_members_id',
  }),
  adminAuditLogs_targetMemberId: many(adminAuditLog, {
    relationName: 'adminAuditLog_targetMemberId_members_id',
  }),
  adminAuditLogs_actorId: many(adminAuditLog, {
    relationName: 'adminAuditLog_actorId_members_id',
  }),
  uscfRatingHistories: many(uscfRatingHistory),
  scanUsages: many(scanUsage),
  lcaPosts_updatedBy: many(lcaPosts, {
    relationName: 'lcaPosts_updatedBy_members_id',
  }),
  lcaPosts_createdBy: many(lcaPosts, {
    relationName: 'lcaPosts_createdBy_members_id',
  }),
  emailCampaignRecipients: many(emailCampaignRecipients),
  guardian: one(members, {
    fields: [members.guardianId],
    references: [members.id],
    relationName: 'members_guardianId_members_id',
  }),
  dependents: many(members, {
    relationName: 'members_guardianId_members_id',
  }),
  club: one(clubs, {
    fields: [members.clubId],
    references: [clubs.id],
  }),
}))

export const clubsRelations = relations(clubs, ({ many }) => ({
  tournaments: many(tournaments),
  clubOfficers: many(clubOfficers),
  clubNews: many(clubNews),
  members: many(members),
}))

export const registrationsRelations = relations(registrations, ({ one }) => ({
  member: one(members, {
    fields: [registrations.memberId],
    references: [members.id],
  }),
  tournament: one(tournaments, {
    fields: [registrations.tournamentId],
    references: [tournaments.id],
  }),
}))

export const clubOfficersRelations = relations(clubOfficers, ({ one }) => ({
  member: one(members, {
    fields: [clubOfficers.memberId],
    references: [members.id],
  }),
  club: one(clubs, {
    fields: [clubOfficers.clubId],
    references: [clubs.id],
  }),
}))

export const clubNewsRelations = relations(clubNews, ({ one }) => ({
  club: one(clubs, {
    fields: [clubNews.clubId],
    references: [clubs.id],
  }),
}))

export const tournamentDirectorsRelations = relations(tournamentDirectors, ({ one }) => ({
  member: one(members, {
    fields: [tournamentDirectors.memberId],
    references: [members.id],
  }),
  tournament: one(tournaments, {
    fields: [tournamentDirectors.tournamentId],
    references: [tournaments.id],
  }),
}))

export const tournamentRemindersRelations = relations(tournamentReminders, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentReminders.tournamentId],
    references: [tournaments.id],
  }),
  member: one(members, {
    fields: [tournamentReminders.memberId],
    references: [members.id],
  }),
}))

export const tournamentAttendeeRemindersRelations = relations(tournamentAttendeeReminders, ({ one }) => ({
  member: one(members, {
    fields: [tournamentAttendeeReminders.memberId],
    references: [members.id],
  }),
  tournament: one(tournaments, {
    fields: [tournamentAttendeeReminders.tournamentId],
    references: [tournaments.id],
  }),
}))

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  boardMember: one(boardMembers, {
    fields: [supportTickets.seatId],
    references: [boardMembers.id],
  }),
  member: one(members, {
    fields: [supportTickets.memberId],
    references: [members.id],
  }),
  supportMessages: many(supportMessages),
}))

export const boardMembersRelations = relations(boardMembers, ({ many }) => ({
  supportTickets: many(supportTickets),
  boardSeatAssignments: many(boardSeatAssignments),
  seatRegions: many(seatRegions),
}))

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  loggedByMember: one(members, {
    fields: [supportMessages.loggedBy],
    references: [members.id],
  }),
  supportTicket: one(supportTickets, {
    fields: [supportMessages.ticketId],
    references: [supportTickets.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  member: one(members, {
    fields: [payments.memberId],
    references: [members.id],
  }),
}))

export const tournamentGamesRelations = relations(tournamentGames, ({ one }) => ({
  member_blackMemberId: one(members, {
    fields: [tournamentGames.blackMemberId],
    references: [members.id],
    relationName: 'tournamentGames_blackMemberId_members_id',
  }),
  member_whiteMemberId: one(members, {
    fields: [tournamentGames.whiteMemberId],
    references: [members.id],
    relationName: 'tournamentGames_whiteMemberId_members_id',
  }),
  tournament: one(tournaments, {
    fields: [tournamentGames.tournamentId],
    references: [tournaments.id],
  }),
}))

export const emailCampaignsRelations = relations(emailCampaigns, ({ one, many }) => ({
  creator: one(members, {
    fields: [emailCampaigns.createdBy],
    references: [members.id],
  }),
  emailCampaignRecipients: many(emailCampaignRecipients),
}))

export const boardSeatAssignmentsRelations = relations(boardSeatAssignments, ({ one }) => ({
  member_appointedBy: one(members, {
    fields: [boardSeatAssignments.appointedBy],
    references: [members.id],
    relationName: 'boardSeatAssignments_appointedBy_members_id',
  }),
  member_memberId: one(members, {
    fields: [boardSeatAssignments.memberId],
    references: [members.id],
    relationName: 'boardSeatAssignments_memberId_members_id',
  }),
  boardMember: one(boardMembers, {
    fields: [boardSeatAssignments.seatId],
    references: [boardMembers.id],
  }),
}))

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  member_targetMemberId: one(members, {
    fields: [adminAuditLog.targetMemberId],
    references: [members.id],
    relationName: 'adminAuditLog_targetMemberId_members_id',
  }),
  member_actorId: one(members, {
    fields: [adminAuditLog.actorId],
    references: [members.id],
    relationName: 'adminAuditLog_actorId_members_id',
  }),
}))

export const uscfRatingHistoryRelations = relations(uscfRatingHistory, ({ one }) => ({
  member: one(members, {
    fields: [uscfRatingHistory.memberId],
    references: [members.id],
  }),
}))

export const scanUsageRelations = relations(scanUsage, ({ one }) => ({
  member: one(members, {
    fields: [scanUsage.memberId],
    references: [members.id],
  }),
}))

export const lcaPostsRelations = relations(lcaPosts, ({ one }) => ({
  member_updatedBy: one(members, {
    fields: [lcaPosts.updatedBy],
    references: [members.id],
    relationName: 'lcaPosts_updatedBy_members_id',
  }),
  member_createdBy: one(members, {
    fields: [lcaPosts.createdBy],
    references: [members.id],
    relationName: 'lcaPosts_createdBy_members_id',
  }),
}))

export const emailCampaignRecipientsRelations = relations(emailCampaignRecipients, ({ one }) => ({
  member: one(members, {
    fields: [emailCampaignRecipients.memberId],
    references: [members.id],
  }),
  emailCampaign: one(emailCampaigns, {
    fields: [emailCampaignRecipients.campaignId],
    references: [emailCampaigns.id],
  }),
}))

export const stateChampionsRelations = relations(stateChampions, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [stateChampions.tournamentId],
    references: [tournaments.id],
  }),
}))

export const seatRegionsRelations = relations(seatRegions, ({ one }) => ({
  boardMember: one(boardMembers, {
    fields: [seatRegions.seatId],
    references: [boardMembers.id],
  }),
}));