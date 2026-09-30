import { describe, expect, it } from 'vitest'
import { maxWeightMatching, type WeightedEdge } from './matching'

function lcg(seed: number) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

function brute(n: number, edges: WeightedEdge[], maxCard: boolean): [number, number] {
  const w = new Map<string, number>()
  for (const [a, b, x] of edges) w.set(`${Math.min(a, b)},${Math.max(a, b)}`, x)
  let best: [number, number] = [0, 0]
  const used = new Array(n).fill(false)
  const rec = (start: number, card: number, wt: number) => {
    let i = start
    while (i < n && used[i]) i++
    if (i >= n) {
      const better = maxCard ? card > best[0] || (card === best[0] && wt > best[1]) : wt > best[1]
      if (better) best = [card, wt]
      return
    }
    used[i] = true
    rec(i + 1, card, wt)
    for (let j = i + 1; j < n; j++) {
      const x = w.get(`${i},${j}`)
      if (!used[j] && x !== undefined) { used[j] = true; rec(i + 1, card + 1, wt + x); used[j] = false }
    }
    used[i] = false
  }
  rec(0, 0, 0)
  return best
}

describe('maxWeightMatching', () => {
  it('matches a brute-force search on random graphs', () => {
    const rnd = lcg(42)
    for (let t = 0; t < 800; t++) {
      const n = 2 + Math.floor(rnd() * 8)
      const edges: WeightedEdge[] = []
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < 0.6) edges.push([i, j, Math.floor(rnd() * 30)])
      if (!edges.length) continue
      const maxCard = rnd() < 0.5
      const mate = maxWeightMatching(edges, maxCard)
      const w = new Map(edges.map(([a, b, x]) => [`${Math.min(a, b)},${Math.max(a, b)}`, x] as const))
      let card = 0
      let wt = 0
      for (let v = 0; v < mate.length; v++) {
        if (mate[v] < 0) continue
        expect(mate[mate[v]]).toBe(v)
        if (v < mate[v]) { card++; wt += w.get(`${v},${mate[v]}`) as number }
      }
      const [bc, bw] = brute(mate.length, edges, maxCard)
      if (maxCard) expect([card, wt]).toEqual([bc, bw])
      else expect(wt).toBe(bw)
    }
  })

  it('finds the perfect matching a greedy choice would miss', () => {
    // 0-1 is heaviest, but taking it strands 2 and 3.
    const mate = maxWeightMatching([[0, 1, 10], [0, 2, 6], [1, 3, 6]], true)
    expect(mate).toEqual([2, 3, 0, 1])
  })
})
