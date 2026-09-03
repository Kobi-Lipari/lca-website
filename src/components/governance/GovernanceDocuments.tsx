// src/components/governance/GovernanceDocuments.tsx
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Upload, FileText, Pencil, ChevronDown } from 'lucide-react'
import { DocRow } from '@/components/governance/GovLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  adminCreateGovernanceDocument,
  adminUpdateGovernanceDocument,
  adminDeleteGovernanceDocument,
  getGovernanceDocuments,
  type ApiGovernanceDocument,
} from '@/lib/api'
import { ACCEPTED_UPLOAD_TYPES, stripDocumentExtension } from '@/lib/documentUpload'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'

/**
 * The editor is admin-only, and TipTap is not small.
 *
 * This component renders on /governance/bylaws and /governance/minutes,
 * which are public pages — a visitor reading the bylaws was downloading the
 * whole editor to render a read-only list. Loading it with the add/edit form
 * keeps it off that path entirely.
 */
const RichTextEditor = lazy(() =>
  import('@/components/governance/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
)

/** RichTextEditor with its own loading boundary, so the two call sites below
 *  don't each need to think about one. */
function LazyEditor(props: { content: string; onChange: (html: string) => void }) {
  return (
    <Suspense
      fallback={
        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Loading editor…
        </div>
      }
    >
      <RichTextEditor {...props} />
    </Suspense>
  )
}

const emptyForm = { title: '', content: '', doc_date: '', year: '' }

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').trim()
}

function DocumentCard({
  doc,
  isAdmin,
  layout,
  onEdit,
  onDelete,
}: {
  doc: ApiGovernanceDocument
  isAdmin: boolean
  layout: 'accordion' | 'preview'
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const plainText = doc.content ? stripHtml(doc.content) : ''
  const snippet = plainText.length > 220 ? plainText.slice(0, 220).trim() + '…' : plainText

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start justify-between gap-2 px-4 pt-3 pb-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[#1a2744]">{doc.title}</h4>
            <ChevronDown className={`size-4 flex-shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
          {doc.doc_date && <p className="text-xs text-muted-foreground">{doc.doc_date}</p>}
          {layout === 'accordion' && !expanded && snippet && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{snippet}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onEdit} className="p-1 text-muted-foreground hover:text-[#1a2744]">
              <Pencil className="size-3.5" />
            </button>
            <button type="button" onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </button>

      {layout === 'accordion' ? (
        expanded && (
          <div className="px-4 pb-4 pt-1">
            {doc.content ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: doc.content }} />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-3.5 text-muted-foreground" />
                <DocRow title="" filename={doc.filename} file_url={doc.file_url} />
              </div>
            )}
          </div>
        )
      ) : (
        <div className="px-4 pb-4 pt-1">
          {doc.content ? (
            <div className="relative">
              <div
                className={`prose prose-sm max-w-none ${!expanded ? 'max-h-40 overflow-hidden' : ''}`}
                dangerouslySetInnerHTML={{ __html: doc.content }}
              />
              {!expanded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="size-3.5 text-muted-foreground" />
              <DocRow title="" filename={doc.filename} file_url={doc.file_url} />
            </div>
          )}
          {doc.content && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 text-sm font-medium text-[#1a2744] underline underline-offset-2"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function GovernanceDocuments({
  category,
  title,
  isAdmin,
  layout = 'accordion',
}: {
  category: ApiGovernanceDocument['category']
  title: string
  isAdmin: boolean
  layout?: 'accordion' | 'preview'
}) {
  const [docs, setDocs] = useState<ApiGovernanceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    getGovernanceDocuments(category)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  function startAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setAdding(true)
  }

  function startEdit(doc: ApiGovernanceDocument) {
    setForm({
      title: doc.title,
      content: doc.content || '',
      doc_date: doc.doc_date || '',
      year: doc.year ? String(doc.year) : '',
    })
    setEditingId(doc.id)
    setAdding(true)
  }

  function cancelForm() {
    setAdding(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleFile(file: File) {
    setParsing(true)
    try {
      // Loaded here rather than at module scope: the parser is mammoth plus
      // pdfjs, and nobody who is only reading these pages should pay for it.
      // "Reading file…" is already showing by the time this resolves.
      const { parseFileToHtml } = await import('@/lib/parseDocumentFile')
      const html = await parseFileToHtml(file)
      setForm((p) => ({
        ...p,
        content: html,
        title: p.title || stripDocumentExtension(file.name),
      }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        category,
        title: form.title,
        content: form.content || null,
        filename: null,
        file_url: null,
        doc_date: form.doc_date || null,
        year: form.year ? Number(form.year) : null,
      }

      if (editingId) {
        const updated = await adminUpdateGovernanceDocument(editingId, payload)
        setDocs((prev) => prev.map((d) => (d.id === editingId ? updated : d)))
      } else {
        const created = await adminCreateGovernanceDocument(payload)
        setDocs((prev) => [created, ...prev])
      }

      cancelForm()
    } catch (err) {
      console.error('Failed to save document:', err)
      alert(err instanceof Error ? err.message : 'Failed to save document.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    await adminDeleteGovernanceDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
    if (editingId === id) cancelForm()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[#1a2744]">{title}</h3>
        {isAdmin && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            <Plus className="mr-1.5 size-3.5" /> Add document
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <p className="text-sm font-medium text-[#1a2744]">{editingId ? 'Edit document' : 'Add document'}</p>

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
              <LazyEditor content={form.content} onChange={(html) => setForm((p) => ({ ...p, content: html }))} />
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
                    <LazyEditor content={form.content} onChange={(html) => setForm((p) => ({ ...p, content: html }))} />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2">
            <Button type="button" className={GOLD} size="sm" onClick={handleSave} disabled={saving || !form.title || !form.content}>
              {editingId ? 'Save changes' : 'Save'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancelForm}>Cancel</Button>
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
            <DocumentCard
              key={doc.id}
              doc={doc}
              isAdmin={isAdmin}
              layout={layout}
              onEdit={() => startEdit(doc)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}