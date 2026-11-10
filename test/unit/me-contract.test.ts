// test/unit/me-contract.test.ts
//
// The contracts of WS08 step 7 (domain/contracts/me.ts) on their own, beside
// the integration tests that hold the two endpoints to them:
// - registered as file routing names the two files, 'me/tournament-creation'
//   with GET alone and its answer, and 'me/payout-request' with POST alone,
//   its body and its answer, the very schemas me.ts exports, which the
//   contracts' index exports as well;
// - me.ts imports zod and ./common and nothing else, as the contracts layer
//   asks of its files though its own list does not name this one, and the
//   two handlers take the schemas and the types from it, neither importing
//   zod;
// - the five grants are the five the creation rules name, in their order;
// - the grant answer is strict: its four fields and no other, a grant the
//   rules name, booleans as booleans, and clubId an id or null but always
//   there;
// - the payout request's body is loose: nothing required, tournamentId text
//   or null, other keys kept as sent, and anything but an object refused;
// - its answer is strict at both levels: kind payout_request alone, created a
//   boolean, and no other field, the ticket's number, which is for staff and
//   board members only, the event, the message or the member among them.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as fromIndex from '../../domain/contracts'
import {
  creationGrantSchema,
  payoutRequestRequestSchema,
  payoutRequestResponseSchema,
  tournamentCreationResponseSchema,
} from '../../domain/contracts/me'
import { contracts } from '../../domain/contracts/registry'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
/** The specifiers a file names: imports, re-exports and import(), types included. */
const specifiersOf = (path: string) => ts.preProcessFile(read(path), true, true).importedFiles.map((f) => f.fileName)

const GRANTS = ['admin', 'president', 'standing_director', 'club_rep', 'none'] as const

/** An answer of each shape the contract allows, to be changed one way at a time. */
const grantAnswer = { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null }
const payoutAnswer = { ticket: { id: 'ticket-1-abc', kind: 'payout_request', status: 'open' }, created: true }

const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success

describe('the two contracts in the registry', () => {
  it('registers GET /api/me/tournament-creation with its answer alone, and no body or query to send', () => {
    const route = contracts['me/tournament-creation']
    expect(Object.keys(route)).toEqual(['GET'])
    expect(route.GET.response).toBe(tournamentCreationResponseSchema)
    expect(Object.keys(route.GET)).toEqual(['response'])
  })

  it('registers POST /api/me/payout-request with its body and its answer, and no query', () => {
    const route = contracts['me/payout-request']
    expect(Object.keys(route)).toEqual(['POST'])
    expect(route.POST.request).toBe(payoutRequestRequestSchema)
    expect(route.POST.response).toBe(payoutRequestResponseSchema)
    expect(Object.keys(route.POST).sort()).toEqual(['request', 'response'])
  })

  it('keys each as file routing names the handler file beside functions/api/me.ts', () => {
    for (const route of ['me/tournament-creation', 'me/payout-request']) {
      expect(Object.keys(contracts)).toContain(route)
      expect(() => read(`functions/api/${route}.ts`), route).not.toThrow()
    }
  })

  it('is exported from the contracts\' index, the same schemas', () => {
    expect(fromIndex.creationGrantSchema).toBe(creationGrantSchema)
    expect(fromIndex.tournamentCreationResponseSchema).toBe(tournamentCreationResponseSchema)
    expect(fromIndex.payoutRequestRequestSchema).toBe(payoutRequestRequestSchema)
    expect(fromIndex.payoutRequestResponseSchema).toBe(payoutRequestResponseSchema)
    expect(fromIndex.contracts).toBe(contracts)
  })
})

describe('the imports', () => {
  it('me.ts imports zod and ./common and nothing else', () => {
    expect(specifiersOf('domain/contracts/me.ts').sort()).toEqual(['./common', 'zod'])
  })

  it('the two handlers take their schemas and types from me.ts, and neither imports zod', () => {
    for (const handler of ['functions/api/me/tournament-creation.ts', 'functions/api/me/payout-request.ts']) {
      const specifiers = specifiersOf(handler)
      expect(specifiers, handler).toContain('../../../domain/contracts/me')
      expect(specifiers.filter((s) => /^zod(\/|$)/.test(s)), handler).toEqual([])
    }
  })
})

