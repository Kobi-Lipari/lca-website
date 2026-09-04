import { useEffect, useState, type FormEvent } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GOLD_BUTTON } from '@/lib/brand'
import { cn } from '@/lib/utils'
import {
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminGetAnnouncements,
  adminUpdateAnnouncement,
  type AnnouncementSize,
  type AnnouncementTone,
  type ApiAdminAnnouncement,
} from '@/lib/api'

/**
 * Swatches mirror the public banner exactly, so what an admin picks here is
 * what visitors see. Each pairing clears AA — gold 6.51:1, navy 14.81:1,
 * urgent 8.15:1, info 8.74:1.
 */
const TONES: { value: AnnouncementTone; label: string; swatch: string }[] = [
  { value: 'gold', label: 'Gold', swatch: 'bg-lca-gold text-lca-navy' },
  { value: 'navy', label: 'Navy', swatch: 'bg-lca-navy text-white' },
  { value: 'urgent', label: 'Urgent', swatch: 'bg-[#9b1c1c] text-white' },
  { value: 'info', label: 'Info', swatch: 'bg-[#1e4d7b] text-white' },
]

const SIZES: { value: AnnouncementSize; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'compact', label: 'Compact' },
]

const blank = {
  message: '',
  linkUrl: '',
  linkLabel: '',
  tone: 'gold' as AnnouncementTone,
  size: 'default' as AnnouncementSize,
  startsAt: '',
  endsAt: '',
}

/** datetime-local gives "2026-09-06T16:30"; D1 compares these as plain
 *  strings against datetime('now'), which is "2026-09-06 16:30:00". */
const toSql = (v: string) => (v ? v.replace('T', ' ') + ':00' : null)

export function AdminAnnouncementPanel() {
  const [list, setList] = useState<ApiAdminAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blank)

  async function load() {
    try {
      const { announcements } = await adminGetAnnouncements()
      setList(announcements)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    adminGetAnnouncements()
      .then(({ announcements }) => { if (!cancelled) setList(announcements) })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load announcements')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function patch(id: string, body: Parameters<typeof adminUpdateAnnouncement>[1]) {
    setSavingId(id)
    setError(null)
    try {
      const { announcement } = await adminUpdateAnnouncement(id, body)
      setList((prev) => prev.map((a) => (a.id === id ? announcement : a)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingId(null)
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await adminCreateAnnouncement({
        message: form.message,
        linkUrl: form.linkUrl || null,
        linkLabel: form.linkLabel || null,
        tone: form.tone,
        size: form.size,
        startsAt: toSql(form.startsAt),
        endsAt: toSql(form.endsAt),
        sortOrder: list.length,
      })
      setForm(blank)
      setAdding(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    }
  }

  async function handleDelete(a: ApiAdminAnnouncement) {
    if (!confirm(`Delete this banner? "${a.link_label || a.message}"`)) return
    setSavingId(a.id)
    try {
      await adminDeleteAnnouncement(a.id)
      setList((prev) => prev.filter((x) => x.id !== a.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSavingId(null)
    }
  }

  /** Why a banner is or is not on screen right now — enabled is only half of it. */
  function status(a: ApiAdminAnnouncement): { label: string; className: string } {
    if (!a.enabled) return { label: 'Off', className: 'bg-muted text-muted-foreground' }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    if (a.starts_at && a.starts_at > now) return { label: 'Scheduled', className: 'bg-[#1e4d7b]/15 text-[#1e4d7b]' }
    if (a.ends_at && a.ends_at < now) return { label: 'Expired', className: 'bg-muted text-muted-foreground' }
    return { label: 'Live', className: 'bg-emerald-100 text-emerald-800' }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading announcements…</p>

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-lca-gold" />
          <h2 className="text-base font-semibold text-lca-navy">
            Site banners · {list.length}
          </h2>
        </div>
        {!adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 size-3.5" /> Add banner
          </Button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <p className="mb-4 text-sm text-muted-foreground">
        Banners stack at the top of every page, in this order. Leaving both dates empty means
        the banner runs until you switch it off.
      </p>

      {adding && (
        <form onSubmit={handleCreate} className="mb-5 space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-message">Message</Label>
            <Input
              id="ann-message"
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Annual business meeting — Sunday, Sept 6, 4:30 PM Central."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ann-link-label">Link text (optional)</Label>
              <Input
                id="ann-link-label"
                value={form.linkLabel}
                onChange={(e) => setForm((p) => ({ ...p, linkLabel: e.target.value }))}
                placeholder="Details and join link →"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-link-url">Link URL (optional)</Label>
              <Input
                id="ann-link-url"
                value={form.linkUrl}
                onChange={(e) => setForm((p) => ({ ...p, linkUrl: e.target.value }))}
                placeholder="/meeting"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ann-starts">Starts (optional)</Label>
              <Input
                id="ann-starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-ends">Ends (optional)</Label>
              <Input
                id="ann-ends"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tone: t.value }))}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium ring-offset-2',
                    t.swatch,
                    form.tone === t.value && 'ring-2 ring-lca-navy',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-size">Size</Label>
            <select
              id="ann-size"
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={form.size}
              onChange={(e) => setForm((p) => ({ ...p, size: e.target.value as AnnouncementSize }))}
            >
              {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" className={GOLD_BUTTON}>Add banner</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setForm(blank) }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No banners yet.</p>
      ) : (
        <ul className="divide-y">
          {list.map((a, i) => {
            const st = status(a)
            return (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', st.className)}>
                        {st.label}
                      </span>
                      <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', TONES.find((t) => t.value === a.tone)?.swatch)}>
                        {a.tone}
                      </span>
                      {a.size === 'compact' && (
                        <span className="text-[11px] text-muted-foreground">compact</span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-medium text-lca-navy">
                      {a.message?.trim() || a.link_label}
                    </p>
                    {(a.starts_at || a.ends_at) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.starts_at ? `From ${a.starts_at.slice(0, 16)}` : 'From now'}
                        {' · '}
                        {a.ends_at ? `until ${a.ends_at.slice(0, 16)}` : 'no end date'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={savingId === a.id}
                      onClick={() => patch(a.id, { enabled: !a.enabled })}
                    >
                      {a.enabled ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      disabled={savingId === a.id || i === 0}
                      onClick={() => patch(a.id, { sortOrder: a.sort_order - 1 })}
                      aria-label="Move up"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      className="text-red-600 hover:bg-red-50"
                      disabled={savingId === a.id}
                      onClick={() => handleDelete(a)}
                      aria-label="Delete banner"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
