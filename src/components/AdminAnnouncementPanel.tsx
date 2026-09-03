import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { adminGetAnnouncement, adminUpdateAnnouncement } from '@/lib/api'

export function AdminAnnouncementPanel() {
  const [enabled, setEnabled] = useState(false)
  const [message, setMessage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminGetAnnouncement()
      .then(({ announcement }) => {
        setEnabled(!!announcement.enabled)
        setMessage(announcement.message ?? '')
        setLinkUrl(announcement.link_url ?? '')
        setLinkLabel(announcement.link_label ?? '')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await adminUpdateAnnouncement({
        enabled,
        message,
        linkUrl: linkUrl || null,
        linkLabel: linkLabel || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading announcement settings…</p>

  return (
    <div className="max-w-xl space-y-4 rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-lca-navy">Site announcement banner</h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => { setEnabled((v) => !v); setSaved(false) }}
          className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-lca-gold' : 'bg-muted'}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="announcement-message">Message</Label>
        <textarea
          id="announcement-message"
          value={message}
          onChange={(e) => { setMessage(e.target.value); setSaved(false) }}
          rows={3}
          placeholder="Registration is now open for the Fall Scholastic Championship!"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="announcement-link-url">Link URL (optional)</Label>
          <input
            id="announcement-link-url"
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); setSaved(false) }}
            placeholder="/tournaments/abc123"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="announcement-link-label">Link text</Label>
          <input
            id="announcement-link-label"
            value={linkLabel}
            onChange={(e) => { setLinkLabel(e.target.value); setSaved(false) }}
            placeholder="Register now →"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSave} disabled={saving} className="bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90">
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </Button>

      <p className="text-xs text-muted-foreground">
        The banner shows site-wide when enabled. Visitors can dismiss it for their current browser session; it reappears automatically if you change the message.
      </p>
    </div>
  )
}