// functions/utils/byes.ts
//
// The byes a player asks for when entering a tournament: a list of whole
// round numbers, each round counted once, at most one less than the number
// of rounds, and only rounds the tournament has. Entering alone and entering
// in a family checkout both check here, so the two cannot drift apart.

export type ByeRequest =
  | { ok: true; byeRounds: number[] }
  | { ok: false; problem: 'malformed' }
  | { ok: false; problem: 'too-many'; maxByes: number }
  | { ok: false; problem: 'no-such-round'; round: number }

/** `input` is whatever the request sent; nothing sent means no byes. */
export function checkByeRequest(input: unknown, rounds: number): ByeRequest {
  const requested = input ?? []
  if (!Array.isArray(requested) || requested.some((r) => !Number.isInteger(r))) {
    return { ok: false, problem: 'malformed' }
  }
  const byeRounds = [...new Set(requested as number[])].sort((a, b) => a - b)
  const maxByes = rounds - 1
  if (byeRounds.length > maxByes) return { ok: false, problem: 'too-many', maxByes }
  const round = byeRounds.find((r) => r < 1 || r > rounds)
  if (round !== undefined) return { ok: false, problem: 'no-such-round', round }
  return { ok: true, byeRounds }
}
