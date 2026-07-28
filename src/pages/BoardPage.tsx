// src/pages/BoardPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Plus, ShieldCheck, MapPin, Trash2 } from 'lucide-react'
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
  type ApiBoardMember,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

type EditableField = 'role' | 'name' | 'email'

/** A role title containing "Representative" is a regional seat; everything
 *  else (President, Vice President, Secretary-Treasurer, Scholastic
 *  Director, Webmaster, etc.) is an executive officer. Simple, but matches
 *  every role name LCA actually uses, and keeps the grouping automatic —
 *  no separate admin toggle to keep in sync. */
function isRegionalRole(role: string): boolean {
  return /representative/i.test(role)
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

// ── A single officer or representative card ───────────────────────────────────
// onLocalChange fires on every keystroke (just updates local state so typing
// feels normal); onSave fires onBlur and is the actual PATCH. Officers and
// regional reps share this exact same card treatment — no size variants.

function MemberCard({
  m, isAdmin, saving, onLocalChange, onSave, onDelete,
}: {
  m: ApiBoardMember
  isAdmin: boolean
  saving: boolean
  onLocalChange: (id: string, field: EditableField, value: string) => void
  onSave: (id: string, field: EditableField, value: string) => void
  onDelete: (id: string) => void
}) {
  const isVacant = m.name === 'TBD'

  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm"
      style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}
    >
      {isAdmin ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Input
              className="h-7 text-[11px] font-semibold uppercase tracking-wide text-[#c8a94a]"
              value={m.role}
              disabled={saving}
              onBlur={(e) => onSave(m.id, 'role', e.target.value)}
              onChange={(e) => onLocalChange(m.id, 'role', e.target.value)}
            />
            <button type="button" onClick={() => onDelete(m.id)} disabled={saving} className="flex-shrink-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <Input
            className="h-8 font-semibold text-[#1a2744]"
            value={m.name}
            disabled={saving}
            placeholder="Full name"
            onBlur={(e) => onSave(m.id, 'name', e.target.value)}
            onChange={(e) => onLocalChange(m.id, 'name', e.target.value)}
          />
          <Input
            className="h-7 text-xs text-muted-foreground"
            value={m.email ?? ''}
            disabled={saving}
            placeholder="email@louisianachess.org"
            onBlur={(e) => onSave(m.id, 'email', e.target.value)}
            onChange={(e) => onLocalChange(m.id, 'email', e.target.value)}
          />
        </div>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#c8a94a]">
            {m.role}
          </p>
          {isVacant ? (
            <div className="mt-1.5">
              <p className="text-sm italic text-muted-foreground">
                This seat is currently open
              </p>
              <Link
                to="/contact"
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#c8a94a] hover:underline"
              >
                Interested in serving? Contact us →
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-1 font-semibold text-[#1a2744]">
                {m.name}
              </p>
              {m.email && (
                <a
                  href={`mailto:${m.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#c8a94a]/40 bg-[#c8a94a]/8 px-2.5 py-1 text-[11px] font-medium text-[#7a5c00] transition-colors hover:bg-[#c8a94a]/15',
                  )}
                >
                  <Mail className="size-3" /> Email {firstName(m.name)}
                </a>
              )}
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

  const [members, setMembers] = useState<ApiBoardMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newMember, setNewMember] = useState({ role: '', name: '', email: '' })

  useEffect(() => {
    getBoardMembers()
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleLocalChange(id: string, field: EditableField, value: string) {
    setMembers((prev) => prev.map((x) => (x.id === id ? { ...x, [field]: value } : x)))
  }

  async function handleSave(id: string, field: EditableField, value: string) {
    setSaving(id)
    try {
      const member = members.find((m) => m.id === id)!
      const updated = await adminUpdateBoardMember(id, { ...member, [field]: value })
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)))
    } finally {
      setSaving(null)
    }
  }

  async function handleAdd() {
    if (!newMember.role || !newMember.name) return
    setSaving('new')
    try {
      const created = await adminCreateBoardMember({ ...newMember, sort_order: members.length + 1 })
      setMembers((prev) => [...prev, created])
      setNewMember({ role: '', name: '', email: '' })
      setAdding(false)
    } finally { setSaving(null) }
  }

  async function handleDelete(id: string) {
    setSaving(id)
    try {
      await adminDeleteBoardMember(id)
      setMembers((prev) => prev.filter((m) => m.id !== id))
    } finally { setSaving(null) }
  }

  const officers = members.filter((m) => !isRegionalRole(m.role))
  const reps = members.filter((m) => isRegionalRole(m.role))

  return (
    <GovLayout
      title="Board & regional leadership"
      subtitle="The volunteer officers and regional representatives who lead chess in Louisiana — reach out any time, that's what they're here for."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-10">

          {officers.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#c8a94a]" />
                <h2 className="text-base font-bold text-[#1a2744]">Officers</h2>
                <span className="text-xs text-muted-foreground">· {officers.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {officers.map((m) => (
                  <MemberCard
                    key={m.id}
                    m={m}
                    isAdmin={isAdmin}
                    saving={saving === m.id}
                    onLocalChange={handleLocalChange}
                    onSave={handleSave}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {reps.length > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="size-5 text-[#c8a94a]" />
                <h2 className="text-base font-bold text-[#1a2744]">Regional representatives</h2>
                <span className="text-xs text-muted-foreground">· {reps.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reps.map((m) => (
                  <MemberCard
                    key={m.id}
                    m={m}
                    isAdmin={isAdmin}
                    saving={saving === m.id}
                    onLocalChange={handleLocalChange}
                    onSave={handleSave}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div>
              {adding ? (
                <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                  <p className="text-sm font-medium text-[#1a2744]">Add board member</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label className="text-xs">Role</Label><Input className="mt-1 h-8 text-sm" placeholder="e.g. President, or '... Representative'" value={newMember.role} onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value }))} /></div>
                    <div><Label className="text-xs">Name</Label><Input className="mt-1 h-8 text-sm" placeholder="Full name" value={newMember.name} onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label className="text-xs">Email</Label><Input className="mt-1 h-8 text-sm" placeholder="Optional" value={newMember.email} onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: a role containing "Representative" is automatically grouped under Regional representatives.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" className={GOLD} size="sm" onClick={handleAdd} disabled={saving === 'new'}>Add member</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
                  <Plus className="mr-1.5 size-3.5" /> Add board member
                </Button>
              )}
            </div>
          )}

          <div className="rounded-xl border-[3px] border-[#c8a94a] bg-[#1a2744] p-5 text-white">
            <h3 className="font-semibold">Want to reach the whole board at once?</h3>
            <p className="mt-2 text-sm text-white/65">
              For general inquiries, the contact form reaches the LCA directly and gets routed to the right person.
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