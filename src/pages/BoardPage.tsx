// src/pages/BoardPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Mail, Plus, ShieldCheck, MapPin } from 'lucide-react'
import { GovLayout } from '@/components/governance/GovLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  adminCreateBoardMember,
  adminDeleteBoardMember,
  adminUpdateBoardMember,
  getBoardMembers,
  getBoardSeats,
  type ApiBoardMember,
  type ApiBoardSeat,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCA, GOLD_BUTTON as GOLD } from '@/lib/brand'

type EditableField = 'role' | 'name'

/** Fallback grouping for seats created before migration 0025, or added
 *  through the POST endpoint before it learned to set `category`. Once every
 *  row has a category this is dead code — delete it then. */
function isRegionalRole(role: string): boolean {
  return /representative/i.test(role)
}

function isRegional(seat: ApiBoardSeat): boolean {
  return seat.category ? seat.category === 'regional_rep' : isRegionalRole(seat.role)
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

/**
 * "Message Adriana" for one holder, "Message the USCF Delegates" for a shared
 * seat with several. Using first names for a group reads oddly once there are
 * two, and the role is what the visitor is actually trying to reach.
 */
function contactLabel(seat: ApiBoardSeat, displayName: string): string {
  if (seat.holder_count > 1) return `Message the ${seat.role}s`
  return `Message ${firstName(displayName)}`
}

// ── A single officer or representative card ───────────────────────────────────
// The public side never shows an address. The contact link opens the contact
// form pre-routed to this SEAT (?to=<slug>), so the message becomes a ticket
// attached to the office rather than an email to a person. When the holder
// changes, old links keep working and the new holder inherits the history.

function MemberCard({
  seat, member, isAdmin, saving, onLocalChange, onSave, onRetire,
}: {
  seat: ApiBoardSeat
  member?: ApiBoardMember
  isAdmin: boolean
  saving: boolean
  onLocalChange: (id: string, field: EditableField, value: string) => void
  onSave: (id: string, field: EditableField, value: string) => void
  onRetire: (id: string) => void
}) {
  const displayName = seat.holder_name ?? ''
  const isVacant = !displayName || displayName === 'TBD'
  // A seat with no slug predates 0025 and can't be routed to yet.
  const contactHref = seat.slug ? `/contact?to=${encodeURIComponent(seat.slug)}` : '/contact'
  const isLinked = seat.holder_count > 0

  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm"
      style={{ borderLeftColor: LCA.gold, borderLeftWidth: 3 }}
    >
      {isAdmin && member ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Input
              className="h-7 text-[11px] font-semibold uppercase tracking-wide text-lca-navy"
              value={member.role}
              disabled={saving}
              onBlur={(e) => onSave(seat.id, 'role', e.target.value)}
              onChange={(e) => onLocalChange(seat.id, 'role', e.target.value)}
            />
            <button
              type="button"
              onClick={() => onRetire(seat.id)}
              disabled={saving}
              title="Retire this seat — it disappears from the site but its message history is kept"
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Archive className="size-3.5" />
            </button>
          </div>

          {/* A linked seat takes its name from the member account, so an editable
              fallback here would let an admin type something the public never
              sees — which is exactly how the two views drifted apart. */}
          {isLinked ? (
            <div className="rounded-md border border-lca-gold/40 bg-lca-gold/8 px-2 py-1.5">
              <p className="text-sm font-semibold text-lca-navy">{seat.holder_name}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                From {seat.holder_count > 1 ? 'their member accounts' : 'their member account'}.
                Messages reach {seat.holder_count > 1 ? 'them all' : 'them'} through the site.
              </p>
            </div>
          ) : (
            <>
              <Input
                className="h-8 font-semibold text-lca-navy"
                value={member.name}
                disabled={saving}
                placeholder="Full name, or TBD"
                onBlur={(e) => onSave(seat.id, 'name', e.target.value)}
                onChange={(e) => onLocalChange(seat.id, 'name', e.target.value)}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                No member account linked — messages go to the LCA inbox. Link one in
                Admin → Board seats.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-lca-navy">
            {seat.role}
          </p>
          {isVacant ? (
            <div className="mt-1.5">
              <p className="text-sm italic text-muted-foreground">
                This seat is currently open
              </p>
              <Link
                to={contactHref}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-lca-navy hover:underline"
              >
                Interested in serving? Contact us →
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-1 font-semibold text-lca-navy">{displayName}</p>
              <Link
                to={contactHref}
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-md border border-lca-gold/40 bg-lca-gold/8 px-2.5 py-1 text-[11px] font-medium text-[#7a5c00] transition-colors hover:bg-lca-gold/15',
                )}
              >
                <Mail className="size-3" /> {contactLabel(seat, displayName)}
              </Link>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function BoardPage() {
  usePageTitle('Board Members')
  const { role } = useAuth()
  const isAdmin = role === 'lca_admin'

  // seats drives what's rendered (it knows the slug, the category, and who
  // currently holds the office). members is only needed for the admin editor,
  // which still writes through the governance endpoints.
  const [seats, setSeats] = useState<ApiBoardSeat[]>([])
  const [members, setMembers] = useState<ApiBoardMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newMember, setNewMember] = useState({ role: '', name: '' })

  useEffect(() => {
    Promise.all([
      getBoardSeats().catch(() => [] as ApiBoardSeat[]),
      getBoardMembers().catch(() => [] as ApiBoardMember[]),
    ])
      .then(([s, m]) => {
        setSeats(s)
        setMembers(m)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleLocalChange(id: string, field: EditableField, value: string) {
    setMembers((prev) => prev.map((x) => (x.id === id ? { ...x, [field]: value } : x)))
  }

  async function handleSave(id: string, field: EditableField, value: string) {
    setSaving(id)
    try {
      // Only the changed field: the PUT uses field-present semantics, so
      // sending the whole row would push slug/category/is_active at an
      // endpoint that has no business receiving them.
      const updated = await adminUpdateBoardMember(id, { [field]: value })
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
      // Keep the rendered seat in step with the edit without a full refetch.
      setSeats((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                role: updated.role,
                holder_name: s.holder_count > 0 ? s.holder_name : updated.name,
              }
            : s,
        ),
      )
    } finally {
      setSaving(null)
    }
  }

  async function handleAdd() {
    if (!newMember.role || !newMember.name) return
    setSaving('new')
    try {
      const created = await adminCreateBoardMember({
        ...newMember,
        email: null,
        sort_order: members.length + 1,
      })
      setMembers((prev) => [...prev, created])
      // Refetch rather than synthesising a seat: slug and category are
      // assigned server-side, and this page can't route to a seat without them.
      setSeats(await getBoardSeats().catch(() => seats))
      setNewMember({ role: '', name: '' })
      setAdding(false)
    } finally { setSaving(null) }
  }

  // Retires rather than deletes — the seat's tickets and term history survive.
  async function handleRetire(id: string) {
    setSaving(id)
    try {
      await adminDeleteBoardMember(id)
      setMembers((prev) => prev.filter((m) => m.id !== id))
      setSeats((prev) => prev.filter((s) => s.id !== id))
    } finally { setSaving(null) }
  }

  const officers = seats.filter((s) => !isRegional(s))
  const reps = seats.filter(isRegional)

  return (
    <GovLayout
      title="Board & regional leadership"
      subtitle="The volunteer officers and regional representatives who lead chess in Louisiana — reach out any time, that's what they're here for."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-10">
          {isAdmin && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
              You're seeing the editable view — the public sees plain cards. Seat
              titles are edited here; who holds them is set in Admin → Board seats.
            </p>
          )}

          {officers.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="size-5 text-lca-gold" />
                <h2 className="text-base font-bold text-lca-navy">Officers</h2>
                <span className="text-xs text-muted-foreground">· {officers.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {officers.map((s) => (
                  <MemberCard
                    key={s.id}
                    seat={s}
                    member={members.find((m) => m.id === s.id)}
                    isAdmin={isAdmin}
                    saving={saving === s.id}
                    onLocalChange={handleLocalChange}
                    onSave={handleSave}
                    onRetire={handleRetire}
                  />
                ))}
              </div>
            </div>
          )}

          {reps.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="size-5 text-lca-gold" />
                <h2 className="text-base font-bold text-lca-navy">Regional representatives</h2>
                <span className="text-xs text-muted-foreground">· {reps.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reps.map((s) => (
                  <MemberCard
                    key={s.id}
                    seat={s}
                    member={members.find((m) => m.id === s.id)}
                    isAdmin={isAdmin}
                    saving={saving === s.id}
                    onLocalChange={handleLocalChange}
                    onSave={handleSave}
                    onRetire={handleRetire}
                  />
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div>
              {adding ? (
                <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                  <p className="text-sm font-medium text-lca-navy">Add a board seat</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Role</Label><Input className="mt-1 h-8 text-sm" placeholder="e.g. President, or '… Representative'" value={newMember.role} onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value }))} /></div>
                    <div><Label className="text-xs">Name</Label><Input className="mt-1 h-8 text-sm" placeholder="Full name, or TBD" value={newMember.name} onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A role containing "Representative" is grouped under Regional
                    representatives. The name here is only a placeholder until you
                    link a member account in Admin → Board seats.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" className={GOLD} size="sm" onClick={handleAdd} disabled={saving === 'new'}>Add seat</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
                  <Plus className="mr-1.5 size-3.5" /> Add a board seat
                </Button>
              )}
            </div>
          )}

          <div className="rounded-xl border-[3px] border-lca-gold bg-lca-navy p-5 text-white">
            <h3 className="font-semibold">Not sure who to ask?</h3>
            <p className="mt-2 text-sm text-white/65">
              Send it as a general inquiry and we'll route it to the right person. Every message opens a ticket you can follow.
            </p>
            <Button asChild className={cn('mt-4', GOLD)}>
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      )}
    </GovLayout>
  )
}