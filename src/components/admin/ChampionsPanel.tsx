// src/components/admin/ChampionsPanel.tsx
//
// Admin → State champions: add one champion, paste many past years at
// once, and edit or remove rows. Shown on the public /champions page.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminAddChampions, adminDeleteChampion, adminUpdateChampion, getChampions,
  type ApiChampion,
} from '@/lib/api'
import { GOLD_BUTTON as GOLD, ADMIN_SCROLL } from '@/lib/brand'
import { useViewOnly } from '@/lib/viewOnly'
import { parsePasted } from '@/lib/champions'

const EMPTY = { year: String(new Date().getFullYear()), title: '', champion: '', notes: '' }

export function ChampionsPanel() {
  const viewOnly = useViewOnly()
  const [rows, setRows] = useState<ApiChampion[]>([])
  const [form, setForm] = useState(EMPTY)
  const [paste, setPaste] = useState('')
  const [editing, setEditing] = useState<ApiChampion | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () => getChampions().then((d) => setRows(d.champions)).catch(() => setRows([]))
  useEffect(() => { load() }, [])

  const titles = useMemo(() => [...new Set(rows.map((r) => r.title))].sort(), [rows])

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    setNote(null)
    try {
      await action()
      await load()
      setNote({ ok: true, text: done })
      return true
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong' })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (await run(() => adminAddChampions([{ ...form, notes: form.notes || null }]), `Added ${form.champion}.`)) {
      setForm((f) => ({ ...EMPTY, year: f.year, title: f.title }))
    }
  }

  const parsed = parsePasted(paste)
  async function addPasted() {
    if (await run(() => adminAddChampions(parsed.rows), `Added ${parsed.rows.length} champion${parsed.rows.length === 1 ? '' : 's'}.`)) setPaste('')
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const ed = editing
    if (await run(() => adminUpdateChampion(ed.id, { year: ed.year, title: ed.title, champion: ed.champion, notes: ed.notes }), 'Saved.')) setEditing(null)
  }

  return (
    <div className="space-y-6">
      <datalist id="champion-titles">{titles.map((t) => <option key={t} value={t} />)}</datalist>

      {!viewOnly && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={add} className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
            <p className="font-semibold text-lca-navy">Add a champion</p>
            <div className="grid grid-cols-[90px_1fr] gap-3">
              <div className="space-y-1">
                <Label htmlFor="ch-year" className="text-xs">Year</Label>
                <Input id="ch-year" inputMode="numeric" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ch-title" className="text-xs">Championship</Label>
                <Input id="ch-title" list="champion-titles" placeholder="Louisiana State Champion" value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ch-name" className="text-xs">Champion</Label>
              <Input id="ch-name" value={form.champion} onChange={(e) => setForm((f) => ({ ...f, champion: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ch-notes" className="text-xs">Note (optional)</Label>
              <Input id="ch-notes" placeholder="e.g. co-champion, 5.5/6" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">For a tie, add each co-champion as their own line with the same year and championship.</p>
            <Button type="submit" className={GOLD} disabled={busy}>Add</Button>
          </form>

          <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
            <p className="font-semibold text-lca-navy">Add many at once</p>
            <p className="text-xs text-muted-foreground">
              One per line: <span className="font-mono">year, championship, champion, note</span>. Copying rows from a
              spreadsheet works too.
            </p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={7}
              placeholder={'2019, Louisiana State Champion, Jane Doe\n2018, Louisiana State Champion, John Roe, co-champion'}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" />
            {paste.trim() && (
              <p className="text-xs text-muted-foreground">
                {parsed.rows.length} ready
                {parsed.bad.length > 0 && <span className="text-destructive"> · line {parsed.bad.join(', ')} not understood</span>}
              </p>
            )}
            <Button type="button" variant="outline" disabled={busy || parsed.rows.length === 0 || parsed.bad.length > 0} onClick={addPasted}>
              Add {parsed.rows.length || ''} champions
            </Button>
          </div>
        </div>
      )}

      {note && <p className={note.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>{note.text}</p>}

      <div className={`rounded-xl border bg-card shadow-sm ${ADMIN_SCROLL}`}>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No champions yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="border-b">
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Championship</th>
                <th className="px-3 py-2">Champion</th>
                <th className="px-3 py-2">Note</th>
                <th className="w-16 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => editing?.id === r.id ? (
                <tr key={r.id} className="border-b bg-lca-gold/5">
                  <td colSpan={5} className="px-3 py-2">
                    <form onSubmit={saveEdit} className="flex flex-wrap items-center gap-2">
                      <Input className="h-8 w-20" value={editing.year} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) || 0 })} />
                      <Input className="h-8 w-56" list="champion-titles" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                      <Input className="h-8 w-48" value={editing.champion} onChange={(e) => setEditing({ ...editing, champion: e.target.value })} />
                      <Input className="h-8 w-40" placeholder="Note" value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })} />
                      <Button type="submit" size="sm" className={GOLD} disabled={busy}>Save</Button>
                      <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="text-muted-foreground"><X className="size-4" /></button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 tabular-nums">{r.year}</td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2 font-medium text-lca-navy">{r.champion}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes}</td>
                  <td className="px-3 py-2">
                    {!viewOnly && (
                      <span className="flex gap-2">
                        <button type="button" onClick={() => setEditing(r)} aria-label={`Edit ${r.champion}`} className="text-muted-foreground hover:text-lca-navy"><Pencil className="size-3.5" /></button>
                        <button type="button" disabled={busy} aria-label={`Remove ${r.champion}`}
                          onClick={() => window.confirm(`Remove ${r.champion} (${r.year} ${r.title})?`) && run(() => adminDeleteChampion(r.id), 'Removed.')}
                          className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
