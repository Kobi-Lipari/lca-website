// test/unit/fixtures/chess-tables-today.ts
//
// Today's crosstable and standings table (WS01 step 27), as the files drew
// them before the step (src/areas/live/components at a12c74e) with newLook
// off, rendered from the made-up section below: half-point scores and
// tiebreaks, a shared place, an unrated player, a player with no tiebreaks,
// and every result code (a win, a loss and a draw with each colour, a forfeit
// each way, both byes, a round not played and a game with no result yet).
// test/unit/standings-format.test.tsx holds the tables drawn with newLook
// off to this markup, the scope="col" on each header cell aside. Written one
// row or cell a line for reading; markup() joins the lines back into the
// exact markup. The em dash of a missing tiebreak is written as an escape, so
// this file holds no dash character.
import type { ApiStanding, ApiTournamentPairing } from '@/lib/api'

export const CHESS_STANDINGS: ApiStanding[] = [
  { member_id: 'fx-a', full_name: 'Avery Sample', section: 'Open', rating: 1905, score: 2, wins: 2, draws: 0, losses: 0, place: 1, placeLabel: '1', tiebreaks: { modifiedMedian: 3.5, solkoff: 13.5, cumulative: 3, oppCumulative: 7.5, blacks: 1 } },
  { member_id: 'fx-d', full_name: 'Drew Sample', section: 'Open', rating: 1290, score: 1.5, wins: 1, draws: 1, losses: 1, place: 2, placeLabel: '2-3', tiebreaks: { modifiedMedian: 0.5, solkoff: 4, cumulative: 2, oppCumulative: 6, blacks: 2 } },
  { member_id: 'fx-e', full_name: 'Emery Sample', section: 'Open', rating: null, score: 1.5, wins: 0, draws: 0, losses: 0, place: 2, placeLabel: '2-3', tiebreaks: { modifiedMedian: 0.5, solkoff: 4, cumulative: 2, oppCumulative: 6, blacks: 2 } },
  { member_id: 'fx-b', full_name: 'Blair Sample', section: 'Open', rating: 1660, score: 1, wins: 1, draws: 0, losses: 1, place: 4, placeLabel: '4', tiebreaks: { modifiedMedian: 2, solkoff: 3.5, cumulative: 1, oppCumulative: 10.5, blacks: 1 } },
  { member_id: 'fx-c', full_name: 'Casey Sample', section: 'Open', rating: 1410, score: 0.5, wins: 0, draws: 1, losses: 0, place: 5, placeLabel: '5', tiebreaks: undefined as unknown as ApiStanding['tiebreaks'] },
]
const game = (id: string, round: number, board: number, white: string, black: string | null, result: string): ApiTournamentPairing => ({
  id, tournament_id: 'fx-t', round, board, section: 'Open', white_member_id: white, black_member_id: black, result,
})
export const CHESS_PAIRINGS: ApiTournamentPairing[] = [
  game('g11', 1, 1, 'fx-a', 'fx-b', '1-0'),
  game('g12', 1, 2, 'fx-c', 'fx-d', '1/2-1/2'),
  game('g13', 1, 3, 'fx-e', null, 'bye'),
  game('g21', 2, 1, 'fx-b', 'fx-c', '1-0 F'),
  game('g22', 2, 2, 'fx-d', 'fx-a', '0-1'),
  game('g23', 2, 3, 'fx-e', null, 'bye-half'),
  game('g31', 3, 1, 'fx-a', 'fx-e', 'pending'),
  game('g32', 3, 2, 'fx-b', 'fx-d', '0-1'),
]

/** Today's markup, one row or cell a line, joined back into one string. */
export const markup = (literal: string) => literal.replace(/\n\s*/g, '')

