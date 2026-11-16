// functions/api/admin/tournaments.ts
import type { Env, TournamentRow } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../utils/response'
import { recordAdminAction } from '../../utils/admin/audit'
import { getDb } from '../../db/client'
import { tournamentDirectors, tournaments } from '../../db/schema'
import { createTournamentRequestSchema } from '../../../domain/contracts/events'
import { buildSaveSections, isSectionsConflict, loadSections, runBatch, savedSectionFees, toTournamentResponse } from '../../utils/events/sectionsRepo'
import { loadSchedules } from '../../utils/events/schedulesRepo'
import { CREATION_ROLES_ON, creationPerson } from '../../utils/events/creation'
import { SECTIONS_CHANGED_MESSAGE } from '../../../domain/events/sections'
import { FEES_NEED_PAYOUT_ACCOUNT, LCA_RUN_ONLY, canChargeFees, canCreate, feesRaised, regionAlone } from '../../../domain/events/creation'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../../domain/membership/requirement'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

/** A section of a create request, without the id it may carry. */
function withoutId<S extends { id?: string }>(section: S): S {
  const copy: S = { ...section }
  delete copy.id
  return copy
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const { member } = authed

  // Who may create is the creation rules' answer (domain/events/creation.ts)
  // for the person their database half reads. CREATION_ROLES_ON is read here,
  // at each request; while it is unset the seat and the tournament_director
  // role grant nothing, so the rules answer as today's checks did. While
  // REGION_EVENTS_ON is unset the person has no region's clubs and no seat
  // is read; once it is set, a regional seat gives the grant regional_rep
  // and the clubs it keeps (WS09 step 16).
  const rolesOn = CREATION_ROLES_ON
  let person = await creationPerson(context.env.DB, member, rolesOn)
  const isAdmin = person.grant === 'admin'

  // No grant, no create, as before for everyone but an LCA admin and a club
  // rep. A club rep is let through whatever its grant: one with no club is
  // answered after the body check, as before.
  if (person.grant === 'none' && member.role !== 'club_rep') {
    return errorResponse('Forbidden', 403)
  }

  const body = await parseBody(context.request, createTournamentRequestSchema)
  if (isResponse(body)) return body
  if (!body.name || !body.location || !body.date || body.entryFee == null) {
    return errorResponse('name, location, date, and entryFee are required', 400)
  }

  // A club rep always creates for their own club. A rep with no club would
  // create an event nobody but an admin could ever manage, so refuse instead.
  if (member.role === 'club_rep' && !member.club_id) {
    return errorResponse('Your account is not linked to a club yet. Ask an LCA admin to assign you one.', 403)
  }
  // Whether the person creates as the region's representative (WS09 step
  // 17): the club named is one their regional seats keep, and not one they
  // run as an LCA admin or as its rep. Never while REGION_EVENTS_ON is unset,
  // when the person has no region's clubs.
  const asRepresentative = !!body.clubId && regionAlone(person, body.clubId)
  // A club rep who also holds a regional seat and names another club in the
  // region creates for that club, as its representative: the rep's own club
  // has no part in this create, so it is left off the person here, and the
  // two lines below read the club named.
  if (asRepresentative) person = { ...person, repClubId: null }
  if (person.repClubId && body.clubId && body.clubId !== person.repClubId) {
    return errorResponse('Club reps can only create tournaments for their club', 403)
  }
  // An empty club id names no club, for every creator, so the LCA-run check,
  // the club's lookup and the insert below all read it as none.
  if (body.clubId === '') body.clubId = null
  // A club rep's event is its club's, whatever else the rep holds, so a club
  // rep who holds the President seat creates as a club rep.
  const clubId = person.repClubId ?? (body.clubId ?? null)

  // A standing director's and the president's events are LCA-run (Q37, and
  // for the president the membership row of the brief's table); a president
  // who wants a club's event asks an LCA admin, unless they hold a regional
  // seat over the club and create it as the representative.
  if (clubId !== null && person.repClubId === null && !asRepresentative && (person.grant === 'president' || person.grant === 'standing_director')) {
    return errorResponse(LCA_RUN_ONLY, 403)
  }
  if (!canCreate(person, clubId, rolesOn)) {
    return errorResponse('Forbidden', 403)
  }
  // A new event has no section rows yet, so an id sent with a section (the
  // wizard copies the sections of an existing event as the list gave them)
  // names another event's row: each section is added as a new one.
  const sections = body.sections?.length
    ? body.sections.map((s) => (typeof s === 'string' ? s : withoutId(s)))
    : [{ name: 'Open', entryFee: body.entryFee }]

  // D24: a price above $0 at any tier of any section, each read as the
  // section writer will store it (savedSectionFees, the save's comparison
  // too), needs canChargeFees's yes, the rule the save asks too. Every grant
  // of today's that may create is on D24's list, so none of them is refused
  // here; a person who creates as the region's representative is, whatever
  // CREATION_ROLES_ON is, since their standing on the club is the region
  // alone, so their event starts at $0 (WS09 step 17). The approval mark the
  // rule reads on a stored event is the representative's alone here, so the
  // create does not pass it.
  if (feesRaised([], savedSectionFees([], sections, { entry_fee: body.entryFee })) && !canChargeFees(person, { clubId, createdBy: member.id }, rolesOn)) {
    return errorResponse(FEES_NEED_PAYOUT_ACCOUNT, 403)
  }

  if (clubId) {
    const club = await context.env.DB.prepare('SELECT id FROM clubs WHERE id = ?')
      .bind(clubId)
      .first()
    if (!club) return errorResponse('Club not found', 404)
  }

  const id = (isAdmin && body.id?.trim()) || `${slugify(body.name)}-${Date.now().toString(36)}`
  const taken = await context.env.DB.prepare('SELECT 1 FROM tournaments WHERE id = ?').bind(id).first()
  if (taken) return errorResponse('A tournament with that id already exists', 409)
  const status = body.status ?? 'upcoming'
  if (!['upcoming', 'active', 'completed'].includes(status)) {
    return errorResponse('Invalid status', 400)
  }

  const isRated = body.isRated !== false ? 1 : 0

  // A club-run event starts without the LCA membership requirement (clubs
  // get tournament creation first, free of charge); an LCA-run event always
  // has it. Three people reach this point with a club: an admin, the club's
  // own rep and, while REGION_EVENTS_ON is set, the region's representative,
  // who decides it on the draft they create as on any draft of theirs
  // (draftedInRegion in the save). A standing director and the president
  // reach it with a club only as that representative.
  if (body.requiresLcaMembership === false && !clubId) {
    return errorResponse(LCA_RUN_NEEDS_MEMBERSHIP, 400)
  }
  const requiresLcaMembership = !clubId ? 1 : body.requiresLcaMembership ? 1 : 0
  const db = getDb(context.env.DB)

  // The row goes in with no sections (the column's default, '[]'), then
  // the one section writer adds the rows and the JSON, all in one batch.
  const plan = await buildSaveSections(db, id, sections, { reportSettings: null })
  if (!plan.ok) return errorResponse(plan.error, 400)

  // is_visible = 0: new tournaments are true drafts, hidden from public pages
  // until made visible from the management page. This makes the wizard's
  // "created as a draft" banner accurate (the column otherwise defaults to 1).
  // The create schema has no visibility key, so whatever the body asks, the
  // event starts hidden. A representative's event is also marked for an LCA
  // admin's approval, needs_lca_approval 1, and may not list until approved
  // (mayList, read by the save); every other event is written as before.
  const insert = db.insert(tournaments).values({
    id,
    name: body.name,
    location: body.location,
    venue: body.venue ?? null,
    date: body.date,
    endDate: body.endDate ?? null,
    entryFee: body.entryFee,
    rounds: body.rounds ?? 5,
    maxPlayers: body.maxPlayers ?? null,
    status,
    description: body.description ?? null,
    registrationDeadline: body.registrationDeadline ?? null,
    clubId,
    createdBy: member.id,
    isRated,
    isVisible: 0,
    timeControl: body.timeControl ?? null,
    registrationClosesAt: body.registrationClosesAt ?? null,
    customDetails: body.customDetails?.length ? JSON.stringify(body.customDetails) : null,
    requiresLcaMembership,
    ...(asRepresentative ? { needsLcaApproval: 1 } : {}),
  })
  // A standing director and the president run the event they create as its
  // first director, the row canManageTournament admits them by, written in the
  // same batch as the event. An admin and a club rep, a club rep who holds the
  // seat among them, manage it by their role and get no row, which would
  // outlive the role; so does a president or a standing director who creates
  // a club's event as the region's representative, who manages it by the seat.
  const firstDirector = (person.grant === 'president' || person.grant === 'standing_director') && person.repClubId === null && !asRepresentative
    ? [db.insert(tournamentDirectors).values({ tournamentId: id, memberId: member.id }).onConflictDoNothing()]
    : []
  try {
    await runBatch(db, [insert, ...firstDirector, ...plan.queries])
  } catch (err) {
    if (isSectionsConflict(err)) return errorResponse(SECTIONS_CHANGED_MESSAGE, 409)
    throw err
  }

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(id)
    .first<TournamentRow>()
  if (!tournament) return errorResponse('Tournament not found', 404)

  await recordAdminAction(context.env.DB, member, {
    action: 'tournament_create',
    targetLabel: body.name,
    // The grant the person created with joins the entry once CREATION_ROLES_ON
    // is set; while it is unset the entry is as before. A create made as the
    // region's representative says so with one key more, as_representative,
    // in both states, since the grant is the person's own (a club rep's, the
    // president's or a standing director's) and would not say it (WS09 step
    // 18); every other create's entry is as before.
    detail: {
      ...(rolesOn ? { tournament_id: id, grant: person.grant } : { tournament_id: id }),
      ...(asRepresentative ? { as_representative: true } : {}),
    },
  })

  return jsonResponse({ tournament: toTournamentResponse(tournament, await loadSections(db, id), await loadSchedules(db, id)) }, 201)
}