describe('the grants', () => {
  it('are the five the creation rules name, in their order', () => {
    expect(creationGrantSchema.options).toEqual([...GRANTS])
    const rules = ts.createSourceFile('creation.ts', read('domain/events/creation.ts'), ts.ScriptTarget.Latest, true)
    const alias = rules.statements.find((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === 'CreationGrant')
    expect(alias).toBeDefined()
    expect(ts.isUnionTypeNode(alias!.type)).toBe(true)
    const named = (alias!.type as ts.UnionTypeNode).types.map((t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? t.literal.text : t.getText(rules)))
    expect(named).toEqual([...GRANTS])
  })
})

describe('the grant answer', () => {
  it.each(GRANTS)('takes the grant %s, with either answer to each rule', (grant) => {
    for (const canCreate of [true, false]) {
      for (const canChargeFees of [true, false]) {
        expect(ok(tournamentCreationResponseSchema, { grant, canCreate, canChargeFees, clubId: null })).toBe(true)
      }
    }
  })

  it('takes a club\'s id or null as clubId, and needs it there either way', () => {
    expect(ok(tournamentCreationResponseSchema, { ...grantAnswer, grant: 'club_rep', canCreate: false, clubId: 'club-12' })).toBe(true)
    expect(ok(tournamentCreationResponseSchema, grantAnswer)).toBe(true)
    const withoutClub: Record<string, unknown> = { ...grantAnswer }
    delete withoutClub.clubId
    expect(ok(tournamentCreationResponseSchema, withoutClub)).toBe(false)
    for (const clubId of ['', 12, false, undefined]) expect(ok(tournamentCreationResponseSchema, { ...grantAnswer, clubId }), String(clubId)).toBe(false)
  })

  it.each([
    ['a role\'s name for the grant', { grant: 'tournament_director' }],
    ['the admin role\'s name', { grant: 'lca_admin' }],
    ['a grant in words', { grant: 'Standing director' }],
    ['an empty grant', { grant: '' }],
    ['no grant', { grant: null }],
    ['canCreate as 1', { canCreate: 1 }],
    ['canCreate in words', { canCreate: 'true' }],
    ['canChargeFees as 0', { canChargeFees: 0 }],
    ['canChargeFees as null', { canChargeFees: null }],
    ['a member\'s id beside it', { memberId: 'mem-1' }],
    ['a member\'s email beside it', { email: 'someone@example.org' }],
  ])('refuses %s', (_what, change) => {
    expect(ok(tournamentCreationResponseSchema, { ...grantAnswer, ...change })).toBe(false)
  })

  it('refuses an answer missing any of its four fields', () => {
    for (const key of Object.keys(grantAnswer)) {
      const partial: Record<string, unknown> = { ...grantAnswer }
      delete partial[key]
      expect(ok(tournamentCreationResponseSchema, partial), key).toBe(false)
    }
  })
})

describe('the payout request\'s body', () => {
  it.each([
    ['nothing', {}],
    ['no event', { tournamentId: null }],
    ['an event', { tournamentId: 'tour-1' }],
    ['an empty id, which the endpoint reads as no event', { tournamentId: '' }],
  ])('takes %s', (_what, body) => {
    const parsed = payoutRequestRequestSchema.safeParse(body)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(body)
  })

  it('keeps the other keys a page sends, as sent, so the endpoint can leave them unread', () => {
    const body = { tournamentId: 'tour-1', memberId: 'mem-other', kind: 'listing_report', note: 'Please hurry.' }
    expect(payoutRequestRequestSchema.safeParse(body).data).toEqual(body)
  })

  it.each([
    ['an id as a number', { tournamentId: 7 }],
    ['an id in a list', { tournamentId: ['tour-1'] }],
    ['an id as an object', { tournamentId: { id: 'tour-1' } }],
    ['an id as true', { tournamentId: true }],
    ['null', null],
    ['a list', []],
    ['text', 'tour-1'],
    ['a number', 7],
  ])('refuses %s', (_what, body) => {
    expect(ok(payoutRequestRequestSchema, body)).toBe(false)
  })
})

describe('the payout request\'s answer', () => {
  it.each([
    ['a ticket just opened', payoutAnswer],
    ['an open ticket found', { ...payoutAnswer, created: false }],
    ['a ticket in progress found', { ticket: { ...payoutAnswer.ticket, status: 'in_progress' }, created: false }],
  ])('takes %s and reads it back unchanged', (_what, answer) => {
    const parsed = payoutRequestResponseSchema.safeParse(answer)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(answer)
  })

  it.each([
    ['another kind', { kind: 'listing_report' }],
    ['no kind', { kind: null }],
    ['the number staff see beside it', { number: 1042 }],
    ['an empty number beside it', { number: null }],
    ['an id as a number', { id: 1042 }],
    ['a status as a number', { status: 1 }],
    ['the event beside it', { about_id: 'tour-1' }],
    ['the member beside it', { member_id: 'mem-1' }],
    ['the subject beside it', { subject: 'Payout account request from Remy Guidry' }],
  ])('refuses a ticket with %s', (_what, change) => {
    expect(ok(payoutRequestResponseSchema, { ...payoutAnswer, ticket: { ...payoutAnswer.ticket, ...change } })).toBe(false)
  })

  it('refuses a ticket missing any of its three fields', () => {
    for (const key of Object.keys(payoutAnswer.ticket)) {
      const ticket: Record<string, unknown> = { ...payoutAnswer.ticket }
      delete ticket[key]
      expect(ok(payoutRequestResponseSchema, { ...payoutAnswer, ticket }), key).toBe(false)
    }
  })

  it.each([
    ['no created', { created: undefined }],
    ['created in words', { created: 'true' }],
    ['created as 1', { created: 1 }],
    ['the message beside it', { message: 'Remy Guidry asked LCA to set up a payout account.' }],
    ['the ticket missing', { ticket: undefined }],
    ['the ticket as its id', { ticket: 'ticket-1-abc' }],
  ])('refuses an answer with %s', (_what, change) => {
    const answer: Record<string, unknown> = { ...payoutAnswer, ...change }
    for (const [key, value] of Object.entries(answer)) if (value === undefined) delete answer[key]
    expect(ok(payoutRequestResponseSchema, answer)).toBe(false)
  })
})
