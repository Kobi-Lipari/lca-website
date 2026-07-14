// functions/api/tournaments/[id]/remind.ts
import type { Env } from '../../../types'
import { verifySupabaseUser } from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
} from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await verifySupabaseUser(context.request, context.env)
  if (!user) return errorResponse('Unauthorized', 401)

  const tournamentId = context.params.id as string

  const tournament = await context.env.DB.prepare(
    'SELECT id, name FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first()

  if (!tournament) return errorResponse('Tournament not found', 404)

  const member = await context.env.DB.prepare(
    'SELECT email FROM members WHERE id = ?',
  ).bind(user.id).first<{ email: string }>()

  if (!member) return errorResponse('Member not found', 404)

  const id = `reminder-${user.id}-${tournamentId}`

  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO tournament_reminders
     (id, member_id, tournament_id, email)
     VALUES (?, ?, ?, ?)`,
  ).bind(id, user.id, tournamentId, member.email).run()

  return jsonResponse({ success: true })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const user = await verifySupabaseUser(context.request, context.env)
  if (!user) return errorResponse('Unauthorized', 401)

  const tournamentId = context.params.id as string
  const id = `reminder-${user.id}-${tournamentId}`

  await context.env.DB.prepare(
    'DELETE FROM tournament_reminders WHERE id = ?',
  ).bind(id).run()

  return jsonResponse({ success: true })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await verifySupabaseUser(context.request, context.env)
  if (!user) return jsonResponse({ opted_in: false })

  const tournamentId = context.params.id as string
  const id = `reminder-${user.id}-${tournamentId}`

  const reminder = await context.env.DB.prepare(
    'SELECT id FROM tournament_reminders WHERE id = ?',
  ).bind(id).first()

  return jsonResponse({ opted_in: !!reminder })
}