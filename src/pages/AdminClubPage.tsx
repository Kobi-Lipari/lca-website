// src/pages/AdminClubPage.tsx
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Building2, Newspaper, Palette, Trash2, Trophy, Upload, Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminCreateClubNews,
  adminDeleteClubNews,
  adminGetClubNews,
  adminGetClubRoster,
  adminUpdateClub,
  adminUploadClubLogo,
  getClub,
  type ApiAdminMember,
  type ApiClubDetail,
  type ApiClubNews,
  type ApiClubTournament,
} from '@/lib/api'
import { resizeImageToFit } from '@/lib/resizeImage'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCA } from '@/lib/brand'

const goldButtonClass = 'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

type ClubTab = 'details' | 'news' | 'roster' | 'tournaments'

export function AdminClubPage() {
  const { id } = useParams<{ id: string }>()

  const [club, setClub] = useState<ApiClubDetail | null>(null)
  const [roster, setRoster] = useState<ApiAdminMember[]>([])
  const [tournaments, setTournaments] = useState<ApiClubTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newsSaving, setNewsSaving] = useState(false)
  const [tab, setTab] = useState<ClubTab>('details')

  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '',
    city: '',
    location: '',
    description: '',
    meetingSchedule: '',
    contactEmail: '',
    color: LCA.gold,
    imageUrl: '',
    region: '',
  })

  const [newsForm, setNewsForm] = useState({
    title: '',
    newsDate: '',
    excerpt: '',
  })

  const [news, setNews] = useState<ApiClubNews[]>([])
  const [newsDeletingId, setNewsDeletingId] = useState<string | null>(null)

  usePageTitle(club ? `Manage ${club.name}` : 'Manage Club')

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const [clubData, rosterData, newsData] = await Promise.all([
          getClub(id!),
          adminGetClubRoster(id!),
          adminGetClubNews(id!),
        ])
        const c = clubData.club
        setClub(c)
        setTournaments(clubData.tournaments ?? [])
        setForm({
          name: c.name,
          city: c.city,
          location: c.location ?? '',
          description: c.description ?? '',
          meetingSchedule: c.meeting_schedule ?? '',
          contactEmail: c.contact_email ?? '',
          color: (c as any).color ?? LCA.gold,
          imageUrl: (c as any).image_url ?? '',
          region: (c as any).region ?? '',
        })
        setRoster(rosterData)
        setNews(newsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load club')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSaveClub(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const updated = await adminUpdateClub(id, {
        name: form.name,
        city: form.city,
        location: form.location || null,
        description: form.description || null,
        meetingSchedule: form.meetingSchedule || null,
        contactEmail: form.contactEmail || null,
        color: form.color || null,
      } as any)
      setClub(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save club')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same file be re-selected later if needed
    if (!file || !id) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file')
      return
    }
    setLogoUploading(true)
    setLogoError(null)
    try {
      // 400×220 matches the recommended size the old text-field hint used —
      // now enforced automatically instead of trusted to whoever uploads.
      const blob = await resizeImageToFit(file, 320, 320)
      const { imageUrl } = await adminUploadClubLogo(id, blob)
      setForm((p) => ({ ...p, imageUrl }))
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleDeleteNews(item: ApiClubNews) {
    if (!id) return
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setNewsDeletingId(item.id)
    setError(null)
    try {
      await adminDeleteClubNews(id, item.id)
      setNews((prev) => prev.filter((n) => n.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete news')
    } finally {
      setNewsDeletingId(null)
    }
  }

  async function handlePostNews(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setNewsSaving(true)
    setError(null)
    try {
      await adminCreateClubNews(id, newsForm)
      setNewsForm({ title: '', newsDate: '', excerpt: '' })
      setNews(await adminGetClubNews(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post news')
    } finally {
      setNewsSaving(false)
    }
  }

  if (loading) return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-muted-foreground">Loading club…</p>
    </div>
  )

  if (!club) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <p className="text-destructive">{error ?? 'Club not found'}</p>
      <Button asChild className="mt-4" variant="outline">
        <Link to="/admin">Back to admin</Link>
      </Button>
    </div>
  )

  const color = form.color || LCA.gold

  const tabs: { id: ClubTab; label: string; icon: typeof Users }[] = [
    { id: 'details',     label: 'Club details',  icon: Building2  },
    { id: 'news',        label: 'Post news',      icon: Newspaper  },
    { id: 'roster',      label: `Roster (${roster.length})`, icon: Users },
    { id: 'tournaments', label: 'Tournaments',    icon: Trophy     },
  ]

  return (
    <div>
      {/* ── Hero ── */}
      <section
        className="border-b-[3px] text-white"
        style={{ backgroundColor: LCA.navy, borderBottomColor: color }}
      >
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-lca-gold"
          >
            <ArrowLeft className="size-3.5" /> Admin panel
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: color }}
            >
              <Building2 className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Manage {club.name}</h1>
              <p className="mt-0.5 text-sm text-white/55">{club.city}, LA</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-5 flex gap-1 border-t border-white/10 pt-1">
            {tabs.map(({ id: tid, label, icon: Icon }) => (
              <button
                key={tid}
                type="button"
                onClick={() => setTab(tid)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-medium transition-colors',
                  tab === tid
                    ? 'border-lca-gold text-lca-gold'
                    : 'border-transparent text-white/45 hover:text-white/70',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* ── Details tab ── */}
        {tab === 'details' && (
          <form onSubmit={handleSaveClub} className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-lca-navy">Basic information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Club name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="location">Meeting location</Label>
                  <Input id="location" placeholder="e.g. Alexandria Public Library, Room B" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="A brief description shown on the club's public page…"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="schedule">Meeting schedule</Label>
                  <Input id="schedule" placeholder="e.g. Tuesdays 6:00 PM" value={form.meetingSchedule} onChange={(e) => setForm((p) => ({ ...p, meetingSchedule: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Contact email</Label>
                  <Input id="email" type="email" value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="region">Region</Label>
                  <select
                    id="region"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.region}
                    onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                  >
                    <option value="">Select a region…</option>
                    {[
                      'North Louisiana',
                      'Central Louisiana',
                      'North of Lake Pontchartrain',
                      'New Orleans Metro',
                      'Southwest Louisiana',
                      'South Central Louisiana',
                      'Bayou Region',
                    ].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Club color */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Palette className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-lca-navy">Club color</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="h-10 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  placeholder="#c8a94a"
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                />
                <div
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}40`,
                    color,
                  }}
                >
                  <div className="size-3 rounded-full" style={{ backgroundColor: color }} />
                  {form.name || 'Club name'}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Appears as a tint on tournament cards and the club carousel. LCA gold is the default.
              </p>
            </div>

            {/* Club image */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Upload className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-lca-navy">Club image</h2>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Upload a logo or promotional photo. This appears at the top of your club's card in the carousel and in the hero of your club detail page. It's automatically resized and cropped — no need to prepare an exact size yourself.
              </p>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
              >
                {logoUploading ? 'Uploading…' : 'Choose image'}
              </Button>
              {logoError && <p className="mt-2 text-xs text-destructive">{logoError}</p>}
              {form.imageUrl && (
                <div className="mt-3 overflow-hidden rounded-lg border" style={{ maxWidth: 260 }}>
                  <img
                    src={form.imageUrl}
                    alt="Club image preview"
                    className="h-32 w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>

            <Button type="submit" className={goldButtonClass} disabled={saving}>
              {saving ? 'Saving…' : 'Save club'}
            </Button>

            <div className="pt-2">
              <Button asChild variant="outline">
                <Link to={`/clubs/${id}`}>View public club page</Link>
              </Button>
            </div>
          </form>
        )}

        {/* ── News tab ── */}
        {tab === 'news' && (
          <div className="space-y-4">
            {/*
              Posted news was previously invisible here — the tab only offered a
              form, so anything already published could not be reviewed or
              removed from the admin panel at all.
            */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Newspaper className="size-5 text-lca-gold" />
                <h2 className="text-base font-semibold text-lca-navy">
                  Posted news · {news.length}
                </h2>
              </div>
              {news.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing posted yet. Anything you publish below appears on the club's public page.
                </p>
              ) : (
                <ul className="divide-y">
                  {news.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium text-lca-navy">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.news_date}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.excerpt}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-shrink-0 text-red-600 hover:bg-red-50"
                        disabled={newsDeletingId === item.id}
                        onClick={() => handleDeleteNews(item)}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        {newsDeletingId === item.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          <form onSubmit={handlePostNews} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Newspaper className="size-5 text-lca-gold" />
              <h2 className="text-base font-semibold text-lca-navy">Post club news</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="news-title">Title</Label>
                <Input id="news-title" value={newsForm.title} onChange={(e) => setNewsForm((p) => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="news-date">Date</Label>
                <Input id="news-date" type="date" value={newsForm.newsDate} onChange={(e) => setNewsForm((p) => ({ ...p, newsDate: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="news-excerpt">Excerpt</Label>
                <textarea
                  id="news-excerpt"
                  className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={newsForm.excerpt}
                  onChange={(e) => setNewsForm((p) => ({ ...p, excerpt: e.target.value }))}
                  required
                />
              </div>
            </div>
            <Button type="submit" className={cn('mt-4', goldButtonClass)} disabled={newsSaving}>
              {newsSaving ? 'Posting…' : 'Post news'}
            </Button>
          </form>
          </div>
        )}

        {/* ── Roster tab ── */}
        {tab === 'roster' && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="size-5 text-lca-gold" />
              <h2 className="text-base font-semibold text-lca-navy">Club roster · {roster.length} members</h2>
            </div>
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members assigned to this club yet.</p>
            ) : (
              <ul className="divide-y">
                {roster.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    {m.uscf_rating && (
                      <span className="font-mono text-sm text-muted-foreground">{m.uscf_rating}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Tournaments tab ── */}
        {tab === 'tournaments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-lca-gold" />
                <h2 className="text-base font-semibold text-lca-navy">Club tournaments</h2>
              </div>
              <Link
                to="/admin"
                className="flex items-center gap-1 text-sm text-lca-navy hover:underline"
                onClick={() => {
                  sessionStorage.setItem('adminTab', 'tournaments')
                }}
              >
                Create new tournament →
              </Link>
            </div>

            {tournaments.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium text-lca-navy">No tournaments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a tournament for this club from the Admin panel.
                </p>
                <Button asChild className={cn('mt-4', goldButtonClass)} size="sm">
                  <Link to="/admin">Go to tournament management</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {tournaments.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div>
                      <p className="font-medium text-lca-navy">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.date} · {t.status}</p>
                    </div>
                    <Button asChild size="sm" className={goldButtonClass}>
                      <Link to={`/admin/tournaments/${t.id}`}>Manage</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}