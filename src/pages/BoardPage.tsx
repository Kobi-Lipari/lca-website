// src/pages/BoardPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
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
import { usePageTitle } from '@/hooks/usePageTitle'

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

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

  async function handleUpdate(id: string, field: keyof ApiBoardMember, value: string) {
    setSaving(id)
    try {
      const member = members.find((m) => m.id === id)!
      const updated = await adminUpdateBoardMember(id, { ...member, [field]: value })
      setMembers((prev) => prev.map((m) => m.id === id ? updated : m))
    } finally { setSaving(null) }
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

  return (
    <GovLayout title="Board members" subtitle="Current LCA officers and directors">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {members.map((m) => (
              <div key={m.id} className="rounded-xl border bg-card p-4 shadow-sm" style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}>
                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        className="h-7 text-xs font-semibold text-[#c8a94a]"
                        value={m.role}
                        disabled={saving === m.id}
                        onBlur={(e) => handleUpdate(m.id, 'role', e.target.value)}
                        onChange={(e) => setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, role: e.target.value } : x))}
                      />
                      <button type="button" onClick={() => handleDelete(m.id)} disabled={saving === m.id} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <Input
                      className="h-8 font-semibold text-[#1a2744]"
                      value={m.name}
                      disabled={saving === m.id}
                      placeholder="Full name"
                      onBlur={(e) => handleUpdate(m.id, 'name', e.target.value)}
                      onChange={(e) => setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, name: e.target.value } : x))}
                    />
                    <Input
                      className="h-7 text-xs text-muted-foreground"
                      value={m.email ?? ''}
                      disabled={saving === m.id}
                      placeholder="email@louisianachess.org"
                      onBlur={(e) => handleUpdate(m.id, 'email', e.target.value)}
                      onChange={(e) => setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, email: e.target.value } : x))}
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#c8a94a]">{m.role}</p>
                    <p className="mt-1 font-semibold text-[#1a2744]">{m.name !== 'TBD' ? m.name : '—'}</p>
                    {m.email && <a href={`mailto:${m.email}`} className="mt-0.5 block text-xs text-muted-foreground hover:text-[#c8a94a]">{m.email}</a>}
                  </>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-6">
              {adding ? (
                <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                  <p className="text-sm font-medium text-[#1a2744]">Add board member</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label className="text-xs">Role</Label><Input className="mt-1 h-8 text-sm" placeholder="e.g. President" value={newMember.role} onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value }))} /></div>
                    <div><Label className="text-xs">Name</Label><Input className="mt-1 h-8 text-sm" placeholder="Full name" value={newMember.name} onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label className="text-xs">Email</Label><Input className="mt-1 h-8 text-sm" placeholder="Optional" value={newMember.email} onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))} /></div>
                  </div>
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

          <p className="mt-6 text-xs text-muted-foreground">
            To contact the board, use the{' '}
            <Link to="/contact" className="text-[#c8a94a] hover:underline">contact form</Link>.
          </p>
        </>
      )}
    </GovLayout>
  )
}