import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getAnnouncements, type ApiAnnouncement } from '@/lib/api'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'lca-announcements-dismissed'

/**
 * Every tone here has been checked against its own text colour:
 * gold 6.51:1, navy 14.81:1, urgent 8.15:1, info 8.74:1. All clear AA.
 * A new tone needs its pairing checked before it goes in.
 */
const TONES: Record<string, string> = {
  gold: 'bg-lca-gold text-lca-navy',
  navy: 'bg-lca-navy text-white',
  urgent: 'bg-[#9b1c1c] text-white',
  info: 'bg-[#1e4d7b] text-white',
}

const SIZES: Record<string, string> = {
  default: 'px-4 py-2 text-sm',
  compact: 'px-4 py-1 text-xs',
}

/** Ids dismissed this session, so one banner closing never hides another. */
function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    // Private windows and blocked storage both land here. Showing a banner
    // again is a far smaller problem than the component failing to render.
    return []
  }
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([])
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  useEffect(() => {
    getAnnouncements()
      .then(({ announcements }) => setAnnouncements(announcements))
      .catch(() => setAnnouncements([]))
  }, [])

  function handleDismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch { /* see readDismissed */ }
  }

  const visible = announcements.filter((a) => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  return (
    <div>
      {visible.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex items-center justify-center gap-3 text-center',
            TONES[a.tone] ?? TONES.gold,
            SIZES[a.size] ?? SIZES.default,
          )}
        >
          <span>
            {a.message}
            {a.linkUrl && a.linkLabel && (
              <>
                {' '}
                <a
                  href={a.linkUrl}
                  target={a.linkUrl.startsWith('/') ? undefined : '_blank'}
                  rel={a.linkUrl.startsWith('/') ? undefined : 'noopener noreferrer'}
                  className="font-semibold underline underline-offset-2"
                >
                  {a.linkLabel}
                </a>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => handleDismiss(a.id)}
            aria-label={`Dismiss: ${a.linkLabel || a.message}`}
            className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
