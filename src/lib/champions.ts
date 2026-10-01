// src/lib/champions.ts — reading pasted champion lines (Admin → State champions).

export interface PastedChampion { year: number; title: string; champion: string; notes: string | null }

/** "2019, Louisiana State Champion, Jane Doe, co-champion" → a row; tabs work too (pasted from a spreadsheet). */
export function parsePasted(text: string): { rows: PastedChampion[]; bad: number[] } {
  const rows: PastedChampion[] = []
  const bad: number[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return
    const parts = (line.includes('\t') ? line.split('\t') : line.split(',')).map((p) => p.trim())
    const [year, title, champion, ...rest] = parts
    if (!/^\d{4}$/.test(year ?? '') || !title || !champion) { bad.push(i + 1); return }
    rows.push({ year: Number(year), title, champion, notes: rest.join(', ') || null })
  })
  return { rows, bad }
}
