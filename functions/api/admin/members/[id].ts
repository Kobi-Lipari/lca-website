// functions/api/admin/members/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'
import { deleteSupabaseUser } from '../../../utils/supabase'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const memberId = context.params.id as string

  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const db = context.env.DB
  const existing = await db.prepare(
    'SELECT * FROM members WHERE id = ?'
  ).bind(memberId).first()

  if (!existing) return errorResponse('Member not found', 404)

  // Two kinds of history have to outlive an account, and both point at the
  // member row, so the row has to stay: games (the opponents' results,
  // standings and rating reports are built from them) and the activity log
  // entries for changes this person made. Say so before touching anything.
  const played = await db.prepare(
    'SELECT 1 FROM tournament_games WHERE white_member_id = ?1 OR black_member_id = ?1 LIMIT 1',
  ).bind(memberId).first()
  if (played) {
    return errorResponse(
      'This member has played in a tournament, so the account cannot be deleted: the games, standings and rating reports point at it. Nothing was changed.',
      409,
    )
  }
  const acted = await db.prepare(
    'SELECT 1 FROM admin_audit_log WHERE actor_id = ? LIMIT 1',
  ).bind(memberId).first()
  if (acted) {
    // Not only admins and directors: a player who withdraws from a tournament
    // online is logged as the one who acted, so this reaches ordinary members
    // too. Only point at the role when there is one to take away.
    const instead = existing.role === 'member'
      ? 'Its role is already Member, so the account can simply be left in place.'
      : 'To take away its access, change its role to Member instead.'
    return errorResponse(
      `This account cannot be deleted: the activity log records things it did (changes made as an admin or director, for example, or withdrawing from a tournament online), and those entries point at the account. ${instead} Nothing was changed.`,
      409,
    )
  }

  // Every table that references this member, in one batch. D1 runs a batch
  // as a single transaction, so the delete happens completely or not at all.
  // These used to be separate statements: when the last one failed on a
  // reference nobody had listed (a rating on file was enough), the member
  // stayed but their registrations and payments were already gone.
  const forMember = (sql: string) => db.prepare(sql).bind(memberId)
  try {
    await db.batch([
      forMember('DELETE FROM registrations WHERE member_id = ?'),
      forMember('DELETE FROM payments WHERE member_id = ?'),
      forMember('DELETE FROM club_officers WHERE member_id = ?'),
      forMember('DELETE FROM tournament_directors WHERE member_id = ?'),
      forMember('DELETE FROM tournament_reminders WHERE member_id = ?'),
      forMember('DELETE FROM tournament_attendee_reminders WHERE member_id = ?'),
      forMember('DELETE FROM support_messages WHERE sender_id = ?'),
      forMember('DELETE FROM support_tickets WHERE member_id = ?'),
      forMember('DELETE FROM board_seat_assignments WHERE member_id = ?'),
      forMember('DELETE FROM email_campaign_recipients WHERE member_id = ?'),
      forMember('DELETE FROM uscf_rating_history WHERE member_id = ?'),
      forMember('DELETE FROM scan_usage WHERE member_id = ?'),
      // Records about other things that only name this member: keep the
      // record, drop the link. The activity log keeps its own copy of who
      // an entry was about (target_label) for exactly this case.
      forMember('UPDATE admin_audit_log SET target_member_id = NULL WHERE target_member_id = ?'),
      forMember('UPDATE tournaments SET created_by = NULL WHERE created_by = ?'),
      forMember('UPDATE email_campaigns SET created_by = NULL WHERE created_by = ?'),
      forMember('UPDATE lca_posts SET created_by = NULL WHERE created_by = ?'),
      forMember('UPDATE lca_posts SET updated_by = NULL WHERE updated_by = ?'),
      forMember('UPDATE board_seat_assignments SET appointed_by = NULL WHERE appointed_by = ?'),
      forMember('UPDATE support_messages SET logged_by = NULL WHERE logged_by = ?'),
      // Children managed by this account keep their own history (games, ratings)
      // and simply stop having a parent attached; an admin can reattach them.
      forMember('UPDATE members SET guardian_id = NULL WHERE guardian_id = ?'),
      forMember('DELETE FROM members WHERE id = ?'),
    ])
  } catch (err) {
    // A reference this list does not know about yet (a table added later).
    // The batch rolled back, so say that rather than a bare 500.
    if (!/FOREIGN KEY/i.test(err instanceof Error ? err.message : String(err))) throw err
    return errorResponse(
      'This member could not be deleted because other records still point at the account. Nothing was changed.',
      409,
    )
  }

  // The auth user last, so a failure here leaves an orphaned login rather than
  // a member row pointing at nothing. Reported so the admin can see it rather
  // than being told the whole delete failed.
  const authDeleted = await deleteSupabaseUser(context.env, memberId)

  return jsonResponse({ success: true, authDeleted })
}
