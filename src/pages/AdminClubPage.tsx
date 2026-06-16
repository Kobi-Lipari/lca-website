import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Newspaper, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminCreateClubNews,
  adminCreateTournament,
  adminGetClubRoster,
  adminUpdateClub,
  getClub,
  type ApiAdminMember,
  type ApiClubDetail,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function AdminClubPage() {
  const { id } = useParams<{ id: string }>()
  const [club, setClub] = useState<ApiClubDetail | null>(null)
  const [roster, setRoster] = useState<ApiAdminMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newsSaving, setNewsSaving] = useState(false)
  const [tournamentSaving, setTournamentSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    city: '',
    location: '',
    description: '',
    meetingSchedule: '',
    contactEmail: '',
  })

  const [newsForm, setNewsForm] = useState({
    title: '',
    newsDate: '',
    excerpt: '',
  })

  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    location: '',
    date: '',
    entryFee: '40',
  })

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const [clubData, rosterData] = await Promise.all([
          getClub(id!),
          adminGetClubRoster(id!),
        ])
        setClub(clubData.club)
        setForm({
          name: clubData.club.name,
          city: clubData.club.city,
          location: clubData.club.location ?? '',
          description: clubData.club.description ?? '',
          meetingSchedule: clubData.club.meeting_schedule ?? '',
          contactEmail: clubData.club.contact_email ?? '',
        })
        setRoster(rosterData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load club')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleSaveClub(event: FormEvent) {
    event.preventDefault()
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
      })
      setClub(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save club')
    } finally {
      setSaving(false)
    }
  }

  async function handlePostNews(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setNewsSaving(true)
    setError(null)
    try {
      await adminCreateClubNews(id, newsForm)
      setNewsForm({ title: '', newsDate: '', excerpt: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post news')
    } finally {
      setNewsSaving(false)
    }
  }

  async function handleCreateTournament(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setTournamentSaving(true)
    setError(null)
    try {
      await adminCreateTournament({
        name: tournamentForm.name,
        location: tournamentForm.location,
        date: tournamentForm.date,
        entryFee: Number(tournamentForm.entryFee),
        clubId: id,
      })
      setTournamentForm({ name: '', location: '', date: '', entryFee: '40' })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create tournament',
      )
    } finally {
      setTournamentSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading club...</p>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <p className="text-destructive">{error ?? 'Club not found'}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <Building2 className="size-8 text-[#c8a94a]" />
            <h1 className="text-3xl font-bold">Manage {club.name}</h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-10 px-6 py-12">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSaveClub}
          className="rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold text-[#1a2744]">Club details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="location">Meeting location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) =>
                  setForm((p) => ({ ...p, location: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Meeting schedule</Label>
              <Input
                id="schedule"
                value={form.meetingSchedule}
                onChange={(e) =>
                  setForm((p) => ({ ...p, meetingSchedule: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Contact email</Label>
              <Input
                id="email"
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((p) => ({ ...p, contactEmail: e.target.value }))
                }
              />
            </div>
          </div>
          <Button type="submit" className={cn('mt-4', goldButtonClass)} disabled={saving}>
            {saving ? 'Saving...' : 'Save club'}
          </Button>
        </form>

        <form
          onSubmit={handlePostNews}
          className="rounded-xl border bg-card p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Newspaper className="size-5 text-[#c8a94a]" />
            <h2 className="text-lg font-bold text-[#1a2744]">Post club news</h2>
          </div>
          <div className="mt-4 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="news-title">Title</Label>
              <Input
                id="news-title"
                value={newsForm.title}
                onChange={(e) =>
                  setNewsForm((p) => ({ ...p, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-date">Date</Label>
              <Input
                id="news-date"
                value={newsForm.newsDate}
                onChange={(e) =>
                  setNewsForm((p) => ({ ...p, newsDate: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-excerpt">Excerpt</Label>
              <textarea
                id="news-excerpt"
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newsForm.excerpt}
                onChange={(e) =>
                  setNewsForm((p) => ({ ...p, excerpt: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            className={cn('mt-4', goldButtonClass)}
            disabled={newsSaving}
          >
            {newsSaving ? 'Posting...' : 'Post news'}
          </Button>
        </form>

        <form
          onSubmit={handleCreateTournament}
          className="rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="text-lg font-bold text-[#1a2744]">
            Create club tournament
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ct-name">Name</Label>
              <Input
                id="ct-name"
                value={tournamentForm.name}
                onChange={(e) =>
                  setTournamentForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-location">Location</Label>
              <Input
                id="ct-location"
                value={tournamentForm.location}
                onChange={(e) =>
                  setTournamentForm((p) => ({ ...p, location: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-date">Date</Label>
              <Input
                id="ct-date"
                value={tournamentForm.date}
                onChange={(e) =>
                  setTournamentForm((p) => ({ ...p, date: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-fee">Entry fee ($)</Label>
              <Input
                id="ct-fee"
                type="number"
                value={tournamentForm.entryFee}
                onChange={(e) =>
                  setTournamentForm((p) => ({ ...p, entryFee: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            className={cn('mt-4', goldButtonClass)}
            disabled={tournamentSaving}
          >
            {tournamentSaving ? 'Creating...' : 'Create tournament'}
          </Button>
        </form>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-[#c8a94a]" />
            <h2 className="text-lg font-bold text-[#1a2744]">Club roster</h2>
          </div>
          {roster.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No members assigned to this club yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y">
              {roster.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <span className="font-medium">{m.full_name}</span>
                  <span className="text-muted-foreground"> · {m.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button asChild variant="outline">
          <Link to={`/clubs/${id}`}>View public club page</Link>
        </Button>
      </section>
    </div>
  )
}
