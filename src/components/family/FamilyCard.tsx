// src/components/family/FamilyCard.tsx
//
// "My family" on the profile page, for members with a family membership:
// the children a parent manages. Children have no login — the parent
// registers them for tournaments and pays in one checkout, and the family
// membership covers up to FAMILY_MEMBERSHIP_CHILDREN of them. Right after a
// family membership is bought (?family=setup) it opens ready to add them.
// Someone whose family membership has lapsed still sees the children they
// added, so they can keep managing them.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Users, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addChild, getMyChildren, removeChild, updateChild, type ApiChild } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'
import { USCHESS_RENEW_URL, usChessState } from '@/components/uscf/UsChessMembership'
import { FAMILY_MEMBERSHIP_CHILDREN as LIMIT } from '@/lib/family'

const STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'Member', className: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Expired', className: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Not a member', className: 'bg-muted text-muted-foreground' },
}

export function FamilyCard({ planActive, setup = false }: {
  /** The member has an active family membership. */
  planActive: boolean
  /** Just bought one: open ready to add the children. */
  setup?: boolean
}) {
  const [children, setChildren] = useState<ApiChild[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(setup && planActive)
  const card = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (setup && planActive) card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [setup, planActive])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ fullName: '', uscfId: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyChildren()
      .then((list) => { if (!cancelled) setChildren(list) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load family') })
    return () => { cancelled = true }
  }, [])

  function startAdd() {
    setEditingId(null)
    setForm({ fullName: '', uscfId: '' })
    setAdding(true)
    setError(null)
  }

  function startEdit(child: ApiChild) {
    setAdding(false)
    setEditingId(child.id)
    setForm({ fullName: child.full_name, uscfId: child.uscf_id ?? '' })
    setError(null)
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = { fullName: form.fullName.trim(), uscfId: form.uscfId.trim() || null }
      setChildren(editingId ? await updateChild(editingId, body) : await addChild(body))
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(child: ApiChild) {
    if (!confirm(`Remove ${child.full_name} from your account?`)) return
    setBusy(true)
    setError(null)
    try {
      setChildren(await removeChild(child.id))
      cancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setBusy(false)
    }
  }

  const form_ = (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="child-name">Child's full name</Label>
        <Input id="child-name" required maxLength={100} value={form.fullName}
          onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="child-uscf">USCF ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="child-uscf" inputMode="numeric" maxLength={8} placeholder="8 digits" value={form.uscfId}
          onChange={(e) => setForm((p) => ({ ...p, uscfId: e.target.value.replace(/\D/g, '') }))} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className={GOLD} disabled={busy || !form.fullName.trim()}>
          {editingId ? 'Save' : 'Add'}
        </Button>
        <Button type="button" variant="outline" onClick={cancel} aria-label="Cancel"><X className="size-4" /></Button>
      </div>
    </form>
  )

  // Only for family memberships, or someone who already added children.
  if (!planActive && (children === null || children.length === 0)) return null
  const covered = Math.min(children?.length ?? 0, LIMIT)
  const room = LIMIT - covered

  return (
    <div id="family" ref={card} className="scroll-mt-24 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-lca-gold" />
          <h2 className="text-lg font-bold text-lca-navy">My family</h2>
          {planActive && children && (
            <span className="rounded-full bg-lca-navy/[0.06] px-2 py-0.5 text-xs font-medium text-lca-navy">
              {covered} of {LIMIT} added
            </span>
          )}
        </div>
        {!adding && children && !(planActive && room > 0) && (
          <Button type="button" size="sm" variant="outline" onClick={startAdd}>
            <Plus className="mr-1.5 size-3.5" /> Add a child
          </Button>
        )}
      </div>
      {planActive ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Your family membership covers you and up to {LIMIT} children. Add them here and they're covered right away;
          you can then register everyone for tournaments and pay in one checkout.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Your family membership isn't active, so the children below aren't covered.{' '}
          <Link to="/membership" className="font-medium text-lca-navy underline underline-offset-2">Renew it</Link> to cover them again.
        </p>
      )}

      {planActive && children && room > 0 && !adding && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lca-gold/50 bg-lca-gold/10 px-4 py-3">
          <p className="text-sm text-lca-navy">
            {covered === 0
              ? <><span className="font-semibold">Finish setting up your family membership:</span> add the children it covers.</>
              : <>You can add {room} more {room === 1 ? 'child' : 'children'} to your membership.</>}
          </p>
          <Button type="button" size="sm" className={GOLD} onClick={startAdd}>
            <Plus className="mr-1.5 size-3.5" /> Add a child
          </Button>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {children === null ? (
        !error && <p className="mt-4 text-sm text-muted-foreground" role="status">Loading…</p>
      ) : (
        <>
          {children.length > 0 && (
            <ul className="mt-4 divide-y rounded-lg border">
              {children.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-lca-navy">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.uscf_id ? `USCF ${c.uscf_id}` : 'No USCF ID yet — needed for rated events'}
                        {c.uscf_rating ? ` · rating ${c.uscf_rating}` : ''}
                        {c.membership_status === 'active' && c.membership_expiry ? ` · LCA member through ${c.membership_expiry}` : ''}
                      </p>
                      {(() => {
                        const st = usChessState(c.uscf_id, c.uscf_expiration)
                        if (st === 'none' || st === 'unknown') return null
                        const date = (c.uscf_expiration as string).slice(0, 10)
                        return (
                          <p className={cn('text-xs', st === 'expired' ? 'text-red-700' : st === 'soon' ? 'text-amber-800' : 'text-muted-foreground')}>
                            US Chess {st === 'expired' ? `expired ${date}` : `through ${date}`}
                            {st !== 'valid' && (
                              <> · <a href={USCHESS_RENEW_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">Renew</a></>
                            )}
                          </p>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', (STATUS[c.membership_status] ?? STATUS.pending).className)}>
                        {(STATUS[c.membership_status] ?? STATUS.pending).label}
                      </span>
                      <button type="button" onClick={() => startEdit(c)} className="p-1 text-muted-foreground hover:text-lca-navy" aria-label={`Edit ${c.full_name}`}>
                        <Pencil className="size-4" />
                      </button>
                      <button type="button" onClick={() => handleRemove(c)} disabled={busy}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50" aria-label={`Remove ${c.full_name}`}>
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                  {editingId === c.id && form_}
                </li>
              ))}
            </ul>
          )}
          {adding && form_}
          {children.length === 0 && !adding && (
            <p className="mt-4 text-sm text-muted-foreground">No children added yet.</p>
          )}
        </>
      )}
    </div>
  )
}
