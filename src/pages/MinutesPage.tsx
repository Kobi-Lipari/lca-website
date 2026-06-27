import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GovLayout, DocRow } from '@/components/governance/GovLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  adminCreateGovernanceDocument,
  adminDeleteGovernanceDocument,
  getGovernanceDocuments,
  type ApiGovernanceDocument,
} from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'


function DocumentSection({
  category,
  title,
  isAdmin,
}: {
  category: ApiGovernanceDocument['category']
  title: string
  isAdmin: boolean
}) {
  const [docs, setDocs] = useState<ApiGovernanceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', filename: '', file_url: '', doc_date: '', year: '' })

  useEffect(() => {
    getGovernanceDocuments(category)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await adminCreateGovernanceDocument({
        category,
        title: form.title,
        filename: form.filename || null,
        file_url: form.file_url || null,
        doc_date: form.doc_date || null,
        year: form.year ? Number(form.year) : null,
      })
      setDocs((prev) => [created, ...prev])
      setForm({ title: '', filename: '', file_url: '', doc_date: '', year: '' })
      setAdding(false)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await adminDeleteGovernanceDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#1a2744]">{title}</h3>
        {isAdmin && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 size-3.5" /> Add document
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <p className="text-sm font-medium text-[#1a2744]">Add document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label className="text-xs">Title</Label><Input className="mt-1 h-8 text-sm" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label className="text-xs">Filename</Label><Input className="mt-1 h-8 text-sm" placeholder="e.g. bylaws-2024.pdf" value={form.filename} onChange={(e) => setForm((p) => ({ ...p, filename: e.target.value }))} /></div>
            <div><Label className="text-xs">File URL</Label><Input className="mt-1 h-8 text-sm" placeholder="https://..." value={form.file_url} onChange={(e) => setForm((p) => ({ ...p, file_url: e.target.value }))} /></div>
            <div><Label className="text-xs">Document date</Label><Input type="date" className="mt-1 h-8 text-sm" value={form.doc_date} onChange={(e) => setForm((p) => ({ ...p, doc_date: e.target.value }))} /></div>
            <div><Label className="text-xs">Year</Label><Input type="number" className="mt-1 h-8 text-sm" placeholder={String(new Date().getFullYear())} value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button type="button" className={GOLD} size="sm" onClick={handleAdd} disabled={saving || !form.title}>Save</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-2">
          {docs.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground italic">No documents yet.</p>
          ) : (
            docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <DocRow title={doc.title} filename={doc.filename} file_url={doc.file_url} />
                </div>
                {isAdmin && (
                  <button type="button" onClick={() => handleDelete(doc.id)} className="flex-shrink-0 text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


export function MinutesPage() {
  usePageTitle('Meeting Minutes')
  const { role } = useAuth()
  return (
    <GovLayout title="Meeting minutes" subtitle="Board meeting records and treasurer's reports">
      <div className="space-y-8">
        <DocumentSection category="minutes" title="Meeting minutes" isAdmin={role === 'lca_admin'} />
        <DocumentSection category="treasurer" title="Treasurer's reports" isAdmin={role === 'lca_admin'} />
      </div>
    </GovLayout>
  )
}