// src/lib/posts.ts — small helpers shared by the news pages and editor.

/** "2026-07-01" → "Jul 1, 2026" */
export function formatPostDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
