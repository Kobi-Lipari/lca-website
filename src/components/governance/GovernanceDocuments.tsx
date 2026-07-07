import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Upload, FileText } from 'lucide-react'
import { DocRow } from '@/components/governance/GovLayout'
import { RichTextEditor } from '@/components/governance/RichTextEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  adminCreateGovernanceDocument,
  adminDeleteGovernanceDocument,
  getGovernanceDocuments,
  type ApiGovernanceDocument,
} from '@/lib/api'
import { parseFileToHtml, ACCEPTED_UPLOAD_TYPES } from '@/lib/parseDocumentFile'

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function GovernanceDocuments({
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
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ title: '', content: '', doc_date: '', year: '' })

  useEffect(() => {
    getGovernanceDocuments(category)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  async function handleFile(file: File) {
    setParsing(true)
    try {
      const html = await parseFileToHtml(file)
      setForm((p) => ({
        ...p,
        content: html,
        title: p.title || file.name.replace(/\.(docx|pdf)$/i, ''),
      }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setParsing(false)
    }
  }

  async function handleAdd() {
    setSaving(true)
    try {
      const created = await adminCreateGovernanceDocument({
        category,
        title: form.title,
        content: form.content || null,
        filename: null,
        file_url: null,
        doc_date: form.doc_date || null,
        year: form.year ? Number(form.year) : null,
      })
      setDocs((prev) => [created, ...prev])
      setForm({ title: '', content: '', doc_date: '', year: '' })
      setAdding(false)
    } finally {
      setSaving(false)
    }
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
            <div><Label className="text-xs">Title</Label><Input className="mt-1 h-8 text-sm" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label className="text-xs">Document date</Label><Input type="date" className="mt-1 h-8 text-sm" value={form.doc_date} onChange={(e) => setForm((p) => ({ ...p, doc_date: e.target.value }))} /></div>
          </div>

          <Tabs defaultValue="write">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="upload">Upload & convert</TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="mt-3">
              <RichTextEditor content={form.content} onChange={(html) => setForm((p) => ({ ...p, content: html }))} />
            </TabsContent>

            <TabsContent value="upload" className="mt-3 space-y-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleFile(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors ${
                  dragOver ? 'border-[#c8a94a] bg-[#c8a94a]/5' : 'border-muted-foreground/30'
                }`}
              >
                <Upload className="size-5 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {parsing ? 'Reading file…' : 'Drag a .docx or .pdf here, or click to browse'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_UPLOAD_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = ''
                  }}
                />
              </div>

              {form.content && (
                <div>
                  <Label className="text-xs">Review & edit before saving</Label>
                  <div className="mt-1">
                    <RichTextEditor content={form.content} onChange={(html) => setForm((p) => ({ ...p, content: html }))} />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            <Button type="button" className={GOLD} size="sm" onClick={handleAdd} disabled={saving || !form.title || !form.content}>Save</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {docs.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-sm italic text-muted-foreground">No documents yet.</p>
          </div>
        ) : (
          docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border bg-card shadow-sm">
              <div className="flex items-start justify-between gap-2 px-4 pt-3">
                <div>
                  <h4 className="font-semibold text-[#1a2744]">{doc.title}</h4>
                  {doc.doc_date && <p className="text-xs text-muted-foreground">{doc.doc_date}</p>}
                </div>
                {isAdmin && (
                  <button type="button" onClick={() => handleDelete(doc.id)} className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="px-4 pb-4 pt-2">
                {doc.content ? (
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: doc.content }} />
                ) : (
                  // Legacy fallback for docs added the old way (file_url/filename, no content)
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <DocRow title="" filename={doc.filename} file_url={doc.file_url} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}