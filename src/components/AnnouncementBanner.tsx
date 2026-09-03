import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getAnnouncement, type ApiAnnouncement } from '@/lib/api'

const DISMISS_KEY = 'lca-announcement-dismissed'

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<ApiAnnouncement | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    getAnnouncement()
      .then(({ announcement }) => {
        setAnnouncement(announcement)
        if (announcement) {
          // Re-show automatically if the message changes, even if a past
          // announcement was dismissed this session.
          setDismissed(sessionStorage.getItem(DISMISS_KEY) === announcement.message)
        }
      })
      .catch(() => setAnnouncement(null))
  }, [])

  if (!announcement || dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, announcement!.message)
    setDismissed(true)
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-lca-gold px-4 py-2 text-center text-sm font-medium text-lca-navy">
      <span>
        {announcement.message}
        {announcement.linkUrl && announcement.linkLabel && (
          <>
            {' '}
            <a href={announcement.linkUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
  {announcement.linkLabel}
</a>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="flex-shrink-0 opacity-70 hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}