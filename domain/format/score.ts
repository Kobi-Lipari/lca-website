// domain/format/score.ts
// Scores as the site writes them: half points as ½, never ".5".
// 3.5 is "3½", 0.5 is "½", 0 is "0", 10 is "10".

/**
 * Formats a score or tiebreak. Accepts a number or a numeric string (D1 and
 * JSON give both). A value that is not a whole or half point (which chess
 * scoring never produces) is shown as its plain number. A string that is not
 * a number, or already holds ½, is returned as given; null and undefined
 * give "".
 */
export function formatScore(score: number | string | null | undefined): string {
  if (score === null || score === undefined) return ''
  let n: number
  if (typeof score === 'string') {
    const s = score.trim()
    if (s === '' || s.includes('½')) return score
    n = Number(s)
    if (!Number.isFinite(n)) return score
  } else {
    n = score
    if (!Number.isFinite(n)) return ''
  }

  const halves = Math.round(n * 2)
  if (Math.abs(n * 2 - halves) > 1e-9) return String(n)

  const sign = halves < 0 ? '-' : ''
  const whole = Math.floor(Math.abs(halves) / 2)
  const half = Math.abs(halves) % 2 === 1
  if (!half) return whole === 0 ? '0' : `${sign}${whole}`
  return `${sign}${whole === 0 ? '' : whole}½`
}
