// src/components/admin/PostsPanel.tsx
//
// Admin panel → Communications → News posts. Write, edit, pin, publish and
// unpublish LCA announcements. Published posts appear on the News page and
// get their own page (/news/<slug>) with a proper Facebook link preview.
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ExternalLink, ImagePlus, Pin, Plus, Share2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/governance/RichTextEditor'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import {
  adminCreatePost,
  adminDeletePost,
  adminGetPost,
  adminGetPosts,
  adminRemovePostImage,
  adminUpdatePost,
  adminUploadPostImage,
  type ApiPost,
} from '@/lib/api'
import { downscaleImage } from '@/lib/resizeImage'
import { formatPostDate } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'

const SITE = 'https://www.louisianachess.org'

interface Draft {
  title: string
  summary: string
  bodyHtml: string
  linkUrl: string
  linkLabel: string
  pinned: boolean
  publishedAt: string
}

function toDraft(p: ApiPost): Draft {
  return {
    title: p.title,
    summary: p.summary,
    bodyHtml: p.body_html ?? '',
    linkUrl: p.link_url ?? '',
    linkLabel: p.link_label ?? '',
    pinned: p.pinned === 1,
    publishedAt: p.published_at ?? '',
  }
}

export function PostsPanel() {
  const [posts, setPosts] = useState<ApiPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ApiPost | null>(null)

  async function refresh() {
    try {
      setPosts(await adminGetPosts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts')
    }
  }

  useEffect(() => { refresh() }, [])

  async function openPost(p: ApiPost) {
    setError(null)
    try {
      setEditing(await adminGetPost(p.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open post')
    }
  }

  async function newPost() {
    setError(null)
    try {
      const post = await adminCreatePost({ title: 'Untitled announcement' })
      setEditing(post)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
    }
  }

  if (editing) {
    return (
      <PostEditor
        key={editing.id}
        post={editing}
        onClose={() => { setEditing(null); refresh() }}
        onSaved={(p) => { setEditing(p); refresh() }}
      />
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-lca-navy">News posts</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            LCA announcements on the News page. Each post has its own page you can share to Facebook.
          </p>
        </div>
        <Button type="button" size="sm" className={GOLD} onClick={newPost}>
          <Plus className="mr-1.5 size-3.5" /> New post
        </Button>
      </div>
      {error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {posts === null ? (
        <p className="text-muted-foreground" role="status">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {posts.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => openPost(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30">
                {p.image_url
                  ? <img src={p.image_url} alt="" className="size-12 flex-shrink-0 rounded-md border object-cover" />
                  : <span className="size-12 flex-shrink-0 rounded-md border bg-muted/40" />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate font-medium text-lca-navy">
                    {p.pinned === 1 && <Pin className="size-3.5 flex-shrink-0 text-lca-gold" aria-label="Pinned" />}
                    <span className="truncate">{p.title}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.status === 'published' ? formatPostDate(p.published_at) : 'Draft'}
                    {p.summary ? ` · ${p.summary}` : ''}
                  </span>
                </span>
                <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  p.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground')}>
                  {p.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PostEditor({ post, onClose, onSaved }: {
  post: ApiPost
  onClose: () => void
  onSaved: (p: ApiPost) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(post))
  const [saved, setSaved] = useState<Draft>(() => toDraft(post))
  const [imageUrl, setImageUrl] = useState(post.image_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const published = post.status === 'published'
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const publicUrl = `${SITE}/news/${post.slug}`
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  async function save(status?: 'draft' | 'published') {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await adminUpdatePost(post.id, {
        title: draft.title,
        summary: draft.summary,
        bodyHtml: draft.bodyHtml,
        linkUrl: draft.linkUrl || null,
        linkLabel: draft.linkLabel || null,
        pinned: draft.pinned,
        publishedAt: draft.publishedAt || null,
        ...(status ? { status } : {}),
      })
      const next = toDraft(updated)
      setSaved(next)
      setDraft(next)
      setNotice(status === 'published' ? 'Published.' : status === 'draft' ? 'Moved back to drafts.' : 'Saved.')
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function handleImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file'); return }
    setBusy(true)
    setError(null)
    try {
      const blob = await downscaleImage(file, 1600, 0.85)
      const { imageUrl: url } = await adminUploadPostImage(post.id, blob)
      setImageUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage() {
    setBusy(true)
    try {
      await adminRemovePostImage(post.id)
      setImageUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the picture')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setConfirmDelete(false)
    setBusy(true)
    try {
      await adminDeletePost(post.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setBusy(false)
    }
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${post.title}"? ${published ? 'It will disappear from the site, and links to it will stop working. ' : ''}This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { if (!dirty || confirm('Discard unsaved changes?')) onClose() }}
          className="text-sm text-lca-navy hover:underline">
          ← All posts
        </button>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium',
          published ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground')}>
          {published ? 'Published' : 'Draft'}{dirty ? ' · unsaved changes' : ''}
        </span>
      </div>

      {error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && !error && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input id="post-title" maxLength={140} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-summary">Summary <span className="font-normal text-muted-foreground">— shown on the News page and in Facebook previews</span></Label>
          <textarea id="post-summary" maxLength={400} rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label>Picture <span className="font-normal text-muted-foreground">(optional — a wide photo works best)</span></Label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          {imageUrl ? (
            <div className="flex flex-wrap items-end gap-3">
              <img src={imageUrl} alt="" className="h-32 rounded-lg border object-cover" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>Replace</Button>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={removeImage}>Remove</Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-1.5 size-4" /> Add a picture
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Full post <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <RichTextEditor content={draft.bodyHtml} onChange={(html) => set({ bodyHtml: html })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="space-y-1.5">
            <Label htmlFor="post-link">Button link <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="post-link" placeholder="/tournaments/state-championship or https://…" value={draft.linkUrl}
              onChange={(e) => set({ linkUrl: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="post-link-label">Button text</Label>
            <Input id="post-link-label" maxLength={40} placeholder="Learn more" value={draft.linkLabel}
              onChange={(e) => set({ linkLabel: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="post-date">Date shown</Label>
            <Input id="post-date" type="date" className="w-44" value={draft.publishedAt}
              onChange={(e) => set({ publishedAt: e.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-[#1a2744]" checked={draft.pinned}
              onChange={(e) => set({ pinned: e.target.checked })} />
            Pin to the top of the News page
          </label>
        </div>
        {!published && <p className="-mt-2 text-xs text-muted-foreground">Leave the date empty to use the day you publish.</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {published ? (
          <>
            <Button type="button" className={GOLD} disabled={busy || !dirty} onClick={() => save()}>Save changes</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => save('draft')}>Unpublish</Button>
            <Button asChild variant="outline">
              <a href={`/news/${post.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 size-4" /> View</a>
            </Button>
            <Button asChild variant="outline">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`} target="_blank" rel="noopener noreferrer">
                <Share2 className="mr-1.5 size-4" /> Share to Facebook
              </a>
            </Button>
          </>
        ) : (
          <>
            <Button type="button" className={GOLD} disabled={busy} onClick={() => save('published')}>Publish</Button>
            <Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => save()}>Save draft</Button>
          </>
        )}
        <Button type="button" variant="ghost" className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy} onClick={() => setConfirmDelete(true)}>
          <Trash2 className="mr-1.5 size-4" /> Delete
        </Button>
      </div>
      {published && (
        <p className="mt-3 text-xs text-muted-foreground">
          Link: <span className="select-all font-mono">{publicUrl}</span>
        </p>
      )}
    </div>
  )
}