export const TODAYS_CROSSTABLE = `
  <div class="mb-6 break-inside-avoid">
  <h3 class="mb-3 text-base font-semibold text-ink">Open</h3>
  <div class="overflow-x-auto rounded-xl border print:overflow-visible">
  <table class="w-full min-w-[480px] text-left text-sm tabular-nums">
  <thead>
  <tr class="border-b bg-muted/50">
  <th class="px-2 py-2.5 text-right font-semibold text-ink">#</th>
  <th class="px-3 py-2.5 font-semibold text-ink">Player</th>
  <th class="px-2 py-2.5 text-right font-semibold text-ink">Rating</th>
  <th class="px-2 py-2.5 text-center font-semibold text-ink">Rd 1</th>
  <th class="px-2 py-2.5 text-center font-semibold text-ink">Rd 2</th>
  <th class="px-2 py-2.5 text-center font-semibold text-ink">Rd 3</th>
  <th class="px-2 py-2.5 text-center font-semibold text-ink">Rd 4</th>
  <th class="px-2 py-2.5 text-center font-semibold text-ink">Total</th>
  </tr>
  </thead>
  <tbody>
  <tr class="border-b last:border-0">
  <td class="px-2 py-1.5 text-right text-muted-foreground">1</td>
  <td class="px-3 py-1.5 font-medium text-ink">Avery Sample<span class="ml-1.5 text-xs font-normal text-muted-foreground">(1)</span></td>
  <td class="px-2 py-1.5 text-right text-muted-foreground">1905</td>
  <td class="px-2 py-1 text-center leading-tight" title="White"><span class="font-mono text-xs font-semibold text-ink">W4</span><span class="block text-[10px] text-muted-foreground/70">w</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="Black"><span class="font-mono text-xs font-semibold text-ink">W2</span><span class="block text-[10px] text-muted-foreground/70">b</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="White"><span class="font-mono text-xs text-muted-foreground">3</span><span class="block text-[10px] text-muted-foreground/70">w</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">U</span></td>
  <td class="px-2 py-1.5 text-center font-semibold text-ink">2</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-2 py-1.5 text-right text-muted-foreground">2</td>
  <td class="px-3 py-1.5 font-medium text-ink">Drew Sample<span class="ml-1.5 text-xs font-normal text-muted-foreground">(2-3)</span></td>
  <td class="px-2 py-1.5 text-right text-muted-foreground">1290</td>
  <td class="px-2 py-1 text-center leading-tight" title="Black"><span class="font-mono text-xs text-muted-foreground">D5</span><span class="block text-[10px] text-muted-foreground/70">b</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="White"><span class="font-mono text-xs text-muted-foreground">L1</span><span class="block text-[10px] text-muted-foreground/70">w</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="Black"><span class="font-mono text-xs font-semibold text-ink">W4</span><span class="block text-[10px] text-muted-foreground/70">b</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">U</span></td>
  <td class="px-2 py-1.5 text-center font-semibold text-ink">1.5</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-2 py-1.5 text-right text-muted-foreground">3</td>
  <td class="px-3 py-1.5 font-medium text-ink">Emery Sample<span class="ml-1.5 text-xs font-normal text-muted-foreground">(2-3)</span></td>
  <td class="px-2 py-1.5 text-right text-muted-foreground">Unr.</td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs font-semibold text-ink">B</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">H</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="Black"><span class="font-mono text-xs text-muted-foreground">1</span><span class="block text-[10px] text-muted-foreground/70">b</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">U</span></td>
  <td class="px-2 py-1.5 text-center font-semibold text-ink">1.5</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-2 py-1.5 text-right text-muted-foreground">4</td>
  <td class="px-3 py-1.5 font-medium text-ink">Blair Sample<span class="ml-1.5 text-xs font-normal text-muted-foreground">(4)</span></td>
  <td class="px-2 py-1.5 text-right text-muted-foreground">1660</td>
  <td class="px-2 py-1 text-center leading-tight" title="Black"><span class="font-mono text-xs text-muted-foreground">L1</span><span class="block text-[10px] text-muted-foreground/70">b</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="White"><span class="font-mono text-xs font-semibold text-ink">X5</span><span class="block text-[10px] text-muted-foreground/70">w</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="White"><span class="font-mono text-xs text-muted-foreground">L2</span><span class="block text-[10px] text-muted-foreground/70">w</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">U</span></td>
  <td class="px-2 py-1.5 text-center font-semibold text-ink">1</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-2 py-1.5 text-right text-muted-foreground">5</td>
  <td class="px-3 py-1.5 font-medium text-ink">Casey Sample<span class="ml-1.5 text-xs font-normal text-muted-foreground">(5)</span></td>
  <td class="px-2 py-1.5 text-right text-muted-foreground">1410</td>
  <td class="px-2 py-1 text-center leading-tight" title="White"><span class="font-mono text-xs text-muted-foreground">D2</span><span class="block text-[10px] text-muted-foreground/70">w</span></td>
  <td class="px-2 py-1 text-center leading-tight" title="Black"><span class="font-mono text-xs text-muted-foreground">F4</span><span class="block text-[10px] text-muted-foreground/70">b</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">U</span></td>
  <td class="px-2 py-1 text-center leading-tight"><span class="font-mono text-xs text-muted-foreground">U</span></td>
  <td class="px-2 py-1.5 text-center font-semibold text-ink">0.5</td>
  </tr>
  </tbody>
  </table>
  </div>
  <p class="mt-1.5 text-[11px] text-muted-foreground">W win · L loss · D draw, with the opponent's number · B full-point bye · H half-point bye · X / F win / loss by forfeit · U not played · w / b color</p>
  </div>
`

export const TODAYS_STANDINGS = `
  <div class="mb-6 break-inside-avoid">
  <h3 class="mb-3 text-base font-semibold text-ink">Open</h3>
  <div class="overflow-x-auto rounded-xl border print:overflow-visible">
  <table class="w-full min-w-[560px] text-left text-sm tabular-nums">
  <thead>
  <tr class="border-b bg-muted/50">
  <th class="px-3 py-2.5 font-semibold text-ink">Place</th>
  <th class="px-3 py-2.5 font-semibold text-ink">Player</th>
  <th class="px-3 py-2.5 text-right font-semibold text-ink">Rating</th>
  <th class="px-3 py-2.5 text-center font-semibold text-ink">Pts</th>
  <th class="px-3 py-2.5 text-center font-semibold text-ink">W-D-L</th>
  <th class="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" title="Modified Median">MM</th>
  <th class="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" title="Solkoff">Solk</th>
  <th class="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" title="Cumulative">Cum</th>
  <th class="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" title="Opponents' Cumulative">OppC</th>
  </tr>
  </thead>
  <tbody>
  <tr class="border-b last:border-0 bg-lca-gold/5">
  <td class="px-3 py-2 font-medium text-ink">1</td>
  <td class="px-3 py-2 font-medium text-ink">Avery Sample</td>
  <td class="px-3 py-2 text-right text-muted-foreground">1905</td>
  <td class="px-3 py-2 text-center font-semibold text-ink">2</td>
  <td class="px-3 py-2 text-center text-muted-foreground">2-0-0</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">3.5</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">13.5</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">3</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">7.5</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-3 py-2 font-medium text-muted-foreground">2-3</td>
  <td class="px-3 py-2 font-medium text-ink">Drew Sample</td>
  <td class="px-3 py-2 text-right text-muted-foreground">1290</td>
  <td class="px-3 py-2 text-center font-semibold text-ink">1.5</td>
  <td class="px-3 py-2 text-center text-muted-foreground">1-1-1</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">0.5</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">4</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">2</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">6</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-3 py-2 font-medium text-muted-foreground">2-3</td>
  <td class="px-3 py-2 font-medium text-ink">Emery Sample</td>
  <td class="px-3 py-2 text-right text-muted-foreground">Unr.</td>
  <td class="px-3 py-2 text-center font-semibold text-ink">1.5</td>
  <td class="px-3 py-2 text-center text-muted-foreground">0-0-0</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">0.5</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">4</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">2</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">6</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-3 py-2 font-medium text-muted-foreground">4</td>
  <td class="px-3 py-2 font-medium text-ink">Blair Sample</td>
  <td class="px-3 py-2 text-right text-muted-foreground">1660</td>
  <td class="px-3 py-2 text-center font-semibold text-ink">1</td>
  <td class="px-3 py-2 text-center text-muted-foreground">1-0-1</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">2</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">3.5</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">1</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">10.5</td>
  </tr>
  <tr class="border-b last:border-0">
  <td class="px-3 py-2 font-medium text-muted-foreground">5</td>
  <td class="px-3 py-2 font-medium text-ink">Casey Sample</td>
  <td class="px-3 py-2 text-right text-muted-foreground">1410</td>
  <td class="px-3 py-2 text-center font-semibold text-ink">0.5</td>
  <td class="px-3 py-2 text-center text-muted-foreground">0-1-0</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">\u2014</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">\u2014</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">\u2014</td>
  <td class="px-2 py-2 text-center text-xs text-muted-foreground">\u2014</td>
  </tr>
  </tbody>
  </table>
  </div>
  <p class="mt-1.5 text-[11px] text-muted-foreground">Ties broken by US Chess tiebreaks in order: Modified Median, Solkoff, Cumulative, Opponents' Cumulative, then most games with Black.</p>
  </div>
`
